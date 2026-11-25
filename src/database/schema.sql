CREATE TABLE
    conversations (
        id UUID PRIMARY KEY,
        user_id UUID,
        title VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW (),
        updated_at TIMESTAMPTZ DEFAULT NOW ()
    );

CREATE TABLE
    messages (
        id UUID PRIMARY KEY,
        conversation_id UUID NOT NULL,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        token_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW (),
        CONSTRAINT fk_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
        CONSTRAINT chk_message_role CHECK (role IN ('user', 'model'))
    );

CREATE INDEX idx_messages_conversation_created ON messages (conversation_id, created_at);