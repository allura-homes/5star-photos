-- 022: Welcome credits 45 -> 50 (beta total becomes 100) and an admin helper
-- that exposes auth.users.email_confirmed_at to the service role only.
-- Applied to the live database on 2026-09-14.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text := nullif(new.raw_user_meta_data->>'signup_source', '');
  v_welcome integer := 50;
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
    v_welcome,
    v_bonus,
    v_source,
    true
  );

  insert into public.token_transactions (user_id, type, amount, description, balance_after)
  values (new.id, 'welcome_grant', v_welcome, 'Welcome credits', v_welcome + v_bonus);

  if v_bonus > 0 then
    insert into public.token_transactions (user_id, type, amount, description, balance_after)
    values (new.id, 'bonus_grant', v_bonus, 'Beta bonus credits (never expire)', v_welcome + v_bonus);
  end if;

  return new;
end;
$$;

-- Service-role-only read of email confirmation state for the admin user list.
create or replace function public.admin_email_confirmations(p_ids uuid[])
returns table (id uuid, email_confirmed_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select u.id, u.email_confirmed_at
  from auth.users u
  where u.id = any(p_ids);
$$;

revoke all on function public.admin_email_confirmations(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_email_confirmations(uuid[]) to service_role;
