-- Run this migration in the Supabase SQL Editor or with `supabase db push`.
-- All public client access is deliberately denied. Vercel API routes use the server-only secret key.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null check (category in ('cuff','set')),
  material text not null default '316L',
  finish text not null check (finish in ('poliert','frosting')),
  price_cents integer not null check (price_cents > 0),
  subtitle text not null,
  tag text,
  description text not null,
  image text not null,
  image_angle text,
  image_frost text,
  image_engraved text,
  image_frost_engraved text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory (
  product_id text not null references public.products(id) on delete cascade,
  size text not null check (size in ('XS','S','M','L','XL')),
  stock integer not null default 0 check (stock >= 0),
  primary key (product_id, size)
);

create table if not exists public.shipping_rates (
  country text primary key check (country in ('DE','AT','CH')),
  price_cents integer not null check (price_cents>=0),
  active boolean not null default true
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.products (id,name,category,finish,price_cents,subtitle,tag,description,image,image_angle,image_frost,image_engraved,image_frost_engraved)
values
('cuff-01','Le Cuff 01','cuff','poliert',8900,'Poliert · Edelstahl 316L','Bestseller','Der erste Cuff der Kollektion. Klar geformt, von Hand veredelt und für jeden Tag gemacht.','assets/cuff-polished-front.webp','assets/cuff-polished-angle.webp','assets/cuff-frosted.webp','assets/cuff-engraved.webp','assets/cuff-frosted-engraved.webp'),
('cuff-01-frost','Le Cuff 01 Frosted','cuff','frosting',10100,'Frosting · auf Anfrage','Auf Anfrage','Die matte Interpretation unseres Signature-Cuffs. Frosting wird auf Anfrage aufgebracht.','assets/cuff-frosted.webp','assets/cuff-frosted-angle.webp','assets/cuff-frosted.webp','assets/cuff-frosted-engraved.webp','assets/cuff-frosted-engraved.webp'),
('duo-01','Le Duo 01','set','poliert',15900,'2 Cuffs · Edelstahl 316L','Set','Zwei klare Linien, zusammen getragen oder einzeln. Ein reduziertes Set für deinen eigenen Rhythmus.','assets/cuff-duo.webp','assets/cuff-duo.webp','assets/cuff-duo.webp','assets/cuff-duo.webp','assets/cuff-duo.webp')
on conflict (id) do nothing;

insert into public.inventory (product_id,size,stock) values
('cuff-01','XS',4),('cuff-01','S',8),('cuff-01','M',10),('cuff-01','L',7),('cuff-01','XL',3),
('cuff-01-frost','XS',3),('cuff-01-frost','S',5),('cuff-01-frost','M',6),('cuff-01-frost','L',4),('cuff-01-frost','XL',2),
('duo-01','XS',2),('duo-01','S',3),('duo-01','M',4),('duo-01','L',3),('duo-01','XL',2)
on conflict (product_id,size) do nothing;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','paid','cancelled','fulfilled','refunded')),
  first_name text not null,
  last_name text not null,
  email text not null,
  shipping_address jsonb not null,
  country text not null check (country in ('DE','AT','CH')),
  subtotal_cents integer not null,
  shipping_cents integer not null,
  total_cents integer not null,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  terms_accepted_at timestamptz not null,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  fulfilled_at timestamptz
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id),
  product_name text not null,
  size text not null,
  finish text not null check (finish in ('poliert','frosting')),
  engraving text not null default '',
  quantity integer not null check (quantity between 1 and 5),
  unit_price_cents integer not null check (unit_price_cents > 0)
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'pending' check (status in ('pending','subscribed','unsubscribed')),
  confirmation_token_hash text,
  unsubscribe_token_hash text,
  token_expires_at timestamptz,
  consent_at timestamptz,
  subscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  request_type text not null,
  message text not null,
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new','in_progress','completed','spam')),
  created_at timestamptz not null default now()
);

create table if not exists public.rate_limits (
  bucket text not null,
  subject_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (bucket, subject_hash)
);

create table if not exists public.stripe_events (
  event_id text primary key,
  order_id uuid references public.orders(id),
  event_type text not null,
  received_at timestamptz not null default now()
);

create table if not exists public.email_outbox (
  id bigint generated always as identity primary key,
  email_type text not null check (email_type in ('order_confirmation')),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','sent')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  processing_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (email_type,order_id)
);

alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.customer_requests enable row level security;
alter table public.rate_limits enable row level security;
alter table public.stripe_events enable row level security;
alter table public.email_outbox enable row level security;

revoke all on public.products,public.inventory,public.shipping_rates,public.admin_users,public.orders,public.order_items,public.newsletter_subscribers,public.customer_requests,public.rate_limits,public.stripe_events,public.email_outbox from anon,authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

create or replace function public.consume_rate_limit(p_bucket text,p_subject text,p_limit integer,p_window_seconds integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_count integer; v_start timestamptz;
begin
  delete from public.rate_limits where window_start<now()-interval '1 day';
  insert into public.rate_limits(bucket,subject_hash,window_start,request_count)
  values(p_bucket,p_subject,now(),1)
  on conflict(bucket,subject_hash) do update
  set window_start=case when public.rate_limits.window_start < now() - make_interval(secs=>p_window_seconds) then now() else public.rate_limits.window_start end,
      request_count=case when public.rate_limits.window_start < now() - make_interval(secs=>p_window_seconds) then 1 else public.rate_limits.request_count+1 end
  returning request_count,window_start into v_count,v_start;
  return jsonb_build_object('allowed',v_count<=p_limit,'retry_after',greatest(0,ceil(extract(epoch from (v_start+make_interval(secs=>p_window_seconds)-now())))::integer));
end;
$$;

create or replace function public.create_store_order(p_customer jsonb,p_items jsonb,p_agreed_to_terms boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_order uuid:=gen_random_uuid(); v_line jsonb; v_product public.products%rowtype; v_price integer; v_stock integer; v_subtotal integer:=0; v_shipping integer; v_qty integer; v_size text; v_finish text; v_engraving text; v_items jsonb:='[]'::jsonb; v_email text; v_expired uuid; v_expired_item record;
begin
  if not coalesce(p_agreed_to_terms,false) then raise exception 'AGB und Widerrufsbelehrung müssen bestätigt werden.'; end if;
  for v_expired in update public.orders set status='cancelled' where status='pending' and expires_at<now() returning id loop
    for v_expired_item in select product_id,size,quantity from public.order_items where order_id=v_expired loop
      update public.inventory set stock=stock+v_expired_item.quantity where product_id=v_expired_item.product_id and size=v_expired_item.size;
    end loop;
  end loop;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 15 then raise exception 'Ungültiger Warenkorb.'; end if;
  if p_customer->>'country' not in ('DE','AT','CH') then raise exception 'Lieferland wird nicht unterstützt.'; end if;
  v_email:=lower(trim(p_customer->>'email'));
  if v_email='' or length(v_email)>254 then raise exception 'Ungültige E-Mail-Adresse.'; end if;
  select price_cents into v_shipping from public.shipping_rates where country=p_customer->>'country' and active;
  if not found then raise exception 'Der Versandpreis für das gewählte Land wurde noch nicht eingerichtet.'; end if;
  insert into public.orders(id,first_name,last_name,email,shipping_address,country,subtotal_cents,shipping_cents,total_cents,terms_accepted_at)
  values(v_order,trim(p_customer->>'first_name'),trim(p_customer->>'last_name'),v_email,
    jsonb_build_object('address',p_customer->>'address','postcode',p_customer->>'postcode','city',p_customer->>'city','country',p_customer->>'country'),
    p_customer->>'country',0,v_shipping,v_shipping,now());
  for v_line in select value from jsonb_array_elements(p_items) loop
    v_size:=v_line->>'size';
    v_finish:=case when v_line->>'finish'='frosting' then 'frosting' else 'poliert' end;
    v_engraving:=coalesce(v_line->>'engraving','');
    v_qty:=(v_line->>'quantity')::integer;
    if v_size not in ('XS','S','M','L','XL') or v_qty not between 1 and 5 or length(v_engraving)>18 then raise exception 'Ungültige Produktoption.'; end if;
    select * into v_product from public.products where id=v_line->>'product_id' and active for share;
    if not found then raise exception 'Produkt nicht verfügbar.'; end if;
    update public.inventory set stock=stock-v_qty where product_id=v_product.id and size=v_size and stock>=v_qty returning stock+v_qty into v_stock;
    if not found then raise exception 'Eine gewählte Größe ist nicht mehr verfügbar.'; end if;
    v_price:=v_product.price_cents
      -case when v_product.finish='frosting' then 1200 else 0 end
      +case when v_finish='frosting' then 1200 else 0 end
      +case when v_engraving<>'' then 1000 else 0 end;
    v_subtotal:=v_subtotal+v_price*v_qty;
    insert into public.order_items(order_id,product_id,product_name,size,finish,engraving,quantity,unit_price_cents)
    values(v_order,v_product.id,v_product.name,v_size,v_finish,v_engraving,v_qty,v_price);
    v_items:=v_items||jsonb_build_array(jsonb_build_object('product_id',v_product.id,'product_name',v_product.name,'size',v_size,'finish',v_finish,'engraving',v_engraving,'quantity',v_qty,'unit_price_cents',v_price));
  end loop;
  update public.orders set subtotal_cents=v_subtotal,total_cents=v_subtotal+v_shipping where id=v_order;
  return jsonb_build_object('id',v_order,'subtotal_cents',v_subtotal,'shipping_cents',v_shipping,'total_cents',v_subtotal+v_shipping,'items',v_items);
end;
$$;

create or replace function public.cancel_store_order(p_order_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_item record; v_changed integer;
begin
  update public.orders set status='cancelled' where id=p_order_id and status='pending';
  get diagnostics v_changed=row_count;
  if v_changed=0 then return false; end if;
  for v_item in select product_id,size,quantity from public.order_items where order_id=p_order_id loop
    update public.inventory set stock=stock+v_item.quantity where product_id=v_item.product_id and size=v_item.size;
  end loop;
  return true;
end;
$$;

create or replace function public.record_stripe_event(p_event_id text,p_order_id uuid,p_status text,p_payment_intent_id text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_inserted integer; v_changed integer;
begin
  insert into public.stripe_events(event_id,order_id,event_type) values(p_event_id,p_order_id,p_status)
  on conflict(event_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then return false; end if;
  if p_status='paid' then
    update public.orders set status='paid',paid_at=coalesce(paid_at,now()),stripe_payment_intent_id=p_payment_intent_id
    where id=p_order_id and status='pending' and expires_at>now();
    get diagnostics v_changed=row_count;
    if v_changed=1 then insert into public.email_outbox(email_type,order_id) values('order_confirmation',p_order_id) on conflict do nothing; end if;
  elsif p_status='cancelled' then
    perform public.cancel_store_order(p_order_id);
  end if;
  return true;
end;
$$;

create or replace function public.claim_order_email()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_job public.email_outbox%rowtype; v_order public.orders%rowtype;
begin
  update public.email_outbox set status='pending',processing_at=null where status='processing' and processing_at<now()-interval '10 minutes';
  select * into v_job from public.email_outbox where status='pending' and available_at<=now() order by id for update skip locked limit 1;
  if not found then return null; end if;
  update public.email_outbox set status='processing',processing_at=now(),attempts=attempts+1,last_error=null where id=v_job.id returning * into v_job;
  select * into v_order from public.orders where id=v_job.order_id;
  return jsonb_build_object('id',v_job.id,'order_id',v_order.id,'email',v_order.email);
end;
$$;

create or replace function public.complete_order_email(p_id bigint)
returns void language sql security invoker set search_path = '' as $$
  update public.email_outbox set status='sent',sent_at=now(),processing_at=null,last_error=null where id=p_id and status='processing';
$$;

create or replace function public.retry_order_email(p_id bigint,p_error text)
returns void language sql security invoker set search_path = '' as $$
  update public.email_outbox set status='pending',processing_at=null,available_at=now()+interval '1 minute',last_error=left(p_error,500) where id=p_id and status='processing';
$$;

create or replace function public.start_newsletter_subscription(p_email text,p_token_hash text,p_unsubscribe_hash text,p_expires_at timestamptz)
returns text language plpgsql security invoker set search_path = '' as $$
declare v_status text;
begin
  insert into public.newsletter_subscribers(email,status,confirmation_token_hash,unsubscribe_token_hash,token_expires_at)
  values(lower(trim(p_email)),'pending',p_token_hash,p_unsubscribe_hash,p_expires_at)
  on conflict(email) do update set
    status=case when public.newsletter_subscribers.status='subscribed' then 'subscribed' else 'pending' end,
    confirmation_token_hash=case when public.newsletter_subscribers.status='subscribed' then public.newsletter_subscribers.confirmation_token_hash else excluded.confirmation_token_hash end,
    unsubscribe_token_hash=case when public.newsletter_subscribers.status='subscribed' then public.newsletter_subscribers.unsubscribe_token_hash else excluded.unsubscribe_token_hash end,
    token_expires_at=case when public.newsletter_subscribers.status='subscribed' then public.newsletter_subscribers.token_expires_at else excluded.token_expires_at end
  returning status into v_status;
  return v_status;
end;
$$;

create or replace function public.unsubscribe_newsletter(p_token_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_changed integer;
begin
  update public.newsletter_subscribers set status='unsubscribed',confirmation_token_hash=null,token_expires_at=null
  where unsubscribe_token_hash=p_token_hash and status='subscribed';
  get diagnostics v_changed=row_count;
  return v_changed=1;
end;
$$;

create or replace function public.confirm_newsletter_subscription(p_token_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_changed integer;
begin
  update public.newsletter_subscribers set status='subscribed',subscribed_at=now(),consent_at=now(),confirmation_token_hash=null,token_expires_at=null
  where confirmation_token_hash=p_token_hash and token_expires_at>now() and status='pending';
  get diagnostics v_changed=row_count;
  return v_changed=1;
end;
$$;

create or replace function public.create_customer_request(p_name text,p_email text,p_request_type text,p_message text,p_consent_at timestamptz)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.customer_requests(name,email,request_type,message,consent_at)
  values(trim(p_name),lower(trim(p_email)),p_request_type,trim(p_message),p_consent_at) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.release_expired_orders()
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_order uuid; v_total integer:=0; v_item record;
begin
  for v_order in update public.orders set status='cancelled' where status='pending' and expires_at<now() returning id loop
    for v_item in select product_id,size,quantity from public.order_items where order_id=v_order loop
      update public.inventory set stock=stock+v_item.quantity where product_id=v_item.product_id and size=v_item.size;
    end loop;
    v_total:=v_total+1;
  end loop;
  delete from public.rate_limits where window_start<now()-interval '1 day';
  return v_total;
end;
$$;

revoke all on function public.consume_rate_limit(text,text,integer,integer),public.create_store_order(jsonb,jsonb,boolean),public.cancel_store_order(uuid),public.record_stripe_event(text,uuid,text,text),public.claim_order_email(),public.complete_order_email(bigint),public.retry_order_email(bigint,text),public.start_newsletter_subscription(text,text,text,timestamptz),public.confirm_newsletter_subscription(text),public.unsubscribe_newsletter(text),public.create_customer_request(text,text,text,text,timestamptz),public.release_expired_orders() from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,text,integer,integer),public.create_store_order(jsonb,jsonb,boolean),public.cancel_store_order(uuid),public.record_stripe_event(text,uuid,text,text),public.claim_order_email(),public.complete_order_email(bigint),public.retry_order_email(bigint,text),public.start_newsletter_subscription(text,text,text,timestamptz),public.confirm_newsletter_subscription(text),public.unsubscribe_newsletter(text),public.create_customer_request(text,text,text,text,timestamptz),public.release_expired_orders() to service_role;
