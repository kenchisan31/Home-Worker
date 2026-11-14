export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const base = process.env.SITE_URL
    ? process.env.SITE_URL.replace(/\/+$/, "")
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `https://${String(req.headers["x-forwarded-host"] || req.headers.host || "home-worker-nu.vercel.app").split(",")[0].trim()}`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600");
  return res.status(200).send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`);
}
