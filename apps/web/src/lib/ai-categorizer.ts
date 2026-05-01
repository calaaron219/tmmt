// AI categorizer fallback (Phase 2). Used when the rule-based categorizer
// (lib/categorizer.ts) returns null. Asks Gemini to pick a category name
// from the user's list, then maps the name back to a category id.
//
// Safe by design: if GEMINI_API_KEY is missing or the model errors out,
// returns { categoryId: null } so the caller can fall through to leaving
// the transaction uncategorized — the user's flow is never broken.

import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import type {
  LlmCategorizer,
  CategorizationRequest,
  CategorizationResult,
} from "@tmmt/shared";

// Below this, leave the txn uncategorized rather than commit a low-confidence guess.
const MIN_CONFIDENCE = 0.6;

const responseSchema = z.object({
  categoryName: z
    .string()
    .nullable()
    .describe(
      "The exact name of the best-matching category from the provided list, or null if none fit."
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Self-assessed confidence that the chosen category is correct. 0 = wild guess, 1 = certain."
    ),
  reasoning: z
    .string()
    .optional()
    .describe("One short sentence explaining the choice."),
});

class GeminiCategorizer implements LlmCategorizer {
  async categorize(req: CategorizationRequest): Promise<CategorizationResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { categoryId: null, confidence: 0 };
    }
    if (req.availableCategories.length === 0) {
      return { categoryId: null, confidence: 0 };
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const model = google("gemini-2.5-flash");

    const dollars = (req.amountCents / 100).toFixed(2);
    const categoryList = req.availableCategories
      .map((c) => `- ${c.name}`)
      .join("\n");

    const prompt = [
      `You are categorizing a personal-finance ${req.type === "INCOME" ? "income" : "expense"} transaction.`,
      "",
      "Transaction:",
      `- Description: ${req.rawDescription}`,
      req.merchant ? `- Merchant: ${req.merchant}` : null,
      `- Amount: $${dollars}`,
      "",
      "Available categories (pick exactly one name, copying it verbatim):",
      categoryList,
      "",
      "If none of the categories clearly fit, return null for categoryName.",
      "Be conservative: low confidence is fine — the system will leave it uncategorized.",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { object } = await generateObject({
        model,
        schema: responseSchema,
        prompt,
      });

      if (!object.categoryName || object.confidence < MIN_CONFIDENCE) {
        return {
          categoryId: null,
          confidence: object.confidence,
          reasoning: object.reasoning,
        };
      }

      const match = req.availableCategories.find(
        (c) => c.name.toLowerCase() === object.categoryName!.toLowerCase()
      );
      if (!match) {
        return {
          categoryId: null,
          confidence: object.confidence,
          reasoning: object.reasoning,
        };
      }

      return {
        categoryId: match.id,
        confidence: object.confidence,
        reasoning: object.reasoning,
      };
    } catch (err) {
      console.error("[ai-categorizer] failed:", err);
      return { categoryId: null, confidence: 0 };
    }
  }
}

export const aiCategorizer: LlmCategorizer = new GeminiCategorizer();
