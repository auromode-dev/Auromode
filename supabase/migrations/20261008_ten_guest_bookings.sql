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
