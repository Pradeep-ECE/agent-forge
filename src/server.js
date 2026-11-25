
import "dotenv/config";

import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import chatRoutes from "./routes/chat.routes.js";
import authRoutes from "./routes/auth.routes.js";
import agentRoutes from "./routes/agent.routes.js";
import toolRoutes from "./routes/tool.routes.js";
import agentToolRoutes from "./routes/agent-tool.routes.js";
import agentChatRoutes from "./routes/agent-chat.routes.js";
import documentRoutes from "./routes/document.routes.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Request parsing
app.use(express.json({ limit: "1mb" }));

// Basic API rate limiting
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  })
);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AgentForge API is running",
  });
});

// Public authentication routes
app.use("/api/auth", authRoutes);

// Protected chat routes
app.use("/api/chat", chatRoutes);

// Protected agent routes
app.use("/api/agents", agentRoutes);

app.use("/api/tools", toolRoutes);
app.use("/api/agents/:agentId/tools", agentToolRoutes);
app.use("/api/agents/:agentId/chat", agentChatRoutes);
app.use("/api/documents", documentRoutes);

// Centralized error handler
app.use((error, req, res, next) => {
  console.error("API Error:", error);

  if (res.headersSent) {
    return next(error);
  }

  if (error.message === "SESSION_NOT_FOUND") {
    return res.status(404).json({
      success: false,
      message: "Chat session not found",
    });
  }
  if (error.message === "AGENT_NOT_FOUND") {
  return res.status(404).json({
    success: false,
    message: "Agent not found",
  });
}

  if (error.message === "EMPTY_MODEL_RESPONSE") {
    return res.status(502).json({
      success: false,
      message: "AI service returned an empty response",
    });
  }
  if (error.message === "TOOL_NOT_FOUND") {
  return res.status(404).json({
    error: "TOOL_NOT_FOUND",
    message: "Tool not found",
  });
}

if (error.message === "AGENT_TOOL_NOT_FOUND") {
  return res.status(404).json({
    error: "AGENT_TOOL_NOT_FOUND",
    message: "Tool is not assigned to this agent",
  });
}

if (error.message === "TOOL_ALREADY_ASSIGNED") {
  return res.status(409).json({
    error: "TOOL_ALREADY_ASSIGNED",
    message: "Tool is already assigned to this agent",
  });
}
if (error.message === "DOCUMENT_NOT_FOUND") {
  return res.status(404).json({
    success: false,
    error: "DOCUMENT_NOT_FOUND",
    message: "Document not found",
  });
}

if (error.message === "DOCUMENT_TOO_LARGE") {
  return res.status(400).json({
    success: false,
    error: "DOCUMENT_TOO_LARGE",
    message: "Document exceeds maximum chunk limit",
  });
}
console.error("Unhandled API Error:", error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`AgentForge API running on port ${PORT}`);
});
