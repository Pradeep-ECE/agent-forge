import crypto from "node:crypto";

/**
 * Inserts a single tool execution audit record.
 */
export async function createToolExecutionLog(
  client,
  {
    id = crypto.randomUUID(),
    userId,
    agentId,
    conversationId,
    toolId = null,
    toolName,
    iteration,
    inputArgs = {},
    outputResult = null,
    errorMessage = null,
    status,
    durationMs,
  }
) {
  const query = `
    INSERT INTO tool_execution_logs (
      id,
      user_id,
      agent_id,
      conversation_id,
      tool_id,
      tool_name,
      iteration,
      input_args,
      output_result,
      error_message,
      status,
      duration_ms
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8::jsonb, $9::jsonb, $10, $11, $12
    )
    RETURNING *;
  `;

  const values = [
    id,
    userId,
    agentId,
    conversationId,
    toolId,
    toolName,
    iteration,
    JSON.stringify(inputArgs ?? {}),
    outputResult !== null && outputResult !== undefined
      ? JSON.stringify(outputResult)
      : null,
    errorMessage,
    status,
    durationMs,
  ];

  const { rows } = await client.query(query, values);
  return rows[0] || null;
}

/**
 * Retrieves chronological tool execution logs for a user's conversation.
 */
export async function findToolExecutionLogsByConversationId(
  client,
  conversationId,
  userId
) {
  const query = `
    SELECT *
    FROM tool_execution_logs
    WHERE conversation_id = $1
      AND user_id = $2
    ORDER BY created_at ASC;
  `;

  const { rows } = await client.query(query, [conversationId, userId]);
  return rows;
}

/**
 * Retrieves recent tool execution logs for a user's agent.
 */
export async function findToolExecutionLogsByAgentId(
  client,
  agentId,
  userId,
  { limit = 50 } = {}
) {
  const query = `
    SELECT *
    FROM tool_execution_logs
    WHERE agent_id = $1
      AND user_id = $2
    ORDER BY created_at DESC
    LIMIT $3;
  `;

  const { rows } = await client.query(query, [agentId, userId, limit]);
  return rows;
}