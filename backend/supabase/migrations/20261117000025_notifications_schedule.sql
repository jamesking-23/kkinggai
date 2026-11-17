-- Phase 16: run the notification generator hourly (at minute 7). Requires the pg_cron extension (available on Supabase).
create extension if not exists pg_cron;
select cron.schedule('generate-notifications', '7 * * * *', 'select public.generate_notifications()');
