import { createApp } from "../lib/core.js";
import { getDb } from "../lib/db.js";

const app = createApp(getDb());

export default async function handler(req, res) {
  const out = await app.rpc({ method: req.method, headers: req.headers, body: req.body });
  for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v);
  res.status(out.status).json(out.body);
}