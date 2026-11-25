import {
  createConversation,
  findConversationById,
  deleteConversation,
} from "./repositories/conversation.repository.js";

import {
  createMessage,
  findMessagesByConversationId,
} from "./repositories/message.repository.js";

import { pool } from "./config/database.js";

async function testRepositories() {
  let conversationId;

  try {
    // TEST 1: Create Conversation
    console.log("\n--- TEST 1: Create Conversation ---");

    const conversation = await createConversation();

    conversationId = conversation.id;

    console.log("Conversation created:", conversation);


    // TEST 2: Find Conversation
    console.log("\n--- TEST 2: Find Conversation ---");

    const foundConversation =
      await findConversationById(conversationId);

    console.log("Conversation found:", foundConversation);


    // TEST 3: Create User Message
    console.log("\n--- TEST 3: Create User Message ---");

    const userMessage = await createMessage({
      conversationId,
      role: "user",
      content: "My name is Pradeep. I am a Node.js backend developer.",
      tokenCount: 15,
    });

    console.log("User message created:", userMessage);


    // TEST 4: Create Model Message
    console.log("\n--- TEST 4: Create Model Message ---");

    const modelMessage = await createMessage({
      conversationId,
      role: "model",
      content: "Nice to meet you, Pradeep!",
      tokenCount: 8,
    });

    console.log("Model message created:", modelMessage);


    // TEST 5: Get Conversation Messages
    console.log("\n--- TEST 5: Get Conversation Messages ---");

    const messages =
      await findMessagesByConversationId(conversationId);

    console.log("Conversation messages:", messages);


    // TEST 6: Delete Conversation
    console.log("\n--- TEST 6: Delete Conversation ---");

    const deleted = await deleteConversation(conversationId);

    console.log("Conversation deleted:", deleted);


    // TEST 7: Verify Cascade Delete
    console.log("\n--- TEST 7: Verify Cascade Delete ---");

    const remainingMessages =
      await findMessagesByConversationId(conversationId);

    console.log("Remaining messages:", remainingMessages);

    console.log("\nAll repository tests completed!");

  } catch (error) {
    console.error("\nRepository test failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testRepositories();