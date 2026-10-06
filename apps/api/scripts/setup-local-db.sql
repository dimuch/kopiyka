-- One-time local setup, run as the MySQL root user:
--   mysql -u root -p < apps/api/scripts/setup-local-db.sql
-- Pick your own password: replace 'change-me' here and in apps/api/.env.
CREATE DATABASE IF NOT EXISTS kopiyka      CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS kopiyka_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'kopiyka'@'localhost' IDENTIFIED BY 'change-me';
CREATE USER IF NOT EXISTS 'kopiyka'@'127.0.0.1' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON kopiyka.*      TO 'kopiyka'@'localhost', 'kopiyka'@'127.0.0.1';
GRANT ALL PRIVILEGES ON kopiyka_test.* TO 'kopiyka'@'localhost', 'kopiyka'@'127.0.0.1';
