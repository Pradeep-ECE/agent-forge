import crypto from "node:crypto";

/**
 * Links an existing user-owned document to a user-owned agent.
 */
export async function linkDocumentToAgent(
  client,
  { id = crypto.randomUUID(), userId, agentId, documentId }
) {
  const query = `
    INSERT INTO agent_documents (id, user_id, agent_id, document_id)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (agent_id, document_id)
    DO UPDATE SET created_at = agent_documents.created_at
    RETURNING id, user_id, agent_id, document_id, created_at;
  `;

  const { rows } = await client.query(query, [id, userId, agentId, documentId]);
  return {
    id: rows[0].id,
    userId: rows[0].user_id,
    agentId: rows[0].agent_id,
    documentId: rows[0].document_id,
    createdAt: rows[0].created_at,
  };
}

/**
 * Lists all documents attached to a specific agent for the authenticated user.
 */
export async function findDocumentsByAgentId(client, agentId, userId) {
  const query = `
    SELECT
      d.id,
      d.user_id,
      d.title,
      d.source_type,
      d.file_name,
      d.mime_type,
      d.file_size_bytes,
      d.chunk_count,
      d.status,
      d.created_at,
      ad.created_at AS linked_at
    FROM agent_documents ad
    INNER JOIN documents d
      ON d.id = ad.document_id
     AND d.user_id = ad.user_id
    WHERE ad.agent_id = $1
      AND ad.user_id = $2
    ORDER BY ad.created_at DESC;
  `;

  const { rows } = await client.query(query, [agentId, userId]);
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    sourceType: row.source_type,
    fileName: row.file_name ?? null,
    mimeType: row.mime_type ?? null,
    fileSizeBytes: row.file_size_bytes ?? null,
    chunkCount: row.chunk_count,
    status: row.status,
    createdAt: row.created_at,
    linkedAt: row.linked_at,
  }));
}

/**
 * Returns only the linked document IDs for a specific agent.
 */
export async function findDocumentIdsByAgentId(client, agentId, userId) {
  const query = `
    SELECT document_id
    FROM agent_documents
    WHERE agent_id = $1
      AND user_id = $2;
  `;

  const { rows } = await client.query(query, [agentId, userId]);
  return rows.map((r) => r.document_id);
}

/**
 * Unlinks a document from an agent (does not delete the underlying document).
 */
export async function unlinkDocumentFromAgent(
  client,
  agentId,
  documentId,
  userId
) {
  const query = `
    DELETE FROM agent_documents
    WHERE agent_id = $1
      AND document_id = $2
      AND user_id = $3
    RETURNING id;
  `;

  const { rows } = await client.query(query, [agentId, documentId, userId]);
  return rows.length > 0;
}