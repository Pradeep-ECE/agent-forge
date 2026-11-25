import { z } from "zod";
import { searchUserDocuments } from "../../services/document.service.js";

const documentSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(500),
  topK: z.number().int().min(1).max(8).optional().default(4),
});

export async function executeDocumentSearch(rawArgs, context = {}) {
  const { userId, agentId = null } = context;
  if (!userId) {
    throw new Error("TOOL_CONTEXT_ERROR: Missing authenticated userId");
  }

  const parsed = documentSearchInputSchema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    throw new Error(
      `TOOL_VALIDATION_ERROR: ${parsed.error.issues[0]?.message || "Invalid input"}`
    );
  }

  const matches = await searchUserDocuments({
    userId,
    agentId,
    query: parsed.data.query,
    topK: parsed.data.topK,
  });

  if (matches.length === 0) {
    return {
      query: parsed.data.query,
      matchCount: 0,
      results: [],
      message:
        "No relevant information found in the documents linked to this agent.",
    };
  }

  return {
    query: parsed.data.query,
    matchCount: matches.length,
    results: matches.map((m) => ({
      documentId: m.documentId,
      documentTitle: m.documentTitle,
      documentFileName: m.documentFileName,
      chunkIndex: m.chunkIndex,
      relevanceScore: m.score,
      content: m.content,
    })),
  };
}