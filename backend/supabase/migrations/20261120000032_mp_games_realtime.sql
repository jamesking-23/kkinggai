-- Push changes to multiplayer games to the people watching them. Realtime applies the table's
-- select policy, so a user only receives games they take part in (or are invited to).
alter publication supabase_realtime add table public.mp_games;
