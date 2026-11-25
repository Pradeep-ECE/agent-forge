import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  addToolToAgent,
  configureAgentTool,
  detachToolFromAgent,
  getAgentTools,
} from "../services/agent-tool.service.js";

const router = Router({ mergeParams: true });

const agentIdParamSchema = z.object({
  agentId: z.string().uuid("Invalid agent ID format"),
});

const agentToolParamsSchema = z.object({
  agentId: z.string().uuid("Invalid agent ID format"),
  toolId: z.string().uuid("Invalid tool ID format"),
});

const assignToolBodySchema = z
  .object({
    toolId: z.string().uuid("Invalid tool ID format"),
    configuration: z.record(z.string(), z.unknown()).optional().default({}),
    isEnabled: z.boolean().optional().default(true),
  })
  .strict();

const updateAgentToolBodySchema = z
  .object({
    isEnabled: z.boolean().optional(),
    configuration: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field (isEnabled or configuration) must be provided",
  });

router.use(authenticateToken);

/**
 * POST /api/agents/:agentId/tools
 * Assigns an active platform tool to the authenticated user's agent.
 */
router.post("/", async (req, res, next) => {
  try {
    const parsedParams = agentIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid agent ID",
        details: parsedParams.error.flatten(),
      });
    }

    const parsedBody = assignToolBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid tool assignment payload",
        details: parsedBody.error.flatten(),
      });
    }

    const assignment = await addToolToAgent(
      req.user.id,
      parsedParams.data.agentId,
      parsedBody.data
    );

    res.status(201).json({ agentTool: assignment });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agents/:agentId/tools
 * Lists all tools assigned to the authenticated user's agent.
 */
router.get("/", async (req, res, next) => {
  try {
    const parsedParams = agentIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid agent ID",
        details: parsedParams.error.flatten(),
      });
    }

    const tools = await getAgentTools(req.user.id, parsedParams.data.agentId);
    res.status(200).json({ tools });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/agents/:agentId/tools/:toolId
 * Enables/disables or updates configuration for an assigned tool.
 */
router.patch("/:toolId", async (req, res, next) => {
  try {
    const parsedParams = agentToolParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid agent or tool ID",
        details: parsedParams.error.flatten(),
      });
    }

    const parsedBody = updateAgentToolBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid update payload",
        details: parsedBody.error.flatten(),
      });
    }

    const updated = await configureAgentTool(
      req.user.id,
      parsedParams.data.agentId,
      parsedParams.data.toolId,
      parsedBody.data
    );

    res.status(200).json({ agentTool: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/agents/:agentId/tools/:toolId
 * Removes a tool assignment from the authenticated user's agent.
 */
router.delete("/:toolId", async (req, res, next) => {
  try {
    const parsedParams = agentToolParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid agent or tool ID",
        details: parsedParams.error.flatten(),
      });
    }

    await detachToolFromAgent(
      req.user.id,
      parsedParams.data.agentId,
      parsedParams.data.toolId
    );

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;