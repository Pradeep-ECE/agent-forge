import { Router } from "express";
import { z } from "zod";

import { authenticateToken } from "../middleware/auth.middleware.js";

import {
  createAgent,
  getAgents,
  getAgent,
  updateAgent,
  deleteAgent,
} from "../services/agent.service.js";
import {
  attachDocumentToAgent,
  detachDocumentFromAgent,
  listAgentDocuments,
} from "../services/document.service.js";

const router = Router();

router.use(authenticateToken);

// Validation schemas

const createAgentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(2000).nullable().optional(),
  systemPrompt: z.string().trim().min(1),
  model: z.string().trim().min(1).max(100),
  temperature: z.number().min(0).max(2).optional(),
}).strict();

const updateAgentSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(2000).nullable().optional(),
  systemPrompt: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  isActive: z.boolean().optional(),
}).strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

const agentIdSchema = z.string().uuid();
const documentIdSchema = z.string().uuid();

const linkDocumentSchema = z.object({
  documentId: z.string().uuid(),
}).strict();

// CREATE AGENT
router.post("/", async (req, res, next) => {
  try {
    const validation = createAgentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        errors: validation.error.issues,
      });
    }

    const agent = await createAgent(
      req.user.id,
      validation.data
    );

    return res.status(201).json({
      success: true,
      data: agent,
    });
  } catch (error) {
    next(error);
  }
});

// GET ALL AGENTS
router.get("/", async (req, res, next) => {
  try {
    const agents = await getAgents(req.user.id);

    return res.status(200).json({
      success: true,
      data: agents,
    });
  } catch (error) {
    next(error);
  }
});

// GET SINGLE AGENT
router.get("/:agentId", async (req, res, next) => {
  try {
    const validation = agentIdSchema.safeParse(
      req.params.agentId
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid agent ID",
      });
    }

    const agent = await getAgent(
      req.user.id,
      validation.data
    );

    return res.status(200).json({
      success: true,
      data: agent,
    });
  } catch (error) {
    next(error);
  }
});

// UPDATE AGENT
router.patch("/:agentId", async (req, res, next) => {
  try {
    const idValidation = agentIdSchema.safeParse(
      req.params.agentId
    );

    if (!idValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid agent ID",
      });
    }

    const bodyValidation = updateAgentSchema.safeParse(
      req.body
    );

    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        errors: bodyValidation.error.issues,
      });
    }

    const agent = await updateAgent(
      req.user.id,
      idValidation.data,
      bodyValidation.data
    );

    return res.status(200).json({
      success: true,
      data: agent,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE AGENT
router.delete("/:agentId", async (req, res, next) => {
  try {
    const validation = agentIdSchema.safeParse(
      req.params.agentId
    );

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid agent ID",
      });
    }

    await deleteAgent(
      req.user.id,
      validation.data
    );

    return res.status(200).json({
      success: true,
      message: "Agent deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

// LINK DOCUMENT TO AGENT (Agent-Level Knowledge Base Scoping)
router.post("/:agentId/documents", async (req, res, next) => {
  try {
    const agentValidation = agentIdSchema.safeParse(req.params.agentId);
    if (!agentValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid agent ID",
      });
    }

    const bodyValidation = linkDocumentSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        errors: bodyValidation.error.issues,
      });
    }

    const link = await attachDocumentToAgent({
      userId: req.user.id,
      agentId: agentValidation.data,
      documentId: bodyValidation.data.documentId,
    });

    return res.status(201).json({
      success: true,
      data: link,
    });
  } catch (error) {
    if (error.message === "AGENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "AGENT_NOT_FOUND",
      });
    }
    if (error.message === "DOCUMENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "DOCUMENT_NOT_FOUND",
      });
    }
    next(error);
  }
});

// LIST DOCUMENTS LINKED TO AN AGENT
router.get("/:agentId/documents", async (req, res, next) => {
  try {
    const agentValidation = agentIdSchema.safeParse(req.params.agentId);
    if (!agentValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid agent ID",
      });
    }

    const documents = await listAgentDocuments(
      req.user.id,
      agentValidation.data
    );

    return res.status(200).json({
      success: true,
      data: documents,
    });
  } catch (error) {
    if (error.message === "AGENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "AGENT_NOT_FOUND",
      });
    }
    next(error);
  }
});

// UNLINK DOCUMENT FROM AGENT
router.delete("/:agentId/documents/:documentId", async (req, res, next) => {
  try {
    const agentValidation = agentIdSchema.safeParse(req.params.agentId);
    if (!agentValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid agent ID",
      });
    }

    const docValidation = documentIdSchema.safeParse(req.params.documentId);
    if (!docValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID",
      });
    }

    await detachDocumentFromAgent({
      userId: req.user.id,
      agentId: agentValidation.data,
      documentId: docValidation.data,
    });

    return res.status(200).json({
      success: true,
      message: "Document unlinked from agent successfully",
    });
  } catch (error) {
    if (error.message === "AGENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "AGENT_NOT_FOUND",
      });
    }
    if (error.message === "AGENT_DOCUMENT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        error: "AGENT_DOCUMENT_NOT_FOUND",
      });
    }
    next(error);
  }
});

export default router;