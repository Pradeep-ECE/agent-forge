import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { runAgentChat } from "../services/agent-chat.service.js";

const router = Router({ mergeParams: true });

const agentIdParamSchema = z.object({
  agentId: z.string().uuid("Invalid agent ID format"),
});

const agentChatBodySchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, "Message cannot be empty")
      .max(10000, "Message exceeds maximum length"),
    sessionId: z.string().uuid("Invalid session ID format").optional(),
  })
  .strict();

router.use(authenticateToken);

/**
 * POST /api/agents/:agentId/chat
 * Sends a message to a user-owned agent and runs the Gemini function-calling loop.
 */
router.post("/", async (req, res, next) => {
  try {
    const parsedParams = agentIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid agent ID",
        details: parsedParams.error.flatten(),
      });
    }

    const parsedBody = agentChatBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid chat request payload",
        details: parsedBody.error.flatten(),
      });
    }

    const result = await runAgentChat({
      userId: req.user.id,
      agentId: parsedParams.data.agentId,
      message: parsedBody.data.message,
      sessionId: parsedBody.data.sessionId ?? null,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;