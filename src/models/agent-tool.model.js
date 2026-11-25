export class AgentTool {
  constructor({
    user_id,
    agent_id,
    tool_id,
    configuration = {},
    is_enabled = true,
    created_at = new Date(),
    tool_name = null,
    tool_description = null,
    handler_key = null,
    input_schema = null,
    tool_is_active = null,
  }) {
    this.userId = user_id;
    this.agentId = agent_id;
    this.toolId = tool_id;
    this.configuration = configuration ?? {};
    this.isEnabled = is_enabled;
    this.createdAt = created_at;

    if (tool_name !== null) {
      this.tool = {
        id: tool_id,
        name: tool_name,
        description: tool_description,
        handlerKey: handler_key,
        inputSchema: input_schema,
        isActive: tool_is_active,
      };
    }
  }

  static fromDatabase(row) {
    return new AgentTool(row);
  }
}