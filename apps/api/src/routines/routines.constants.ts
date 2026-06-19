export const ROUTINES_QUEUE = 'routines';

export const RoutineJob = {
  /** Daily fan-over-all-users routine-task generation. */
  GenerateDaily: 'generate-daily',
} as const;

export type RoutineJobName = (typeof RoutineJob)[keyof typeof RoutineJob];
