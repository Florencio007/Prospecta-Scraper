-- Create a table to store per-user SMTP settings
create table if not exists public.smtp_settings (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  host text not null,
  port integer not null default 587,
  username text not null, -- 'user' is a reserved keyword in some contexts, better use username
  password text not null, -- In a real prod env, this should be encrypted or stored in Vault
  from_email text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure one setting per user
  constraint smtp_settings_user_id_key unique (user_id)
);

-- Enable RLS
alter table public.smtp_settings enable row level security;

-- Policies
create policy "Users can view their own smtp settings"
  on public.smtp_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own smtp settings"
  on public.smtp_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own smtp settings"
  on public.smtp_settings for update
  using (auth.uid() = user_id);

create policy "Users can delete their own smtp settings"
  on public.smtp_settings for delete
  using (auth.uid() = user_id);

-- Trigger for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_smtp_settings_updated_at
  before update on public.smtp_settings
  for each row
  execute procedure public.handle_updated_at();
