
import { randomUUID } from "node:crypto";
import { Conversation } from "../models/conversation.model.js";

export async function createConversation(client, userId) {
  const id = randomUUID();

  const query = `
    INSERT INTO conversations (id, user_id, title)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;

  const { rows } = await client.query(query, [
    id,
    userId,
    "New Conversation",
  ]);

  return Conversation.fromDatabase(rows[0]);
}

export async function findConversationById(client, conversationId,userId) {
  const query = `
    SELECT *
    FROM conversations
    WHERE id = $1 and user_id = $2;
  `;

  const { rows } = await client.query(query, [conversationId,userId]);

  return rows.length
    ? Conversation.fromDatabase(rows[0])
    : null;
}

export async function deleteConversation(client, conversationId) {
  const query = `
    DELETE FROM conversations
    WHERE id = $1
    RETURNING id;
  `;

  const { rows } = await client.query(query, [conversationId]);

  return rows.length > 0;
}

export async function updateConversationTimestamp(client, conversationId) {
  const query = `
    UPDATE conversations
    SET updated_at = NOW()
    WHERE id = $1
    RETURNING id;
  `;

  const { rows } = await client.query(query, [conversationId]);

  return rows.length > 0;
}
