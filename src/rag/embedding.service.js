import { ai } from "../config/ai.js";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSION = 768;

/**
 * Splits raw document text into overlapping, boundary-aware chunks.
 */
export function chunkText(
  rawText,
  { chunkSize = 800, overlap = 150 } = {}
) {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= chunkSize) {
    return [normalized];
  }

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      const slice = normalized.slice(start, end);
      const lastParagraph = slice.lastIndexOf("\n\n");
      const lastSentence = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf(".\n"),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("! ")
      );
      const lastSpace = slice.lastIndexOf(" ");

      const minCut = Math.floor(chunkSize * 0.5);

      if (lastParagraph >= minCut) {
        end = start + lastParagraph + 2;
      } else if (lastSentence >= minCut) {
        end = start + lastSentence + 1;
      } else if (lastSpace >= minCut) {
        end = start + lastSpace;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

/**
 * Generates a 768-dimensional Gemini embedding vector.
 * Use taskType = 'RETRIEVAL_DOCUMENT' when indexing chunks,
 * and taskType = 'RETRIEVAL_QUERY' when embedding search queries.
 */
export async function generateEmbedding(
  text,
  { taskType = "RETRIEVAL_DOCUMENT" } = {}
) {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType,
      outputDimensionality: EMBEDDING_DIMENSION,
    },
  });

  const values = response.embeddings?.[0]?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("EMBEDDING_GENERATION_FAILED");
  }

  return values;
}

/**
 * Computes cosine similarity between two equal-length numeric vectors.
 */
export function computeCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}