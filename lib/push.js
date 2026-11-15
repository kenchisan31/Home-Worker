import webpush from "web-push";
let configured = false;
function setup() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@thoviet.vn", pub, priv);
  configured = true;
  return true;
}
export async function sendPush(subscription, payload) {
  if (!setup()) return false;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 3600, urgency: "high" });
    return true;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) return "expired";
    console.error("Push delivery error:", e.statusCode || e.message);
    return false;
  }
}
export function vapidPublicKey() { return process.env.VAPID_PUBLIC_KEY || ""; }
