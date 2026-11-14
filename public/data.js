/* ThợViệt – lớp dữ liệu (gọi API /api/rpc trên Vercel, database là Neon).
   Giao diện vẫn đọc dữ liệu từ biến DB trong bộ nhớ như trước; file này:
   - boot(): hỏi server xem đã đăng nhập chưa + tải dữ liệu vào DB
   - save(): so sánh DB với bản đã lưu và gửi phần thay đổi lên server (ảnh được tải lên trước)
   - subscribeChat(): hỏi server định kỳ để nhận tin nhắn mới */
let DB = { workers: [], jobs: [], convs: [] }, S = null, SNAP = { w: undefined, j: {}, c: {}, v: {}, m: {} }, SIG = "";
const load = k => (k === "tv_db" ? DB : null);               // code cũ gọi DB=load("tv_db")||DB: luôn trả về DB trong bộ nhớ
const nid = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);
const viErr = e => String((e && e.message) || e);
function banner(msg) { document.body.innerHTML = `<div style="max-width:560px;margin:60px auto;padding:20px;font:16px/1.6 system-ui,sans-serif"><h2>🔧 ThợViệt</h2><p>${msg}</p></div>`; }

/* ---------- gọi server ---------- */
async function api(op, args) {
  let r;
  try {
    r = await fetch("/api/rpc", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, args: args || {} }) });
  } catch (e) { const err = new Error("Không kết nối được máy chủ."); err.network = true; throw err; }
  let d = null; try { d = await r.json(); } catch (e) {}
  if (!r.ok) { const err = new Error((d && d.error) || "Lỗi máy chủ (" + r.status + ")."); err.status = r.status; throw err; }
  return d || {};
}

/* cập nhật mảng tại chỗ (giữ nguyên đối tượng cũ để các màn hình đang mở không bị "mồ côi") */
function mergeArr(old, nw) {
  const m = new Map(old.map(o => [o.id, o]));
  const out = nw.map(n => { const o = m.get(n.id); if (!o) return n; for (const k of Object.keys(o)) delete o[k]; Object.assign(o, n); return o; });
  old.length = 0; old.push(...out);
}

/* ---------- hàng đợi: mọi lần lưu/tải chạy lần lượt, không giẫm chân nhau ---------- */
let chain = Promise.resolve();
function enqueue(f, quiet) { const p = chain.then(f); chain = p.catch(e => { console.error(e); if (!quiet) alert("Không lưu được lên máy chủ: " + viErr(e) + "\nHãy kiểm tra mạng rồi thử lại."); }); return p; }
const save = () => { enqueue(syncUp).catch(() => {}); };

/* ---------- ảnh: đưa ảnh dạng data: lên server, thay bằng link ---------- */
async function up(src) {
  if (!src || !/^data:/.test(src)) return src;
  return (await api("upload", { data: src })).url;
}
async function upWorker(w) { w.photo = await up(w.photo); for (const a of w.albums || []) for (const p of a.photos || []) if (p.src) p.src = await up(p.src); }

/* ---------- ghi thay đổi lên server ---------- */
const workerPayload = w => ({
  w: { id: w.id, name: w.name, cat: w.cat, city: w.city || "", rate: w.rate || "", negot: !!w.negot, exp: +w.exp || 0, bio: w.bio || "", skills: w.skills || [], gender: w.gender || "", byear: String(w.byear || ""), addr: w.addr || "", photo: w.photo || "", albums: w.albums || [], cv: { work: w.work || [], edu: w.edu || [], cert: w.cert || [], award: w.award || [] }, pub: !!w.pub },
  c: { phone: w.phone || "", cmail: w.cmail || "", ref: w.ref || [] },
  s: { busy: !!w.busy, active: w.active || [] }
});
const jobPayload = j => ({ id: j.id, title: j.title, cat: j.cat, city: j.city || "", budget: j.budget || "", days: j.days || "", desc: j.desc || "", photos: j.photos || [], addr: j.addr || "", chosen: j.chosen || null });

async function syncUp() {
  if (!S) return;
  const me = DB.workers.find(w => w.email === S.email);
  if (me && (S.role === "tho" || S.role === "sup")) {
    await upWorker(me);
    const p = workerPayload(me), k = JSON.stringify(p);
    if (SNAP.w !== k) { const r = await api("worker_save", p); if (r.id && r.id !== me.id) me.id = r.id; SNAP.w = JSON.stringify(workerPayload(me)); }
  }
  for (const j of DB.jobs) {
    if (j.by === S.email) { j.photos = j.photos || []; for (let i = 0; i < j.photos.length; i++) j.photos[i] = await up(j.photos[i]); const p = jobPayload(j), k = JSON.stringify(p); if (SNAP.j[j.id] !== k) { await api("job_save", { j: p }); SNAP.j[j.id] = k; } }
    else { const c1 = j.chosen || 0, c0 = SNAP.c[j.id] || 0; if (c1 !== c0) { await api("job_assign", { job: j.id, worker: c1 || c0, on: !!c1 }); SNAP.c[j.id] = c1; } }
    for (const b of j.bids) if (!b.id) { const d = await api("bid_add", { job: j.id, worker: b.w, price: b.p || "", msg: b.m || "" }); b.id = d.id; }
  }
  const side = S.role === "biz" ? "o" : "w";
  for (const c of DB.convs) {
    if (SNAP.v[c.id] === undefined) {
      const d = await api("conv_add", { id: c.id, worker: c.worker, owner: c.owner });
      if (d.id && d.id !== c.id) c.id = d.id;          // đã có cuộc trò chuyện giữa 2 người này từ trước
      SNAP.v[c.id] = "{}";
    }
    const sv = JSON.stringify(c.seen || {});
    if (SNAP.v[c.id] !== sv) { await api("conv_seen", { id: c.id, ts: (c.seen || {})[side] || 0 }); SNAP.v[c.id] = sv; }
    for (const m of c.msgs) {
      if (!m.id) { const d = await api("msg_add", { conv: c.id, body: m.t || "", offer: m.offer || null, ts: m.ts }); m.id = d.id; SNAP.m[m.id] = m.offer ? m.offer.st : null; }
      else if (m.offer && SNAP.m[m.id] !== m.offer.st) { await api("offer_set", { msg: m.id, st: m.offer.st }); SNAP.m[m.id] = m.offer.st; }
    }
  }
  for (const w of DB.workers) for (const r of w.reviews) if (!r.id) { r.img = await up(r.img); const d = await api("review_add", { worker: w.id, stars: r.s, body: r.t || "", img: r.img || "" }); r.id = d.id; }
}

/* ---------- tải dữ liệu từ server ---------- */
function snapConvs() { DB.convs.forEach(c => { SNAP.v[c.id] = JSON.stringify(c.seen || {}); c.msgs.forEach(m => { if (m.id) SNAP.m[m.id] = m.offer ? m.offer.st : null; }); }); }
function applyConvs(list, sig) {
  const old = new Map(DB.convs.map(c => [c.id, c]));
  const nc = list.map(c => { const o = old.get(c.id); if (o) c.msgs.push(...o.msgs.filter(m => !m.id)); return c; });   // giữ tin chưa gửi xong
  const pending = DB.convs.filter(c => SNAP.v[c.id] === undefined && !nc.some(x => x.id === c.id));                    // giữ cuộc trò chuyện mới chưa lưu
  mergeArr(DB.convs, nc.concat(pending)); snapConvs(); SIG = sig || SIG;
}
async function fetchConvs() { const d = await api("chats"); applyConvs(d.convs || [], d.sig); }
function applyAll(d) {
  mergeArr(DB.workers, d.workers || []);
  mergeArr(DB.jobs, d.jobs || []);
  applyConvs(d.convs || [], d.sig);
  SNAP.w = undefined; SNAP.j = {}; SNAP.c = {};
  const me = DB.workers.find(w => w.email === S.email); if (me && (S.role === "tho" || S.role === "sup")) SNAP.w = JSON.stringify(workerPayload(me));
  DB.jobs.forEach(j => { SNAP.c[j.id] = j.chosen || 0; if (j.by === S.email) SNAP.j[j.id] = JSON.stringify(jobPayload(j)); });
}
const loadAll = () => enqueue(async () => { const d = await api("load"); if (d.me) { S = { email: d.me.id, name: d.me.name, role: d.me.role, logo: d.me.logo || "" }; applyAll(d); } else S = null; }, true);
const refreshChats = () => enqueue(fetchConvs, true);

/* ---------- tin nhắn mới: hỏi server mỗi vài giây ---------- */
let RT = null;
function subscribeChat(cb) {
  if (RT) return;
  RT = setInterval(() => {
    if (document.hidden || !S) return;
    enqueue(async () => { const d = await api("chat_poll"); if (d.sig === SIG) return false; await fetchConvs(); return true; }, true).then(changed => { if (changed) cb(); }).catch(() => {});
  }, 4000);
}

/* ---------- đăng nhập / khởi động ---------- */
async function boot() {
  try {
    const d = await api("load");
    if (!d.me) { S = null; return true; }
    S = { email: d.me.id, name: d.me.name, role: d.me.role, logo: d.me.logo || "" };   // S.email là mã người dùng (uuid), chỉ dùng làm khoá
    applyAll(d);
    return true;
  } catch (e) { console.error(e); banner("Không kết nối được máy chủ. Hãy kiểm tra mạng rồi tải lại trang."); return false; }
}
async function authSignUp(email, pw, name, role) { const d = await api("signup", { email, pw, name, role }); return { session: d.me }; }
async function authSignIn(email, pw) { await api("login", { email, pw }); }
async function logout() { try { await api("logout"); } catch (e) {} location.href = "index.html"; }
function startPage() {   // dùng cho owner.html / worker.html
  boot().then(ok => { if (!ok) return; addEventListener("hashchange", async () => { try { await loadAll(); } catch (e) {} route(); }); route(); chatInit(); });
}
