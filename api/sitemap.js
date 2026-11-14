import { getDb } from "../lib/db.js";

const esc = v => String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const baseUrl = req => {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `https://${String(req.headers["x-forwarded-host"] || req.headers.host || "home-worker-nu.vercel.app").split(",")[0].trim()}`;
};
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  try {
    const db = getDb(), base = baseUrl(req);
    const [workers, jobs] = await Promise.all([
      db.query("select id,created_at from workers where kind='tho' and pub=true order by created_at desc limit 20000"),
      db.query("select id,created_at from jobs where owner_id is not null and done_at=0 order by created_at desc limit 20000")
    ]);
    const urls = [
      { loc:`${base}/`, priority:"1.0", change:"weekly" },
      ...workers.map(x => ({ loc:`${base}/tho/${x.id}`, lastmod:x.created_at, priority:"0.7", change:"monthly" })),
      ...jobs.map(x => ({ loc:`${base}/du-an/${x.id}`, lastmod:x.created_at, priority:"0.6", change:"weekly" }))
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(x => `  <url><loc>${esc(x.loc)}</loc>${x.lastmod ? `<lastmod>${new Date(Number(x.lastmod)).toISOString().slice(0,10)}</lastmod>` : ""}<changefreq>${x.change}</changefreq><priority>${x.priority}</priority></url>`).join("\n")}\n</urlset>`;
    res.setHeader("Content-Type","application/xml; charset=utf-8");
    res.setHeader("Cache-Control","public, s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).send(xml);
  } catch (e) {
    console.error("Sitemap error:", e);
    return res.status(500).send("Sitemap temporarily unavailable");
  }
}
