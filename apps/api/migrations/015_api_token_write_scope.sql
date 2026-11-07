-- Brief 069: a 'write' token may also use the routes in apiTokens/auth.ts.
ALTER TABLE api_tokens MODIFY COLUMN scope ENUM('read', 'write') NOT NULL;
