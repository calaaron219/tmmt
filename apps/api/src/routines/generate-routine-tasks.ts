import type { PrismaClient } from '@prisma/client';

/**
 * ⚠️ KEEP IN SYNC WITH apps/web/src/app/app/time/actions.ts → ensureTodayRoutineTasks
 *
 * Deliberately duplicated (not shared via a package) per the Phase 4 PR #2
 * decision to avoid build-ifying @tmmt/db. The web app runs this lazily on
 * page load; the worker runs it on a daily cron. Both must stay identical —
 * if you change the generation rules here, change them there too.
 *
 * Idempotent per (routine, UTC day): a routine is only generated once per UTC
 * day, guarded by `lastGeneratedFor` plus an in-transaction re-check, so the
 * cron and the lazy page-load path can both run without creating duplicates.
 *
 * Takes the PrismaClient as a parameter (DI) so the worker passes its own
 * PrismaService and the web passes @tmmt/db's singleton.
 */
export async function generateTodayRoutineTasks(
  prisma: PrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  // Today's UTC midnight. UTC because Task/TimeEntry timestamps are stored in
  // UTC; a user-local day boundary needs the per-user TZ column (Phase 4 PR #5).
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const due = await prisma.routine.findMany({
    where: {
      userId,
      OR: [{ lastGeneratedFor: null }, { lastGeneratedFor: { lt: todayUtc } }],
    },
  });

  if (due.length === 0) return 0;

  // Per-routine transaction: create the task and stamp lastGeneratedFor
  // together so a crash mid-loop can't leave a routine stamped but task-less.
  let created = 0;
  for (const r of due) {
    await prisma.$transaction(async (tx) => {
      // Defensive re-check inside the tx: if a parallel run (e.g. the user
      // opened the app just as the cron fired) already bumped this routine,
      // skip without creating a duplicate task.
      const fresh = await tx.routine.findUnique({
        where: { id: r.id },
        select: { lastGeneratedFor: true },
      });
      if (fresh?.lastGeneratedFor && fresh.lastGeneratedFor >= todayUtc) {
        return;
      }

      await tx.task.create({
        data: {
          userId,
          title: r.title,
          description: r.description,
          priority: r.priority,
          estimateMinutes: r.estimateMinutes,
          projectId: r.projectId,
          routineId: r.id,
        },
      });
      await tx.routine.update({
        where: { id: r.id },
        data: { lastGeneratedFor: todayUtc },
      });
      created++;
    });
  }
  return created;
}
