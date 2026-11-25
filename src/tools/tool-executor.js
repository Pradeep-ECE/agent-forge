import { Type } from "@google/genai";
import { executeCalculator } from "./handlers/calculator.handler.js";
import { executeGetCurrentDatetime } from "./handlers/datetime.handler.js";
import { executeDocumentSearch } from "./handlers/document-search.handler.js";

const DEFAULT_TOOL_TIMEOUT_MS = 5000;

/**
 * Static allowlisted registry mapping tool names to verified local handlers.
 * Arbitrary code or DB-stored scripts are strictly forbidden.
 */
const HANDLER_REGISTRY = Object.freeze({
  calculator: executeCalculator,
  get_current_datetime: executeGetCurrentDatetime,
  document_search: executeDocumentSearch,
});

function mapSchemaType(typeStr) {
  switch (String(typeStr || "").toUpperCase()) {
    case "NUMBER":
      return Type.NUMBER;
    case "INTEGER":
      return Type.INTEGER;
    case "BOOLEAN":
      return Type.BOOLEAN;
    case "ARRAY":
      return Type.ARRAY;
    case "OBJECT":
      return Type.OBJECT;
    case "STRING":
    default:
      return Type.STRING;
  }
}

function convertToGeminiSchema(schema) {
  if (!schema || typeof schema !== "object") {
    return { type: Type.OBJECT, properties: {} };
  }

  const converted = {
    type: mapSchemaType(schema.type || "OBJECT"),
  };

  if (schema.description) {
    converted.description = schema.description;
  }

  if (Array.isArray(schema.enum)) {
    converted.enum = schema.enum;
  }

  if (schema.properties && typeof schema.properties === "object") {
    converted.properties = {};
    for (const [propName, propDef] of Object.entries(schema.properties)) {
      converted.properties[propName] = convertToGeminiSchema(propDef);
    }
  }

  if (Array.isArray(schema.required)) {
    converted.required = schema.required;
  }

  if (schema.items) {
    converted.items = convertToGeminiSchema(schema.items);
  }

  return converted;
}

/**
 * Converts enabled agent-tool assignments into Gemini functionDeclarations.
 */
export function buildGeminiFunctionDeclarations(agentTools = []) {
  return agentTools
    .filter((assignment) => assignment.isEnabled && assignment.tool?.isActive)
    .filter((assignment) => Boolean(HANDLER_REGISTRY[assignment.tool.name]))
    .map((assignment) => ({
      name: assignment.tool.name,
      description: assignment.tool.description,
      parameters: convertToGeminiSchema(assignment.tool.inputSchema),
    }));
}

function runWithTimeout(fn, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TOOL_EXECUTION_TIMEOUT: Exceeded ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve()
      .then(fn)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Safely executes an assigned tool by verifying assignment + allowlist
 * and passing verified server context ({ userId, agentId }).
 */
export async function executeAssignedTool({
  userId,
  agentId,
  agentTools,
  toolName,
  args = {},
  timeoutMs = DEFAULT_TOOL_TIMEOUT_MS,
}) {
  const startTime = Date.now();

  const assigned = agentTools.find(
    (item) =>
      item.isEnabled &&
      item.tool?.isActive &&
      item.tool?.name === toolName
  );

  if (!assigned) {
    return {
      ok: false,
      error: `UNAUTHORIZED_TOOL: Tool "${toolName}" is not assigned to this agent`,
      durationMs: Date.now() - startTime,
    };
  }

  const handler = HANDLER_REGISTRY[toolName];
  if (!handler) {
    return {
      ok: false,
      error: `UNSUPPORTED_TOOL_HANDLER: No registered handler for "${toolName}"`,
      durationMs: Date.now() - startTime,
    };
  }

  try {
    const output = await runWithTimeout(
      () => handler(args, { userId, agentId }),
      timeoutMs
    );

    return {
      ok: true,
      result: output,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || "TOOL_EXECUTION_FAILED",
      durationMs: Date.now() - startTime,
    };
  }
}