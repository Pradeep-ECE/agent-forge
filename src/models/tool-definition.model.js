
export class ToolDefinition {
  constructor({
    id,
    name,
    description,
    handler_key,
    input_schema,
    is_active = true,
    created_at = new Date(),
    updated_at = new Date(),
  }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.handlerKey = handler_key;
    this.inputSchema = input_schema;
    this.isActive = is_active;
    this.createdAt = created_at;
    this.updatedAt = updated_at;
  }

  static fromDatabase(row) {
    return new ToolDefinition(row);
  }
}
