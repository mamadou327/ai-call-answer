// ============================================================================
// ElevenLabs Flash v2.5 streaming TTS adapter for the Twilio media stream.
//
// PURPOSE
// -------
// When a business has the `use_elevenlabs_voice` flag turned on, OpenAI Realtime
// is configured for TEXT-ONLY output. We pipe OpenAI's text deltas into this
// adapter, which streams them to ElevenLabs over WebSocket and forwards the
// resulting μ-law 8kHz audio chunks straight to Twilio in the same `media`
// envelope the existing OpenAI-audio path uses.
//
// SAFETY
// ------
// - Lives in its own file so the existing OpenAI audio path in index.ts stays
//   100% untouched. Easy to delete if we ever want to roll back.
// - Auto-reconnects with exponential backoff (mirrors OpenAI reconnect pattern).
// - Never throws across session boundaries — all errors are logged.
// - Tracks character usage for cost monitoring (calls_log.elevenlabs_chars_used).
// ============================================================================

const ELEVENLABS_WS_BASE = "wss://api.elevenlabs.io/v1/text-to-speech";
const FLASH_MODEL_ID = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "ulaw_8000"; // matches Twilio media stream natively

// Reconnect / backoff
const MAX_RECONNECT_ATTEMPTS = 4;
const BASE_RECONNECT_DELAY_MS = 500;

export interface ElevenLabsAdapterOptions {
  apiKey: string;
  voiceId: string;
  // Forward an audio chunk to Twilio. payload is base64 μ-law 8kHz.
  onAudioChunk: (base64Payload: string) => void;
  // Called when ElevenLabs signals the synthesized response is fully done.
  onResponseComplete?: () => void;
  // Called for diagnostics/logging.
  onLog?: (message: string, meta?: Record<string, unknown>) => void;
  // Called when a fatal error happens (e.g. all reconnects failed).
  onFatalError?: (error: Error) => void;
  // Optional voice settings tuning per business.
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
    speed?: number;
  };
}

interface InternalState {
  ws: WebSocket | null;
  ready: boolean;
  // Text buffered while WS is (re)connecting — flushed on open.
  pendingText: string[];
  // True after we've sent the "" terminator for the current utterance.
  flushed: boolean;
  reconnectAttempts: number;
  charsThisUtterance: number;
  totalCharsUsed: number;
  audioChunkCount: number;
  utteranceStartedAt: number | null;
  firstAudioAt: number | null;
}

export class ElevenLabsTTS {
  private opts: ElevenLabsAdapterOptions;
  private state: InternalState;
  private isClosed = false;

  constructor(opts: ElevenLabsAdapterOptions) {
    this.opts = opts;
    this.state = {
      ws: null,
      ready: false,
      pendingText: [],
      flushed: false,
      reconnectAttempts: 0,
      charsThisUtterance: 0,
      totalCharsUsed: 0,
      audioChunkCount: 0,
      utteranceStartedAt: null,
      firstAudioAt: null,
    };
    this.connect();
  }

  /** Total characters synthesized across the lifetime of this adapter. */
  getTotalCharsUsed(): number {
    return this.state.totalCharsUsed;
  }

  /**
   * Push a text fragment into the TTS stream. Safe to call as deltas arrive
   * from OpenAI — ElevenLabs Flash starts synthesizing as soon as it has a few
   * words.
   */
  pushText(text: string): void {
    if (!text || this.isClosed) return;

    if (this.state.utteranceStartedAt === null) {
      this.state.utteranceStartedAt = Date.now();
    }
    this.state.charsThisUtterance += text.length;
    this.state.totalCharsUsed += text.length;
    this.state.flushed = false;

    if (this.state.ready && this.state.ws?.readyState === WebSocket.OPEN) {
      try {
        this.state.ws.send(JSON.stringify({ text }));
      } catch (err) {
        this.log("send-failed", { error: String(err) });
        this.state.pendingText.push(text);
      }
    } else {
      this.state.pendingText.push(text);
    }
  }

  /**
   * Tell ElevenLabs the current utterance is finished — it will flush remaining
   * audio for this utterance. We do NOT close the socket here; we keep it open
   * for the next utterance to avoid reconnect latency.
   */
  endUtterance(): void {
    if (this.isClosed || this.state.flushed) return;
    this.state.flushed = true;

    if (this.state.ready && this.state.ws?.readyState === WebSocket.OPEN) {
      try {
        // Empty text marks end-of-input for ElevenLabs streaming TTS.
        this.state.ws.send(JSON.stringify({ text: "" }));
      } catch (err) {
        this.log("end-utterance-failed", { error: String(err) });
      }
    }
  }

  /**
   * Hard interrupt: caller barged in. Close the current WS so any in-flight
   * audio chunks are discarded, then immediately open a fresh socket so the
   * next response has minimal startup latency.
   */
  interrupt(): void {
    if (this.isClosed) return;
    this.log("interrupt", {
      audioChunkCount: this.state.audioChunkCount,
      charsThisUtterance: this.state.charsThisUtterance,
    });
    this.resetUtteranceCounters();
    this.forceCloseSocket("interrupted-by-user");
    // Re-open immediately so we're warm for the next response.
    this.reconnectAttempts = 0;
    this.connect();
  }

  /** Called by the parent when the call ends. */
  close(): void {
    this.isClosed = true;
    this.forceCloseSocket("session-ended");
    this.log("closed", { totalCharsUsed: this.state.totalCharsUsed });
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private set reconnectAttempts(n: number) {
    this.state.reconnectAttempts = n;
  }

  private connect(): void {
    if (this.isClosed) return;

    const url = `${ELEVENLABS_WS_BASE}/${this.opts.voiceId}/stream-input?model_id=${FLASH_MODEL_ID}&output_format=${OUTPUT_FORMAT}&inactivity_timeout=60`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      this.log("ws-create-failed", { error: String(err) });
      this.scheduleReconnect();
      return;
    }
    this.state.ws = ws;
    this.state.ready = false;

    ws.onopen = () => {
      this.log("ws-open", { voiceId: this.opts.voiceId });
      // ElevenLabs requires an init frame containing API key + voice settings.
      const initFrame = {
        text: " ", // priming whitespace per ElevenLabs streaming protocol
        voice_settings: this.opts.voiceSettings ?? {
          stability: 0.5,
          similarity_boost: 0.8,
          speed: 1.0,
          use_speaker_boost: true,
        },
        // Lower chunk_length_schedule = lower first-audio latency.
        generation_config: {
          chunk_length_schedule: [120, 160, 250, 290],
        },
        xi_api_key: this.opts.apiKey,
      };

      try {
        ws.send(JSON.stringify(initFrame));
        this.state.ready = true;
        this.state.reconnectAttempts = 0;

        // Flush anything that arrived before the socket was ready.
        if (this.state.pendingText.length > 0) {
          const buffered = this.state.pendingText.join("");
          this.state.pendingText = [];
          ws.send(JSON.stringify({ text: buffered }));
        }
        if (this.state.flushed) {
          ws.send(JSON.stringify({ text: "" }));
        }
      } catch (err) {
        this.log("init-frame-failed", { error: String(err) });
      }
    };

    ws.onmessage = (event) => {
      let payload: any;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : null;
      } catch {
        return;
      }
      if (!payload) return;

      if (payload.audio) {
        // ElevenLabs sends base64 μ-law 8kHz — exactly what Twilio expects.
        if (this.state.firstAudioAt === null && this.state.utteranceStartedAt) {
          this.state.firstAudioAt = Date.now();
          this.log("first-audio", {
            latencyMs: this.state.firstAudioAt - this.state.utteranceStartedAt,
          });
        }
        this.state.audioChunkCount++;
        try {
          this.opts.onAudioChunk(payload.audio);
        } catch (err) {
          this.log("forward-failed", { error: String(err) });
        }
      }

      if (payload.isFinal) {
        this.log("response-complete", {
          chunks: this.state.audioChunkCount,
          chars: this.state.charsThisUtterance,
        });
        this.opts.onResponseComplete?.();
        this.resetUtteranceCounters();
      }

      if (payload.error) {
        this.log("ws-error-payload", { error: payload.error });
      }
    };

    ws.onerror = (event) => {
      this.log("ws-error", { event: String((event as ErrorEvent).message ?? event) });
    };

    ws.onclose = (event) => {
      this.log("ws-close", { code: event.code, reason: event.reason });
      this.state.ready = false;
      this.state.ws = null;
      if (!this.isClosed) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.isClosed) return;
    if (this.state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      const err = new Error(
        `ElevenLabs WS reconnect failed after ${MAX_RECONNECT_ATTEMPTS} attempts`
      );
      this.log("reconnect-exhausted");
      this.opts.onFatalError?.(err);
      return;
    }
    const attempt = ++this.state.reconnectAttempts;
    const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt - 1);
    this.log("reconnect-scheduled", { attempt, delayMs: delay });
    setTimeout(() => this.connect(), delay);
  }

  private forceCloseSocket(reason: string): void {
    const ws = this.state.ws;
    this.state.ws = null;
    this.state.ready = false;
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      try {
        ws.close(1000, reason);
      } catch {
        // ignore
      }
    }
  }

  private resetUtteranceCounters(): void {
    this.state.audioChunkCount = 0;
    this.state.charsThisUtterance = 0;
    this.state.utteranceStartedAt = null;
    this.state.firstAudioAt = null;
    this.state.flushed = false;
  }

  private log(event: string, meta: Record<string, unknown> = {}): void {
    this.opts.onLog?.(`[ElevenLabsTTS] ${event}`, meta);
  }
}
