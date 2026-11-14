-- Bổ sung các cột mà backend hiện tại sử dụng nếu database được tạo từ bản SQL rút gọn cũ.
-- Có thể chạy nhiều lần; không xóa hoặc ghi đè dữ liệu hiện có.

alter table jobs add column if not exists done_req_at bigint not null default 0;
alter table jobs add column if not exists done_at bigint not null default 0;
alter table reviews add column if not exists verified boolean not null default false;

create index if not exists idx_jobs_created on jobs (created_at);
create index if not exists idx_users_created on users (created_at);
