-- Brief 063: tokens for the MCP connector (apps/mcp). Removing the connector drops this table in a new migration.
CREATE TABLE IF NOT EXISTS api_tokens (
  token_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash  CHAR(64)     NOT NULL UNIQUE,        -- sha256 of the token, as for sessions; the token is never stored
  user_id     INT UNSIGNED NOT NULL,
  scope       ENUM('read') NOT NULL,               -- read-only in v1; the write brief adds 'write'
  label       VARCHAR(100) NOT NULL DEFAULT '',    -- the OAuth client's name, e.g. 'Claude'
  expires_at  DATETIME     NOT NULL,               -- absolute: issued + API_TOKEN_TTL_MINUTES, never renewed
  created_at  DATETIME     NOT NULL,               -- set from the app clock, like sessions
  INDEX (user_id),
  INDEX (expires_at),
  CONSTRAINT fk_api_tokens_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);
