
import { withUserTransaction } from "../config/database.js";

import {
  createAgent as createAgentRepository,
  findAgentsByUserId,
  findAgentById,
  updateAgent as updateAgentRepository,
  deleteAgent as deleteAgentRepository,
} from "../repositories/agent.repository.js";

export async function createAgent(userId, agentData) {
  return withUserTransaction(userId, async (client) => {
    return createAgentRepository(client, userId, agentData);
  });
}

export async function getAgents(userId) {
  return withUserTransaction(userId, async (client) => {
    return findAgentsByUserId(client, userId);
  });
}

export async function getAgent(userId, agentId) {
  return withUserTransaction(userId, async (client) => {
    const agent = await findAgentById(client, agentId, userId);

    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    return agent;
  });
}

export async function updateAgent(userId, agentId, agentData) {
  return withUserTransaction(userId, async (client) => {
    const agent = await updateAgentRepository(
      client,
      agentId,
      userId,
      agentData
    );

    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    return agent;
  });
}

export async function deleteAgent(userId, agentId) {
  return withUserTransaction(userId, async (client) => {
    const deleted = await deleteAgentRepository(
      client,
      agentId,
      userId
    );

    if (!deleted) {
      throw new Error("AGENT_NOT_FOUND");
    }

    return true;
  });
}
