(() => {
  const rpc = async (op, args={}) => {
    const r = await fetch('/api/rpc', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({op,args}) });
    const d = await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error || 'Lỗi kết nối'); return d;
  };
  const b64 = s => { const p='='.repeat((4-s.length%4)%4); return Uint8Array.from(atob((s+p).replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)); };
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let panel=false, unread=0;
  function shell(){
    if(document.getElementById('tv-notify-root')) return;
    const root=document.createElement('div'); root.id='tv-notify-root';
    root.innerHTML=`<style>
      #tv-notify-root{position:fixed;right:16px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:9998;font:14px system-ui;color:#172033}
      #tv-nbtn{border:0;border-radius:999px;background:#155eef;color:white;padding:12px 16px;box-shadow:0 5px 22px #0003;font-weight:700;cursor:pointer}
      #tv-nbadge{display:inline-flex;min-width:19px;height:19px;align-items:center;justify-content:center;border-radius:20px;background:#e53935;color:white;font-size:11px;margin-left:5px}
      #tv-npanel{display:none;position:absolute;right:0;bottom:56px;width:min(360px,calc(100vw - 28px));max-height:min(70vh,540px);overflow:auto;background:white;color:#172033;border:1px solid #d9deea;border-radius:16px;box-shadow:0 12px 40px #0003;padding:14px}
      #tv-npanel.open{display:block}#tv-npanel h3{margin:0 0 10px;font-size:17px}#tv-npanel button{cursor:pointer}
      .tv-nitem{padding:10px 2px;border-bottom:1px solid #edf0f5;text-align:left;display:block;width:100%;background:white;border:0;color:inherit}
      .tv-nitem.unread{background:#f0f6ff}.tv-ndate{font-size:11px;color:#6b7280}.tv-nmuted{font-size:12px;color:#6b7280}
      #tv-npanel .tv-naction{border:1px solid #d8deea;border-radius:8px;background:white;padding:7px 9px;margin:0 5px 8px 0}
      @media(max-width:480px){#tv-notify-root{right:12px;bottom:calc(12px + env(safe-area-inset-bottom))}#tv-nbtn{padding:12px 14px}}
    </style><button id="tv-nbtn" type="button">🔔 Thông báo <span id="tv-nbadge" hidden>0</span></button><section id="tv-npanel"><h3>Thông báo ThợViệt</h3><div id="tv-ncontrols"></div><div id="tv-nitems" class="tv-nmuted">Đang tải…</div></section>`;
    document.body.append(root);
    root.querySelector('#tv-nbtn').onclick=()=>{panel=!panel;root.querySelector('#tv-npanel').classList.toggle('open',panel);if(panel)loadItems()};
  }
  function setUnread(n){unread=n;const b=document.querySelector('#tv-nbadge');if(!b)return;b.hidden=!n;b.textContent=n>99?'99+':n;}
  async function loadItems(){
    const box=document.querySelector('#tv-nitems');if(!box)return;
    try{const d=await rpc('notifications_list');setUnread(d.unread||0);box.innerHTML=(d.items||[]).map(x=>`<button class="tv-nitem ${x.read_at?'':'unread'}" data-id="${x.id}" data-url="${esc(x.url)}"><b>${esc(x.title)}</b><div>${esc(x.body)}</div><div class="tv-ndate">${new Date(Number(x.created_at)).toLocaleString('vi-VN')}</div></button>`).join('')||'<p>Chưa có thông báo.</p>';
      box.querySelectorAll('.tv-nitem').forEach(b=>b.onclick=async()=>{await rpc('notification_read',{id:Number(b.dataset.id)});location.href=b.dataset.url||'/'});
    }catch(e){box.textContent=e.message}
  }
  async function enablePush(){
    const status=document.querySelector('#tv-nstatus');status.textContent='Đang xin quyền thông báo…';
    try{
      if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw new Error('Trình duyệt này chưa hỗ trợ Web Push. Hãy dùng Chrome/Edge hoặc Safari mới.');
      if(!window.isSecureContext)throw new Error('Thông báo đẩy cần HTTPS.');
      const perm=await Notification.requestPermission();if(perm!=='granted')throw new Error('Bạn chưa cấp quyền thông báo cho ThợViệt.');
      const reg=await navigator.serviceWorker.register('/sw.js');
      const key=await rpc('push_key');if(!key.publicKey)throw new Error('Máy chủ chưa cấu hình VAPID. Quản trị viên cần thêm VAPID_PUBLIC_KEY và VAPID_PRIVATE_KEY trên Vercel.');
      let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(key.publicKey)});
      await rpc('push_subscribe',{subscription:sub.toJSON()});status.textContent='Đã bật thông báo trên thiết bị này.';document.querySelector('#tv-nenable').textContent='Đã bật trên thiết bị này';document.querySelector('#tv-nenable').disabled=true;
    }catch(e){status.textContent=e.message}
  }
  async function init(){
    try{const d=await rpc('load');if(!d.me)return;shell();
      const ctl=document.querySelector('#tv-ncontrols');ctl.innerHTML=`<button class="tv-naction" id="tv-nenable">📲 Bật thông báo trên điện thoại</button><button class="tv-naction" id="tv-nreadall">Đánh dấu đã đọc</button><a class="tv-naction" href="/trade.html" style="display:inline-block;text-decoration:none;color:inherit">📄 Hợp đồng & giao dịch</a><a class="tv-naction" href="/report.html" style="display:inline-block;text-decoration:none;color:inherit">⚑ Báo cáo vi phạm</a><div id="tv-nstatus" class="tv-nmuted">Thông báo đẩy cần cấp quyền trên từng thiết bị. iPhone/iPad: thêm website vào Màn hình chính trước khi bật.</div>`;
      document.querySelector('#tv-nenable').onclick=enablePush;
      document.querySelector('#tv-nreadall').onclick=async()=>{await rpc('notification_read_all');loadItems()};
      const reg=await navigator.serviceWorker?.register('/sw.js').catch(()=>null);
      if(reg){const sub=await reg.pushManager?.getSubscription();if(sub){document.querySelector('#tv-nenable').textContent='Đã bật trên thiết bị này';document.querySelector('#tv-nenable').disabled=true}}
      await loadItems();setInterval(()=>{if(!document.hidden)loadItems()},60000);
    }catch{}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
