
import { ai, MODEL } from "../config/ai.js";
import { withUserTransaction } from "../config/database.js";

import {
  createConversation,
  findConversationById,
  deleteConversation,
  updateConversationTimestamp,
} from "../repositories/conversation.repository.js";

import {
  createMessage,
  findMessagesByConversationId,
  deleteMessagesByConversationId,
} from "../repositories/message.repository.js";

// Create a new conversation
export async function createSession(userId) {
  return withUserTransaction(userId, async (client) => {
    const conversation = await createConversation(client, userId);

    return {
      sessionId: conversation.id,
      createdAt: conversation.createdAt,
    };
  });
}

// Send a message
export async function sendMessage(userId, sessionId, message) {
  // Transaction 1: Save user message and fetch history
  const contents = await withUserTransaction(userId, async (client) => {
    const conversation = await findConversationById(client, sessionId);
console.log("conversation",userId);
    if (!conversation) {
      throw new Error("SESSION_NOT_FOUND");
    }

    await createMessage(client, {
      conversationId: sessionId,
      userId,
      role: "user",
      content: message,
    });

    const history = await findMessagesByConversationId(client, sessionId,userId);

    return history.map((item) => ({
      role: item.role,
      parts: [{ text: item.content }],
    }));
  });

  // Gemini call outside the database transaction
  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
  });

  const responseText = response.text;

  if (!responseText) {
    throw new Error("EMPTY_MODEL_RESPONSE");
  }

  // Transaction 2: Save model response
  await withUserTransaction(userId, async (client) => {
    const conversation = await findConversationById(client, sessionId);

    if (!conversation) {
      throw new Error("SESSION_NOT_FOUND");
    }

    await createMessage(client, {
      conversationId: sessionId,
      userId,
      role: "model",
      content: responseText,
      tokenCount: response.usageMetadata?.candidatesTokenCount ?? 0,
    });

    await updateConversationTimestamp(client, sessionId);
  });

  return {
    sessionId,
    message,
    response: responseText,
    usage: response.usageMetadata,
  };
}


// Get conversation history
export async function getSessionHistory(userId, sessionId) {
  return withUserTransaction(userId, async (client) => {
    const conversation = await findConversationById(
      client,
      sessionId,
      userId
    );
 console.log("conversation",conversation);
    if (!conversation) {
      throw new Error("SESSION_NOT_FOUND");
    }

    const messages = await findMessagesByConversationId(
      client,
      sessionId,
      userId
    );

    return messages.map((item) => ({
      role: item.role,
      message: item.content,
    }));
  });
}


// Delete conversation and its messages explicitly
export async function deleteSession(userId, sessionId) {
  return withUserTransaction(userId, async (client) => {
    const conversation = await findConversationById(client, sessionId);

    if (!conversation) {
      throw new Error("SESSION_NOT_FOUND");
    }

    await deleteMessagesByConversationId(client, sessionId);

    await deleteConversation(client, sessionId);

    return true;
  });
}
