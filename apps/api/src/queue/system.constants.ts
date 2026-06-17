/**
 * Shared identifiers for the `system` queue.
 *
 * The producer (system.bootstrap), the worker (system.processor), and the
 * health check all import these literals so the queue + job names can never
 * drift apart.
 */
export const SYSTEM_QUEUE = 'system';

export const SystemJob = {
  /** One-off job enqueued on every boot — proves producer → Redis → worker. */
  Ping: 'ping',
  /** Repeatable job — proves the scheduler mechanism PR #2's routine cron uses. */
  Heartbeat: 'heartbeat',
} as const;

export type SystemJobName = (typeof SystemJob)[keyof typeof SystemJob];
