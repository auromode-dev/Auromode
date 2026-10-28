-- January-March season rates; April-December normal rates, per occupied night.
-- Apply after 20261009_booking_references.sql. Does not change inventory or existing bookings.
begin;
create or replace function public.stay_price(p_season integer,p_normal integer,p_checkin date,p_checkout date)
returns integer language sql immutable strict set search_path=public as $$
 select sum(case when extract(month from p_checkin + d) between 1 and 3 then p_season else p_normal end)::integer
 from generate_series(0,p_checkout-p_checkin-1) as days(d)
 where p_checkout>p_checkin and p_checkout-p_checkin<=180;
$$;
revoke all on function public.stay_price(integer,integer,date,date) from public,anon,authenticated;
grant execute on function public.stay_price(integer,integer,date,date) to service_role;

-- A separate RPC prevents an older database from returning normal-only quotes.
create or replace function public.available_rooms_priced(p_category text,p_checkin date,p_checkout date,p_guests integer)
returns table(id uuid,name text,total_amount integer,cancellation_terms text)
language sql security definer set search_path=public as $$
 select r.id,r.name,public.stay_price(r.season_rate,r.non_season_rate,p_checkin,p_checkout),r.cancellation_terms
 from rooms r
 where r.active and r.category=p_category and r.capacity>=p_guests and p_guests>=1
 and p_checkout>p_checkin and p_checkout-p_checkin<=180
 and p_checkin >= (now() at time zone 'Asia/Kolkata')::date
 and not exists(select 1 from bookings b where b.room_id=r.id
   and (b.status='confirmed' or (b.status='pending' and b.hold_expires_at>now()))
   and daterange(b.checkin,b.checkout,'[)') && daterange(p_checkin,p_checkout,'[)'))
 order by 3,r.id;
$$;
revoke all on function public.available_rooms_priced(text,date,date,integer) from public,anon;
grant execute on function public.available_rooms_priced(text,date,date,integer) to authenticated,service_role;
create or replace function public.reserve_room(p_category text,p_checkin date,p_checkout date,p_adults integer,p_children integer,p_guest jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare selected rooms; reservation bookings; total integer;
begin
 if p_checkin<(now() at time zone 'Asia/Kolkata')::date or p_checkout<=p_checkin or p_checkout-p_checkin>180 or p_adults<1 or p_children<0 then raise exception 'Invalid stay'; end if;
 perform pg_advisory_xact_lock(hashtext('auromode_reservation'));
 update bookings set status='expired' where status='pending' and hold_expires_at<=now();
 select r.* into selected from rooms r join available_rooms_priced(p_category,p_checkin,p_checkout,p_adults+p_children) a on a.id=r.id order by a.total_amount,r.id limit 1 for update of r;
 if selected.id is null then raise exception 'No room available'; end if;
 total:=public.stay_price(selected.season_rate,selected.non_season_rate,p_checkin,p_checkout);
 if (p_guest->>'expectedAmount')::integer is distinct from total then raise exception 'Rate changed. Check availability again'; end if;
 insert into bookings(room_id,checkin,checkout,adults,children,first_name,last_name,email,phone,requests,whatsapp_opt_in,amount)
 values(selected.id,p_checkin,p_checkout,p_adults,p_children,p_guest->>'firstName',p_guest->>'lastName',p_guest->>'email',p_guest->>'phone',coalesce(p_guest->>'requests',''),coalesce((p_guest->>'whatsappOptIn')::boolean,false),total) returning * into reservation;
 return jsonb_build_object('id',reservation.id,'amount',reservation.amount);
end $$;
create or replace function public.reserve_rooms(p_category text,p_checkin date,p_checkout date,p_adults integer,p_children integer,p_guest jsonb,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare chosen uuid[]; total integer; group_ref uuid:=gen_random_uuid(); ids uuid[]:='{}'; r rooms; b_id uuid; adults_left integer:=p_adults; children_left integer:=p_children; a integer; c integer; remaining integer:=p_quantity;
begin
 if p_quantity<2 or p_quantity>10 or p_adults<p_quantity or p_adults>10 or p_children<0 or p_children>3 or p_adults+p_children>10 or p_checkin<(now() at time zone 'Asia/Kolkata')::date or p_checkout<=p_checkin or p_checkout-p_checkin>180 then raise exception 'Invalid stay'; end if;
 perform pg_advisory_xact_lock(hashtext('auromode_reservation'));
 update bookings set status='expired' where status='pending' and hold_expires_at<=now();
 select array_agg(id),sum(total_amount) into chosen,total from (select * from available_rooms_priced(p_category,p_checkin,p_checkout,ceil((p_adults+p_children)::numeric/p_quantity)::integer) limit p_quantity) candidates;
 if coalesce(cardinality(chosen),0)<>p_quantity then raise exception 'Not enough rooms available'; end if;
 perform 1 from rooms where id=any(chosen) order by id for update;
 select sum(public.stay_price(season_rate,non_season_rate,p_checkin,p_checkout)) into total from rooms where id=any(chosen);
 if exists(select 1 from rooms where id=any(chosen) and (not active or category<>p_category or capacity<ceil((p_adults+p_children)::numeric/p_quantity))) then raise exception 'Rooms changed. Check availability again'; end if;
 if total is distinct from (p_guest->>'expectedAmount')::integer then raise exception 'Rate changed. Check availability again'; end if;
 for r in select * from rooms where id=any(chosen) order by public.stay_price(season_rate,non_season_rate,p_checkin,p_checkout),id for update loop
  a:=least(r.capacity,adults_left-(remaining-1));
  c:=least(r.capacity-a,children_left);
  adults_left:=adults_left-a;children_left:=children_left-c;remaining:=remaining-1;
  insert into bookings(group_id,room_id,checkin,checkout,adults,children,first_name,last_name,email,phone,requests,whatsapp_opt_in,amount)
  values(group_ref,r.id,p_checkin,p_checkout,a,c,p_guest->>'firstName',p_guest->>'lastName',p_guest->>'email',p_guest->>'phone',coalesce(p_guest->>'requests',''),coalesce((p_guest->>'whatsappOptIn')::boolean,false),public.stay_price(r.season_rate,r.non_season_rate,p_checkin,p_checkout)) returning id into b_id;
  ids:=array_append(ids,b_id);
 end loop;
 if adults_left<>0 or children_left<>0 then raise exception 'Invalid guest allocation'; end if;
 return jsonb_build_object('id',ids[1],'ids',ids,'amount',total);
end $$;
revoke all on function public.reserve_rooms(text,date,date,integer,integer,jsonb,integer) from public,anon,authenticated;
grant execute on function public.reserve_rooms(text,date,date,integer,integer,jsonb,integer) to service_role;

revoke all on function public.reserve_room(text,date,date,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_room(text,date,date,integer,integer,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
