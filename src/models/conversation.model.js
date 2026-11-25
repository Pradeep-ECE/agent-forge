export class Conversation {
  constructor({
    id,
    user_id = null,
    title = null,
    created_at = new Date(),
    updated_at = new Date(),
  }) {
    this.id = id;
    this.userId = user_id;
    this.title = title;
    this.createdAt = created_at;
    this.updatedAt = updated_at;
  }

  static fromDatabase(row) {
    return new Conversation(row);
  }
}