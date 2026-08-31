-- Optional: promote a user to admin after signup
-- Run in Supabase SQL editor with the user's auth.users id:

-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
-- where email = 'admin@yourdomain.com';

-- update public.profiles set role = 'admin' where email = 'admin@yourdomain.com';
