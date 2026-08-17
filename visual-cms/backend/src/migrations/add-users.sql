-- Migration: Authentication — users table
-- Date: 2026-06-30
-- Учётки для входа в Visual CMS. Хранятся только bcrypt-хеши паролей.
-- Имена колонок — camelCase в кавычках (TypeORM-конвенция, см. add-collections.sql).
-- Все операции идемпотентны (IF NOT EXISTS) — безопасны для повторного запуска.

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username       VARCHAR(100) NOT NULL UNIQUE,
  "passwordHash" VARCHAR(255) NOT NULL,
  role           VARCHAR(32)  NOT NULL DEFAULT 'admin',
  "isActive"     BOOLEAN      NOT NULL DEFAULT true,
  "lastLoginAt"  TIMESTAMP,
  "createdAt"    TIMESTAMP    NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
