import { AgentTool } from "../models/agent-tool.model.js";

/**
 * Assigns a platform tool to a user's agent.
 * Composite FK (user_id, agent_id) also prevents attaching to another user's agent.
 */
export async function assignToolToAgent(
  client,
  {
    userId,
    agentId,
    toolId,
    configuration = {},
    isEnabled = true,
  }
) {
  const query = `
    INSERT INTO agent_tools (
      user_id,
      agent_id,
      tool_id,
      configuration,
      is_enabled
    )
    VALUES ($1, $2, $3, $4::jsonb, $5)
    RETURNING *;
  `;

  const values = [
    userId,
    agentId,
    toolId,
    JSON.stringify(configuration),
    isEnabled,
  ];

  const { rows } = await client.query(query, values);
  return rows.length ? AgentTool.fromDatabase(rows[0]) : null;
}

/**
 * Lists all tools assigned to a specific user's agent, joined with tool metadata.
 */
export async function findToolsByAgentId(client, agentId, userId) {
  const query = `
    SELECT
      at.user_id,
      at.agent_id,
      at.tool_id,
      at.configuration,
      at.is_enabled,
      at.created_at,
      td.name AS tool_name,
      td.description AS tool_description,
      td.handler_key,
      td.input_schema,
      td.is_active AS tool_is_active
    FROM agent_tools at
    INNER JOIN tool_definitions td
      ON td.id = at.tool_id
    WHERE at.agent_id = $1
      AND at.user_id = $2
    ORDER BY td.name ASC;
  `;

  const { rows } = await client.query(query, [agentId, userId]);
  return rows.map((row) => AgentTool.fromDatabase(row));
}

/**
 * Finds a single assigned tool record for a user's agent.
 */
export async function findAgentTool(client, agentId, toolId, userId) {
  const query = `
    SELECT
      at.user_id,
      at.agent_id,
      at.tool_id,
      at.configuration,
      at.is_enabled,
      at.created_at,
      td.name AS tool_name,
      td.description AS tool_description,
      td.handler_key,
      td.input_schema,
      td.is_active AS tool_is_active
    FROM agent_tools at
    INNER JOIN tool_definitions td
      ON td.id = at.tool_id
    WHERE at.agent_id = $1
      AND at.tool_id = $2
      AND at.user_id = $3;
  `;

  const { rows } = await client.query(query, [agentId, toolId, userId]);
  return rows.length ? AgentTool.fromDatabase(rows[0]) : null;
}

/**
 * Updates allowed fields (isEnabled, configuration) on an assigned agent tool.
 */
export async function updateAgentTool(
  client,
  agentId,
  toolId,
  userId,
  updateData
) {
  const allowedFields = {
    isEnabled: { column: "is_enabled", cast: "" },
    configuration: { column: "configuration", cast: "::jsonb" },
  };

  const updates = [];
  const values = [agentId, toolId, userId];

  for (const [property, meta] of Object.entries(allowedFields)) {
    if (Object.hasOwn(updateData, property)) {
      const rawValue =
        property === "configuration"
          ? JSON.stringify(updateData[property])
          : updateData[property];
      values.push(rawValue);
      updates.push(`${meta.column} = $${values.length}${meta.cast}`);
    }
  }

  if (updates.length === 0) {
    return findAgentTool(client, agentId, toolId, userId);
  }

  const query = `
    UPDATE agent_tools
    SET ${updates.join(", ")}
    WHERE agent_id = $1
      AND tool_id = $2
      AND user_id = $3
    RETURNING *;
  `;

  const { rows } = await client.query(query, values);
  return rows.length ? AgentTool.fromDatabase(rows[0]) : null;
}

/**
 * Removes a tool assignment from a user's agent.
 * Returns true if a row was deleted, false otherwise.
 */
export async function removeToolFromAgent(client, agentId, toolId, userId) {
  const query = `
    DELETE FROM agent_tools
    WHERE agent_id = $1
      AND tool_id = $2
      AND user_id = $3
    RETURNING agent_id;
  `;

  const { rows } = await client.query(query, [agentId, toolId, userId]);
  return rows.length > 0;
}