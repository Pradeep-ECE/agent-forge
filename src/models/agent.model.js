
export class Agent {
  constructor({
    id,
    user_id,
    name,
    description = null,
    system_prompt,
    model,
    temperature = 0.7,
    is_active = true,
    created_at = new Date(),
    updated_at = new Date(),
  }) {
    this.id = id;
    this.userId = user_id;
    this.name = name;
    this.description = description;
    this.systemPrompt = system_prompt;
    this.model = model;
    this.temperature = Number(temperature);
    this.isActive = is_active;
    this.createdAt = created_at;
    this.updatedAt = updated_at;
  }

  static fromDatabase(row) {
    return new Agent(row);
  }
}
