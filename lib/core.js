// ThợViệt – API phía server (chạy trên Vercel, nói chuyện với Neon Postgres).
// Mọi kiểm tra quyền nằm ở đây: trình duyệt không bao giờ chạm trực tiếp vào database.
import crypto from "node:crypto";

const CATS = ["Thợ cơ khí", "Thợ điện", "Kỹ sư công trình"];
const SHOP_CATS = ["Sắt thép", "Xi măng, gạch, cát đá", "Sơn và chống thấm", "Thiết bị vệ sinh", "Điện, dây cáp", "Ống nước, phụ kiện", "Gỗ, nội thất", "Kính, nhôm", "Vật liệu khác"];
const IMG = "/api/img?id=";
const DAY = 86400000;
const s = (x, n) => String(x == null ? "" : x).slice(0, n);
const num = x => (x == null ? null : Number(x));
const J = t => { try { return JSON.parse(t); } catch { return null; } };
const sha = x => crypto.createHash("sha256").update(x).digest("hex");
const scrypt = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? no(e) : ok(k))));
const hashPw = async pw => { const salt = crypto.randomBytes(16); return salt.toString("hex") + ":" + (await scrypt(pw, salt)).toString("hex"); };
const verifyPw = async (pw, stored) => {
  const [salt, h, extra] = String(stored || "").split(":");
  if (extra !== undefined || !/^[a-f0-9]{32}$/i.test(salt || "") || !/^[a-f0-9]{128}$/i.test(h || "")) return false;
  const k = await scrypt(pw, Buffer.from(salt, "hex")), b = Buffer.from(h, "hex");
  return k.length === b.length && crypto.timingSafeEqual(k, b);
};
class HttpErr extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = m => new HttpErr(400, m), forbid = (m = "Không có quyền thực hiện thao tác này.") => new HttpErr(403, m);
const parseCookies = h => Object.fromEntries(String(h || "").split(/;\s*/).filter(Boolean).map(c => {
  const i = c.indexOf("=");
  if (i < 1) return ["", ""];
  try { return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }
  catch { return ["", ""]; }
}));
const cookie = (v, age, req) => `tv_session=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${req.headers["x-forwarded-proto"] === "https" ? "; Secure" : ""}`;
const need = (c, role) => { if (!c.user) throw new HttpErr(401, "Bạn cần đăng nhập."); if (role && c.user.role !== role) throw forbid(); return c.user; };
const isImg = u => !u || /^\/api\/img\?id=[a-f0-9]{24}$/.test(String(u));

/* ---------- đối tượng gửi về cho giao diện ---------- */
const wObj = (r, ct, st) => { const cv = J(r.cv) || {}; return { id: num(r.id), email: r.user_id || "", name: r.name, cat: r.cat, city: r.city || "", rate: r.rate || "", negot: !!r.negot, exp: num(r.exp) || 0, bio: r.bio || "", skills: J(r.skills) || [], gender: r.gender || "", byear: r.byear || "", photo: r.photo || "", albums: J(r.albums) || [], gallery: [], kind: r.kind || "tho", addr: r.addr || "", work: cv.work || [], edu: cv.edu || [], cert: cv.cert || [], award: cv.award || [], pub: !!r.pub, phone: ct ? ct.phone || "" : "", cmail: ct ? ct.cmail || "" : "", ref: ct ? J(ct.ref) || [] : [], busy: st ? !!st.busy : !!r.busy_pub, active: st ? J(st.active) || [] : [], reviews: [] }; };
const jObj = (r, bids) => ({ id: num(r.id), title: r.title, cat: r.cat, city: r.city || "", budget: r.budget || "", days: r.days || "", desc: r.descr || "", photos: J(r.photos) || [], addr: r.addr || "", by: r.owner_id || "", byName: r.owner_name || "", byLogo: r.owner_logo || "", chosen: num(r.chosen) || 0, doneReq: num(r.done_req_at) || 0, done: num(r.done_at) > 0, doneAt: num(r.done_at) || 0, bids: bids || [] });
const cObj = (r, msgs) => ({ id: r.id, owner: r.owner_id, ownerName: r.owner_name || "", worker: num(r.worker_id), workerName: r.worker_name || "", seen: { o: num(r.seen_o) || 0, w: num(r.seen_w) || 0 }, msgs: msgs || [] });
const mObj = r => { const m = { id: num(r.id), f: r.side, t: r.body || "", ts: num(r.ts) }; const o = J(r.offer); if (o) m.offer = o; return m; };
const vnDate = ms => new Date(ms).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export function createApp(db) {
  const q = (t, p = []) => db.query(t, p);
  const isAdmin = u => !!u && String(process.env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean).includes(String(u.email || "").toLowerCase());
  const MYC = "(c.owner_id=$1 or c.worker_id in (select id from workers where user_id=$1))";

  async function authUser(req) {
    const tk = parseCookies(req.headers.cookie).tv_session; if (!tk) return null;
    return (await q("select u.id,u.email,u.name,u.role,u.logo from sessions s join users u on u.id=s.user_id where s.id=$1 and s.expires_at>$2", [sha(tk), Date.now()]))[0] || null;
  }
  async function startSession(c, uid) {
    const tk = crypto.randomBytes(32).toString("hex");
    await q("delete from sessions where expires_at<$1", [Date.now()]);
    await q("insert into sessions (id,user_id,expires_at) values ($1,$2,$3)", [sha(tk), uid, Date.now() + 30 * DAY]);
    c.out.headers["Set-Cookie"] = cookie(tk, 30 * 86400, c.req);
  }
  async function convFor(c, id) {
    const r = (await q("select c.*,w.user_id as wuid from convs c join workers w on w.id=c.worker_id where c.id=$1", [id]))[0];
    if (!r) throw new HttpErr(404, "Không tìm thấy cuộc trò chuyện.");
    const side = r.owner_id === c.user.id ? "o" : r.wuid === c.user.id ? "w" : null;
    if (!side) throw forbid();
    return { r, side };
  }
  async function chatsData(uid) {
    const [C, M] = await Promise.all([
      q(`select c.* from convs c where ${MYC}`, [uid]),
      q(`select m.* from messages m join convs c on c.id=m.conv_id where ${MYC} order by m.id`, [uid])]);
    const by = {}; M.forEach(m => (by[m.conv_id] = by[m.conv_id] || []).push(mObj(m)));
    return C.map(r => cObj(r, by[r.id] || []));
  }
  async function sigOf(uid) {
    const m = (await q(`select count(*) as n, coalesce(max(m.id),0) as mx, coalesce(max(m.upd),0) as up from messages m join convs c on c.id=m.conv_id where ${MYC}`, [uid]))[0];
    const k = (await q(`select count(*) as n from convs c where ${MYC}`, [uid]))[0];
    return `${num(m.mx)}:${num(m.n)}:${num(m.up)}:${num(k.n)}`;
  }

  const OPS = {
    async signup(c) {
      const a = c.a, email = s(a.email, 200).trim().toLowerCase(), pw = String(a.pw || ""), name = s(a.name, 80).trim(), role = a.role;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad("Email không hợp lệ.");
      if (pw.length < 6 || pw.length > 200) throw bad("Mật khẩu cần từ 6 ký tự.");
      if (!name) throw bad("Vui lòng nhập tên.");
      if (role !== "tho" && role !== "biz" && role !== "sup") throw bad("Vai trò không hợp lệ.");
      if ((await q("select id from users where email=$1", [email])).length) throw new HttpErr(409, "Email này đã được đăng ký.");
      const id = crypto.randomUUID();
      await q("insert into users (id,email,name,role,pw,created_at) values ($1,$2,$3,$4,$5,$6)", [id, email, name, role, await hashPw(pw), Date.now()]);
      await startSession(c, id);
      return { me: { id, name, role, logo: "" } };
    },
    async login(c) {
      const email = s(c.a.email, 200).trim().toLowerCase(), pw = String(c.a.pw || "").slice(0, 200);
      const u = (await q("select * from users where email=$1", [email]))[0];
      if (!u) { await scrypt(pw, Buffer.alloc(16)); throw new HttpErr(401, "Sai email hoặc mật khẩu."); }
      if (num(u.lock_until) > Date.now()) throw new HttpErr(429, "Đăng nhập sai quá nhiều lần. Hãy thử lại sau 10 phút.");
      if (!(await verifyPw(pw, u.pw))) {
        const n = num(u.fail_n) + 1;
        await q("update users set fail_n=$2,lock_until=$3 where id=$1", [u.id, n >= 5 ? 0 : n, n >= 5 ? Date.now() + 600000 : 0]);
        throw new HttpErr(401, "Sai email hoặc mật khẩu.");
      }
      if (num(u.fail_n)) await q("update users set fail_n=0,lock_until=0 where id=$1", [u.id]);
      await startSession(c, u.id);
      return { me: { id: u.id, name: u.name, role: u.role, logo: u.logo || "" } };
    },
    async logout(c) {
      const tk = parseCookies(c.req.headers.cookie).tv_session;
      if (tk) await q("delete from sessions where id=$1", [sha(tk)]);
      c.out.headers["Set-Cookie"] = cookie("", 0, c.req);
    },
    async load(c) {
      const u = c.user; if (!u) return { me: null };
      const R = u.role, wWhere = R === "biz" ? "true" : R === "sup" ? "user_id=$1" : "kind='tho'";   // thợ không thấy Chợ, nhà phân phối chỉ thấy gian hàng của mình
      const [W, CT, ST, RV, JB, BD] = await Promise.all([
        q(`select * from workers where ${wWhere}`, R === "sup" ? [u.id] : []),
        q(`select * from worker_contact where worker_id in (select id from workers where (${wWhere}) and (user_id=$1 or pub=true))`, [u.id]),
        q("select * from worker_state where worker_id in (select id from workers where user_id=$1)", [u.id]),
        q("select * from reviews order by id desc"),
        q("select j.*, u.logo as owner_logo from jobs j left join users u on u.id=j.owner_id order by j.id desc"),
        q("select * from bids where worker_id in (select id from workers where user_id=$1) or job_id in (select id from jobs where owner_id=$1)", [u.id])]);
      const key = a => Object.fromEntries(a.map(x => [num(x.worker_id), x])), cm = key(CT), sm = key(ST), rv = {}, bd = {};
      RV.forEach(r => (rv[num(r.worker_id)] = rv[num(r.worker_id)] || []).push({ id: num(r.id), n: r.author_name, s: num(r.stars), t: r.body || "", img: r.img || "", d: vnDate(num(r.at)), v: !!r.verified }));
      BD.forEach(b => (bd[num(b.job_id)] = bd[num(b.job_id)] || []).push({ id: num(b.id), w: num(b.worker_id), p: b.price || "", m: b.msg || "" }));
      return {
        me: { id: u.id, name: u.name, role: u.role, logo: u.logo || "" },
        workers: W.map(r => { const w = wObj(r, cm[num(r.id)], sm[num(r.id)]); w.reviews = rv[w.id] || []; return w; }),
        jobs: JB.map(r => jObj(r, bd[num(r.id)])),
        convs: await chatsData(u.id), sig: await sigOf(u.id)
      };
    },
    async chats(c) { const u = need(c); return { convs: await chatsData(u.id), sig: await sigOf(u.id) }; },
    async chat_poll(c) { const u = need(c); return { sig: await sigOf(u.id) }; },

    async worker_save(c) {
      const u = need(c), shop = u.role === "sup", w = c.a.w || {}, ct = c.a.c || {}, st = c.a.s || {};
      if (!shop && u.role !== "tho") throw forbid();
      const ex = (await q("select id from workers where user_id=$1", [u.id]))[0], id = ex ? num(ex.id) : num(w.id);
      if (!Number.isSafeInteger(id) || id <= 0) throw bad("Mã gian hàng không hợp lệ.");
      if (!(shop ? SHOP_CATS : CATS).includes(w.cat)) throw bad(shop ? "Loại vật liệu không hợp lệ." : "Ngành nghề không hợp lệ.");
      const name = s(w.name, 80).trim(); if (!name) throw bad(shop ? "Vui lòng nhập tên doanh nghiệp." : "Vui lòng nhập họ tên.");
      if (shop && (!s(w.addr, 200).trim() || !s(ct.phone, 30).trim())) throw bad("Vui lòng nhập địa chỉ và số điện thoại.");
      const skills = JSON.stringify((Array.isArray(w.skills) ? w.skills : []).slice(0, 40).map(x => s(x, 60).trim()).filter(Boolean));
      const albumList = Array.isArray(w.albums) ? w.albums.slice(0, 20) : [];
      const badAlbumImage = albumList.some(a => !a || typeof a !== "object" || (Array.isArray(a.photos) && a.photos.some(p => p && p.src && !isImg(p.src))));
      if (badAlbumImage) throw bad("Ảnh album chưa được tải lên hệ thống.");
      const albums = JSON.stringify(albumList), cv = JSON.stringify(w.cv && typeof w.cv === "object" ? w.cv : {});
      const ref = JSON.stringify(Array.isArray(ct.ref) ? ct.ref : []), active = JSON.stringify(Array.isArray(st.active) ? st.active : []);
      if (albums.length > 300000 || cv.length > 100000 || ref.length > 20000 || active.length > 20000) throw bad("Dữ liệu quá lớn.");
      const photo = s(w.photo, 300);
      if (/data:/i.test(photo + albums) || !isImg(photo)) throw bad("Ảnh chưa được tải lên.");
      const busyPub = !!(st.busy || (Array.isArray(st.active) && st.active.length));
      const r = await q(`insert into workers (id,user_id,name,cat,city,rate,negot,exp,bio,skills,gender,byear,photo,albums,cv,pub,busy_pub,created_at,kind,addr)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        on conflict (id) do update set name=excluded.name,cat=excluded.cat,city=excluded.city,rate=excluded.rate,negot=excluded.negot,exp=excluded.exp,bio=excluded.bio,skills=excluded.skills,gender=excluded.gender,byear=excluded.byear,photo=excluded.photo,albums=excluded.albums,cv=excluded.cv,pub=excluded.pub,busy_pub=excluded.busy_pub,addr=excluded.addr
        where workers.user_id=excluded.user_id returning id`,
      [id, u.id, name, w.cat, s(w.city, 60), s(w.rate, 60), !!w.negot, Math.max(0, Math.min(80, parseInt(w.exp) || 0)), s(w.bio, 3000), skills, s(w.gender, 10), s(w.byear, 4), photo, albums, cv, shop ? true : !!w.pub, busyPub, Date.now(), shop ? "shop" : "tho", s(w.addr, 200).trim()]);
      if (!r.length) throw forbid();
      await q(`insert into worker_contact (worker_id,phone,cmail,ref) values ($1,$2,$3,$4) on conflict (worker_id) do update set phone=excluded.phone,cmail=excluded.cmail,ref=excluded.ref`, [id, s(ct.phone, 30), s(ct.cmail, 120), ref]);
      await q(`insert into worker_state (worker_id,busy,active) values ($1,$2,$3) on conflict (worker_id) do update set busy=excluded.busy,active=excluded.active`, [id, !!st.busy, active]);
      return { id };
    },
    async job_save(c) {
      const u = need(c, "biz"), j = c.a.j || {}, id = num(j.id);
      if (!Number.isSafeInteger(id) || id <= 0) throw bad("Mã dự án không hợp lệ.");
      if (!CATS.includes(j.cat)) throw bad("Ngành nghề không hợp lệ.");
      const title = s(j.title, 150).trim(); if (!title) throw bad("Vui lòng nhập tên dự án.");
      const chosen = num(j.chosen) || null;
      if (chosen && !(await q("select id from workers where id=$1 and kind='tho'", [chosen])).length) throw bad("Thợ được chọn không hợp lệ.");
      const photos = (Array.isArray(j.photos) ? j.photos : []).slice(0, 6).map(x => s(x, 300));
      if (photos.some(p => !/^\/api\/img\?id=[a-f0-9]{24}$/.test(p))) throw bad("Ảnh chưa được tải lên.");
      const r = await q(`insert into jobs (id,owner_id,owner_name,title,cat,city,budget,days,descr,chosen,created_at,photos,addr) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        on conflict (id) do update set title=excluded.title,cat=excluded.cat,city=excluded.city,budget=excluded.budget,days=excluded.days,descr=excluded.descr,chosen=case when jobs.done_at>0 then jobs.chosen else excluded.chosen end,photos=excluded.photos,addr=excluded.addr
        where jobs.owner_id=excluded.owner_id returning id`,
      [id, u.id, u.name, title, j.cat, s(j.city, 60), s(j.budget, 60), s(j.days, 60), s(j.desc, 3000), chosen, Date.now(), JSON.stringify(photos), s(j.addr, 200).trim()]);
      if (!r.length) throw forbid();
    },
    async job_delete(c) {
      const u = need(c, "biz"), id = num(c.a.id);
      if (!Number.isSafeInteger(id) || id <= 0) throw bad("Mã dự án không hợp lệ.");
      const row = (await q("select photos from jobs where id=$1 and owner_id=$2", [id, u.id]))[0];
      if (!row) throw new HttpErr(404, "Không tìm thấy dự án của bạn.");
      await q("delete from jobs where id=$1 and owner_id=$2", [id, u.id]);
      for (const p of (J(row.photos) || []).slice(0, 6)) { const k = String(p).slice(IMG.length); if (/^[a-f0-9]{24}$/.test(k)) await q("delete from images where id=$1 and owner_id=$2", [k, u.id]); }   // dọn ảnh của dự án
    },
    async job_assign(c) {
      const u = need(c, "tho"), w = num(c.a.worker), job = num(c.a.job);
      const mine = (await q("select id from workers where id=$1 and user_id=$2", [w, u.id]))[0]; if (!mine) throw forbid();
      if (c.a.on) await q("update jobs set chosen=$2 where id=$1 and (chosen is null or chosen=$2)", [job, w]);
      else await q("update jobs set chosen=null,done_req_at=0 where id=$1 and chosen=$2 and done_at=0", [job, w]);
    },
    // Thợ báo đã xong việc (chờ chủ dự án xác nhận)
    async job_done_request(c) {
      const u = need(c, "tho"), job = num(c.a.job);
      if (!Number.isSafeInteger(job) || job <= 0) throw bad("Mã dự án không hợp lệ.");
      const r = await q("update jobs set done_req_at=$2 where id=$1 and done_at=0 and chosen in (select id from workers where user_id=$3) returning id", [job, Date.now(), u.id]);
      if (!r.length) throw forbid("Bạn không phải thợ được chọn cho dự án này, hoặc dự án đã hoàn thành.");
    },
    // Chủ dự án xác nhận hoàn thành: mốc này là căn cứ để xác thực đánh giá (và sau này là tính phí)
    async job_done_confirm(c) {
      const u = need(c, "biz"), job = num(c.a.job);
      if (!Number.isSafeInteger(job) || job <= 0) throw bad("Mã dự án không hợp lệ.");
      const j = (await q("select chosen,done_at from jobs where id=$1 and owner_id=$2", [job, u.id]))[0];
      if (!j) throw new HttpErr(404, "Không tìm thấy dự án của bạn.");
      if (!j.chosen) throw bad("Hãy chọn thợ trước khi xác nhận hoàn thành.");
      if (num(j.done_at) > 0) return;
      await q("update jobs set done_at=$2 where id=$1 and owner_id=$3 and done_at=0", [job, Date.now(), u.id]);
    },
    async bid_add(c) {
      const u = need(c, "tho"), w = num(c.a.worker), job = num(c.a.job);
      if (!(await q("select id from workers where id=$1 and user_id=$2", [w, u.id])).length) throw forbid();
      if (!(await q("select id from jobs where id=$1 and done_at=0", [job])).length) throw bad("Không tìm thấy dự án đang tuyển thợ.");
      await q("insert into bids (job_id,worker_id,price,msg,created_at) values ($1,$2,$3,$4,$5) on conflict (job_id,worker_id) do nothing", [job, w, s(c.a.price, 60), s(c.a.msg, 1000), Date.now()]);
      return { id: num((await q("select id from bids where job_id=$1 and worker_id=$2", [job, w]))[0].id) };
    },
    async conv_add(c) {
      const u = need(c), a = c.a, wId = num(a.worker), W = (await q("select id,user_id,name from workers where id=$1", [wId]))[0];
      if (!W) throw bad("Không tìm thấy thợ.");
      let owner;
      if (u.role === "biz") owner = u.id;
      else { if (W.user_id !== u.id) throw forbid(); owner = s(a.owner, 64); }
      const O = (await q("select id,name from users where id=$1 and role='biz'", [owner]))[0]; if (!O) throw bad("Không tìm thấy chủ dự án.");
      const id = /^c\d{1,20}$/.test(String(a.id || "")) ? a.id : "c" + Date.now();
      await q("insert into convs (id,owner_id,worker_id,owner_name,worker_name,created_at) values ($1,$2,$3,$4,$5,$6) on conflict (owner_id,worker_id) do nothing", [id, owner, wId, O.name, W.name, Date.now()]);
      return { id: (await q("select id from convs where owner_id=$1 and worker_id=$2", [owner, wId]))[0].id };
    },
    async conv_seen(c) {
      need(c); const { side } = await convFor(c, c.a.id), ts = num(c.a.ts) || 0;
      if (side === "o") await q("update convs set seen_o=$2 where id=$1 and seen_o<$2", [c.a.id, ts]);
      else await q("update convs set seen_w=$2 where id=$1 and seen_w<$2", [c.a.id, ts]);
    },
    async msg_add(c) {
      need(c); const a = c.a, { side } = await convFor(c, a.conv), body = s(a.body, 4000);
      let offer = null;
      if (a.offer) { if (side !== "o") throw forbid(); const o = a.offer; offer = JSON.stringify({ job: s(o.job, 200), jobId: num(o.jobId) || 0, price: s(o.price, 60), days: s(o.days, 60), note: s(o.note, 1000), st: "pending" }); }
      else if (!body.trim()) throw bad("Tin nhắn trống.");
      const now = Date.now(); let ts = Number(a.ts); if (!Number.isFinite(ts) || Math.abs(ts - now) > DAY) ts = now;
      const r = await q("insert into messages (conv_id,side,body,offer,ts,upd) values ($1,$2,$3,$4,$5,$6) returning id", [a.conv, side, body, offer, ts, now]);
      return { id: num(r[0].id) };
    },
    async offer_set(c) {
      need(c, "tho"); const m = (await q("select id,offer,conv_id from messages where id=$1", [num(c.a.msg)]))[0];
      if (!m || !m.offer) throw bad("Không tìm thấy đề nghị.");
      if ((await convFor(c, m.conv_id)).side !== "w") throw forbid();
      const o = J(m.offer), st = String(c.a.st);
      if (!["ok", "no", "cancel"].includes(st)) throw bad("Trạng thái không hợp lệ.");
      if (o.st === st) return;
      if (!(o.st === "pending" || (o.st === "ok" && st === "cancel"))) throw bad("Đề nghị này đã được xử lý.");
      o.st = st; await q("update messages set offer=$2,upd=$3 where id=$1", [m.id, JSON.stringify(o), Date.now()]);
    },
    async review_add(c) {
      const u = need(c, "biz"), a = c.a, w = num(a.worker), W = (await q("select id from workers where id=$1 and kind='tho'", [w]))[0];
      if (!W) throw bad("Không tìm thấy thợ.");
      const stars = parseInt(a.stars); if (!(stars >= 1 && stars <= 5)) throw bad("Số sao không hợp lệ.");
      if (!isImg(a.img)) throw bad("Ảnh chưa được tải lên.");
      const verified = (await q("select 1 from jobs where owner_id=$1 and chosen=$2 and done_at>0 limit 1", [u.id, w])).length > 0;
      const r = await q("insert into reviews (worker_id,author_id,author_name,stars,body,img,at,verified) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id", [w, u.id, u.name, stars, s(a.body, 2000), s(a.img, 300), Date.now(), verified]);
      return { id: num(r[0].id) };
    },
    async profile_save(c) {
      const u = need(c, "biz"), logo = s(c.a.logo, 300);
      if (logo) {
        if (!/^\/api\/img\?id=[a-f0-9]{24}$/.test(logo)) throw bad("Ảnh chưa được tải lên.");
        if (!(await q("select id from images where id=$1 and owner_id=$2", [logo.slice(IMG.length), u.id])).length) throw forbid();
      }
      const old = (await q("select logo from users where id=$1", [u.id]))[0];
      await q("update users set logo=$2 where id=$1", [u.id, logo]);
      if (old && old.logo && old.logo !== logo) { const k = String(old.logo).slice(IMG.length); if (/^[a-f0-9]{24}$/.test(k)) await q("delete from images where id=$1 and owner_id=$2", [k, u.id]); }   // dọn logo cũ
      return { logo };
    },
    async password_change(c) {
      const u = need(c), old = String(c.a.old || "").slice(0, 200), pw = String(c.a.pw || "");
      if (pw.length < 6 || pw.length > 200) throw bad("Mật khẩu mới cần từ 6 ký tự.");
      const r = (await q("select pw,fail_n,lock_until from users where id=$1", [u.id]))[0];
      if (num(r.lock_until) > Date.now()) throw new HttpErr(429, "Bạn nhập sai quá nhiều lần. Hãy thử lại sau 10 phút.");
      if (!(await verifyPw(old, r.pw))) {
        const n = num(r.fail_n) + 1;
        await q("update users set fail_n=$2,lock_until=$3 where id=$1", [u.id, n >= 5 ? 0 : n, n >= 5 ? Date.now() + 600000 : 0]);
        throw bad("Mật khẩu hiện tại không đúng.");
      }
      await q("update users set pw=$2,fail_n=0,lock_until=0 where id=$1", [u.id, await hashPw(pw)]);
      const tk = parseCookies(c.req.headers.cookie).tv_session;
      await q("delete from sessions where user_id=$1 and id<>$2", [u.id, sha(tk)]);   // các thiết bị khác phải đăng nhập lại
    },
    async upload(c) {
      const u = need(c), m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(c.a.data || ""));
      if (!m || m[2].length > 1400000) throw bad("Ảnh không hợp lệ hoặc quá lớn.");
      const bytes = Buffer.from(m[2], "base64");
      const valid = m[1] === "image/png"
        ? bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        : m[1] === "image/jpeg"
          ? bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
          : bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
      if (!valid) throw bad("Nội dung ảnh không khớp định dạng tệp.");
      if (num((await q("select count(*) as n from images where owner_id=$1", [u.id]))[0].n) >= 400) throw bad("Bạn đã tải lên quá nhiều ảnh.");
      const id = crypto.randomBytes(12).toString("hex");
      await q("insert into images (id,owner_id,mime,data,created_at) values ($1,$2,$3,$4,$5)", [id, u.id, m[1], m[2], Date.now()]);
      return { url: IMG + id };
    },
    // Thống kê cho quản trị (chỉ email trong ADMIN_EMAILS). Chỉ trả số tổng hợp, loại bỏ dữ liệu mẫu (không có chủ sở hữu).
    async admin_stats(c) {
      const u = need(c); if (!isAdmin(u)) throw forbid();
      const now = Date.now(), d7 = now - 7 * DAY, d30 = now - 30 * DAY, one = async (t, p = []) => (await q(t, p))[0] || {}, N = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, num(v) || 0]));
      const [us, wk, jb, bd, cv, ms, of, rv, daily, prov] = await Promise.all([
        one("select count(*) as total, count(*) filter (where role='tho') as tho, count(*) filter (where role='biz') as biz, count(*) filter (where role='sup') as sup, count(*) filter (where created_at>$1) as d7, count(*) filter (where created_at>$2) as d30 from users", [d7, d30]),
        one("select count(*) filter (where kind='tho') as tho, count(*) filter (where kind='tho' and pub) as tho_pub, count(*) filter (where kind='shop') as shop from workers where user_id is not null"),
        one("select count(*) as total, count(*) filter (where created_at>$1) as d30, count(*) filter (where exists(select 1 from bids b where b.job_id=jobs.id)) as with_bid, count(*) filter (where chosen is not null) as chosen, count(*) filter (where done_req_at>0) as done_req, count(*) filter (where done_at>0) as done from jobs where owner_id is not null", [d30]),
        one("select count(*) as total from bids b join jobs j on j.id=b.job_id where j.owner_id is not null"),
        one("select count(*) as total, count(*) filter (where exists(select 1 from messages m where m.conv_id=convs.id and m.side='o') and exists(select 1 from messages m where m.conv_id=convs.id and m.side='w')) as replied from convs"),
        one("select count(*) as total, count(*) filter (where ts>$1) as d7 from messages", [d7]),
        one("select count(*) as total, count(*) filter (where offer::jsonb->>'st'='ok') as accepted from messages where offer is not null"),
        one("select count(*) as total, count(*) filter (where verified) as verified from reviews where author_id is not null"),
        q("select to_char(to_timestamp(created_at/1000.0) at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD') as d, count(*) as n from users where created_at>$1 group by 1 order by 1", [d30]),
        q("select city, count(*) as n from jobs where owner_id is not null and city<>'' group by city order by n desc limit 8")]);
      return { at: now, users: N(us), workers: N(wk), jobs: N(jb), bids: N(bd), convs: N(cv), messages: N(ms), offers: N(of), reviews: N(rv), signups: daily.map(r => ({ d: r.d, n: num(r.n) })), provinces: prov.map(r => ({ city: r.city, n: num(r.n) })) };
    },
    async delete_account(c) {
      const u = need(c); await q("delete from users where id=$1", [u.id]);
      c.out.headers["Set-Cookie"] = cookie("", 0, c.req);
    }
  };

  return {
    async rpc(req) {
      const out = { headers: {} }, base = {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      };
      try {
        if (req.method !== "POST") throw new HttpErr(405, "Phương thức không hợp lệ.");
        const origin = req.headers.origin;
        if (origin) {
          let originHost = "";
          try { originHost = new URL(origin).host.toLowerCase(); } catch { throw forbid("Nguồn gửi yêu cầu không hợp lệ."); }
          if (req.headers.host && originHost !== String(req.headers.host).toLowerCase()) throw forbid("Nguồn gửi yêu cầu không hợp lệ.");
        }
        if (String(req.headers["sec-fetch-site"] || "").toLowerCase() === "cross-site") throw forbid("Yêu cầu từ website khác bị từ chối.");
        const rawSize = (() => { try { return Buffer.byteLength(JSON.stringify(req.body || {}), "utf8"); } catch { return Infinity; } })();
        if (rawSize > 1_500_000) throw new HttpErr(413, "Dữ liệu gửi lên quá lớn.");
        const { op, args } = req.body || {}, fn = Object.prototype.hasOwnProperty.call(OPS, op) ? OPS[op] : null;
        if (!fn) throw bad("Thao tác không hợp lệ.");
        const body = await fn({ q, user: await authUser(req), a: args || {}, req, out });
        return { status: 200, headers: { ...base, ...out.headers }, body: body === undefined ? { ok: true } : body };
      } catch (e) {
        const st = e instanceof HttpErr ? e.status : e && e.code === "23505" ? 409 : 500;
        if (st === 500) console.error(e);
        return { status: st, headers: { ...base, ...out.headers }, body: { error: st === 500 ? "Lỗi máy chủ, hãy thử lại sau." : st === 409 && !(e instanceof HttpErr) ? "Dữ liệu bị trùng." : e.message } };
      }
    },
    async img(id) {
      if (!/^[a-f0-9]{24}$/.test(String(id || ""))) return { status: 404, headers: {} };
      const r = (await q("select mime,data from images where id=$1", [id]))[0];
      if (!r) return { status: 404, headers: {} };
      return { status: 200, headers: { "Content-Type": r.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" }, raw: Buffer.from(r.data, "base64") };
    }
  };
}
