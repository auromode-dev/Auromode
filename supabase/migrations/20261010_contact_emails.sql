-- Existing enquiries are not emailed retroactively.
begin;
alter table public.enquiries add column if not exists notify_email boolean not null default false;
alter table public.enquiries add column if not exists guest_email_sent boolean not null default false;
alter table public.enquiries add column if not exists admin_email_sent boolean not null default false;
alter table public.enquiries add column if not exists email_locked_until timestamptz;
alter table public.enquiries add column if not exists email_next_attempt_at timestamptz not null default now();
create or replace function public.claim_enquiry_emails(p_id uuid default null) returns setof public.enquiries language sql security definer set search_path=public as $$
 update enquiries set email_locked_until=now()+interval '5 minutes' where id in (
 select id from enquiries where notify_email and (not guest_email_sent or not admin_email_sent)
 and (p_id is null or id=p_id) and email_next_attempt_at<=now() and (email_locked_until is null or email_locked_until<now())
 order by created_at for update skip locked limit 10) returning *;
$$;
revoke all on function public.claim_enquiry_emails(uuid) from public,anon,authenticated;
grant execute on function public.claim_enquiry_emails(uuid) to service_role;
notify pgrst,'reload schema';
commit;
