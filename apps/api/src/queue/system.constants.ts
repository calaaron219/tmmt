/**
 * Shared identifiers for the `system` queue — a lightweight liveness queue.
 * (PR #1 also had a demo `heartbeat`; PR #2 retired it now that the `routines`
 * queue is the real scheduled work.)
 */
export const SYSTEM_QUEUE = 'system';

export const SystemJob = {
  /** One-off job enqueued on every boot — proves producer → Redis → worker. */
  Ping: 'ping',
} as const;

export type SystemJobName = (typeof SystemJob)[keyof typeof SystemJob];
