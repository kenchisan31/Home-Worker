// Kết nối Neon. Chuỗi kết nối chỉ nằm trong biến môi trường DATABASE_URL của server (Vercel), KHÔNG bao giờ để trong code web.
import { neon } from "@neondatabase/serverless";

export const cleanUrl = u => String(u || "").replace(/channel_binding=[^&]*&?/, "").replace(/[?&]$/, "");

let sql = null;
export function getDb() {
  return {
    async query(text, params = []) {
      if (!process.env.DATABASE_URL) throw new Error("Thiếu biến môi trường DATABASE_URL");
      sql = sql || neon(cleanUrl(process.env.DATABASE_URL));
      const r = await sql.query(text, params);
      return Array.isArray(r) ? r : r.rows;
    }
  };
}