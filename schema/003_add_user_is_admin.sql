-- Migration: add is_admin column to users table
-- Exchange rate writes are now restricted to admin users only.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" boolean NOT NULL DEFAULT false;
