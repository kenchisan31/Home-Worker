import { createApp } from "../lib/core.js";
import { getDb } from "../lib/db.js";

const app = createApp(getDb());

export default async function handler(req, res) {
  const id = new URL(req.url, "http://x").searchParams.get("id");
  const out = await app.img(id);
  for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v);
  res.status(out.status).send(out.raw || "");
}