-- ThợViệt: quản trị, thông báo đẩy, báo cáo, hợp đồng và sổ giao dịch.
-- An toàn để chạy nhiều lần trên Neon hiện có.
alter table users add column if not exists account_status text not null default 'active';
alter table users add column if not exists account_status_note text not null default '';
alter table workers add column if not exists moderation_status text not null default 'pending';
alter table workers alter column moderation_status set default 'pending';
update workers set moderation_status='approved' where pub=true and moderation_status='pending';
alter table workers add column if not exists moderation_note text not null default '';
alter table jobs add column if not exists moderation_status text not null default 'approved';
alter table jobs alter column moderation_status set default 'pending';
alter table jobs add column if not exists moderation_note text not null default '';

create table if not exists push_subscriptions (
  id bigint generated always as identity primary key,
  user_id text not null references users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at bigint not null,
  last_seen bigint not null
);
create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

create table if not exists notifications (
  id bigint generated always as identity primary key,
  user_id text not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  url text not null default '/',
  data jsonb not null default '{}'::jsonb,
  created_at bigint not null,
  read_at bigint not null default 0
);
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);

create table if not exists reports (
  id bigint generated always as identity primary key,
  reporter_id text not null references users(id) on delete cascade,
  target_type text not null check(target_type in ('user','worker','job','message')),
  target_id text not null,
  reason text not null,
  details text not null default '',
  status text not null default 'open' check(status in ('open','reviewing','resolved','rejected')),
  admin_note text not null default '',
  created_at bigint not null,
  resolved_at bigint not null default 0
);
create index if not exists idx_reports_status_created on reports(status, created_at desc);

create table if not exists contracts (
  id text primary key,
  job_id bigint not null references jobs(id) on delete restrict,
  owner_id text not null references users(id) on delete restrict,
  worker_id bigint not null references workers(id) on delete restrict,
  amount numeric(14,2) not null default 0 check(amount >= 0),
  currency text not null default 'VND',
  terms text not null default '',
  fee_rate numeric(6,4) not null default 0.0500,
  platform_fee numeric(14,2) not null default 0,
  status text not null default 'proposed' check(status in ('proposed','accepted','in_progress','completion_requested','completed','cancelled','disputed')),
  created_at bigint not null,
  updated_at bigint not null
);
create index if not exists idx_contracts_owner on contracts(owner_id, created_at desc);
create index if not exists idx_contracts_worker on contracts(worker_id, created_at desc);

create table if not exists transactions (
  id text primary key,
  contract_id text not null references contracts(id) on delete restrict,
  payer_id text not null references users(id) on delete restrict,
  payee_id text references users(id) on delete restrict,
  kind text not null check(kind in ('deposit','balance','platform_fee','refund')),
  provider text not null default 'manual',
  amount numeric(14,2) not null check(amount >= 0),
  status text not null default 'pending' check(status in ('pending','paid','failed','refunded')),
  provider_ref text not null default '',
  note text not null default '',
  created_at bigint not null,
  updated_at bigint not null
);
create index if not exists idx_transactions_contract on transactions(contract_id, created_at desc);
