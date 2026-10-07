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

-- Run in Supabase SQL Editor after the room inventory migration.
begin;
alter table public.bookings add column if not exists group_id uuid;
create index if not exists bookings_group_id_idx on public.bookings(group_id);
create or replace function public.reserve_rooms(p_category text,p_checkin date,p_checkout date,p_adults integer,p_children integer,p_guest jsonb,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare chosen uuid[]; total integer; group_ref uuid:=gen_random_uuid(); ids uuid[]:='{}'; r rooms; b_id uuid; adults_left integer:=p_adults; children_left integer:=p_children; a integer; c integer; remaining integer:=p_quantity;
begin
 if p_quantity<2 or p_quantity>4 or p_adults<p_quantity or p_adults>4 or p_children<0 or p_children>3 or p_checkin<(now() at time zone 'Asia/Kolkata')::date or p_checkout<=p_checkin or p_checkout-p_checkin>180 then raise exception 'Invalid stay'; end if;
 perform pg_advisory_xact_lock(hashtext('auromode_reservation'));
 update bookings set status='expired' where status='pending' and hold_expires_at<=now();
 select array_agg(id),sum(nightly_rate)*(p_checkout-p_checkin) into chosen,total from (select * from available_rooms(p_category,p_checkin,p_checkout,ceil((p_adults+p_children)::numeric/p_quantity)::integer) limit p_quantity) candidates;
 if coalesce(cardinality(chosen),0)<>p_quantity then raise exception 'Not enough rooms available'; end if;
 perform 1 from rooms where id=any(chosen) order by id for update;
 select sum(nightly_rate)*(p_checkout-p_checkin) into total from rooms where id=any(chosen);
 if exists(select 1 from rooms where id=any(chosen) and (not active or category<>p_category or capacity<ceil((p_adults+p_children)::numeric/p_quantity))) then raise exception 'Rooms changed. Check availability again'; end if;
 if total is distinct from (p_guest->>'expectedAmount')::integer then raise exception 'Rate changed. Check availability again'; end if;
 for r in select * from rooms where id=any(chosen) order by nightly_rate,id for update loop
  a:=least(r.capacity,adults_left-(remaining-1));
  c:=least(r.capacity-a,children_left);
  adults_left:=adults_left-a;children_left:=children_left-c;remaining:=remaining-1;
  insert into bookings(group_id,room_id,checkin,checkout,adults,children,first_name,last_name,email,phone,requests,whatsapp_opt_in,amount)
  values(group_ref,r.id,p_checkin,p_checkout,a,c,p_guest->>'firstName',p_guest->>'lastName',p_guest->>'email',p_guest->>'phone',coalesce(p_guest->>'requests',''),coalesce((p_guest->>'whatsappOptIn')::boolean,false),r.nightly_rate*(p_checkout-p_checkin)) returning id into b_id;
  ids:=array_append(ids,b_id);
 end loop;
 if adults_left<>0 or children_left<>0 then raise exception 'Invalid guest allocation'; end if;
 return jsonb_build_object('id',ids[1],'ids',ids,'amount',total);
end $$;
revoke all on function public.reserve_rooms(text,date,date,integer,integer,jsonb,integer) from public,anon,authenticated;
grant execute on function public.reserve_rooms(text,date,date,integer,integer,jsonb,integer) to service_role;
create or replace function public.confirm_payment(p_order_id text,p_payment_id text,p_amount integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare b bookings; total integer; needs_review boolean;
begin
 perform pg_advisory_xact_lock(hashtext('auromode_reservation'));
 select * into b from bookings where razorpay_order_id=p_order_id for update;
 if b.id is null then raise exception 'Payment mismatch'; end if;
 select sum(amount) into total from bookings where id=b.id or (b.group_id is not null and group_id=b.group_id);
 if total<>p_amount then raise exception 'Payment mismatch'; end if;
 if b.razorpay_payment_id=p_payment_id and b.payment_status in ('paid','refund_required','refunded') then return jsonb_build_object('id',b.id,'status',b.status); end if;
 select exists(select 1 from bookings where (id=b.id or (b.group_id is not null and group_id=b.group_id)) and (status in ('cancelled','expired','payment_review') or (status='pending' and hold_expires_at<=now()))) into needs_review;
 update bookings set status=case when needs_review then 'payment_review' else 'confirmed' end,payment_status=case when needs_review then 'refund_required' else 'paid' end,razorpay_payment_id=case when id=b.id then p_payment_id else razorpay_payment_id end where id=b.id or (b.group_id is not null and group_id=b.group_id);
 return jsonb_build_object('id',b.id,'status',case when needs_review then 'payment_review' else 'confirmed' end);
end $$;
notify pgrst,'reload schema';
commit;

-- Run after 20260930_multi_room_bookings.sql. No inventory is modified.
begin;
alter table public.bookings add column if not exists reception_request_id uuid unique;
alter table public.bookings add column if not exists booking_source text not null default 'online';
create or replace function public.reception_booking(p_request_id uuid,p_category text,p_checkin date,p_checkout date,p_adults integer,p_children integer,p_guest jsonb,p_quantity integer default 1)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; existing bookings; ids uuid[];
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_request_id is null or p_category is null or p_checkin is null or p_checkout is null or p_adults is null or p_children is null or p_quantity is null or p_guest is null
 or p_category not in ('studio','twin','triple','family') or p_quantity not between 1 and 4 or p_adults not between 1 and 4 or p_adults<p_quantity or p_children not between 0 and 3
 or p_checkin<(now() at time zone 'Asia/Kolkata')::date or p_checkout<=p_checkin or p_checkout-p_checkin>180
 or length(trim(coalesce(p_guest->>'firstName',''))) not between 1 and 80 or length(trim(coalesce(p_guest->>'lastName',''))) not between 1 and 80
 or length(coalesce(p_guest->>'email','')) not between 3 and 254 or coalesce(p_guest->>'email','') not like '%_@_%._%'
 or length(trim(coalesce(p_guest->>'phone',''))) not between 7 and 30 or length(coalesce(p_guest->>'requests',''))>2000
 or coalesce(p_guest->>'consent','false')<>'true' then raise exception 'Invalid reception booking'; end if;
 perform pg_advisory_xact_lock(hashtext('auromode_reservation'));
 select * into existing from bookings where reception_request_id=p_request_id;
 if existing.id is not null then return jsonb_build_object('id',existing.id,'status',existing.status); end if;
 if p_quantity=1 then
 result:=reserve_room(p_category,p_checkin,p_checkout,p_adults,p_children,p_guest);
 ids:=array[(result->>'id')::uuid];
 else
 result:=reserve_rooms(p_category,p_checkin,p_checkout,p_adults,p_children,p_guest,p_quantity);
 select array_agg(value::uuid) into ids from jsonb_array_elements_text(result->'ids');
 end if;
 update bookings set status='confirmed',booking_source='reception' where id=any(ids);
 update bookings set reception_request_id=p_request_id where id=(result->>'id')::uuid;
 return result || jsonb_build_object('status','confirmed');
end $$;
revoke all on function public.reception_booking(uuid,text,date,date,integer,integer,jsonb,integer) from public,anon;
grant execute on function public.reception_booking(uuid,text,date,date,integer,integer,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
commit;

-- Run after 20261007_reception_bookings.sql. Supports up to 10 guests across rooms.
begin;
create or replace function public.reserve_rooms(p_category text,p_checkin date,p_checkout date,p_adults integer,p_children integer,p_guest jsonb,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare chosen uuid[]; total integer; group_ref uuid:=gen_random_uuid(); ids uuid[]:='{}'; r rooms; b_id uuid; adults_left integer:=p_adults; children_left integer:=p_children; a integer; c integer; remaining integer:=p_quantity;
begin
 if p_quantity<2 or p_quantity>10 or p_adults<p_quantity or p_adults>10 or p_children<0 or p_children>3 or p_adults+p_children>10 or p_checkin<(now() at time zone 'Asia/Kolkata')::date or p_checkout<=p_checkin or p_checkout-p_checkin>180 then raise exception 'Invalid stay'; end if;
 perform pg_advisory_xact_lock(hashtext('auromode_reservation'));
 update bookings set status='expired' where status='pending' and hold_expires_at<=now();
 select array_agg(id),sum(nightly_rate)*(p_checkout-p_checkin) into chosen,total from (select * from available_rooms(p_category,p_checkin,p_checkout,ceil((p_adults+p_children)::numeric/p_quantity)::integer) limit p_quantity) candidates;
 if coalesce(cardinality(chosen),0)<>p_quantity then raise exception 'Not enough rooms available'; end if;
 perform 1 from rooms where id=any(chosen) order by id for update;
 select sum(nightly_rate)*(p_checkout-p_checkin) into total from rooms where id=any(chosen);
 if exists(select 1 from rooms where id=any(chosen) and (not active or category<>p_category or capacity<ceil((p_adults+p_children)::numeric/p_quantity))) then raise exception 'Rooms changed. Check availability again'; end if;
 if total is distinct from (p_guest->>'expectedAmount')::integer then raise exception 'Rate changed. Check availability again'; end if;
 for r in select * from rooms where id=any(chosen) order by nightly_rate,id for update loop
  a:=least(r.capacity,adults_left-(remaining-1));
  c:=least(r.capacity-a,children_left);
  adults_left:=adults_left-a;children_left:=children_left-c;remaining:=remaining-1;
  insert into bookings(group_id,room_id,checkin,checkout,adults,children,first_name,last_name,email,phone,requests,whatsapp_opt_in,amount)
  values(group_ref,r.id,p_checkin,p_checkout,a,c,p_guest->>'firstName',p_guest->>'lastName',p_guest->>'email',p_guest->>'phone',coalesce(p_guest->>'requests',''),coalesce((p_guest->>'whatsappOptIn')::boolean,false),r.nightly_rate*(p_checkout-p_checkin)) returning id into b_id;
  ids:=array_append(ids,b_id);
 end loop;
 if adults_left<>0 or children_left<>0 then raise exception 'Invalid guest allocation'; end if;
 return jsonb_build_object('id',ids[1],'ids',ids,'amount',total);
end $$;
revoke all on function public.reserve_rooms(text,date,date,integer,integer,jsonb,integer) from public,anon,authenticated;
grant execute on function public.reserve_rooms(text,date,date,integer,integer,jsonb,integer) to service_role;
create or replace function public.reception_booking(p_request_id uuid,p_category text,p_checkin date,p_checkout date,p_adults integer,p_children integer,p_guest jsonb,p_quantity integer default 1)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; existing bookings; ids uuid[];
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_request_id is null or p_category is null or p_checkin is null or p_checkout is null or p_adults is null or p_children is null or p_quantity is null or p_guest is null
 or p_category not in ('studio','twin','triple','family') or p_quantity not between 1 and 10 or p_adults not between 1 and 10 or p_adults<p_quantity or p_adults+p_children>10 or p_children not between 0 and 3
 or p_checkin<(now() at time zone 'Asia/Kolkata')::date or p_checkout<=p_checkin or p_checkout-p_checkin>180
 or length(trim(coalesce(p_guest->>'firstName',''))) not between 1 and 80 or length(trim(coalesce(p_guest->>'lastName',''))) not between 1 and 80
 or length(coalesce(p_guest->>'email','')) not between 3 and 254 or coalesce(p_guest->>'email','') not like '%_@_%._%'
 or length(trim(coalesce(p_guest->>'phone',''))) not between 7 and 30 or length(coalesce(p_guest->>'requests',''))>2000
 or coalesce(p_guest->>'consent','false')<>'true' then raise exception 'Invalid reception booking'; end if;
 perform pg_advisory_xact_lock(hashtext('auromode_reservation'));
 select * into existing from bookings where reception_request_id=p_request_id;
 if existing.id is not null then return jsonb_build_object('id',existing.id,'status',existing.status); end if;
 if p_quantity=1 then
 result:=reserve_room(p_category,p_checkin,p_checkout,p_adults,p_children,p_guest);
 ids:=array[(result->>'id')::uuid];
 else
 result:=reserve_rooms(p_category,p_checkin,p_checkout,p_adults,p_children,p_guest,p_quantity);
 select array_agg(value::uuid) into ids from jsonb_array_elements_text(result->'ids');
 end if;
 update bookings set status='confirmed',booking_source='reception' where id=any(ids);
 update bookings set reception_request_id=p_request_id where id=(result->>'id')::uuid;
 return result || jsonb_build_object('status','confirmed');
end $$;
revoke all on function public.reception_booking(uuid,text,date,date,integer,integer,jsonb,integer) from public,anon;
grant execute on function public.reception_booking(uuid,text,date,date,integer,integer,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
commit;

-- Run after 20261008_ten_guest_bookings.sql.
begin;
create sequence if not exists public.booking_reference_seq;
alter table public.bookings add column if not exists booking_reference text;
create or replace function public.assign_booking_reference() returns trigger language plpgsql security definer set search_path=public as $$
declare number text;
begin
 if TG_OP='UPDATE' and old.booking_reference is not null then new.booking_reference:=old.booking_reference;return new;end if;
 select coalesce(room_number::text,'legacy') into number from rooms where id=new.room_id;
 new.booking_reference:='avapart_'||to_char(new.checkin,'YYYYMMDD')||'_R'||coalesce(number,'legacy')||'_'||nextval('public.booking_reference_seq')::text;
 return new;
end $$;
drop trigger if exists set_booking_reference on public.bookings;
create trigger set_booking_reference before insert or update on public.bookings for each row execute function public.assign_booking_reference();
update public.bookings set booking_reference=null where booking_reference is null;
create unique index if not exists bookings_reference_unique on public.bookings(booking_reference);
alter table public.bookings alter column booking_reference set not null;
create or replace function public.claim_booking_notifications(p_booking_id uuid) returns setof public.notification_outbox language sql security definer set search_path=public as $$
 update notification_outbox set locked_until=now()+interval '5 minutes' where id in (
 select n.id from notification_outbox n join bookings b on b.id=n.booking_id
 where (b.id=p_booking_id or b.group_id=(select group_id from bookings where id=p_booking_id))
 and n.delivered_at is null and n.next_attempt_at<=now() and (n.locked_until is null or n.locked_until<now())
 order by n.created_at for update of n skip locked limit 30) returning *;
$$;
revoke all on function public.claim_booking_notifications(uuid) from public,anon,authenticated;
grant execute on function public.claim_booking_notifications(uuid) to service_role;
create or replace function public.reception_booking(p_request_id uuid,p_category text,p_checkin date,p_checkout date,p_adults integer,p_children integer,p_guest jsonb,p_quantity integer default 1)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; existing bookings; ids uuid[];
begin
 if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_request_id is null or p_category is null or p_checkin is null or p_checkout is null or p_adults is null or p_children is null or p_quantity is null or p_guest is null
 or p_category not in ('studio','twin','triple','family') or p_quantity not between 1 and 10 or p_adults not between 1 and 10 or p_adults<p_quantity or p_adults+p_children>10 or p_children not between 0 and 3
 or p_checkin<(now() at time zone 'Asia/Kolkata')::date or p_checkout<=p_checkin or p_checkout-p_checkin>180
 or length(trim(coalesce(p_guest->>'firstName',''))) not between 1 and 80 or length(trim(coalesce(p_guest->>'lastName',''))) not between 1 and 80
 or length(coalesce(p_guest->>'email','')) not between 3 and 254 or coalesce(p_guest->>'email','') not like '%_@_%._%'
 or length(trim(coalesce(p_guest->>'phone',''))) not between 7 and 30 or length(coalesce(p_guest->>'requests',''))>2000
 or coalesce(p_guest->>'consent','false')<>'true' then raise exception 'Invalid reception booking'; end if;
 perform pg_advisory_xact_lock(hashtext('auromode_reservation'));
 select * into existing from bookings where reception_request_id=p_request_id;
 if existing.id is not null then return jsonb_build_object('id',existing.id,'status',existing.status,'reference',existing.booking_reference); end if;
 if p_quantity=1 then
 result:=reserve_room(p_category,p_checkin,p_checkout,p_adults,p_children,p_guest);
 ids:=array[(result->>'id')::uuid];
 else
 result:=reserve_rooms(p_category,p_checkin,p_checkout,p_adults,p_children,p_guest,p_quantity);
 select array_agg(value::uuid) into ids from jsonb_array_elements_text(result->'ids');
 end if;
 update bookings set status='confirmed',booking_source='reception' where id=any(ids);
 update bookings set reception_request_id=p_request_id where id=(result->>'id')::uuid;
 return result || jsonb_build_object('status','confirmed','reference',(select booking_reference from bookings where id=(result->>'id')::uuid));
end $$;
revoke all on function public.reception_booking(uuid,text,date,date,integer,integer,jsonb,integer) from public,anon;
grant execute on function public.reception_booking(uuid,text,date,date,integer,integer,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
commit;

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
