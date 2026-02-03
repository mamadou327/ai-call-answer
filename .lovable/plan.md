
## Goal
Stop the AI phone calls from cutting off mid-call and make long calls (up to ~30 minutes) realistically possible.

## ✅ IMPLEMENTED

### Changes Made

#### 1. `twilio-stream-action/index.ts`
- ✅ Increased `MAX_RECONNECTS` from 4 to **10** (supports 10+ stream rotations = 18+ minutes)
- ✅ Added exponential backoff with `getReconnectPauseDuration()` (1s → 3s max)
- ✅ Added "One moment please" spoken message on reconnects (skipped on first for speed)
- ✅ Better logging with pause duration and reconnect count

#### 2. `twilio-media-stream/index.ts`
- ✅ Added **proactive stream rotation** every 110 seconds (before the ~2-3 min platform drop)
- ✅ New constants: `STREAM_ROTATION_ENABLED`, `STREAM_ROTATION_INTERVAL_MS` (110s), `STREAM_ROTATION_CHECK_INTERVAL_MS` (10s)
- ✅ New session fields: `streamStartedAt`, `streamRotationCheckIntervalId`, `isRotating`
- ✅ New functions: `startStreamRotationCheck()`, `stopStreamRotationCheck()`
- ✅ Enhanced logging with stream age in seconds on stop/close events
- ✅ Proper cleanup of rotation interval in stop/close handlers

### How It Works
1. When a stream starts, `streamStartedAt` is set to `Date.now()`
2. Every 10 seconds, `startStreamRotationCheck()` compares stream age to 110s threshold
3. When threshold is exceeded, the system:
   - Logs `[rotation]` event to `call_conversations`
   - Stops all intervals (keepalive, silence, rotation)
   - Closes Twilio WebSocket with reason `proactive_rotation`
4. Twilio then hits `twilio-stream-action` with incremented reconnect count
5. `twilio-stream-action` plays "One moment please" (on 2nd+ reconnect) and restarts stream
6. New stream begins with fresh 110s timer, context rehydrated from `call_conversations`

### Expected Behavior
- Calls can now last **30+ minutes** by stitching together multiple ~110s stream segments
- Caller hears brief "One moment please" every ~2 minutes (imperceptible with fast reconnects)
- Context (order details, conversation history) survives across rotations via rehydration
- Logs show `[rotation]` and `[reconnect]` events for debugging

## Testing Checklist
- [ ] 5-minute call with ordering
- [ ] 10-minute call with pauses
- [ ] 20-30 minute extended call
- [ ] Verify `[rotation]` events in `call_conversations.messages`
- [ ] Verify reconnect count increments properly
- [ ] Confirm no "dead air" longer than 2-3 seconds
