import crypto from "node:crypto";

function mapDocumentRow(row) {
  if (!row) return null;
  return {
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
    updatedAt: row.updated_at,
  };
}

/**
 * Inserts a document and all its embedded chunks inside an active user transaction.
 */
export async function createDocumentWithChunks(
  client,
  {
    id = crypto.randomUUID(),
    userId,
    title,
    sourceType = "text",
    fileName = null,
    mimeType = null,
    fileSizeBytes = null,
    rawContent,
    chunks,
  }
) {
  const docQuery = `
    INSERT INTO documents (
      id,
      user_id,
      title,
      source_type,
      file_name,
      mime_type,
      file_size_bytes,
      raw_content,
      chunk_count,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ready')
    RETURNING *;
  `;

  const { rows: docRows } = await client.query(docQuery, [
    id,
    userId,
    title,
    sourceType,
    fileName,
    mimeType,
    fileSizeBytes,
    rawContent,
    chunks.length,
  ]);

  const document = mapDocumentRow(docRows[0]);

  const chunkInsertQuery = `
    INSERT INTO document_chunks (
      id,
      user_id,
      document_id,
      chunk_index,
      content,
      embedding
    )
    VALUES ($1, $2, $3, $4, $5, $6::real[]);
  `;

  for (let i = 0; i < chunks.length; i++) {
    await client.query(chunkInsertQuery, [
      crypto.randomUUID(),
      userId,
      document.id,
      i,
      chunks[i].content,
      chunks[i].embedding,
    ]);
  }

  return document;
}

/**
 * Lists all documents owned by the user (without heavy raw_content).
 */
export async function findDocumentsByUserId(client, userId) {
  const query = `
    SELECT
      id,
      user_id,
      title,
      source_type,
      file_name,
      mime_type,
      file_size_bytes,
      chunk_count,
      status,
      created_at,
      updated_at
    FROM documents
    WHERE user_id = $1
    ORDER BY created_at DESC;
  `;

  const { rows } = await client.query(query, [userId]);
  return rows.map(mapDocumentRow);
}

/**
 * Fetches a single document by ID and userId (including raw_content).
 */
export async function findDocumentById(client, documentId, userId) {
  const query = `
    SELECT *
    FROM documents
    WHERE id = $1
      AND user_id = $2;
  `;

  const { rows } = await client.query(query, [documentId, userId]);
  if (!rows[0]) return null;

  return {
    ...mapDocumentRow(rows[0]),
    rawContent: rows[0].raw_content,
  };
}

/**
 * Deletes a user's document (cascades to document_chunks and agent_documents).
 */
export async function deleteDocumentById(client, documentId, userId) {
  const query = `
    DELETE FROM documents
    WHERE id = $1
      AND user_id = $2
    RETURNING id;
  `;

  const { rows } = await client.query(query, [documentId, userId]);
  return rows.length > 0;
}

/**
 * Retrieves all ready document chunks for a specific user,
 * optionally scoped to a specific list of documentIds.
 */
export async function findAllChunksByUserId(client, userId, documentIds = null) {
  if (Array.isArray(documentIds)) {
    if (documentIds.length === 0) {
      return [];
    }

    const scopedQuery = `
      SELECT
        dc.id,
        dc.document_id,
        d.title AS document_title,
        d.file_name AS document_file_name,
        dc.chunk_index,
        dc.content,
        dc.embedding
      FROM document_chunks dc
      INNER JOIN documents d
        ON d.id = dc.document_id
       AND d.user_id = dc.user_id
      WHERE dc.user_id = $1
        AND d.status = 'ready'
        AND dc.document_id = ANY($2::uuid[])
      ORDER BY d.created_at DESC, dc.chunk_index ASC;
    `;

    const { rows } = await client.query(scopedQuery, [userId, documentIds]);
    return rows.map((row) => ({
      chunkId: row.id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      documentFileName: row.document_file_name ?? null,
      chunkIndex: row.chunk_index,
      content: row.content,
      embedding: row.embedding,
    }));
  }

  const query = `
    SELECT
      dc.id,
      dc.document_id,
      d.title AS document_title,
      d.file_name AS document_file_name,
      dc.chunk_index,
      dc.content,
      dc.embedding
    FROM document_chunks dc
    INNER JOIN documents d
      ON d.id = dc.document_id
     AND d.user_id = dc.user_id
    WHERE dc.user_id = $1
      AND d.status = 'ready'
    ORDER BY d.created_at DESC, dc.chunk_index ASC;
  `;

  const { rows } = await client.query(query, [userId]);
  return rows.map((row) => ({
    chunkId: row.id,
    documentId: row.document_id,
    documentTitle: row.document_title,
    documentFileName: row.document_file_name ?? null,
    chunkIndex: row.chunk_index,
    content: row.content,
    embedding: row.embedding,
  }));
}