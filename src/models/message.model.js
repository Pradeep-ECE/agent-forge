export const MESSAGE_ROLES = Object.freeze({
  USER: "user",
  MODEL: "model",
});

export class Message {
  constructor({
    id,
    conversation_id,
    role,
    content,
    token_count = 0,
    created_at = new Date(),
  }) {
    this.id = id;
    this.conversationId = conversation_id;
    this.role = role;
    this.content = content;
    this.tokenCount = token_count;
    this.createdAt = created_at;
  }

  static fromDatabase(row) {
    return new Message(row);
  }
}