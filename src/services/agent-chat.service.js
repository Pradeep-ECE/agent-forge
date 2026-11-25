import { ai, MODEL } from "../config/ai.js";
import { withUserTransaction } from "../config/database.js";
import { findAgentById } from "../repositories/agent.repository.js";
import { findToolsByAgentId } from "../repositories/agent-tool.repository.js";
import {
  createConversation,
  findConversationById,
  updateConversationTimestamp,
} from "../repositories/conversation.repository.js";
import {
  createMessage,
  findMessagesByConversationId,
} from "../repositories/message.repository.js";
import { createToolExecutionLog } from "../repositories/tool-execution-log.repository.js";
import {
  buildGeminiFunctionDeclarations,
  executeAssignedTool,
} from "../tools/tool-executor.js";

const MAX_TOOL_ITERATIONS = 5;

/**
 * Shared Phase 1 helper: validates agent + session ownership, persists user message,
 * and loads conversation history + enabled agent tools.
 */
async function prepareAgentTurn({ userId, agentId, message, sessionId }) {
  return withUserTransaction(userId, async (client) => {
    const agent = await findAgentById(client, agentId, userId);
    if (!agent) {
      throw new Error("AGENT_NOT_FOUND");
    }

    if (!agent.isActive) {
      throw new Error("AGENT_INACTIVE");
    }

    let activeSessionId = sessionId;

    if (activeSessionId) {
      const existingConversation = await findConversationById(
        client,
        activeSessionId,
        userId
      );
      if (!existingConversation) {
        throw new Error("SESSION_NOT_FOUND");
      }
    } else {
      const newConversation = await createConversation(client, userId);
      activeSessionId = newConversation.id;
    }

    await createMessage(client, {
      conversationId: activeSessionId,
      userId,
      role: "user",
      content: message,
    });

    const history = await findMessagesByConversationId(
      client,
      activeSessionId,
      userId
    );

    const agentTools = await findToolsByAgentId(client, agentId, userId);

    return {
      agent,
      sessionId: activeSessionId,
      agentTools,
      contents: history.map((item) => ({
        role: item.role,
        parts: [{ text: item.content }],
      })),
    };
  });
}

/**
 * Shared Phase 3 helper: atomically persists final assistant response
 * and tool execution audit logs under user RLS context.
 */
async function persistAgentTurn({
  userId,
  agentId,
  sessionId,
  finalResponseText,
  totalOutputTokens,
  toolExecutions,
}) {
  await withUserTransaction(userId, async (client) => {
    const conversation = await findConversationById(
      client,
      sessionId,
      userId
    );
    if (!conversation) {
      throw new Error("SESSION_NOT_FOUND");
    }

    await createMessage(client, {
      conversationId: sessionId,
      userId,
      role: "model",
      content: finalResponseText,
      tokenCount: totalOutputTokens,
    });

    for (const exec of toolExecutions) {
      await createToolExecutionLog(client, {
        userId,
        agentId,
        conversationId: sessionId,
        toolId: exec.toolId,
        toolName: exec.toolName,
        iteration: exec.iteration,
        inputArgs: exec.args,
        outputResult: exec.ok ? exec.result : null,
        errorMessage: exec.ok ? null : exec.error,
        status: exec.ok ? "success" : "error",
        durationMs: exec.durationMs,
      });
    }

    await updateConversationTimestamp(client, sessionId, userId);
  });
}

/**
 * Standard request/response Agent Chat execution.
 */
export async function runAgentChat({
  userId,
  agentId,
  message,
  sessionId = null,
}) {
  const {
    agent,
    sessionId: resolvedSessionId,
    agentTools,
    contents,
  } = await prepareAgentTurn({ userId, agentId, message, sessionId });

  const functionDeclarations = buildGeminiFunctionDeclarations(agentTools);
  const generationConfig = {
    systemInstruction: agent.systemPrompt,
    temperature: agent.temperature,
    ...(functionDeclarations.length > 0
      ? { tools: [{ functionDeclarations }] }
      : {}),
  };

  const targetModel = agent.model || MODEL;
  const toolExecutions = [];
  let totalOutputTokens = 0;
  let finalResponseText = "";

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await ai.models.generateContent({
      model: targetModel,
      contents,
      config: generationConfig,
    });

    totalOutputTokens += response.usageMetadata?.candidatesTokenCount ?? 0;

    const functionCalls = response.functionCalls;

    if (!functionCalls || functionCalls.length === 0) {
      finalResponseText = response.text || "";
      break;
    }

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) {
      contents.push(modelContent);
    } else {
      contents.push({
        role: "model",
        parts: functionCalls.map((fc) => ({
          functionCall: {
            name: fc.name,
            args: fc.args ?? {},
          },
        })),
      });
    }

    const functionResponseParts = [];

    for (const fc of functionCalls) {
      const matchedAssignment = agentTools.find(
        (item) => item.tool?.name === fc.name
      );

      const execution = await executeAssignedTool({
        userId,
        agentId: agent.id,
        agentTools,
        toolName: fc.name,
        args: fc.args ?? {},
      });

      toolExecutions.push({
        toolId: matchedAssignment?.toolId ?? null,
        iteration: iteration + 1,
        toolName: fc.name,
        args: fc.args ?? {},
        ok: execution.ok,
        result: execution.ok ? execution.result : undefined,
        error: execution.ok ? undefined : execution.error,
        durationMs: execution.durationMs,
      });

      functionResponseParts.push({
        functionResponse: {
          name: fc.name,
          ...(fc.id ? { id: fc.id } : {}),
          response: execution.ok
            ? { output: execution.result }
            : { error: execution.error },
        },
      });
    }

    contents.push({
      role: "user",
      parts: functionResponseParts,
    });
  }

  if (!finalResponseText) {
    if (toolExecutions.length >= MAX_TOOL_ITERATIONS) {
      throw new Error("MAX_TOOL_ITERATIONS_EXCEEDED");
    }
    throw new Error("EMPTY_MODEL_RESPONSE");
  }

  await persistAgentTurn({
    userId,
    agentId: agent.id,
    sessionId: resolvedSessionId,
    finalResponseText,
    totalOutputTokens,
    toolExecutions,
  });

  return {
    agentId: agent.id,
    sessionId: resolvedSessionId,
    message,
    response: finalResponseText,
    toolExecutions: toolExecutions.map(({ toolId, ...publicFields }) => publicFields),
  };
}

/**
 * Streaming Agent Chat execution (SSE-compatible).
 */
export async function streamAgentChat({
  userId,
  agentId,
  message,
  sessionId = null,
  onEvent,
  signal,
}) {
  const {
    agent,
    sessionId: resolvedSessionId,
    agentTools,
    contents,
  } = await prepareAgentTurn({ userId, agentId, message, sessionId });

  onEvent("session", {
    agentId: agent.id,
    sessionId: resolvedSessionId,
  });

  const functionDeclarations = buildGeminiFunctionDeclarations(agentTools);
  const generationConfig = {
    systemInstruction: agent.systemPrompt,
    temperature: agent.temperature,
    ...(functionDeclarations.length > 0
      ? { tools: [{ functionDeclarations }] }
      : {}),
  };

  const targetModel = agent.model || MODEL;
  const toolExecutions = [];
  let totalOutputTokens = 0;
  let finalResponseText = "";

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    if (signal?.aborted) {
      throw new Error("STREAM_ABORTED");
    }

    const stream = await ai.models.generateContentStream({
      model: targetModel,
      contents,
      config: generationConfig,
    });

    const collectedFunctionCalls = [];
    const rawModelParts = [];
    let iterationText = "";
    let iterationOutputTokens = 0;

    for await (const chunk of stream) {
      if (signal?.aborted) {
        throw new Error("STREAM_ABORTED");
      }

      if (chunk.usageMetadata?.candidatesTokenCount != null) {
        iterationOutputTokens = chunk.usageMetadata.candidatesTokenCount;
      }

      const candidateParts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const part of candidateParts) {
        if (part.functionCall) {
          collectedFunctionCalls.push(part.functionCall);
          rawModelParts.push(part);
        } else if (part.thought) {
          rawModelParts.push(part);
        } else if (typeof part.text === "string" && part.text.length > 0) {
          iterationText += part.text;
          rawModelParts.push(part);
          onEvent("token", { text: part.text });
        }
      }
    }

    totalOutputTokens += iterationOutputTokens;

    if (collectedFunctionCalls.length === 0) {
      finalResponseText = iterationText;
      break;
    }

    contents.push({
      role: "model",
      parts: rawModelParts,
    });

    const functionResponseParts = [];

    for (const fc of collectedFunctionCalls) {
      const matchedAssignment = agentTools.find(
        (item) => item.tool?.name === fc.name
      );

      onEvent("tool_start", {
        iteration: iteration + 1,
        toolName: fc.name,
        args: fc.args ?? {},
      });

      const execution = await executeAssignedTool({
        userId,
        agentId: agent.id,
        agentTools,
        toolName: fc.name,
        args: fc.args ?? {},
      });

      const execRecord = {
        toolId: matchedAssignment?.toolId ?? null,
        iteration: iteration + 1,
        toolName: fc.name,
        args: fc.args ?? {},
        ok: execution.ok,
        result: execution.ok ? execution.result : undefined,
        error: execution.ok ? undefined : execution.error,
        durationMs: execution.durationMs,
      };

      toolExecutions.push(execRecord);

      onEvent("tool_result", {
        iteration: execRecord.iteration,
        toolName: execRecord.toolName,
        ok: execRecord.ok,
        result: execRecord.result,
        error: execRecord.error,
        durationMs: execRecord.durationMs,
      });

      functionResponseParts.push({
        functionResponse: {
          name: fc.name,
          ...(fc.id ? { id: fc.id } : {}),
          response: execution.ok
            ? { output: execution.result }
            : { error: execution.error },
        },
      });
    }

    contents.push({
      role: "user",
      parts: functionResponseParts,
    });
  }

  if (!finalResponseText) {
    if (toolExecutions.length >= MAX_TOOL_ITERATIONS) {
      throw new Error("MAX_TOOL_ITERATIONS_EXCEEDED");
    }
    throw new Error("EMPTY_MODEL_RESPONSE");
  }

  await persistAgentTurn({
    userId,
    agentId: agent.id,
    sessionId: resolvedSessionId,
    finalResponseText,
    totalOutputTokens,
    toolExecutions,
  });

  const publicToolExecutions = toolExecutions.map(
    ({ toolId, ...publicFields }) => publicFields
  );

  onEvent("done", {
    agentId: agent.id,
    sessionId: resolvedSessionId,
    response: finalResponseText,
    totalOutputTokens,
    toolExecutions: publicToolExecutions,
  });
}