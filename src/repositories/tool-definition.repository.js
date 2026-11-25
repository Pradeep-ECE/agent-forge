import { ToolDefinition } from "../models/tool-definition.model.js";

/**
 * Inserts a new platform tool definition.
 * Intended for internal/admin/seed usage only.
 */
export async function createToolDefinition(client, toolData) {
  const {
    id,
    name,
    description,
    handlerKey,
    inputSchema,
    isActive = true,
  } = toolData;

  const query = `
    INSERT INTO tool_definitions (
      id,
      name,
      description,
      handler_key,
      input_schema,
      is_active
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    RETURNING *;
  `;

  const values = [
    id,
    name,
    description,
    handlerKey,
    JSON.stringify(inputSchema),
    isActive,
  ];

  const { rows } = await client.query(query, values);
  return rows.length ? ToolDefinition.fromDatabase(rows[0]) : null;
}

/**
 * Idempotent upsert for deterministic platform tool seeding.
 * Matches on unique handler_key so rerunning seeds updates metadata safely
 * without duplicating rows or breaking existing tool_id foreign keys.
 */
export async function upsertToolDefinition(client, toolData) {
  const {
    id,
    name,
    description,
    handlerKey,
    inputSchema,
    isActive = true,
  } = toolData;

  const query = `
    INSERT INTO tool_definitions (
      id,
      name,
      description,
      handler_key,
      input_schema,
      is_active
    )
    VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    ON CONFLICT (handler_key)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      input_schema = EXCLUDED.input_schema,
      is_active = EXCLUDED.is_active,
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    id,
    name,
    description,
    handlerKey,
    JSON.stringify(inputSchema),
    isActive,
  ];

  const { rows } = await client.query(query, values);
  return rows.length ? ToolDefinition.fromDatabase(rows[0]) : null;
}

/**
 * Lists all active platform tools available for assignment.
 */
export async function findActiveToolDefinitions(client) {
  const query = `
    SELECT *
    FROM tool_definitions
    WHERE is_active = TRUE
    ORDER BY name ASC;
  `;

  const { rows } = await client.query(query);
  return rows.map((row) => ToolDefinition.fromDatabase(row));
}

/**
 * Finds a tool definition by UUID.
 * Optionally restricts to active tools only (default: false for internal lookups,
 * pass { activeOnly: true } when validating user assignment requests).
 */
export async function findToolDefinitionById(
  client,
  toolId,
  { activeOnly = false } = {}
) {
  const query = activeOnly
    ? `
      SELECT *
      FROM tool_definitions
      WHERE id = $1
        AND is_active = TRUE;
    `
    : `
      SELECT *
      FROM tool_definitions
      WHERE id = $1;
    `;

  const { rows } = await client.query(query, [toolId]);
  return rows.length ? ToolDefinition.fromDatabase(rows[0]) : null;
}

/**
 * Finds a tool definition by its unique handler_key.
 */
export async function findToolDefinitionByHandlerKey(
  client,
  handlerKey,
  { activeOnly = false } = {}
) {
  const query = activeOnly
    ? `
      SELECT *
      FROM tool_definitions
      WHERE handler_key = $1
        AND is_active = TRUE;
    `
    : `
      SELECT *
      FROM tool_definitions
      WHERE handler_key = $1;
    `;

  const { rows } = await client.query(query, [handlerKey]);
  return rows.length ? ToolDefinition.fromDatabase(rows[0]) : null;
}