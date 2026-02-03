

# Fix: Phone Call Stability - Prevent 2-Minute Dropouts

## Problem Identified

Based on today's call logs, I can see exactly what's happening:

- Calls are dropping/becoming unstable around the 2-minute mark
- OpenAI WebSocket connections are closing unexpectedly
- The system enters a reconnect loop (in-place OpenAI reconnect, then stream reconnect)
- During reconnects, the AI stops responding and the caller experiences silence

**Today's Example:**
```
17:17:11 - AI responds "Yoghurt Sauce, excellent choice!"
17:17:13 - [reconnect] Stream reconnecting (attempt 1/4)
17:17:25 - [reconnect] In-place OpenAI reconnect attempt 1/3
17:17:26 - [reconnect] Stream reconnecting (attempt 2/4)
```

## Root Causes

1. **OpenAI Realtime API WebSocket instability** - The connection drops after ~2 minutes of continuous streaming
2. **No heartbeat/keepalive mechanism** - Nothing is pinging the OpenAI connection to keep it alive
3. **Aggressive token limits** - The summarization threshold may be triggering during active conversation
4. **Reconnect delay too short** - 700ms delay between reconnect attempts may not be enough for the server to stabilize

## Solution

### 1. Add WebSocket Keepalive Pings

Send periodic "ping" events to OpenAI to keep the connection alive. OpenAI's Realtime API supports this.

```typescript
// Send keepalive every 30 seconds
const KEEPALIVE_INTERVAL_MS = 30000;
let keepaliveInterval: number | null = null;

function startKeepalive(ws: WebSocket) {
  stopKeepalive();
  keepaliveInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      // Send empty input_audio_buffer.commit as keepalive
      // Or use response.cancel which is a no-op if nothing is running
      ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      console.log("[MediaStream] Keepalive sent");
    }
  }, KEEPALIVE_INTERVAL_MS);
}
```

### 2. Increase Reconnect Resilience

- Increase delay between reconnect attempts from 700ms to 1500ms
- Add exponential backoff for reconnect attempts
- Increase max in-place reconnects from 3 to 5

### 3. Handle Long Silences Better

If no audio is received for 10+ seconds, proactively check the connection and prompt the caller:

```typescript
// If no audio events for 10 seconds, check health
if (timeSinceLastAudio > 10000 && !session.isAISpeaking) {
  sendProactivePrompt("Are you still there?");
}
```

### 4. Session Timeout Extension

OpenAI Realtime sessions may have an implicit timeout. We'll add periodic "activity" to prevent server-side timeouts:

- Commit empty audio buffers periodically
- Log connection health metrics

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/twilio-media-stream/index.ts` | Add keepalive pings, improve reconnect logic, add silence detection |

## Technical Implementation

### Keepalive Mechanism

```typescript
const KEEPALIVE_INTERVAL = 25000; // 25 seconds

let keepaliveTimer: number | null = null;

function startKeepalive() {
  stopKeepalive();
  keepaliveTimer = setInterval(() => {
    if (session.openAiWs?.readyState === WebSocket.OPEN) {
      session.openAiWs.send(JSON.stringify({ 
        type: "input_audio_buffer.commit" 
      }));
      console.log("[MediaStream] Keepalive ping sent");
    }
  }, KEEPALIVE_INTERVAL);
}

function stopKeepalive() {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
}
```

### Improved Reconnect Logic

```typescript
const MAX_OPENAI_RECONNECT_ATTEMPTS = 5; // Increased from 3
const BASE_DELAY_MS = 1500; // Increased from 700

// Exponential backoff
const delayMs = BASE_DELAY_MS * Math.pow(1.5, session.openAiReconnectAttempts);
```

### Silence Detection

```typescript
// Track last audio activity
session.lastAudioReceivedAt = Date.now();

// In media event handler
case "media":
  session.lastAudioReceivedAt = Date.now();
  break;

// Periodic check (every 5 seconds)
setInterval(() => {
  const silenceDuration = Date.now() - (session.lastAudioReceivedAt || Date.now());
  if (silenceDuration > 10000 && !session.isAISpeaking) {
    // Connection may be stale, proactively check
    if (session.openAiWs?.readyState !== WebSocket.OPEN) {
      scheduleOpenAiReconnect("stale_connection");
    }
  }
}, 5000);
```

## Expected Results

- Calls should stay stable for 10+ minutes instead of dropping at 2 minutes
- Keepalive pings will prevent server-side connection timeouts
- Better reconnect logic will recover faster when issues do occur
- Silence detection will catch stale connections before the caller notices

