import { withUserTransaction } from "../config/database.js";
import {
  chunkText,
  computeCosineSimilarity,
  generateEmbedding,
} from "../rag/embedding.service.js";
import { findAgentById } from "../repositories/agent.repository.js";
import {
  findDocumentIdsByAgentId,
  findDocumentsByAgentId,
  linkDocumentToAgent,
  unlinkDocumentFromAgent,
} from "../repositories/agent-document.repository.js";
import {
  createDocumentWithChunks,
  deleteDocumentById,
  findAllChunksByUserId,
  findDocumentById,
  findDocumentsByUserId,
} from "../repositories/document.repository.js";

const MAX_CHUNKS_PER_DOCUMENT = 100;

/**
 * Splits raw content into chunks, generates Gemini embeddings outside the DB transaction,
 * and persists the document + chunks atomically under user isolation.
 */
export async function ingestDocument({
  userId,
  title,
  content,
  sourceType = "text",
  fileName = null,
  mimeType = null,
  fileSizeBytes = null,
}) {
  const rawChunks = chunkText(content);

  if (rawChunks.length === 0) {
    throw new Error("EMPTY_DOCUMENT_CONTENT");
  }

  if (rawChunks.length > MAX_CHUNKS_PER_DOCUMENT) {
    throw new Error("DOCUMENT_TOO_LARGE");
  }

  const embeddedChunks = [];
  for (const textChunk of rawChunks) {
    const embedding = await generateEmbedding(textChunk, {
      taskType: "RETRIEVAL_DOCUMENT",
    });
    embeddedChunks.push({
      content: textChunk,
      embedding,
    });
  }

  return withUserTransaction(userId, async (client) => {
    return createDocumentWithChunks(client, {
      userId,
      title,
      sourceType,
      fileName,
      mimeType,
      fileSizeBytes,
      rawContent: content,
      chunks: embeddedChunks,
    });
  });
}

/**
 * Lists all documents owned by the user.
 */
export async function listUserDocuments(userId) {
  return withUserTransaction(userId, async (client) => {
    return findDocumentsByUserId(client, userId);
  });
}

/**
 * Gets a single document owned by the user.
 */
export async function getUserDocument(userId, documentId) {
  return withUserTransaction(userId, async (client) => {
    const doc = await findDocumentById(client, documentId, userId);
    if (!doc) {
      throw new Error("DOCUMENT_NOT_FOUND");
    }
    return doc;
  });
}

/**
 * Deletes a user-owned document and its chunks.
 */
export async function removeUserDocument(userId, documentId) {
  return withUserTransaction(userId, async (client) => {
    const deleted = await deleteDocumentById(client, documentId, userId);
    if (!deleted) {
      throw new Error("DOCUMENT_NOT_FOUND");
    }
    return true;
  });
}

/**
 * Attaches an existing user-owned document to a user-owned agent.
 */
export async function attachDocumentToAgent({ userId, agentId, documentId }) {
  return withUserTransaction(userId, async (client) => {
    const agent = await findAgentById(client, agentId, userId);
    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    const doc = await findDocumentById(client, documentId, userId);
    if (!doc) {
      throw new Error("DOCUMENT_NOT_FOUND");
    }

    return linkDocumentToAgent(client, {
      userId,
      agentId,
      documentId,
    });
  });
}

/**
 * Lists all documents linked to a specific agent.
 */
export async function listAgentDocuments(userId, agentId) {
  return withUserTransaction(userId, async (client) => {
    const agent = await findAgentById(client, agentId, userId);
    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    return findDocumentsByAgentId(client, agentId, userId);
  });
}

/**
 * Detaches a document from a specific agent.
 */
export async function detachDocumentFromAgent({ userId, agentId, documentId }) {
  return withUserTransaction(userId, async (client) => {
    const agent = await findAgentById(client, agentId, userId);
    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    const removed = await unlinkDocumentFromAgent(
      client,
      agentId,
      documentId,
      userId
    );
    if (!removed) {
      throw new Error("AGENT_DOCUMENT_NOT_FOUND");
    }

    return true;
  });
}

/**
 * Searches documents using Gemini query embeddings + cosine similarity.
 * When agentId is provided, restricts search strictly to documents linked to that agent.
 */
export async function searchUserDocuments({
  userId,
  agentId = null,
  query,
  topK = 4,
  minScore = 0.35,
}) {
  const queryEmbedding = await generateEmbedding(query, {
    taskType: "RETRIEVAL_QUERY",
  });

  const chunks = await withUserTransaction(userId, async (client) => {
    if (agentId) {
      const linkedDocIds = await findDocumentIdsByAgentId(
        client,
        agentId,
        userId
      );
      return findAllChunksByUserId(client, userId, linkedDocIds);
    }

    return findAllChunksByUserId(client, userId);
  });

  if (chunks.length === 0) {
    return [];
  }

  return chunks
    .map((chunk) => ({
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      documentFileName: chunk.documentFileName,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score: Number(
        computeCosineSimilarity(queryEmbedding, chunk.embedding).toFixed(4)
      ),
    }))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}