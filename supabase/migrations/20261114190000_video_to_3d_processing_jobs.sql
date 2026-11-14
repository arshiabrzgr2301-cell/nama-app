-- NAMA asynchronous video-to-3D and stereoscopic processing jobs.
-- GPU work is performed by an external worker; clients can only enqueue and read jobs.

create table if not exists public.video_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  input_video_path text not null,
  processing_mode text not null check (processing_mode in ('spatial','stereo','both')),
  status text not null default 'queued'
    check (status in ('queued','processing','completed','failed')),
  progress smallint not null default 0 check (progress between 0 and 100),
  spatial_asset_path text,
  stereo_video_path text,
  worker_job_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists video_jobs_org_created_idx
  on public.video_processing_jobs(organization_id, created_at desc);
create index if not exists video_jobs_status_created_idx
  on public.video_processing_jobs(status, created_at)
  where status in ('queued','processing');

alter table public.video_processing_jobs enable row level security;

drop policy if exists nama_video_jobs_read_org on public.video_processing_jobs;
create policy nama_video_jobs_read_org on public.video_processing_jobs
for select to authenticated
using (private.nama_is_active_member(organization_id));

drop policy if exists nama_video_jobs_insert_org on public.video_processing_jobs;
create policy nama_video_jobs_insert_org on public.video_processing_jobs
for insert to authenticated
with check (
  created_by = auth.uid()
  and private.nama_is_active_member(organization_id)
  and exists (
    select 1 from public.properties p
    where p.id = video_processing_jobs.property_id
      and p.organization_id = video_processing_jobs.organization_id
      and p.video_path = video_processing_jobs.input_video_path
  )
);

-- No client UPDATE/DELETE policy: only the trusted processing worker may
-- change status, progress, errors, and output paths through service_role.
revoke all on public.video_processing_jobs from anon;
grant select, insert on public.video_processing_jobs to authenticated;
grant all on public.video_processing_jobs to service_role;

comment on table public.video_processing_jobs is
  'Asynchronous GPU jobs for spatial 3D reconstruction (Gaussian Splatting/NeRF) and stereo video generation. Worker-only writes.';
