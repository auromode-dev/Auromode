-- Run once in the Supabase SQL editor before configuring the application.
create extension if not exists btree_gist;
create table public.rooms (
 id uuid primary key default gen_random_uuid(), name text not null,
 category text not null check(category in ('standard','deluxe','family','long-stay')),
 capacity integer not null check(capacity between 1 and 4),
 nightly_rate integer not null check(nightly_rate > 0), -- INR paise, tax inclusive
 active boolean not null default true, image_url text,
 cancellation_terms text not null default 'Contact reception for cancellation terms before paying.',
 created_at timestamptz not null default now()
);
create table public.bookings (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms,
 checkin date not null, checkout date not null, adults integer not null check(adults between 1 and 4),
 children integer not null default 0 check(children between 0 and 3),
 first_name text not null, last_name text not null, email text not null, phone text not null,
 requests text not null default '', whatsapp_opt_in boolean not null default false, amount integer not null check(amount>0),
 status text not null default 'pending' check(status in ('pending','confirmed','cancelled','expired','payment_review')),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','paid','refund_required','refunded')),
 razorpay_order_id text unique, razorpay_payment_id text unique,
 hold_expires_at timestamptz not null default now()+interval '15 minutes',
 created_at timestamptz not null default now(), check(checkout>checkin),
 constraint no_overlapping_stays exclude using gist (room_id with =, daterange(checkin,checkout,'[)') with &&) where(status in ('pending','confirmed'))
);
create table public.enquiries (id uuid primary key default gen_random_uuid(),name text not null,email text not null,phone text,subject text not null,message text not null,created_at timestamptz not null default now());
create table public.notification_outbox(id uuid primary key default gen_random_uuid(),booking_id uuid references public.bookings,event text not null,payload jsonb not null default '{}',created_at timestamptz not null default now(),delivered_at timestamptz,unique(booking_id,event));
create function public.is_admin() returns boolean language sql stable set search_path=public as $$ select coalesce(auth.jwt()->'app_metadata'->>'role','')='admin' $$;
alter table public.rooms enable row level security;
alter table public.bookings enable row level security;
alter table public.enquiries enable row level security;
alter table public.notification_outbox enable row level security;
create policy admin_rooms on public.rooms for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_bookings on public.bookings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_enquiries on public.enquiries for select to authenticated using(public.is_admin());
create policy admin_notifications on public.notification_outbox for select to authenticated using(public.is_admin());
create function public.available_rooms(p_category text,p_checkin date,p_checkout date,p_guests integer)
returns table(id uuid,name text,nightly_rate integer,cancellation_terms text) language sql security definer set search_path=public as $$
 select r.id,r.name,r.nightly_rate,r.cancellation_terms from rooms r where r.active and r.category=p_category and r.capacity>=p_guests and p_checkout>p_checkin and p_checkin >= (now() at time zone 'Asia/Kolkata')::date
 and not exists(select 1 from bookings b where b.room_id=r.id and (b.status='confirmed' or (b.status='pending' and b.hold_expires_at>now())) and daterange(b.checkin,b.checkout,'[)') && daterange(p_checkin,p_checkout,'[)')) order by r.nightly_rate,r.id;
$$;
create function public.reserve_room(p_category text,p_checkin date,p_checkout date,p_adults integer,p_children integer,p_guest jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare selected rooms; reservation bookings;
begin
 if p_checkin<(now() at time zone 'Asia/Kolkata')::date or p_checkout<=p_checkin or p_checkout-p_checkin>180 or p_adults<1 or p_children<0 then raise exception 'Invalid stay'; end if;
 perform pg_advisory_xact_lock(hashtext('auromode_reservation'));
 update bookings set status='expired' where status='pending' and hold_expires_at<=now();
 select r.* into selected from rooms r join available_rooms(p_category,p_checkin,p_checkout,p_adults+p_children) a on a.id=r.id order by r.nightly_rate,r.id limit 1 for update of r;
 if selected.id is null then raise exception 'No room available'; end if;
 if (p_guest->>'expectedAmount')::integer is distinct from selected.nightly_rate*(p_checkout-p_checkin) then raise exception 'Rate changed. Check availability again'; end if;
 insert into bookings(room_id,checkin,checkout,adults,children,first_name,last_name,email,phone,requests,whatsapp_opt_in,amount)
 values(selected.id,p_checkin,p_checkout,p_adults,p_children,p_guest->>'firstName',p_guest->>'lastName',p_guest->>'email',p_guest->>'phone',coalesce(p_guest->>'requests',''),coalesce((p_guest->>'whatsappOptIn')::boolean,false),selected.nightly_rate*(p_checkout-p_checkin)) returning * into reservation;
 return jsonb_build_object('id',reservation.id,'amount',reservation.amount);
end $$;
create function public.confirm_payment(p_order_id text,p_payment_id text,p_amount integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare b bookings;
begin
 perform pg_advisory_xact_lock(hashtext('auromode_reservation'));
 select * into b from bookings where razorpay_order_id=p_order_id for update;
 if b.id is null or b.amount<>p_amount then raise exception 'Payment mismatch'; end if;
 if b.razorpay_payment_id=p_payment_id and b.payment_status in ('paid','refund_required','refunded') then return jsonb_build_object('id',b.id,'status',b.status); end if;
 if b.status in ('cancelled','expired','payment_review') or (b.status='pending' and b.hold_expires_at<=now()) then
 update bookings set status='payment_review',payment_status='refund_required',razorpay_payment_id=p_payment_id where id=b.id;
 return jsonb_build_object('id',b.id,'status','payment_review');
 end if;
 update bookings set status='confirmed',payment_status='paid',razorpay_payment_id=p_payment_id where id=b.id;
 return jsonb_build_object('id',b.id,'status','confirmed');
end $$;
create function public.queue_booking_notification() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='INSERT' then
 insert into notification_outbox(booking_id,event) values(new.id,'new_booking') on conflict do nothing;
 elsif old.status is distinct from new.status then
 insert into notification_outbox(booking_id,event) values(new.id,new.status) on conflict do nothing;
 end if;
 if TG_OP='UPDATE' and old.payment_status='paid' and new.status='cancelled' then new.payment_status='refund_required'; end if;
 return new;
end $$;
create trigger queue_booking_event after insert or update on public.bookings for each row execute function public.queue_booking_notification();
-- Cancellation must retain the payment record and flag it for a real provider refund.
create function public.flag_refund() returns trigger language plpgsql set search_path=public as $$ begin if new.status='cancelled' and old.payment_status='paid' then new.payment_status='refund_required'; end if; return new; end $$;
create trigger cancellation_refund before update on public.bookings for each row execute function public.flag_refund();
revoke all on function public.available_rooms(text,date,date,integer) from public,anon,authenticated;
revoke all on function public.reserve_room(text,date,date,integer,integer,jsonb) from public,anon,authenticated;
revoke all on function public.confirm_payment(text,text,integer) from public,anon,authenticated;
grant execute on function public.available_rooms(text,date,date,integer) to service_role;
grant execute on function public.reserve_room(text,date,date,integer,integer,jsonb) to service_role;
grant execute on function public.confirm_payment(text,text,integer) to service_role;
alter publication supabase_realtime add table public.bookings;
-- Approved inventory is imported at the end of this bootstrap.
-- Notification delivery configuration and exclusive worker leases.

alter table public.notification_outbox add column locked_until timestamptz;
alter table public.notification_outbox add column next_attempt_at timestamptz not null default now();
alter table public.notification_outbox add column admin_email_sent boolean not null default false;
alter table public.notification_outbox add column guest_email_sent boolean not null default false;
alter table public.notification_outbox add column admin_whatsapp_sent boolean not null default false;
alter table public.notification_outbox add column guest_whatsapp_sent boolean not null default false;
create function public.claim_notifications() returns setof public.notification_outbox language sql security definer set search_path=public as $$
 update notification_outbox set locked_until=now()+interval '5 minutes' where id in (select id from notification_outbox where delivered_at is null and next_attempt_at<=now() and (locked_until is null or locked_until<now()) order by created_at for update skip locked limit 10) returning *;
$$;
revoke all on function public.claim_notifications() from public,anon,authenticated;
grant execute on function public.claim_notifications() to service_role;
-- Admin-only uploads, public room photography. No guest files in this bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('room-images','room-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy room_image_upload on storage.objects for insert to authenticated with check(bucket_id='room-images' and public.is_admin());
create policy room_image_update on storage.objects for update to authenticated using(bucket_id='room-images' and public.is_admin()) with check(bucket_id='room-images' and public.is_admin());
create policy room_image_delete on storage.objects for delete to authenticated using(bucket_id='room-images' and public.is_admin());

-- Room categories, verified inventory, seasonal price fields and gallery support.
-- Apply to the existing project in Supabase SQL Editor. Transactional and rerunnable.
-- 34 physical rooms; INR paise, per room/night, taxes included. Non-season rates active.
begin;
alter table public.rooms drop constraint if exists rooms_category_check;
update public.rooms set category=case capacity when 1 then 'studio' when 2 then 'twin' when 3 then 'triple' else 'family' end where category not in ('studio','twin','triple','family');
alter table public.rooms add constraint rooms_category_check check(category in ('studio','twin','triple','family'));
alter table public.rooms add column if not exists room_number integer;
alter table public.rooms add column if not exists season_rate integer;
alter table public.rooms add column if not exists non_season_rate integer;
alter table public.rooms add column if not exists image_urls text[] not null default '{}';
update public.rooms set season_rate=coalesce(season_rate,nightly_rate),non_season_rate=coalesce(non_season_rate,nightly_rate),image_urls=case when cardinality(image_urls)=0 and image_url is not null then array[image_url] else image_urls end;
alter table public.rooms alter column season_rate set not null;
alter table public.rooms alter column non_season_rate set not null;
create unique index if not exists rooms_number_unique on public.rooms(room_number);
alter table public.rooms drop constraint if exists rooms_rates_positive;
alter table public.rooms add constraint rooms_rates_positive check(season_rate>0 and non_season_rate>0);
alter table public.rooms drop constraint if exists rooms_gallery_limit;
alter table public.rooms add constraint rooms_gallery_limit check(cardinality(image_urls)<=12);
-- Keep online pricing on non-season rates until season dates are agreed.
create or replace function public.sync_room_details() returns trigger language plpgsql set search_path=public as $$
begin
 new.nightly_rate:=new.non_season_rate;
 new.image_url:=new.image_urls[1];
 return new;
end $$;
drop trigger if exists sync_room_details on public.rooms;
create trigger sync_room_details before insert or update on public.rooms for each row execute function public.sync_room_details();
-- Adopt exact numbered labels when migrating an existing numbered inventory.
update public.rooms set room_number=substring(name from '[0-9]+')::integer where room_number is null and name ~* '^Room[[:space:]]+[0-9]+$';
insert into public.rooms(room_number,name,category,capacity,season_rate,non_season_rate,nightly_rate,image_urls)
select room_number,name,category,capacity,season_rate,non_season_rate,non_season_rate,image_urls
from jsonb_to_recordset($inventory$[{"room_number":1,"name":"Room 01","category":"triple","capacity":3,"season_rate":400000,"non_season_rate":350000,"image_urls":["/images/triple.jpg"]},{"room_number":2,"name":"Room 02","category":"family","capacity":4,"season_rate":450000,"non_season_rate":400000,"image_urls":["/images/family-suite.jpg"]},{"room_number":3,"name":"Room 03","category":"triple","capacity":3,"season_rate":400000,"non_season_rate":350000,"image_urls":["/images/triple.jpg"]},{"room_number":4,"name":"Room 04","category":"triple","capacity":3,"season_rate":400000,"non_season_rate":350000,"image_urls":["/images/triple.jpg"]},{"room_number":5,"name":"Room 05","category":"twin","capacity":2,"season_rate":400000,"non_season_rate":350000,"image_urls":["/images/twin.jpg"]},{"room_number":6,"name":"Room 06","category":"twin","capacity":2,"season_rate":500000,"non_season_rate":400000,"image_urls":["/images/twin.jpg"]},{"room_number":7,"name":"Room 07","category":"family","capacity":4,"season_rate":450000,"non_season_rate":400000,"image_urls":["/images/family-suite.jpg"]},{"room_number":8,"name":"Room 08","category":"twin","capacity":2,"season_rate":400000,"non_season_rate":350000,"image_urls":["/images/twin.jpg"]},{"room_number":9,"name":"Room 09","category":"twin","capacity":2,"season_rate":400000,"non_season_rate":350000,"image_urls":["/images/twin.jpg"]},{"room_number":10,"name":"Room 10","category":"twin","capacity":2,"season_rate":400000,"non_season_rate":350000,"image_urls":["/images/twin.jpg"]},{"room_number":11,"name":"Room 11","category":"triple","capacity":3,"season_rate":450000,"non_season_rate":350000,"image_urls":["/images/triple.jpg"]},{"room_number":12,"name":"Room 12","category":"triple","capacity":3,"season_rate":400000,"non_season_rate":350000,"image_urls":["/images/triple.jpg"]},{"room_number":13,"name":"Room 13","category":"twin","capacity":2,"season_rate":300000,"non_season_rate":250000,"image_urls":["/images/twin.jpg"]},{"room_number":14,"name":"Room 14","category":"twin","capacity":2,"season_rate":400000,"non_season_rate":300000,"image_urls":["/images/twin.jpg"]},{"room_number":15,"name":"Room 15","category":"twin","capacity":2,"season_rate":450000,"non_season_rate":300000,"image_urls":["/images/twin.jpg"]},{"room_number":16,"name":"Room 16","category":"twin","capacity":2,"season_rate":380000,"non_season_rate":280000,"image_urls":["/images/twin.jpg"]},{"room_number":17,"name":"Room 17","category":"twin","capacity":2,"season_rate":380000,"non_season_rate":280000,"image_urls":["/images/twin.jpg"]},{"room_number":18,"name":"Room 18","category":"family","capacity":4,"season_rate":500000,"non_season_rate":400000,"image_urls":["/images/family-suite.jpg"]},{"room_number":19,"name":"Room 19","category":"twin","capacity":2,"season_rate":400000,"non_season_rate":250000,"image_urls":["/images/twin.jpg"]},{"room_number":20,"name":"Room 20","category":"twin","capacity":2,"season_rate":250000,"non_season_rate":200000,"image_urls":["/images/twin.jpg"]},{"room_number":21,"name":"Room 21","category":"twin","capacity":2,"season_rate":400000,"non_season_rate":250000,"image_urls":["/images/twin.jpg"]},{"room_number":22,"name":"Room 22","category":"studio","capacity":1,"season_rate":200000,"non_season_rate":150000,"image_urls":["/images/studio.jpg"]},{"room_number":23,"name":"Room 23","category":"twin","capacity":2,"season_rate":250000,"non_season_rate":200000,"image_urls":["/images/twin.jpg"]},{"room_number":24,"name":"Room 24","category":"twin","capacity":2,"season_rate":250000,"non_season_rate":200000,"image_urls":["/images/twin.jpg"]},{"room_number":25,"name":"Room 25","category":"twin","capacity":2,"season_rate":400000,"non_season_rate":300000,"image_urls":["/images/twin.jpg"]},{"room_number":26,"name":"Room 26","category":"twin","capacity":2,"season_rate":400000,"non_season_rate":250000,"image_urls":["/images/twin.jpg"]},{"room_number":27,"name":"Room 27","category":"family","capacity":4,"season_rate":600000,"non_season_rate":450000,"image_urls":["/images/family-suite.jpg"]},{"room_number":28,"name":"Room 28","category":"twin","capacity":2,"season_rate":350000,"non_season_rate":200000,"image_urls":["/images/twin.jpg"]},{"room_number":29,"name":"Room 29","category":"twin","capacity":2,"season_rate":350000,"non_season_rate":200000,"image_urls":["/images/twin.jpg"]},{"room_number":30,"name":"Room 30","category":"twin","capacity":2,"season_rate":350000,"non_season_rate":200000,"image_urls":["/images/twin.jpg"]},{"room_number":31,"name":"Room 31","category":"twin","capacity":2,"season_rate":350000,"non_season_rate":200000,"image_urls":["/images/twin.jpg"]},{"room_number":32,"name":"Room 32","category":"twin","capacity":2,"season_rate":350000,"non_season_rate":200000,"image_urls":["/images/twin.jpg"]},{"room_number":33,"name":"Room 33","category":"twin","capacity":2,"season_rate":350000,"non_season_rate":200000,"image_urls":["/images/twin.jpg"]},{"room_number":34,"name":"Room 34","category":"studio","capacity":1,"season_rate":200000,"non_season_rate":150000,"image_urls":["/images/studio.jpg"]}]$inventory$::jsonb) as x(room_number integer,name text,category text,capacity integer,season_rate integer,non_season_rate integer,image_urls text[])
on conflict(room_number) do update set name=excluded.name,category=excluded.category,capacity=excluded.capacity,season_rate=excluded.season_rate,non_season_rate=excluded.non_season_rate,
image_urls=case when cardinality(rooms.image_urls)=0 then excluded.image_urls else rooms.image_urls end;
-- Preserve the pre-import Studio 101 record and its bookings, but exclude it from the approved 34-room inventory.
update public.rooms set active=false where id='7aa60e8b-b6f1-4e09-9891-d36c0ac60fac' and room_number is null;
-- Allows the admin to clean up newly uploaded files after a failed room save.
drop policy if exists admin_room_images_read on storage.objects;
create policy admin_room_images_read on storage.objects for select to authenticated using(bucket_id='room-images' and public.is_admin());
notify pgrst,'reload schema';
commit;
-- Existing unnumbered records are preserved. Review their availability in /admin.
