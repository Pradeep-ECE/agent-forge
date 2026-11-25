
import { randomUUID } from "node:crypto";
import { Agent } from "../models/agent.model.js";

export async function createAgent(client, userId, agentData) {
  const id = randomUUID();

  const query = `
    INSERT INTO agents (
      id,
      user_id,
      name,
      description,
      system_prompt,
      model,
      temperature
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const { rows } = await client.query(query, [
    id,
    userId,
    agentData.name,
    agentData.description ?? null,
    agentData.systemPrompt,
    agentData.model,
    agentData.temperature ?? 0.7,
  ]);

  return Agent.fromDatabase(rows[0]);
}

export async function findAgentsByUserId(client, userId) {
  const query = `
    SELECT *
    FROM agents
    WHERE user_id = $1
    ORDER BY created_at DESC;
  `;

  const { rows } = await client.query(query, [userId]);

  return rows.map((row) => Agent.fromDatabase(row));
}

export async function findAgentById(client, agentId, userId) {
  const query = `
    SELECT *
    FROM agents
    WHERE id = $1
      AND user_id = $2;
  `;

  const { rows } = await client.query(query, [agentId, userId]);

  return rows.length ? Agent.fromDatabase(rows[0]) : null;
}


export async function updateAgent(
  client,
  agentId,
  userId,
  agentData
) {
  const allowedFields = {
    name: "name",
    description: "description",
    systemPrompt: "system_prompt",
    model: "model",
    temperature: "temperature",
    isActive: "is_active",
  };

  const updates = [];
  const values = [agentId, userId];

  for (const [property, column] of Object.entries(allowedFields)) {
    if (Object.hasOwn(agentData, property)) {
      values.push(agentData[property]);
      updates.push(`${column} = $${values.length}`);
    }
  }

  if (updates.length === 0) {
    return findAgentById(client, agentId, userId);
  }

  updates.push("updated_at = NOW()");

  const query = `
    UPDATE agents
    SET ${updates.join(", ")}
    WHERE id = $1
      AND user_id = $2
    RETURNING *;
  `;

  const { rows } = await client.query(query, values);

  return rows.length ? Agent.fromDatabase(rows[0]) : null;
}


export async function deleteAgent(client, agentId, userId) {
  const query = `
    DELETE FROM agents
    WHERE id = $1
      AND user_id = $2
    RETURNING id;
  `;

  const { rows } = await client.query(query, [agentId, userId]);

  return rows.length > 0;
}
