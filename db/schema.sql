-- ThợViệt – lược đồ cho Neon (PostgreSQL)
-- Chạy bằng:  npm run db:setup   (hoặc dán toàn bộ vào Neon Console → SQL Editor → Run)
-- Lưu ý: mỗi câu lệnh kết thúc bằng dấu chấm phẩy ở cuối dòng. Không viết dấu chấm phẩy trong phần chú thích.

create table if not exists users (
  id text primary key,
  email text not null unique,
  name text not null default '',
  role text not null check (role in ('tho','biz')),
  pw text not null,
  fail_n int not null default 0,
  lock_until bigint not null default 0,
  created_at bigint not null default 0
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at bigint not null
);
create index if not exists idx_sessions_user on sessions (user_id);

create table if not exists workers (
  id bigint primary key,
  user_id text unique references users(id) on delete cascade,
  name text not null,
  cat text not null,
  city text not null default '',
  rate text not null default '',
  negot boolean not null default false,
  exp int not null default 0,
  bio text not null default '',
  skills text not null default '[]',
  gender text not null default '',
  byear text not null default '',
  photo text not null default '',
  albums text not null default '[]',
  cv text not null default '{}',
  pub boolean not null default false,
  busy_pub boolean not null default false,
  created_at bigint not null default 0
);

create table if not exists worker_contact (
  worker_id bigint primary key references workers(id) on delete cascade,
  phone text not null default '',
  cmail text not null default '',
  ref text not null default '[]'
);

create table if not exists worker_state (
  worker_id bigint primary key references workers(id) on delete cascade,
  busy boolean not null default false,
  active text not null default '[]'
);

create table if not exists jobs (
  id bigint primary key,
  owner_id text references users(id) on delete cascade,
  owner_name text not null default '',
  title text not null,
  cat text not null,
  city text not null default '',
  budget text not null default '',
  days text not null default '',
  descr text not null default '',
  chosen bigint references workers(id) on delete set null,
  created_at bigint not null default 0
);
create index if not exists idx_jobs_owner on jobs (owner_id);

create table if not exists bids (
  id bigint generated always as identity primary key,
  job_id bigint not null references jobs(id) on delete cascade,
  worker_id bigint not null references workers(id) on delete cascade,
  price text not null default '',
  msg text not null default '',
  created_at bigint not null default 0,
  unique (job_id, worker_id)
);
create index if not exists idx_bids_worker on bids (worker_id);

create table if not exists convs (
  id text primary key,
  owner_id text not null references users(id) on delete cascade,
  worker_id bigint not null references workers(id) on delete cascade,
  owner_name text not null default '',
  worker_name text not null default '',
  seen_o bigint not null default 0,
  seen_w bigint not null default 0,
  created_at bigint not null default 0,
  unique (owner_id, worker_id)
);

create table if not exists messages (
  id bigint generated always as identity primary key,
  conv_id text not null references convs(id) on delete cascade,
  side text not null check (side in ('o','w')),
  body text not null default '',
  offer text,
  ts bigint not null,
  upd bigint not null default 0
);
create index if not exists idx_messages_conv on messages (conv_id, id);

create table if not exists reviews (
  id bigint generated always as identity primary key,
  worker_id bigint not null references workers(id) on delete cascade,
  author_id text references users(id) on delete set null,
  author_name text not null default '',
  stars int not null check (stars between 1 and 5),
  body text not null default '',
  img text not null default '',
  at bigint not null default 0
);
create index if not exists idx_reviews_worker on reviews (worker_id);

create table if not exists images (
  id text primary key,
  owner_id text not null references users(id) on delete cascade,
  mime text not null,
  data text not null,
  created_at bigint not null default 0
);
create index if not exists idx_images_owner on images (owner_id);

-- ===== Bổ sung (chạy được cả trên DB mới lẫn DB đã tạo từ bản cũ, chạy lại nhiều lần vẫn an toàn) =====
-- Các cột/vai trò dưới đây đã được code (lib/core.js) dùng nhưng bản schema cũ chưa có.
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('tho','biz','sup'));
alter table users add column if not exists logo text not null default '';
alter table workers add column if not exists kind text not null default 'tho';
alter table workers add column if not exists addr text not null default '';
alter table jobs add column if not exists photos text not null default '[]';
alter table jobs add column if not exists addr text not null default '';
alter table jobs add column if not exists done_req_at bigint not null default 0;
alter table jobs add column if not exists done_at bigint not null default 0;
alter table reviews add column if not exists verified boolean not null default false;
create index if not exists idx_jobs_created on jobs (created_at);
create index if not exists idx_users_created on users (created_at);


-- ===== Module quản trị, thông báo, báo cáo, hợp đồng và giao dịch =====
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
