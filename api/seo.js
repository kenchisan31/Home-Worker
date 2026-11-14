import { getDb } from "../lib/db.js";

const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const parse = v => { try { return JSON.parse(v || "[]"); } catch { return []; } };
const img = v => /^\/api\/img\?id=[a-f0-9]{24}$/.test(String(v || "")) ? String(v) : "";
const baseUrl = req => {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `https://${String(req.headers["x-forwarded-host"] || req.headers.host || "home-worker-nu.vercel.app").split(",")[0].trim()}`;
};
const page = ({ title, description, url, image, body, jsonld }) => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow">
<link rel="canonical" href="${esc(url)}"><meta property="og:type" content="website"><meta property="og:locale" content="vi_VN">
<meta property="og:site_name" content="ThợViệt"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
<meta property="og:url" content="${esc(url)}"><meta name="theme-color" content="#e8590c">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>
<style>body{margin:0;background:#f7f7f7;color:#202124;font:16px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}.wrap{max-width:850px;margin:32px auto;padding:0 18px}.card{background:white;border:1px solid #e5e5e5;border-radius:16px;padding:24px}.brand{color:#e8590c;font-weight:800;text-decoration:none}.hero{display:flex;gap:20px;align-items:center;flex-wrap:wrap}.avatar{width:132px;height:132px;object-fit:cover;border-radius:18px;background:#eee}.muted{color:#666}.chips span{display:inline-block;background:#fff2e9;border-radius:30px;padding:5px 11px;margin:4px 5px 0 0}.cta{display:inline-block;margin-top:18px;padding:11px 18px;background:#e8590c;color:white;border-radius:9px;text-decoration:none;font-weight:700}h1{line-height:1.25}footer{margin:18px 0;color:#777;font-size:13px}</style></head>
<body><main class="wrap"><a class="brand" href="/">🔧 ThợViệt</a><section class="card" style="margin-top:16px">${body}</section>
<footer>ThợViệt – Kết nối thợ xây dựng, doanh nghiệp và nhà phân phối vật liệu.</footer></main></body></html>`;

export default async function handler(req, res) {
  const id = String(new URL(req.url, "https://local.invalid").searchParams.get("id") || "");
  const type = String(new URL(req.url, "https://local.invalid").searchParams.get("type") || "");
  if (!/^\d{1,18}$/.test(id) || !["worker", "job"].includes(type)) return res.status(404).send("Không tìm thấy nội dung.");
  const db = getDb(), base = baseUrl(req);
  try {
    if (type === "worker") {
      const rows = await db.query(
        "select id,name,cat,city,rate,negot,exp,bio,skills,photo,albums,created_at from workers where id=$1 and kind='tho' and pub=true",
        [id]
      );
      const w = rows[0];
      if (!w) return res.status(404).send("Hồ sơ không tồn tại hoặc chưa được công khai.");
      const rawSkills = parse(w.skills), skills = (Array.isArray(rawSkills) ? rawSkills : []).filter(x => typeof x === "string").slice(0, 40);
      const rawAlbums = parse(w.albums), albums = (Array.isArray(rawAlbums) ? rawAlbums : []).flatMap(a => Array.isArray(a?.photos) ? a.photos : []).map(x => img(x?.src)).filter(Boolean).slice(0, 8);
      const photo = img(w.photo);
      const description = (w.bio || `${w.name} – ${w.cat} tại ${w.city}.`).replace(/\s+/g, " ").slice(0, 240);
      const url = `${base}/tho/${w.id}`;
      const body = `<div class="hero">${photo ? `<img class="avatar" src="${esc(photo)}" alt="Ảnh hồ sơ ${esc(w.name)}">` : ""}<div><div class="muted">HỒ SƠ THỢ CÔNG KHAI</div><h1>${esc(w.name)}</h1><b>${esc(w.cat)}</b><div class="muted">📍 ${esc(w.city || "Chưa cập nhật khu vực")} · ${Number(w.exp) || 0} năm kinh nghiệm</div></div></div>
      ${w.bio ? `<h2>Giới thiệu</h2><p>${esc(w.bio)}</p>` : ""}
      <h2>Kỹ năng</h2><div class="chips">${skills.map(x => `<span>${esc(x)}</span>`).join("") || "<span>Đang cập nhật</span>"}</div>
      <p><b>Mức giá:</b> ${esc(w.negot ? "Thỏa thuận" : (w.rate || "Liên hệ để trao đổi"))}</p>
      ${albums.length ? `<h2>Một số hình ảnh công trình</h2><div style="display:flex;gap:10px;flex-wrap:wrap">${albums.map(x => `<img src="${esc(x)}" alt="Ảnh công trình của ${esc(w.name)}" style="width:145px;height:115px;object-fit:cover;border-radius:9px">`).join("")}</div>` : ""}
      <a class="cta" href="/index.html">Đăng nhập ThợViệt để liên hệ</a>`;
      const jsonld = { "@context":"https://schema.org", "@type":"ProfilePage", name:`Hồ sơ ${w.name} – ThợViệt`, url, description, mainEntity:{ "@type":"Person", name:w.name, jobTitle:w.cat, address:{ "@type":"PostalAddress", addressLocality:w.city, addressCountry:"VN" }, description } };
      return res.setHeader("Cache-Control","public, s-maxage=300, stale-while-revalidate=3600").status(200).send(page({ title:`${w.name} – ${w.cat} | ThợViệt`, description, url, image:photo ? `${base}${photo}` : "", body, jsonld }));
    }

    const rows = await db.query(
      "select j.id,j.title,j.cat,j.city,j.budget,j.days,j.descr,j.addr,j.created_at,u.name as owner_name from jobs j left join users u on u.id=j.owner_id where j.id=$1 and j.owner_id is not null and j.done_at=0",
      [id]
    );
    const j = rows[0];
    if (!j) return res.status(404).send("Dự án không tồn tại hoặc đã hoàn thành.");
    const description = (j.descr || `${j.title} – ${j.cat} tại ${j.city}.`).replace(/\s+/g, " ").slice(0, 240);
    const url = `${base}/du-an/${j.id}`;
    const body = `<div class="muted">DỰ ÁN ĐANG TUYỂN THỢ</div><h1>${esc(j.title)}</h1><p><b>${esc(j.cat)}</b> · 📍 ${esc(j.city || "Chưa cập nhật khu vực")}</p>
      <p><b>Địa chỉ:</b> ${esc(j.addr || j.city || "Liên hệ chủ dự án để biết thêm")}</p>
      ${j.budget ? `<p><b>Ngân sách tham khảo:</b> ${esc(j.budget)}</p>` : ""}
      ${j.days ? `<p><b>Thời gian dự kiến:</b> ${esc(j.days)}</p>` : ""}
      ${j.descr ? `<h2>Mô tả công việc</h2><p style="white-space:pre-wrap">${esc(j.descr)}</p>` : ""}
      <p class="muted">Đăng bởi ${esc(j.owner_name || "Chủ dự án ThợViệt")}</p><a class="cta" href="/index.html">Đăng nhập để ứng tuyển / trao đổi</a>`;
    const jsonld = { "@context":"https://schema.org", "@type":"WebPage", name:j.title, url, description, datePublished:new Date(Number(j.created_at)||Date.now()).toISOString(), about:{ "@type":"Thing", name:j.cat } };
    return res.setHeader("Cache-Control","public, s-maxage=180, stale-while-revalidate=1800").status(200).send(page({ title:`${j.title} – ${j.city} | ThợViệt`, description, url, body, jsonld }));
  } catch (e) {
    console.error("SEO page error:", e);
    return res.status(500).send("Không thể tải nội dung.");
  }
}
