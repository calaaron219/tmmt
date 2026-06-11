// AI day planner (Phase 3 PR #6). Asks Gemini to propose a schedule of
// TimeBlocks for today given the user's open tasks, existing blocks,
// and working hours. Mirrors lib/ai-categorizer.ts: same SDK, same
// safety net (returns { proposals: [] } if anything goes wrong rather
// than throwing — the UI handles the empty case gracefully).
//
// Output is NOT persisted by this layer. The caller (planMyDay server
// action) returns the proposals to the UI; the user reviews them and
// explicitly clicks "Apply" to persist via the existing createTimeBlock
// path (which re-validates ownership + bounds).

import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import type {
  LlmPlanner,
  PlanningRequest,
  PlanningResult,
} from "@tmmt/shared";

const HHMM = /^\d{2}:\d{2}$/;

const proposedBlockSchema = z.object({
  taskId: z
    .string()
    .nullable()
    .describe(
      "The id of one of the openTasks, or null for a free-form block (e.g. lunch, break). Copy verbatim from the input."
    ),
  title: z
    .string()
    .min(1)
    .max(200)
    .describe(
      "Short title for the block. If linked to a task, usually the task's title."
    ),
  startHhMm: z
    .string()
    .regex(HHMM)
    .describe(
      "Start time as HH:MM in 24-hour UTC. Must be ≥ workingHoursStart."
    ),
  endHhMm: z
    .string()
    .regex(HHMM)
    .describe(
      "End time as HH:MM in 24-hour UTC. Must be > startHhMm and ≤ workingHoursEnd."
    ),
  reasoning: z
    .string()
    .min(1)
    .max(300)
    .describe(
      "One short sentence on why this block is placed here (e.g. priority, due date, energy fit)."
    ),
});

const responseSchema = z.object({
  proposals: z
    .array(proposedBlockSchema)
    .describe("Ordered chronologically. May be empty if nothing fits."),
  summary: z
    .string()
    .max(280)
    .optional()
    .describe("Optional one-liner summarizing the plan's intent."),
});

// Helpers for the post-model sanity pass. The model is usually well-behaved
// thanks to generateObject, but we belt-and-suspender anything that affects
// persistence: time format, day window, overlap with existing blocks.
function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(
  startMin: number,
  endMin: number,
  windows: Array<{ startMin: number; endMin: number }>
): boolean {
  return windows.some((w) => startMin < w.endMin && endMin > w.startMin);
}

class GeminiPlanner implements LlmPlanner {
  async planDay(req: PlanningRequest): Promise<PlanningResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { proposals: [] };
    }
    if (req.openTasks.length === 0) {
      return { proposals: [] };
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const model = google("gemini-2.5-flash");

    const tasksJson = JSON.stringify(req.openTasks, null, 2);
    const blocksJson =
      req.existingBlocks.length === 0
        ? "(none)"
        : JSON.stringify(req.existingBlocks, null, 2);

    const prompt = [
      `You are a calm, opinionated personal day-planner. Plan today (${req.date}, UTC).`,
      "",
      `Working window: ${req.workingHoursStart}–${req.workingHoursEnd} (UTC, 24h).`,
      "All proposed blocks MUST fall inside this window and MUST NOT overlap the existingBlocks below.",
      "",
      "Heuristics (in priority order):",
      "1. Anything due TODAY comes first.",
      "2. HIGH priority before MEDIUM before LOW.",
      "3. Use the task's estimateMinutes when set; otherwise default to 60 minutes for HIGH, 45 for MEDIUM, 30 for LOW.",
      "4. Group similar work; avoid context-switching whiplash.",
      "5. Schedule one free-form ~45-min break around midday if the working window allows.",
      "6. Don't over-pack. Leaving 20–30% of the window unscheduled is fine — better than a fictional plan.",
      "7. Skip tasks whose estimate alone would overflow the remaining window.",
      "",
      "Output JSON with one entry per proposed block. taskId MUST be one of the openTasks ids OR null (for free-form). Times are UTC HH:MM, 15-minute granularity.",
      "",
      "Open tasks:",
      tasksJson,
      "",
      "Existing blocks (already on the calendar — do not overlap these):",
      blocksJson,
    ].join("\n");

    try {
      const { object } = await generateObject({
        model,
        schema: responseSchema,
        prompt,
      });

      // Post-model sanity pass. Anything that fails a check is dropped
      // rather than failing the whole plan — degrade gracefully.
      const winStart = hhmmToMinutes(req.workingHoursStart);
      const winEnd = hhmmToMinutes(req.workingHoursEnd);
      const taskIds = new Set(req.openTasks.map((t) => t.id));
      const existingWindows = req.existingBlocks.map((b) => ({
        startMin: hhmmToMinutes(b.startHhMm),
        endMin: hhmmToMinutes(b.endHhMm),
      }));
      const proposedSoFar: Array<{ startMin: number; endMin: number }> = [];

      const clean = object.proposals.filter((p) => {
        if (p.taskId !== null && !taskIds.has(p.taskId)) return false;
        const s = hhmmToMinutes(p.startHhMm);
        const e = hhmmToMinutes(p.endHhMm);
        if (e <= s) return false;
        if (s < winStart || e > winEnd) return false;
        if (overlaps(s, e, existingWindows)) return false;
        if (overlaps(s, e, proposedSoFar)) return false;
        proposedSoFar.push({ startMin: s, endMin: e });
        return true;
      });

      return {
        proposals: clean,
        summary: object.summary,
      };
    } catch (err) {
      console.error("[ai-planner] failed:", err);
      return { proposals: [] };
    }
  }
}

export const aiPlanner: LlmPlanner = new GeminiPlanner();
