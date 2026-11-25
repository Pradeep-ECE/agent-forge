
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Create one chat session
const chat = ai.chats.create({
  model: "gemini-3.5-flash-lite",
});

async function runConversation() {
  try {
    // Message 1
    const response1 = await chat.sendMessage({
      message: "My name is Pradeep. I am a backend developer working with Node.js.",
    });

    console.log("\nUser: Tell me about yourself.");
    console.log("Gemini:", response1.text);

    // Message 2 - tests previous context
    const response2 = await chat.sendMessage({
      message: "What is my name and what technology do I work with?",
    });

    console.log("\nUser: What is my name and technology?");
    console.log("Gemini:", response2.text);

    // Message 3 - tests context retention
    const response3 = await chat.sendMessage({
      message: "Suggest one AI project suitable for my background.",
    });

    console.log("\nUser: Suggest an AI project.");
    console.log("Gemini:", response3.text);

    // Inspect conversation history
    const history = chat.getHistory();

    console.log("\nTotal conversation messages:", history);

  } catch (error) {
    console.error("Gemini API Error:", error.message);
  }
}

runConversation();

const newChat = ai.chats.create({
  model: "gemini-3.5-flash-lite",
});

const response = await newChat.sendMessage({
  message: "What is my name and what technology do I work with?",
});

console.log("New Chat Response:", response.text);

