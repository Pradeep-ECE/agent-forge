
import { Router } from "express";
import { z } from "zod";

import {
  createSession,
  sendMessage,
  getSessionHistory,
  deleteSession,
} from "../services/chat.service.js";

import { authenticateToken } from "../middleware/auth.middleware.js";

const router = Router();

const messageSchema = z.object({
  message: z.string().trim().min(1).max(10000),
});

// Protect every chat endpoint with JWT authentication
router.use(authenticateToken);

// POST /api/chat/sessions
router.post("/sessions", async (req, res, next) => {
  try {
    const session = await createSession(req.user.id);

    return res.status(201).json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/chat/:sessionId/messages
router.post("/:sessionId/messages", async (req, res, next) => {
  try {
    const validation = messageSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body",
        errors: validation.error.issues,
      });
    }

    const result = await sendMessage(
      req.user.id,
      req.params.sessionId,
      validation.data.message
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/chat/:sessionId/history
router.get("/:sessionId/history", async (req, res, next) => {
  try {
    const history = await getSessionHistory(
      req.user.id,
      req.params.sessionId
    );

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/chat/:sessionId
router.delete("/:sessionId", async (req, res, next) => {
  try {
    await deleteSession(
      req.user.id,
      req.params.sessionId
    );

    return res.status(200).json({
      success: true,
      message: "Session deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
