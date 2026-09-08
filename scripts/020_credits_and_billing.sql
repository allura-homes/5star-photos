-- Credits + Stripe billing foundation.
-- Applied via Supabase MCP; kept here for versioning.

-- ---------------------------------------------------------------------------
-- profiles: plan + credit balances + Stripe linkage
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists billing_interval text,
  add column if not exists plan_credits integer not null default 0,
  add column if not exists topup_credits integer not null default 0,
  add column if not exists welcome_credits_granted boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists current_period_end timestamptz;

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'startup', 'pro', 'max'));

alter table public.profiles drop constraint if exists profiles_billing_interval_check;
alter table public.profiles add constraint profiles_billing_interval_check
  check (billing_interval is null or billing_interval in ('month', 'year'));

alter table public.profiles drop constraint if exists profiles_credits_nonnegative;
alter table public.profiles add constraint profiles_credits_nonnegative
  check (plan_credits >= 0 and topup_credits >= 0);

create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;

-- One-time migration of legacy token balances into plan credits so existing
-- users are not zeroed out. Guarded so re-running is a no-op.
update public.profiles
set plan_credits = greatest(coalesce(tokens, 0), 0),
    welcome_credits_granted = true
where welcome_credits_granted = false
  and plan_credits = 0;

-- ---------------------------------------------------------------------------
-- token_transactions doubles as the credit ledger
-- ---------------------------------------------------------------------------
alter table public.token_transactions
  add column if not exists balance_after integer;

alter table public.token_transactions drop constraint if exists token_transactions_type_check;
alter table public.token_transactions add constraint token_transactions_type_check
  check (type = any (array[
    -- legacy
    'purchase','revision','upscale','bonus','refund',
    -- spend
    'upload','transform','save_variation','download_hires',
    -- grants
    'welcome_grant','plan_grant','period_reset','topup_purchase','admin_adjust'
  ]));

-- ---------------------------------------------------------------------------
-- stripe_events: webhook idempotency
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
-- No policies: only the service role (webhook) touches this table.

-- ---------------------------------------------------------------------------
-- transform_charges: a transform is charged once per request, not per model
-- ---------------------------------------------------------------------------
create table if not exists public.transform_charges (
  transform_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_id uuid,
  amount integer not null,
  charged_at timestamptz not null default now(),
  refunded_at timestamptz
);
alter table public.transform_charges enable row level security;
drop policy if exists "transform_charges_select_own" on public.transform_charges;
create policy "transform_charges_select_own" on public.transform_charges
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- spend_credits: atomic spend (plan first, then top-up) + ledger row.
-- Negative p_amount = refund/grant into plan_credits.
-- Top-up credits are only spendable while subscribed (plan <> 'free').
-- ---------------------------------------------------------------------------
create or replace function public.spend_credits(
  p_user uuid,
  p_amount integer,
  p_type text,
  p_description text default null,
  p_image_id uuid default null,
  p_job_id uuid default null
)
returns table (ok boolean, plan_credits integer, topup_credits integer, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_plan_credits integer;
  v_topup_credits integer;
  v_status text;
  v_from_plan integer;
  v_from_topup integer;
begin
  -- Callers may only spend for themselves unless running as service role.
  if auth.uid() is not null and auth.uid() <> p_user then
    return query select false, 0, 0, 'forbidden'::text;
    return;
  end if;

  select p.plan, p.plan_credits, p.topup_credits, p.subscription_status
    into v_plan, v_plan_credits, v_topup_credits, v_status
  from public.profiles p
  where p.id = p_user
  for update;

  if not found then
    return query select false, 0, 0, 'no_profile'::text;
    return;
  end if;

  if p_amount <= 0 then
    -- refund / grant into plan credits
    update public.profiles
      set plan_credits = profiles.plan_credits - p_amount,
          updated_at = now()
      where id = p_user
      returning profiles.plan_credits, profiles.topup_credits
      into v_plan_credits, v_topup_credits;

    insert into public.token_transactions (user_id, type, amount, description, image_id, job_id, balance_after)
    values (p_user, p_type, -p_amount, p_description, p_image_id, p_job_id, v_plan_credits + v_topup_credits);

    return query select true, v_plan_credits, v_topup_credits, 'ok'::text;
    return;
  end if;

  if v_status = 'past_due' or v_status = 'unpaid' then
    return query select false, v_plan_credits, v_topup_credits, 'past_due'::text;
    return;
  end if;

  -- Top-ups are only usable while subscribed.
  if v_plan = 'free' then
    v_topup_credits := 0;
  end if;

  if v_plan_credits + v_topup_credits < p_amount then
    return query select false, v_plan_credits, v_topup_credits, 'insufficient'::text;
    return;
  end if;

  v_from_plan := least(v_plan_credits, p_amount);
  v_from_topup := p_amount - v_from_plan;

  update public.profiles
    set plan_credits = profiles.plan_credits - v_from_plan,
        topup_credits = profiles.topup_credits - v_from_topup,
        updated_at = now()
    where id = p_user
    returning profiles.plan_credits, profiles.topup_credits
    into v_plan_credits, v_topup_credits;

  insert into public.token_transactions (user_id, type, amount, description, image_id, job_id, balance_after)
  values (p_user, p_type, -p_amount, p_description, p_image_id, p_job_id, v_plan_credits + v_topup_credits);

  return query select true, v_plan_credits, v_topup_credits, 'ok'::text;
end;
$$;

revoke all on function public.spend_credits(uuid, integer, text, text, uuid, uuid) from public, anon;
grant execute on function public.spend_credits(uuid, integer, text, text, uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- New users: 45 welcome credits
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, plan, plan_credits, welcome_credits_granted)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'viewer',
    'free',
    45,
    true
  );

  insert into public.token_transactions (user_id, type, amount, description, balance_after)
  values (new.id, 'welcome_grant', 45, 'Welcome credits', 45);

  return new;
end;
$$;

-- Keep the legacy profiles.tokens column mirrored to the new balances so
-- existing UI reads remain correct.
create or replace function public.sync_profile_tokens()
returns trigger
language plpgsql
as $$
begin
  new.tokens := new.plan_credits + new.topup_credits;
  return new;
end;
$$;

drop trigger if exists profiles_sync_tokens on public.profiles;
create trigger profiles_sync_tokens
  before insert or update of plan_credits, topup_credits on public.profiles
  for each row execute function public.sync_profile_tokens();

update public.profiles set tokens = plan_credits + topup_credits
where tokens is distinct from plan_credits + topup_credits;

-- Transform charge bookkeeping used to verify refunds server-side.
alter table public.transform_charges add column if not exists success_count integer not null default 0;
alter table public.transform_charges add column if not exists models text[] not null default '{}';

create or replace function public.increment_transform_success(p_transform_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.transform_charges
  set success_count = success_count + 1
  where transform_id = p_transform_id;
$$;

revoke all on function public.increment_transform_success(uuid) from public, anon, authenticated;
grant execute on function public.increment_transform_success(uuid) to service_role;
