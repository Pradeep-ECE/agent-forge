import { pool } from "../config/database.js";
import {
  findActiveToolDefinitions,
  findToolDefinitionById,
} from "../repositories/tool-definition.repository.js";

/**
 * Returns all active platform tools available in the catalog.
 */
export async function getAvailableTools() {
  return findActiveToolDefinitions(pool);
}

/**
 * Retrieves a single active platform tool by ID.
 * Throws TOOL_NOT_FOUND if it does not exist or is inactive.
 */
export async function getAvailableToolById(toolId) {
  const tool = await findToolDefinitionById(pool, toolId, {
    activeOnly: true,
  });

  if (!tool) {
    throw new Error("TOOL_NOT_FOUND");
  }

  return tool;
}