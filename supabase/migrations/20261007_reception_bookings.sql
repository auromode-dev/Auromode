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
