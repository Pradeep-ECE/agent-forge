import { withUserTransaction } from "../config/database.js";
import { findAgentById } from "../repositories/agent.repository.js";
import { findToolDefinitionById } from "../repositories/tool-definition.repository.js";
import {
  assignToolToAgent,
  findAgentTool,
  findToolsByAgentId,
  removeToolFromAgent,
  updateAgentTool,
} from "../repositories/agent-tool.repository.js";

/**
 * Assigns an active platform tool to one of the authenticated user's agents.
 */
export async function addToolToAgent(
  userId,
  agentId,
  { toolId, configuration = {}, isEnabled = true }
) {
  return withUserTransaction(userId, async (client) => {
    const agent = await findAgentById(client, agentId, userId);
    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    const tool = await findToolDefinitionById(client, toolId, {
      activeOnly: true,
    });
    if (!tool) {
      throw new Error("TOOL_NOT_FOUND");
    }

    try {
      await assignToolToAgent(client, {
        userId,
        agentId,
        toolId,
        configuration,
        isEnabled,
      });
    } catch (error) {
      if (error.code === "23505") {
        throw new Error("TOOL_ALREADY_ASSIGNED");
      }
      throw error;
    }

    return findAgentTool(client, agentId, toolId, userId);
  });
}

/**
 * Lists all tools assigned to one of the authenticated user's agents.
 */
export async function getAgentTools(userId, agentId) {
  return withUserTransaction(userId, async (client) => {
    const agent = await findAgentById(client, agentId, userId);
    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    return findToolsByAgentId(client, agentId, userId);
  });
}

/**
 * Updates configuration or enabled status for a tool assigned to the user's agent.
 */
export async function configureAgentTool(
  userId,
  agentId,
  toolId,
  updateData
) {
  return withUserTransaction(userId, async (client) => {
    const agent = await findAgentById(client, agentId, userId);
    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    const updated = await updateAgentTool(
      client,
      agentId,
      toolId,
      userId,
      updateData
    );

    if (!updated) {
      throw new Error("AGENT_TOOL_NOT_FOUND");
    }

    return findAgentTool(client, agentId, toolId, userId);
  });
}

/**
 * Removes a tool assignment from one of the authenticated user's agents.
 */
export async function detachToolFromAgent(userId, agentId, toolId) {
  return withUserTransaction(userId, async (client) => {
    const agent = await findAgentById(client, agentId, userId);
    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    const removed = await removeToolFromAgent(client, agentId, toolId, userId);
    if (!removed) {
      throw new Error("AGENT_TOOL_NOT_FOUND");
    }
  });
}