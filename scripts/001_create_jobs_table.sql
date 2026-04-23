-- Create jobs table for tracking photo enhancement jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text not null check (status in ('uploaded', 'processing_preview', 'preview_ready', 'processing_final', 'done', 'error')),
  style_mode text not null check (style_mode in ('daylight_4000k', 'cotton_candy_dusk', 'full_5star_fix')),
  file_list jsonb not null default '[]'::jsonb,
  error_message text,
  google_drive_link text
);

-- Enable RLS (though no auth for MVP, this is good practice)
alter table public.jobs enable row level security;

-- Allow all operations for now (since no auth in MVP)
create policy "jobs_select_all"
  on public.jobs for select
  using (true);

create policy "jobs_insert_all"
  on public.jobs for insert
  with check (true);

create policy "jobs_update_all"
  on public.jobs for update
  using (true);

create policy "jobs_delete_all"
  on public.jobs for delete
  using (true);

-- Create index for faster lookups
create index if not exists jobs_created_at_idx on public.jobs(created_at desc);
create index if not exists jobs_status_idx on public.jobs(status);
