-- Covering indexes for the foreign keys the Supabase performance advisor flagged (lint 0001).
-- Without them, deleting or updating a parent row scans the child table, and joins on these columns are slower.
-- Generated from pg_constraint so each index matches its constraint's column order. Safe to re-run.
do $$
declare
  fk record;
  idx text;
begin
  for fk in
    select c.conname, c.conrelid::regclass as tbl, cl.relname,
      (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
         from unnest(c.conkey) with ordinality k(attnum, ord)
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    where c.contype = 'f' and c.conname in (
    'ai_conversations_workspace_id_fkey',
    'ai_messages_conversation_id_owner_id_fkey',
    'ai_messages_owner_id_fkey',
    'assignments_course_id_workspace_id_fkey',
    'assignments_created_by_fkey',
    'audit_logs_actor_id_fkey',
    'card_reviews_card_id_workspace_id_fkey',
    'card_reviews_workspace_id_fkey',
    'chess_analyses_game_fk',
    'chess_puzzles_game_fk',
    'courses_created_by_fkey',
    'events_created_by_fkey',
    'flashcard_decks_course_id_workspace_id_fkey',
    'flashcard_decks_created_by_fkey',
    'flashcards_created_by_fkey',
    'flashcards_deck_id_workspace_id_fkey',
    'goals_created_by_fkey',
    'goals_project_id_workspace_id_fkey',
    'habit_logs_habit_id_workspace_id_fkey',
    'habit_logs_workspace_id_fkey',
    'habits_workspace_id_fkey',
    'idea_backlog_created_by_fkey',
    'idea_backlog_related_module_fkey',
    'interview_prep_application_id_user_id_fkey',
    'milestones_created_by_fkey',
    'milestones_goal_id_workspace_id_fkey',
    'milestones_project_id_workspace_id_fkey',
    'mp_games_creator_id_fkey',
    'mp_games_draw_offer_by_fkey',
    'mp_games_resigned_by_fkey',
    'mp_games_timed_out_by_fkey',
    'news_items_feed_id_user_id_fkey',
    'projects_created_by_fkey',
    'research_sources_course_id_workspace_id_fkey',
    'research_sources_created_by_fkey',
    'run_plan_sessions_plan_fk',
    'run_plan_sessions_user_id_fkey',
    'study_notes_course_id_workspace_id_fkey',
    'study_notes_created_by_fkey',
    'task_attachments_created_by_fkey',
    'task_attachments_task_id_workspace_id_fkey',
    'task_attachments_workspace_id_fkey',
    'task_completions_completed_by_fkey',
    'task_completions_task_id_workspace_id_fkey',
    'task_completions_workspace_id_fkey',
    'tasks_created_by_fkey',
    'tasks_parent_task_id_workspace_id_fkey',
    'tasks_project_id_workspace_id_fkey',
    'venture_contacts_venture_id_user_id_fkey',
    'venture_entries_venture_id_user_id_fkey',
    'venture_tasks_venture_id_user_id_fkey',
    'workspace_modules_module_id_fkey'
    )
  loop
    idx := left(fk.relname || '_' || left(fk.conname, 40) || '_idx', 63);
    execute format('create index if not exists %I on %s (%s)', idx, fk.tbl, fk.cols);
  end loop;
end $$;
