-- Run once in Supabase: SQL Editor > New query > paste > Run

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text not null default 'owner' check (role in ('admin','owner'))
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text, phone text, job_type text,
  stage text not null default 'New inquiry',
  due_date date, notes text,
  extra jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table field_definitions (
  id uuid primary key default gen_random_uuid(),
  label text not null, key text unique not null,
  field_type text not null default 'text', options jsonb, sort_order int default 0
);

create table email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null, subject text not null, body text not null,
  created_at timestamptz not null default now()
);

create function is_admin() returns boolean language sql security definer stable as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create function has_profile() returns boolean language sql security definer stable as
$$ select exists (select 1 from profiles where id = auth.uid()) $$;

create function handle_new_user() returns trigger language plpgsql security definer as
$$ begin insert into profiles (id) values (new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;
alter table leads enable row level security;
alter table field_definitions enable row level security;
alter table email_templates enable row level security;

create policy "read own profile or admin" on profiles for select using (id = auth.uid() or is_admin());
create policy "admin edits profiles" on profiles for all using (is_admin()) with check (is_admin());

create policy "staff read leads" on leads for select using (has_profile());
create policy "staff add leads" on leads for insert with check (has_profile());
create policy "staff update leads" on leads for update using (has_profile());
create policy "admin deletes leads" on leads for delete using (is_admin());

create policy "staff read fields" on field_definitions for select using (has_profile());
create policy "admin writes fields" on field_definitions for all using (is_admin()) with check (is_admin());
create policy "staff read templates" on email_templates for select using (has_profile());
create policy "admin writes templates" on email_templates for all using (is_admin()) with check (is_admin());

-- After creating your own user, make yourself admin (swap in your email):
-- update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
