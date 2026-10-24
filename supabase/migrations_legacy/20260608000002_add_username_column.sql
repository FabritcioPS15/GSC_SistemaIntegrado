-- Migration: Add username to users and user_registration_requests tables

-- 1. Add username column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- 2. Add username column to user_registration_requests table
ALTER TABLE public.user_registration_requests 
ADD COLUMN IF NOT EXISTS username text;
