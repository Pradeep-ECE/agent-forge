import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  getAvailableToolById,
  getAvailableTools,
} from "../services/tool-registry.service.js";

const router = Router();

const toolIdParamSchema = z.object({
  toolId: z.string().uuid("Invalid tool ID format"),
});

router.use(authenticateToken);

/**
 * GET /api/tools
 * Lists all active platform tools available in the catalog.
 */
router.get("/", async (req, res, next) => {
  try {
    const tools = await getAvailableTools();
    res.status(200).json({ tools });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tools/:toolId
 * Retrieves details of a single active platform tool.
 */
router.get("/:toolId", async (req, res, next) => {
  try {
    const parsedParams = toolIdParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Invalid tool ID",
        details: parsedParams.error.flatten(),
      });
    }

    const tool = await getAvailableToolById(parsedParams.data.toolId);
    res.status(200).json({ tool });
  } catch (error) {
    next(error);
  }
});

export default router;