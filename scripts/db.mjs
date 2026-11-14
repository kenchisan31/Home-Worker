// Chạy file .sql lên Neon:  node scripts/db.mjs db/schema.sql
// Cần biến môi trường DATABASE_URL (đặt trong file .env.local hoặc export trước khi chạy).
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";

const file = process.argv[2];
if (!file) { console.error("Cách dùng: node scripts/db.mjs <file.sql>"); process.exit(1); }

// đọc .env.local / .env nếu có (không cần thư viện dotenv)
for (const f of [".env.local", ".env"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.DATABASE_URL) { console.error("Thiếu DATABASE_URL (xem .env.example)."); process.exit(1); }

const url = process.env.DATABASE_URL.replace(/channel_binding=[^&]*&?/, "").replace(/[?&]$/, "");
const sql = neon(url);
const text = fs.readFileSync(file, "utf8").replace(/\r/g, "").split("\n").filter(l => !/^\s*--/.test(l)).join("\n");
const stmts = text.split(/;[ \t]*\n/).map(s => s.trim()).filter(Boolean);

for (const [i, st] of stmts.entries()) {
  try { await sql.query(st); }
  catch (e) { console.error(`Lỗi ở câu lệnh #${i + 1}:\n${st.slice(0, 200)}\n→ ${e.message}`); process.exit(1); }
}
console.log(`Xong: đã chạy ${stmts.length} câu lệnh từ ${file}`);
