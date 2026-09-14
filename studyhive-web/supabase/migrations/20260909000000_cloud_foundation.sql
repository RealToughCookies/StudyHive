-- StudyHive cloud foundation. Apply once to a new Supabase project.
begin;
create table public.users (
  id bigint generated always as identity primary key,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null check (length(username) between 1 and 80),
  email text not null,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'premium')),
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.users enable row level security;
revoke all on public.users from anon, authenticated;
grant select on public.users to authenticated;
create policy own_profile on public.users for select to authenticated using (auth_user_id = (select auth.uid()));

-- Resolve the numeric application identity from the verified authentication identity.
create function public.current_profile_id() returns bigint language sql stable security definer set search_path = '' as $$
  select p.id from public.users p join auth.users a on a.id = p.auth_user_id
    where p.auth_user_id = (select auth.uid()) and a.email_confirmed_at is not null
$$;
revoke all on function public.current_profile_id() from public;
grant execute on function public.current_profile_id() to authenticated;
create function public.has_pro() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select subscription_tier = 'premium' and subscription_expires_at > now()
    from public.users where auth_user_id = (select auth.uid())), false)
$$;
revoke all on function public.has_pro() from public;
grant execute on function public.has_pro() to authenticated;

create table public.classes (
  id bigint generated always as identity primary key,
  user_id bigint not null default public.current_profile_id() references public.users(id) on delete cascade,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now(),
  unique (id, user_id),
  check (length(name) between 1 and 100)
);

alter table public.classes enable row level security;
revoke all on public.classes from anon, authenticated;
grant select, insert, update, delete on public.classes to authenticated;
create policy own_read on public.classes for select to authenticated using (user_id = (select public.current_profile_id()));
create policy own_delete on public.classes for delete to authenticated using (user_id = (select public.current_profile_id()));

create policy own_insert on public.classes for insert to authenticated with check (user_id = (select public.current_profile_id()));
create policy own_update on public.classes for update to authenticated using (user_id = (select public.current_profile_id())) with check (user_id = (select public.current_profile_id()));
create index on public.classes (user_id);

create table public.notes (
  id bigint generated always as identity primary key,
  user_id bigint not null default public.current_profile_id() references public.users(id) on delete cascade,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  class_id bigint,
  revision bigint not null default 1,
  unique (id, user_id),
  check (length(title) between 1 and 300),
  check (octet_length(content) <= 2000000)
);

alter table public.notes enable row level security;
revoke all on public.notes from anon, authenticated;
grant select, insert, update, delete on public.notes to authenticated;
create policy own_read on public.notes for select to authenticated using (user_id = (select public.current_profile_id()));
create policy own_delete on public.notes for delete to authenticated using (user_id = (select public.current_profile_id()));

create policy own_insert on public.notes for insert to authenticated with check (user_id = (select public.current_profile_id()));
create policy own_update on public.notes for update to authenticated using (user_id = (select public.current_profile_id())) with check (user_id = (select public.current_profile_id()));
create index on public.notes (user_id);

create table public.flashcard_decks (
  id bigint generated always as identity primary key,
  user_id bigint not null default public.current_profile_id() references public.users(id) on delete cascade,
  name TEXT NOT NULL,
  class_id bigint,
  note_id bigint,
  created_at timestamptz DEFAULT now(),
  spaced_repetition_enabled boolean not null default false,
  unique (id, user_id)
);

alter table public.flashcard_decks enable row level security;
revoke all on public.flashcard_decks from anon, authenticated;
grant select, insert, update, delete on public.flashcard_decks to authenticated;
create policy own_read on public.flashcard_decks for select to authenticated using (user_id = (select public.current_profile_id()));
create policy own_delete on public.flashcard_decks for delete to authenticated using (user_id = (select public.current_profile_id()));

create policy own_insert on public.flashcard_decks for insert to authenticated with check (user_id = (select public.current_profile_id()) and (not spaced_repetition_enabled or (select public.has_pro())));
create policy own_update on public.flashcard_decks for update to authenticated using (user_id = (select public.current_profile_id())) with check (user_id = (select public.current_profile_id()) and (not spaced_repetition_enabled or (select public.has_pro())));
create index on public.flashcard_decks (user_id);

create table public.flashcards (
  id bigint generated always as identity primary key,
  note_id bigint,
  deck_id bigint,
  user_id bigint not null default public.current_profile_id() references public.users(id) on delete cascade,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  created_at timestamptz DEFAULT now(),
  class_id bigint,
  unique (id, user_id),
  check (length(front) between 1 and 20000 and length(back) between 1 and 20000)
);

alter table public.flashcards enable row level security;
revoke all on public.flashcards from anon, authenticated;
grant select, insert, update, delete on public.flashcards to authenticated;
create policy own_read on public.flashcards for select to authenticated using (user_id = (select public.current_profile_id()));
create policy own_delete on public.flashcards for delete to authenticated using (user_id = (select public.current_profile_id()));

create policy own_insert on public.flashcards for insert to authenticated with check (user_id = (select public.current_profile_id()));
create policy own_update on public.flashcards for update to authenticated using (user_id = (select public.current_profile_id())) with check (user_id = (select public.current_profile_id()));
create index on public.flashcards (user_id);

create table public.quizzes (
  id bigint generated always as identity primary key,
  note_id bigint,
  user_id bigint not null default public.current_profile_id() references public.users(id) on delete cascade,
  title TEXT NOT NULL,
  questions TEXT NOT NULL,
  created_at timestamptz DEFAULT now(),
  class_id bigint,
  unique (id, user_id)
);

alter table public.quizzes enable row level security;
revoke all on public.quizzes from anon, authenticated;
grant select, insert, update, delete on public.quizzes to authenticated;
create policy own_read on public.quizzes for select to authenticated using (user_id = (select public.current_profile_id()));
create policy own_delete on public.quizzes for delete to authenticated using (user_id = (select public.current_profile_id()));

create policy own_insert on public.quizzes for insert to authenticated with check (user_id = (select public.current_profile_id()) and (select public.has_pro()));
create policy own_update on public.quizzes for update to authenticated using (user_id = (select public.current_profile_id())) with check (user_id = (select public.current_profile_id()) and (select public.has_pro()));
create index on public.quizzes (user_id);

create table public.quiz_attempts (
  id bigint generated always as identity primary key,
  quiz_id bigint NOT NULL,
  user_id bigint not null default public.current_profile_id() references public.users(id) on delete cascade,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  answers TEXT NOT NULL,
  completed_at timestamptz DEFAULT now(),
  unique (id, user_id),
  check (total > 0 and score between 0 and total)
);

alter table public.quiz_attempts enable row level security;
revoke all on public.quiz_attempts from anon, authenticated;
grant select, insert, update, delete on public.quiz_attempts to authenticated;
create policy own_read on public.quiz_attempts for select to authenticated using (user_id = (select public.current_profile_id()));
create policy own_delete on public.quiz_attempts for delete to authenticated using (user_id = (select public.current_profile_id()));

create policy own_insert on public.quiz_attempts for insert to authenticated with check (user_id = (select public.current_profile_id()) and (select public.has_pro()));
create policy own_update on public.quiz_attempts for update to authenticated using (user_id = (select public.current_profile_id())) with check (user_id = (select public.current_profile_id()) and (select public.has_pro()));
create index on public.quiz_attempts (user_id);

create table public.pomodoro_sessions (
  id bigint generated always as identity primary key,
  user_id bigint not null default public.current_profile_id() references public.users(id) on delete cascade,
  duration_minutes INTEGER NOT NULL,
  completed boolean not null default false,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  unique (id, user_id),
  check (duration_minutes between 1 and 180)
);

alter table public.pomodoro_sessions enable row level security;
revoke all on public.pomodoro_sessions from anon, authenticated;
grant select, insert, update, delete on public.pomodoro_sessions to authenticated;
create policy own_read on public.pomodoro_sessions for select to authenticated using (user_id = (select public.current_profile_id()));
create policy own_delete on public.pomodoro_sessions for delete to authenticated using (user_id = (select public.current_profile_id()));

create policy own_insert on public.pomodoro_sessions for insert to authenticated with check (user_id = (select public.current_profile_id()));
create policy own_update on public.pomodoro_sessions for update to authenticated using (user_id = (select public.current_profile_id())) with check (user_id = (select public.current_profile_id()));
create index on public.pomodoro_sessions (user_id);

create table public.settings (
  id bigint generated always as identity primary key,
  user_id bigint not null default public.current_profile_id() references public.users(id) on delete cascade unique,
  theme TEXT DEFAULT 'blue',
  dark_mode boolean not null default false,
  pomodoro_work_minutes INTEGER DEFAULT 25,
  pomodoro_break_minutes INTEGER DEFAULT 5,
  pomodoro_long_break_minutes INTEGER DEFAULT 15,
  notification_sound boolean not null default true,
  timer_sound boolean not null default true,
  show_floating_timer boolean not null default true,
  pause_on_blur boolean not null default false,
  auto_resume_on_focus boolean not null default false,
  shortcuts text,
  unique (id, user_id),
  check (theme in ('blue', 'green', 'purple', 'amber', 'rose')),
  check (pomodoro_work_minutes between 1 and 180 and pomodoro_break_minutes between 1 and 60 and pomodoro_long_break_minutes between 1 and 60)
);

alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;
grant select, insert, update, delete on public.settings to authenticated;
create policy own_read on public.settings for select to authenticated using (user_id = (select public.current_profile_id()));
create policy own_delete on public.settings for delete to authenticated using (user_id = (select public.current_profile_id()));

create policy own_insert on public.settings for insert to authenticated with check (user_id = (select public.current_profile_id()));
create policy own_update on public.settings for update to authenticated using (user_id = (select public.current_profile_id())) with check (user_id = (select public.current_profile_id()));
create index on public.settings (user_id);

create table public.note_attachments (
  id bigint generated always as identity primary key,
  note_id bigint NOT NULL,
  user_id bigint not null default public.current_profile_id() references public.users(id) on delete cascade,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at timestamptz DEFAULT now(),
  unique (id, user_id),
  check (file_size between 0 and 10485760),
  check (filename like user_id::text || '/%')
);

alter table public.note_attachments enable row level security;
revoke all on public.note_attachments from anon, authenticated;
grant select, insert, update, delete on public.note_attachments to authenticated;
create policy own_read on public.note_attachments for select to authenticated using (user_id = (select public.current_profile_id()));
create policy own_delete on public.note_attachments for delete to authenticated using (user_id = (select public.current_profile_id()));

create policy own_insert on public.note_attachments for insert to authenticated with check (user_id = (select public.current_profile_id()));
create policy own_update on public.note_attachments for update to authenticated using (user_id = (select public.current_profile_id())) with check (user_id = (select public.current_profile_id()));
create index on public.note_attachments (user_id);

create table public.sticky_notes (
  id bigint generated always as identity primary key,
  user_id bigint not null default public.current_profile_id() references public.users(id) on delete cascade,
  content TEXT NOT NULL DEFAULT '',
  position_x INTEGER DEFAULT 100,
  position_y INTEGER DEFAULT 100,
  width INTEGER DEFAULT 200,
  height INTEGER DEFAULT 150,
  color TEXT DEFAULT '#fef08a',
  is_visible boolean not null default true,
  is_minimized boolean not null default false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  unique (id, user_id)
);

alter table public.sticky_notes enable row level security;
revoke all on public.sticky_notes from anon, authenticated;
grant select, insert, update, delete on public.sticky_notes to authenticated;
create policy own_read on public.sticky_notes for select to authenticated using (user_id = (select public.current_profile_id()));
create policy own_delete on public.sticky_notes for delete to authenticated using (user_id = (select public.current_profile_id()));

create policy own_insert on public.sticky_notes for insert to authenticated with check (user_id = (select public.current_profile_id()));
create policy own_update on public.sticky_notes for update to authenticated using (user_id = (select public.current_profile_id())) with check (user_id = (select public.current_profile_id()));
create index on public.sticky_notes (user_id);

create table public.reminders (
  id bigint generated always as identity primary key,
  user_id bigint not null default public.current_profile_id() references public.users(id) on delete cascade,
  title TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  time TEXT,
  color TEXT DEFAULT '#3b82f6',
  priority INTEGER DEFAULT 0,
  repeat TEXT,
  completed boolean not null default false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  unique (id, user_id)
);

alter table public.reminders enable row level security;
revoke all on public.reminders from anon, authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
create policy own_read on public.reminders for select to authenticated using (user_id = (select public.current_profile_id()));
create policy own_delete on public.reminders for delete to authenticated using (user_id = (select public.current_profile_id()));

create policy own_insert on public.reminders for insert to authenticated with check (user_id = (select public.current_profile_id()));
create policy own_update on public.reminders for update to authenticated using (user_id = (select public.current_profile_id())) with check (user_id = (select public.current_profile_id()));
create index on public.reminders (user_id);

alter table public.notes add foreign key (class_id, user_id) references public.classes(id, user_id) on delete set null (class_id);

alter table public.flashcard_decks add foreign key (class_id, user_id) references public.classes(id, user_id) on delete set null (class_id);

alter table public.flashcard_decks add foreign key (note_id, user_id) references public.notes(id, user_id) on delete set null (note_id);

alter table public.flashcards add foreign key (class_id, user_id) references public.classes(id, user_id) on delete set null (class_id);

alter table public.flashcards add foreign key (note_id, user_id) references public.notes(id, user_id) on delete set null (note_id);

alter table public.flashcards add foreign key (deck_id, user_id) references public.flashcard_decks(id, user_id) on delete cascade;

alter table public.quizzes add foreign key (class_id, user_id) references public.classes(id, user_id) on delete set null (class_id);

alter table public.quizzes add foreign key (note_id, user_id) references public.notes(id, user_id) on delete set null (note_id);

alter table public.quiz_attempts add foreign key (quiz_id, user_id) references public.quizzes(id, user_id) on delete cascade;

alter table public.note_attachments add foreign key (note_id, user_id) references public.notes(id, user_id) on delete cascade;


-- Only the account trigger creates settings; the browser may update its own preferences.
revoke insert, delete on public.settings from authenticated;

create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
declare profile_id bigint;
begin
  insert into public.users(auth_user_id, username, email)
    values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), 'Student'), 80), coalesce(new.email, '')) returning id into profile_id;
  insert into public.settings(user_id) values (profile_id);
  return new;
end;
$$;
revoke all on function public.create_profile() from public;
create trigger studyhive_new_account after insert on auth.users for each row execute function public.create_profile();

-- Atomically create a complete deck; an invalid card rolls the entire request back.
create function public.create_flashcard_deck(deck_name text, cards jsonb, class_ref bigint default null, note_ref bigint default null)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare deck bigint; card jsonb;
begin
  if jsonb_typeof(cards) <> 'array' or jsonb_array_length(cards) < 1 or jsonb_array_length(cards) > 500
    or length(trim(deck_name)) not between 1 and 200 then
    raise exception 'A deck needs a name and 1 to 500 cards';
  end if;
  insert into public.flashcard_decks(name, class_id, note_id) values (trim(deck_name), class_ref, note_ref) returning id into deck;
  for card in select * from jsonb_array_elements(cards) loop
    insert into public.flashcards(deck_id, class_id, note_id, front, back)
      values (deck, class_ref, note_ref, card->>'front', card->>'back');
  end loop;
  return deck;
end;
$$;
revoke all on function public.create_flashcard_deck(text,jsonb,bigint,bigint) from public;
grant execute on function public.create_flashcard_deck(text,jsonb,bigint,bigint) to authenticated;

create function public.advance_note_revision() returns trigger language plpgsql set search_path = '' as $$
begin new.revision := old.revision + 1; new.updated_at := now(); return new; end;
$$;
revoke all on function public.advance_note_revision() from public;
create trigger advance_note_revision before update on public.notes for each row execute function public.advance_note_revision();

-- Optimistic concurrency prevents a stale tab/device from silently replacing a newer note.
create function public.save_note(note_ref bigint, expected_revision bigint, note_title text, note_content text, class_ref bigint default null)
returns setof public.notes language plpgsql security invoker set search_path = '' as $$
begin
  return query update public.notes set title = note_title, content = note_content, class_id = class_ref,
    updated_at = now(), revision = revision + 1
    where id = note_ref and revision = expected_revision returning *;
  if not found then raise exception 'This note changed on another device or was deleted. Keep a copy of your edits and reopen it before saving.'; end if;
end;
$$;
revoke all on function public.save_note(bigint,bigint,text,text,bigint) from public;
grant execute on function public.save_note(bigint,bigint,text,text,bigint) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('study-files', 'study-files', false, 10485760, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/png','image/jpeg','image/gif','image/webp']);
create policy study_files_read on storage.objects for select to authenticated
  using (bucket_id = 'study-files' and (storage.foldername(name))[1] = (select public.current_profile_id())::text);
create policy study_files_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'study-files' and (storage.foldername(name))[1] = (select public.current_profile_id())::text);
create policy study_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'study-files' and (storage.foldername(name))[1] = (select public.current_profile_id())::text);
commit;
