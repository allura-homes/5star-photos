-- Bonus credits: a third bucket that never resets and is spendable on any
-- plan (unlike top-ups, which are frozen while unsubscribed). Used for the
-- /beta landing page grant and for seeding internal test accounts.
-- Applied via Supabase MCP; kept here for versioning.

alter table public.profiles
  add column if not exists bonus_credits integer not null default 0,
  add column if not exists signup_source text;

alter table public.profiles drop constraint if exists profiles_credits_nonnegative;
alter table public.profiles add constraint profiles_credits_nonnegative
  check (plan_credits >= 0 and topup_credits >= 0 and bonus_credits >= 0);

alter table public.token_transactions drop constraint if exists token_transactions_type_check;
alter table public.token_transactions add constraint token_transactions_type_check
  check (type = any (array[
    'purchase','revision','upscale','bonus','refund',
    'upload','transform','save_variation','download_hires',
    'welcome_grant','plan_grant','period_reset','topup_purchase','admin_adjust',
    'bonus_grant'
  ]));

-- ---------------------------------------------------------------------------
-- spend_credits: plan -> top-up (if subscribed) -> bonus
-- ---------------------------------------------------------------------------
drop function if exists public.spend_credits(uuid, integer, text, text, uuid, uuid);

create or replace function public.spend_credits(
  p_user uuid,
  p_amount integer,
  p_type text,
  p_description text default null,
  p_image_id uuid default null,
  p_job_id uuid default null
)
returns table (ok boolean, plan_credits integer, topup_credits integer, bonus_credits integer, code text, plan text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_plan_credits integer;
  v_topup_credits integer;
  v_bonus_credits integer;
  v_usable_topup integer;
  v_status text;
  v_from_plan integer;
  v_from_topup integer;
  v_from_bonus integer;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    return query select false, 0, 0, 0, 'forbidden'::text, 'free'::text;
    return;
  end if;

  select p.plan, p.plan_credits, p.topup_credits, p.bonus_credits, p.subscription_status
    into v_plan, v_plan_credits, v_topup_credits, v_bonus_credits, v_status
  from public.profiles p
  where p.id = p_user
  for update;

  if not found then
    return query select false, 0, 0, 0, 'no_profile'::text, 'free'::text;
    return;
  end if;

  if p_amount <= 0 then
    -- Refunds go back to the plan bucket; bonus grants go to the bonus bucket.
    if p_type = 'bonus_grant' then
      update public.profiles
        set bonus_credits = profiles.bonus_credits - p_amount, updated_at = now()
        where id = p_user
        returning profiles.plan_credits, profiles.topup_credits, profiles.bonus_credits
        into v_plan_credits, v_topup_credits, v_bonus_credits;
    else
      update public.profiles
        set plan_credits = profiles.plan_credits - p_amount, updated_at = now()
        where id = p_user
        returning profiles.plan_credits, profiles.topup_credits, profiles.bonus_credits
        into v_plan_credits, v_topup_credits, v_bonus_credits;
    end if;

    insert into public.token_transactions (user_id, type, amount, description, image_id, job_id, balance_after)
    values (p_user, p_type, -p_amount, p_description, p_image_id, p_job_id,
            v_plan_credits + case when v_plan = 'free' then 0 else v_topup_credits end + v_bonus_credits);

    return query select true, v_plan_credits, v_topup_credits, v_bonus_credits, 'ok'::text, v_plan;
    return;
  end if;

  if v_status = 'past_due' or v_status = 'unpaid' then
    return query select false, v_plan_credits, v_topup_credits, v_bonus_credits, 'past_due'::text, v_plan;
    return;
  end if;

  v_usable_topup := case when v_plan = 'free' then 0 else v_topup_credits end;

  if v_plan_credits + v_usable_topup + v_bonus_credits < p_amount then
    return query select false, v_plan_credits, v_topup_credits, v_bonus_credits, 'insufficient'::text, v_plan;
    return;
  end if;

  v_from_plan  := least(v_plan_credits, p_amount);
  v_from_topup := least(v_usable_topup, p_amount - v_from_plan);
  v_from_bonus := p_amount - v_from_plan - v_from_topup;

  update public.profiles
    set plan_credits  = profiles.plan_credits  - v_from_plan,
        topup_credits = profiles.topup_credits - v_from_topup,
        bonus_credits = profiles.bonus_credits - v_from_bonus,
        updated_at = now()
    where id = p_user
    returning profiles.plan_credits, profiles.topup_credits, profiles.bonus_credits
    into v_plan_credits, v_topup_credits, v_bonus_credits;

  insert into public.token_transactions (user_id, type, amount, description, image_id, job_id, balance_after)
  values (p_user, p_type, -p_amount, p_description, p_image_id, p_job_id,
          v_plan_credits + case when v_plan = 'free' then 0 else v_topup_credits end + v_bonus_credits);

  return query select true, v_plan_credits, v_topup_credits, v_bonus_credits, 'ok'::text, v_plan;
end;
$$;

revoke all on function public.spend_credits(uuid, integer, text, text, uuid, uuid) from public, anon;
grant execute on function public.spend_credits(uuid, integer, text, text, uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- New users: 45 welcome credits, plus 50 bonus credits when signup_source = 'beta'
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := nullif(new.raw_user_meta_data->>'signup_source', '');
  v_bonus integer := case when v_source = 'beta' then 50 else 0 end;
begin
  insert into public.profiles (id, email, display_name, role, plan, plan_credits, bonus_credits, signup_source, welcome_credits_granted)
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
    v_bonus,
    v_source,
    true
  );

  insert into public.token_transactions (user_id, type, amount, description, balance_after)
  values (new.id, 'welcome_grant', 45, 'Welcome credits', 45 + v_bonus);

  if v_bonus > 0 then
    insert into public.token_transactions (user_id, type, amount, description, balance_after)
    values (new.id, 'bonus_grant', v_bonus, 'Beta bonus credits (never expire)', 45 + v_bonus);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- tokens mirror includes bonus credits
-- ---------------------------------------------------------------------------
create or replace function public.sync_profile_tokens()
returns trigger
language plpgsql
as $$
begin
  new.tokens := new.plan_credits
    + case when new.plan = 'free' then 0 else new.topup_credits end
    + new.bonus_credits;
  return new;
end;
$$;

drop trigger if exists profiles_sync_tokens on public.profiles;
create trigger profiles_sync_tokens
  before insert or update of plan, plan_credits, topup_credits, bonus_credits on public.profiles
  for each row execute function public.sync_profile_tokens();

-- ---------------------------------------------------------------------------
-- One-time: every account that exists today is an internal test account.
-- Give each 1,000 non-expiring credits. Guarded by the ledger so re-running
-- the script is a no-op.
-- ---------------------------------------------------------------------------
with grantees as (
  select p.id, p.plan, p.plan_credits, p.topup_credits, p.bonus_credits
  from public.profiles p
  where not exists (
    select 1 from public.token_transactions t
    where t.user_id = p.id and t.type = 'bonus_grant' and t.description = 'Internal test account credits'
  )
),
updated as (
  update public.profiles p
  set bonus_credits = p.bonus_credits + 1000
  from grantees g
  where p.id = g.id
  returning p.id, p.plan, p.plan_credits, p.topup_credits, p.bonus_credits
)
insert into public.token_transactions (user_id, type, amount, description, balance_after)
select id, 'bonus_grant', 1000, 'Internal test account credits',
       plan_credits + case when plan = 'free' then 0 else topup_credits end + bonus_credits
from updated;
