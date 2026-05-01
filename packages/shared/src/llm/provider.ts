// LLM provider contracts shared across web + api.
// The interface is provider-agnostic so the implementation can swap
// (Gemini → Claude → OpenAI) without touching callers.

export type CategorizationCategory = {
  id: string;
  name: string;
};

export type CategorizationRequest = {
  rawDescription: string;
  merchant?: string | null;
  amountCents: number;
  type: "INCOME" | "EXPENSE";
  availableCategories: CategorizationCategory[];
};

export type CategorizationResult = {
  // null when the model wasn't confident or no key is configured.
  categoryId: string | null;
  // 0..1, calibrated by the model itself — treat as advisory.
  confidence: number;
  reasoning?: string;
};

export interface LlmCategorizer {
  categorize(req: CategorizationRequest): Promise<CategorizationResult>;
}
