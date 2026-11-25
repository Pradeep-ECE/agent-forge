
import { randomUUID } from "node:crypto";
import { Message } from "../models/message.model.js";

export async function createMessage(
  client,
  {
    conversationId,
    userId,
    role,
    content,
    tokenCount = 0,
  }
) {
  const id = randomUUID();

  const query = `
    INSERT INTO messages (
      id,
      conversation_id,
      user_id,
      role,
      content,
      token_count
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  const { rows } = await client.query(query, [
    id,
    conversationId,
    userId,
    role,
    content,
    tokenCount,
  ]);

  return Message.fromDatabase(rows[0]);
}

export async function findMessagesByConversationId(
  client,
  conversationId,
  userId
) {
  const query = `
    SELECT *
    FROM messages
    WHERE conversation_id = $1
      AND user_id = $2
    ORDER BY created_at ASC, id ASC;
  `;

  const { rows } = await client.query(query, [
    conversationId,
    userId,
  ]);

  return rows.map((row) => Message.fromDatabase(row));
}

export async function deleteMessagesByConversationId(
  client,
  conversationId,
  userId
) {
  const query = `
    DELETE FROM messages
    WHERE conversation_id = $1
      AND user_id = $2
    RETURNING id;
  `;

  const { rows } = await client.query(query, [
    conversationId,
    userId,
  ]);

  return rows.length;
}
