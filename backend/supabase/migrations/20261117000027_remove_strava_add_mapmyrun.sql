-- Strava no longer offers its API to non-subscribers, so the Strava connection is removed. Runs are brought in by
-- uploading exported files instead. The table held no rows at the time of the change (checked before applying).
-- Runs already imported keep source 'strava'; the source list gains 'mapmyrun' for files exported from MapMyRun.
drop table if exists public.strava_connections;

alter table public.run_activities drop constraint run_activities_source_check;
alter table public.run_activities add constraint run_activities_source_check
  check (source in ('manual','gpx','strava','samsung','mapmyrun'));
