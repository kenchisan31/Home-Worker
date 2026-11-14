# ThợViệt – Vercel + Neon

## Cấu trúc
- `public/`  giao diện (index.html, owner.html, worker.html, data.js, shared.js, style.css)
- `api/`     2 hàm serverless: `/api/rpc` và `/api/img`
- `lib/`     logic server (`core.js`) + kết nối Neon (`db.js`)
- `db/`      `schema.sql` (tạo bảng), `seed.sql` (dữ liệu mẫu, không bắt buộc)

## Cài database (Neon)
1. Tạo project trên neon.tech (nên chọn region Singapore).
2. Neon Console → **Connect** → copy connection string.
3. Mở **SQL Editor**, dán toàn bộ `db/schema.sql` rồi Run.
   (hoặc trên máy: copy `.env.example` thành `.env.local`, điền DATABASE_URL, chạy `npm install && npm run db:setup`)
4. Muốn có dữ liệu mẫu: chạy thêm `db/seed.sql` (hoặc `npm run db:seed`).

## Đưa lên Vercel
1. Đẩy thư mục này lên GitHub (file `.env*` đã được .gitignore chặn).
2. vercel.com → **Add New → Project** → chọn repo. Framework: **Other**. Không cần Build Command.
3. **Settings → Environment Variables**: thêm `DATABASE_URL` = connection string của Neon (Production + Preview).
4. (Tuỳ chọn) Thêm `ADMIN_EMAILS` = email quản trị (nhiều email cách nhau dấu phẩy). Tài khoản đó đăng nhập rồi mở `/admin.html` để xem thống kê thật.
5. Deploy. Nếu đổi biến môi trường sau đó thì phải Redeploy.


## Nâng cấp DB đã tạo từ bản cũ
Chạy lại `db/schema.sql` (hoặc `npm run db:setup`): phần cuối file chỉ thêm cột còn thiếu (logo, kind, addr, photos, done_req_at, done_at, verified) và cho phép vai trò `sup`, chạy lại nhiều lần vẫn an toàn.

## Xác nhận hoàn thành việc
Thợ bấm "Hoàn thành" → server lưu `done_req_at`; chủ dự án bấm "Xác nhận hoàn thành" → `done_at`. Đánh giá của chủ dự án về thợ đã hoàn thành việc sẽ có nhãn "Đã xác thực".


## Bản nâng cấp 1.1 – SEO và hardening API

- Bổ sung trang HTML được render phía server cho hồ sơ thợ công khai: `/tho/{id}`.
- Bổ sung trang HTML được render phía server cho dự án đang tuyển: `/du-an/{id}`.
- `/sitemap.xml` được tạo động từ hồ sơ thợ công khai và dự án chưa hoàn thành.
- `/robots.txt` được tạo động theo domain triển khai.
- Bổ sung metadata SEO, Open Graph và Schema.org cho trang hồ sơ/dự án.
- API từ chối request cross-site theo `Origin` / `Sec-Fetch-Site`, giới hạn payload JSON và kiểm tra chữ ký nhị phân của ảnh trước khi lưu.
- Không thay đổi bảng dữ liệu; không cần migration mới cho bản 1.1.

### Cấu hình domain SEO

Trên Vercel, nên đặt Environment Variable:

- `SITE_URL=https://ten-mien-cua-ban.vn`

Nếu không khai báo, hệ thống dùng `VERCEL_URL` hoặc host hiện tại để tạo canonical URL và sitemap.

### Cập nhật database

Dùng schema đầy đủ tại `db/schema.sql` (không dùng bản SQL rút gọn cũ nếu database chưa có các cột `jobs.done_req_at`, `jobs.done_at`, `reviews.verified`). Chạy:

```bash
npm run db:setup
```

Lệnh schema hiện tại có các câu `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, có thể chạy lại để bổ sung cột còn thiếu. Nếu trước đây bạn đã tạo database bằng file `thoviet.txt` rút gọn được gửi kèm và chưa chạy schema đầy đủ, có thể chạy riêng `db/migrate_legacy.sql` để bổ sung `done_req_at`, `done_at`, `verified` và các index còn thiếu. Sao lưu database trước khi chạy trên dữ liệu production.

### Kiểm tra sau deploy

1. Mở `/robots.txt` và xác nhận Sitemap trỏ đúng domain.
2. Mở `/sitemap.xml`, kiểm tra URL `/tho/...` và `/du-an/...`.
3. Mở một hồ sơ đã bật công khai: `/tho/ID`.
4. Mở một dự án chưa hoàn thành: `/du-an/ID`.
5. Dùng Google Search Console → Kiểm tra URL → Yêu cầu lập chỉ mục.

Lưu ý: SSR giúp Googlebot đọc nội dung trực tiếp nhưng không đảm bảo Google sẽ lập chỉ mục. Hồ sơ thiếu nội dung, trùng lặp hoặc chất lượng thấp vẫn có thể không được index.


### Phạm vi chưa thay đổi trong bản này

Bản 1.1 ưu tiên phần SEO kỹ thuật, PWA và hardening API mà không viết lại SPA để giảm rủi ro ảnh hưởng các luồng hiện có. Các hạng mục sau vẫn cần làm thành các giai đoạn riêng:

- Admin hiện tại vẫn là trang thống kê; chưa có hàng đợi duyệt hồ sơ/tin đăng, khóa tài khoản hoặc xử lý khiếu nại.
- Chưa tích hợp email/Web Push notifications.
- Chưa tích hợp MoMo/VNPay/VietQR, ký quỹ hoặc đối soát.
- Chưa triển khai KYC/CCCD; không nên thu thập CCCD trước khi có chính sách lưu trữ, phân quyền, mã hóa, thời hạn xóa và quy trình tuân thủ phù hợp.
- Chưa chuyển toàn bộ SPA sang Next.js/SSR. Các trang hồ sơ/dự án công khai đã có HTML server-render riêng để xử lý nhu cầu SEO trước, còn các màn hình sau đăng nhập tiếp tục dùng SPA.
