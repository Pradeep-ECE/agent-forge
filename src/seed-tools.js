import "dotenv/config";
import { pool } from "./config/database.js";
import { upsertToolDefinition } from "./repositories/tool-definition.repository.js";

const INITIAL_PLATFORM_TOOLS = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    name: "calculator",
    description:
      "Evaluates basic arithmetic expressions safely (addition, subtraction, multiplication, division, parentheses, and decimals).",
    handlerKey: "calculator",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description:
            "Arithmetic expression to evaluate, e.g., '(125 * 4) + 50 / 2'",
        },
      },
      required: ["expression"],
      additionalProperties: false,
    },
    isActive: true,
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    name: "get_current_datetime",
    description:
      "Returns the current date and time in ISO-8601 format and human-readable format for a specified IANA timezone.",
    handlerKey: "get_current_datetime",
    inputSchema: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description:
            "Optional IANA timezone name, for example 'Asia/Kolkata' or 'UTC'. Defaults to 'UTC' if omitted.",
        },
      },
      required: [],
      additionalProperties: false,
    },
    isActive: true,
  },
];

export async function seedTools(client) {
  const seeded = [];

  for (const tool of INITIAL_PLATFORM_TOOLS) {
    const record = await upsertToolDefinition(client, tool);
    seeded.push(record);
  }

  return seeded;
}

async function runSeed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const tools = await seedTools(client);
    await client.query("COMMIT");

    console.log(
      "Seeded platform tools:",
      tools.map((t) => ({ id: t.id, name: t.name, handlerKey: t.handlerKey }))
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to seed platform tools:", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed();