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
