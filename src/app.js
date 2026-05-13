// ============================================================
//  감귤 수송·콘테이너 통합 관리 — 메인 앱
//  Supabase 연동 버전
// ============================================================

const PER = 7;
const OT = ['노랑', '초록', '헌콘'];
const td = () => new Date().toISOString().slice(0, 10);

// 상태
let farms = [], drivers = [], dispatches = [], picks = [];
let ownIns = [], ownOuts = [], nhfIns = [], nhfOuts = [], reports = [], harvests = [], vehicles = [];
let invUnsorted = [], invSorted = [], invWaste = [], invJuice = [];
let invSizeConfig = {};
let categories = [], sizeGrades = [], itemDefs = [], itemSizeRules = [];
let inboundRecords = [], processingRecords = [], qualityCriteria = [], storageLocations = [];
let _editLocId = null;

function generateUUID() {
  return (crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }));
}
let showVoidData = false;
let _voidTargetId = null;
let ibViewMode = 'list';
let ibFilterCat = '';
let ibFilterSrc = '';
let ibSortCol = null;   // 'date' | 'farm' | 'qty' | null
let ibSortDir = null;   // 'desc' | 'asc' | null
let ibPage = 1;
let ibPageSize = 25;
let ibSearch = '';
let _farmViewSearch = '';
let _farmViewSort = 'remaining-desc';
let _farmExpanded = new Set();
let _catExpanded = new Set();
let _currentFarmList = [];
let _currentCatList = [];
let auditLogs = [];
let auditLogOffset = 0;
const AUDIT_PAGE_SIZE = 100;
let auditLogPage = 1;
const AUDIT_PER_PAGE = 15;
let sortedView = 'list';
let stock = { 노랑: { init: 500 }, 초록: { init: 300 }, 헌콘: { init: 200 } };
let stockEd = { 노랑: false, 초록: false, 헌콘: false };

let _msgTxt = '', _msgDrvTel = '';
let _editFarmId = null, _editDrvId = null, _editPickId = null;
let _XT = null, _XI = null;
let _dt = 'w', _dt2 = 'w', _ft = 'n';
let _dp = 1, _d2p = 1, _rp = 1;
let _repOpen = false;
let _pinHidden = {};
const foldSt = { 'own-tb': false, 'nhf-sum': false, 'nhf-tb': false };
const secSt = { alert: true, 'disp-dash': true, 'farm-dash': true, 'ext-dash': true, 'bk-dash': true };

// PIN 상태
let _loggedDrv = null, _pinBuf = '', _pinMode = 'drv';

// ── 로딩 UI
function showLoading(msg = '불러오는 중...') {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,.85);z-index:999;display:flex;align-items:center;justify-content:center;font-size:16px;color:#C05800;gap:10px';
    document.body.appendChild(el);
  }
  el.innerHTML = `<span style="font-size:24px">🍊</span> ${msg}`;
  el.style.display = 'flex';
}
function hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (el) el.style.display = 'none';
}

// ── 앱 초기화
async function initApp() {
  showLoading('데이터 불러오는 중...');

  const savedAdmPin = localStorage.getItem('citrus_adm_pin');
  if (savedAdmPin) window.ADM_PIN = savedAdmPin;

  try {
    const [data, qcData, locData] = await Promise.all([loadAllData(), dbGetQualityCriteria(), dbGetLocations()]);
    farms = data.farms;
    drivers = data.drivers;
    dispatches = data.dispatches;
    picks = data.picks;
    ownIns = data.ownIns;
    ownOuts = data.ownOuts;
    nhfIns = data.nhfIns;
    nhfOuts = data.nhfOuts;
    reports = data.reports;
    stock = data.stockData;
    harvests = data.harvests || [];
    vehicles = data.vehicles || [];
    qualityCriteria = qcData || [];
    storageLocations = locData || [];
  } catch (e) {
    console.error('데이터 로드 실패:', e);
    alert('⚠ 데이터를 불러오지 못했습니다.\n\nsupabase-client.js에서 URL과 API 키를 확인해 주세요.\n\n' + e.message);
  }

  setDates();
  popSels();
  renderAll();
  
  // 새로고침 후 로그인 상태 복원
  const savedRole = sessionStorage.getItem('citrus_role');
  const savedDrvName = sessionStorage.getItem('citrus_drv');
  
  if (savedRole === 'admin') {
    document.getElementById('pin-screen').style.display = 'none';
    document.getElementById('hdr-btns').style.display = 'flex';
    document.getElementById('hdr-logged').style.display = 'none';
    document.getElementById('rbtn-logout').style.display = '';
    setRole('admin');
  } else if (savedRole === 'driver' && savedDrvName) {
    const drv = drivers.find(d => d.name === savedDrvName);
    if (drv && drv.pin_active !== false) {
      _loggedDrv = drv;
      document.getElementById('hdr-btns').style.display = 'none';
      document.getElementById('hdr-logged').style.display = 'flex';
      document.getElementById('logged-name').textContent = drv.name + ' 기사님 👋';
      document.getElementById('anav').style.display = 'none';
      document.getElementById('dnav').style.display = 'flex';
      document.querySelectorAll('.panel').forEach(p => { p.classList.remove('active'); });
      document.getElementById('p-dmy').style.display = '';
      document.getElementById('p-drep').style.display = '';
      DT('dmy');
      const wel = document.getElementById('drv-welcome');
      if (wel) wel.innerHTML = `안녕하세요 <strong>${esc(drv.name)}</strong> 기사님! 🍊<br><span style="font-size:12px;color:#888">${drv.type} · ${esc(drv.car || '차량 미등록')}</span>`;
      renderMyAssign(); renderMyPending();
    } else {
      document.getElementById('pin-screen').style.display = 'flex';
    }
  } else {
    const sel = document.getElementById('pin-sel');
    sel.innerHTML = '<option value="">-- 기사를 선택하세요 --</option>';
    drivers.filter(d => d.pin_active !== false).forEach(d => {
      sel.innerHTML += `<option value="${esc(d.name)}">${esc(d.name)} (${d.type})</option>`;
    });
    document.getElementById('pin-screen').style.display = 'flex';
  }
  initImeNotice();
  hideLoading();
}

// ── PIN 시스템
function showPin() {
  _pinBuf = ''; updDots();
  const sel = document.getElementById('pin-sel');
  sel.innerHTML = '<option value="">-- 기사를 선택하세요 --</option>';
  drivers.filter(d => d.pin_active !== false).forEach(d => {
    sel.innerHTML += `<option value="${esc(d.name)}">${esc(d.name)} (${d.type})</option>`;
  });
  document.getElementById('pin-error').style.display = 'none';
  setPinMode('drv');
  document.getElementById('pin-screen').style.display = 'flex';
}

function setPinMode(m) {
  _pinMode = m; _pinBuf = ''; updDots();
  document.getElementById('ptab-drv').className = 'pin-mode-tab' + (m === 'drv' ? ' active' : '');
  document.getElementById('ptab-adm').className = 'pin-mode-tab' + (m === 'adm' ? ' active' : '');
  document.getElementById('pin-drv-sec').style.display = m === 'drv' ? '' : 'none';
  document.getElementById('pin-adm-sec').style.display = m === 'adm' ? '' : 'none';
}

function pinReset() { _pinBuf = ''; updDots(); document.getElementById('pin-error').style.display = 'none'; }

function pinKey(k) {
  if (_pinMode === 'adm') return;
  if (!document.getElementById('pin-sel').value) { alert('기사를 먼저 선택해 주세요'); return; }
  if (_pinBuf.length >= 4) return;
  _pinBuf += k; updDots();
  if (_pinBuf.length === 4) setTimeout(checkPin, 120);
}

function pinDel() { _pinBuf = _pinBuf.slice(0, -1); updDots(); }

function updDots() {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('pd' + i);
    if (el) el.className = 'pin-dot' + (i < _pinBuf.length ? ' on' : '');
  }
}

function checkPin() {
  const name = document.getElementById('pin-sel').value;
  const drv = drivers.find(d => d.name === name);
  if (!drv || drv.pin_active === false) { pinErr('❌ 비활성화된 계정입니다.'); return; }
  if (drv.pin === _pinBuf) {
    _loggedDrv = drv;
    sessionStorage.setItem('citrus_role', 'driver');
    sessionStorage.setItem('citrus_drv', drv.name);
    document.getElementById('pin-screen').style.display = 'none';
    document.getElementById('hdr-btns').style.display = 'none';
    document.getElementById('hdr-logged').style.display = 'flex';
    document.getElementById('logged-name').textContent = drv.name + ' 기사님 👋';
    document.getElementById('anav').style.display = 'none';
    document.getElementById('dnav').style.display = 'flex';
    document.querySelectorAll('.panel').forEach(p => { p.classList.remove('active'); });
    document.getElementById('p-dmy').style.display = '';
    document.getElementById('p-drep').style.display = '';
    DT('dmy');
    const wel = document.getElementById('drv-welcome');
    if (wel) wel.innerHTML = `안녕하세요 <strong>${esc(drv.name)}</strong> 기사님! 🍊<br><span style="font-size:12px;color:#888">${drv.type} · ${esc(drv.car || '차량 미등록')}</span>`;
    const rf = document.getElementById('rp-farm');
    if (rf) { rf.innerHTML = '<option value="">선택</option>'; farms.forEach(f => rf.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`); }
  renderMyAssign(); renderMyPending();
    const myReports = reports.filter(r => r.driver === drv.name);
    const repCnt = document.getElementById('rep-cnt');
    if (repCnt) repCnt.textContent = myReports.length + '건';
  } else {
    pinErr('❌ PIN이 맞지 않습니다.');
  }
}

function pinErr(msg) {
  _pinBuf = ''; updDots();
  const el = document.getElementById('pin-error');
  el.textContent = msg; el.style.display = '';
  setTimeout(() => el.style.display = 'none', 2500);
}

function chkAdmPin() {
  const v = document.getElementById('adm-pin-in').value;
  const currentPin = localStorage.getItem('citrus_adm_pin') || ADM_PIN;
  if (v === currentPin) {
    sessionStorage.setItem('citrus_role', 'admin');
    document.getElementById('pin-screen').style.display = 'none';
    setRole('admin');
    document.getElementById('adm-pin-in').value = '';
    document.getElementById('adm-err').style.display = 'none';
  } else {
    document.getElementById('adm-err').style.display = '';
    document.getElementById('adm-pin-in').value = '';
    setTimeout(() => document.getElementById('adm-err').style.display = 'none', 2000);
  }
}

function doLogout() {
  sessionStorage.removeItem('citrus_role');
  sessionStorage.removeItem('citrus_drv');
  _loggedDrv = null;
  document.getElementById('hdr-btns').style.display = 'flex';
  document.getElementById('hdr-logged').style.display = 'none';
  document.getElementById('anav').style.display = 'none';
  document.getElementById('dnav').style.display = 'none';
  document.querySelectorAll('.panel').forEach(p => { p.classList.remove('active'); p.style.display = ''; });
  document.getElementById('pin-screen').style.display = 'flex';
  setPinMode('drv');
}

function gotoAdmin() {
  document.getElementById('rbtn-adm').className = 'rbtn active';
  document.getElementById('hdr-btns').style.display = 'flex';
  document.getElementById('hdr-logged').style.display = 'none';
  setRole('admin');
}
function adminLogout() {
  sessionStorage.removeItem('citrus_role');
  sessionStorage.removeItem('citrus_drv');
  document.getElementById('pin-screen').style.display = 'flex';
  document.getElementById('rbtn-logout').style.display = 'none';
  document.getElementById('rbtn-adm').className = 'rbtn active';
  setPinMode('adm');
}

// ── PIN 관리
function genPin() { return String(Math.floor(1000 + Math.random() * 9000)); }

async function regenPin(id) {
  if (!confirm('PIN을 새로 발급할까요?\n기사에게 새 PIN을 전달해야 합니다.')) return;
  const np = genPin();
  try {
    await dbUpdateDriver(id, { pin: np });
    drivers = drivers.map(d => d.id === id ? { ...d, pin: np } : d);
    _pinHidden[id] = false;
    renderDrivers();
    alert(`새 PIN이 발급되었습니다!\n\n📌 PIN: ${np}\n\n기사에게 전달해 주세요.`);
  } catch (e) { alert('오류: ' + e.message); }
}

function togglePinVis(id) { _pinHidden[id] = !_pinHidden[id]; renderDrivers(); }

async function togglePinActive(id) {
  const drv = drivers.find(d => d.id === id);
  if (!drv) return;
  const newState = !drv.pin_active;
  if (!newState && !confirm(`${drv.name} 기사의 접속을 차단할까요?\n차단하면 즉시 로그인 불가 상태가 됩니다.`)) return;
  try {
    await dbUpdateDriver(id, { pin_active: newState });
    drivers = drivers.map(d => d.id === id ? { ...d, pin_active: newState } : d);
    renderDrivers();
  } catch (e) { alert('오류: ' + e.message); }
}

// ── 토글
function togS(k) {
  secSt[k] = !secSt[k]; const e = secSt[k];
  const det = document.getElementById(k === 'alert' ? 'alert-detail' : k + '-detail');
  const sum = document.getElementById(k === 'alert' ? 'alert-summary' : k + '-summary');
  const txt = document.getElementById(k === 'alert' ? 'alert-txt' : k + '-txt');
  if (det) det.style.display = e ? '' : 'none';
  if (sum) sum.style.display = e ? 'none' : '';
  if (txt) txt.textContent = e ? '간략히' : '자세히';
}

function togF(k) {
  foldSt[k] = !foldSt[k]; const o = foldSt[k];
  const w = document.getElementById(k + '-wrap');
  const ic = document.getElementById(k + '-icon');
  if (w) w.style.display = o ? '' : 'none';
  if (ic) ic.textContent = o ? '▲ 접기' : '▼ 자세히';
}

function togRepH() {
  _repOpen = !_repOpen;
  document.getElementById('rep-history').style.display = _repOpen ? '' : 'none';
  document.getElementById('rep-h-icon').textContent = _repOpen ? '▲ 접기' : '▼ 자세히';
  renderRep();
}

function switchMsgTab(t) {
  document.getElementById('msgtab-c').className = 'msg-tab' + (t === 'c' ? ' active' : '');
  document.getElementById('msgtab-s').className = 'msg-tab' + (t === 's' ? ' active' : '');
  document.getElementById('msgtab-c-panel').style.display = t === 'c' ? '' : 'none';
  document.getElementById('msgtab-s-panel').style.display = t === 's' ? '' : 'none';
}

// ── 재고
function getSt(t) {
  const init = stock[t]?.init || 0;
  const out = dispatches.filter(d => d.ctype === t).reduce((s, d) => s + d.qty, 0);
  return { init, out, remain: init - out };
}

function renderSC() {
  const el = document.getElementById('stock-cards');
  const cc = { 노랑: 'yellow', 초록: 'green', 헌콘: 'old' };
  const ic = { 노랑: '🟡', 초록: '🟢', 헌콘: '⬜' };
  el.innerHTML = OT.map(t => {
    const st = getSt(t);
    const p = st.init > 0 ? st.remain / st.init : 1;
    const rc = p > 0.3 ? 'sok' : p > 0.1 ? 'swarn' : 'sdanger';
    const ed = stockEd[t];
    return `<div class="stock-card ${cc[t]}">
      <div style="font-size:20px;margin-bottom:4px">${ic[t]}</div>
      <div style="font-size:12px;color:#888;margin-bottom:6px;font-weight:500">${t} 콘테이너</div>
      <div class="stock-nums">
        <div class="stock-num-box"><div class="stock-num">${st.init.toLocaleString()}</div><div class="stock-sub">초기재고</div></div>
        <div class="stock-divider"></div>
        <div class="stock-num-box"><div class="stock-num out">-${st.out.toLocaleString()}</div><div class="stock-sub">배출</div></div>
        <div class="stock-divider"></div>
        <div class="stock-num-box"><div class="stock-num remain ${rc}">${st.remain.toLocaleString()}</div><div class="stock-sub">잔여</div></div>
      </div>
      <div class="stock-edit-area">
        ${ed
          ? `<div class="stock-input-row" style="display:flex"><input type="number" id="si-${t}" value="${st.init}" min="0"><button class="ssave" onclick="saveStock('${t}')">저장</button><button class="scancel" onclick="cancelStock('${t}')">취소</button></div>`
          : `<div class="stock-display"><span>초기 <span class="val">${st.init.toLocaleString()}개</span></span><button class="sedit" onclick="editStock('${t}')">✏️ 수정</button></div>`
        }
      </div>
    </div>`;
  }).join('');
}

function editStock(t) { stockEd[t] = true; renderSC(); }
function cancelStock(t) { stockEd[t] = false; renderSC(); }
function saveStock(t) {
  const v = parseInt(document.getElementById('si-' + t)?.value) || 0;
  stock[t] = { init: v };
  stockEd[t] = false;
  saveStockSettings(stock);
  renderSC(); chkStW();
}

function chkStW() {
  const c = gv('dp-ctype'), q = parseInt(document.getElementById('dp-qty')?.value) || 0;
  const w = document.getElementById('dp-stw');
  if (!w) return;
  if (OT.includes(c) && q > 0) {
    const st = getSt(c);
    if (q > st.remain) { w.style.display = ''; w.textContent = `⚠ ${c} 잔여 재고 ${st.remain}개보다 ${q - st.remain}개 많습니다. 그래도 등록 가능.`; }
    else w.style.display = 'none';
  } else w.style.display = 'none';
}

// ── 네비
function setRole(r) {
  document.getElementById('anav').style.display = r === 'admin' ? 'flex' : 'none';
  document.getElementById('dnav').style.display = r === 'driver' ? 'flex' : 'none';
  document.querySelectorAll('.panel').forEach(p => { p.classList.remove('active'); p.style.display = ''; });
  if (r === 'admin') {
    document.getElementById('rbtn-adm').className = 'rbtn active';
    document.getElementById('rbtn-logout').style.display = '';
    T('dash');
  }
}

function T(id) {
  document.querySelectorAll('#anav .nbtn').forEach(b =>
    b.classList.toggle('active', b.getAttribute('onclick') === `T('${id}')`));
  ['dash', 'disp', 'ext', 'cal', 'dboard', 'farm', 'drv', 'vehicle', 'stats', 'export', 'inv'].forEach(p => {
    const el = document.getElementById('p-' + p); if (el) el.classList.remove('active');
  });
  const el = document.getElementById('p-' + id); if (el) el.classList.add('active');
  if (id === 'dash') renderDash();
  if (id === 'cal') renderCal();
  if (id === 'drv') renderAdmPinChange();
  if (id === 'vehicle') renderVehicles();
  if (id === 'stats') renderStats();
  if (id === 'dboard') { if (_dbView === 'sched') renderDSchedule(); else renderDBoard(); }
  if (id === 'inv') loadAndRenderInv();
  if (id === 'export') {
    const t = td();
    const fd = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const ef = document.getElementById('exp-from');
    const et = document.getElementById('exp-to');
    if (ef && !ef.value) ef.value = fd;
    if (et && !et.value) et.value = t;
  }
}
function DT(id) {
  document.querySelectorAll('#dnav .nbtn').forEach(b =>
    b.classList.toggle('active', b.getAttribute('onclick') === `DT('${id}')`));
  ['dmy', 'drep'].forEach(p => { const el = document.getElementById('p-' + p); if (el) el.classList.remove('active'); });
  const el = document.getElementById('p-' + id); if (el) el.classList.add('active');
}

function extTab(t) {
  document.getElementById('ext-f-div').style.display = t === 'f' ? '' : 'none';
  document.getElementById('ext-n-div').style.display = t === 'n' ? '' : 'none';
  document.getElementById('ext-b-div').style.display = t === 'b' ? '' : 'none';
  document.getElementById('et-f').className = 'etab' + (t === 'f' ? ' af' : '');
  document.getElementById('et-n').className = 'etab' + (t === 'n' ? ' an' : '');
  document.getElementById('et-b').className = 'etab' + (t === 'b' ? ' af' : '');
}
function ownTab(t) {
  document.getElementById('ot-i').className = 'etab' + (t === 'i' ? ' af' : '');
  document.getElementById('ot-o').className = 'etab' + (t === 'o' ? ' af' : '');
  document.getElementById('own-in').style.display = t === 'i' ? '' : 'none';
  document.getElementById('own-out').style.display = t === 'o' ? '' : 'none';
}
function nhfTab(t) {
  document.getElementById('nt-i').className = 'etab' + (t === 'i' ? ' an' : '');
  document.getElementById('nt-o').className = 'etab' + (t === 'o' ? ' an' : '');
  document.getElementById('nhf-in').style.display = t === 'i' ? '' : 'none';
  document.getElementById('nhf-out').style.display = t === 'o' ? '' : 'none';
}
function switchPT(t) {
  document.getElementById('pt-disp-sec').style.display = t === 'disp' ? '' : 'none';
  document.getElementById('pt-pick-sec').style.display = t === 'pick' ? '' : 'none';
  document.getElementById('ptab-disp').className = 'dtab' + (t === 'disp' ? ' active' : '');
  document.getElementById('ptab-pick').className = 'dtab' + (t === 'pick' ? ' active' : '');
  if (t === 'pick') renderPick();
}
function switchDT(t) { _dt = t; _dp = 1; document.getElementById('dtab-w').className = 'dtab' + (t === 'w' ? ' active' : ''); document.getElementById('dtab-d').className = 'dtab' + (t === 'd' ? ' active' : ''); renderDDash(); }
function switchDT2(t) { _dt2 = t; _d2p = 1; document.getElementById('dtab2-w').className = 'dtab' + (t === 'w' ? ' active' : ''); document.getElementById('dtab2-d').className = 'dtab' + (t === 'd' ? ' active' : ''); renderDisp(); }
function switchFT(t) { _ft = t; document.getElementById('ftab-n').className = 'dtab' + (t === 'n' ? ' active' : ''); document.getElementById('ftab-o').className = 'dtab' + (t === 'o' ? ' active' : ''); renderFarmTbl(); }
function selCt(v) { document.getElementById('dp-ctype').value = v; document.querySelectorAll('.ctype-btn').forEach(b => b.classList.toggle('sel', b.textContent.includes(v))); chkStW(); }

function mkPg(cid, total, cur, fn) {
  const pages = Math.ceil(total / PER) || 1;
  const el = document.getElementById(cid);
  if (pages <= 1) { el.innerHTML = ''; return; }
  let h = `<span>${total}건 · ${Math.min((cur - 1) * PER + 1, total)}~${Math.min(cur * PER, total)}</span><div class="pg-btns">`;
  h += `<button class="pg-btn" onclick="${fn}(${cur - 1})" ${cur === 1 ? 'disabled' : ''}>◀</button>`;
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - cur) <= 1) h += `<button class="pg-btn ${i === cur ? 'cur' : ''}" onclick="${fn}(${i})">${i}</button>`;
    else if (Math.abs(i - cur) === 2) h += `<span style="padding:0 4px">…</span>`;
  }
  h += `<button class="pg-btn" onclick="${fn}(${cur + 1})" ${cur === pages ? 'disabled' : ''}>▶</button></div>`;
  el.innerHTML = h;
}
function goDP(p) { _dp = p; renderDDash(); }
function goD2P(p) { _d2p = p; renderDisp(); }
function goRP(p) { _rp = p; renderRep(); }

// ── 유틸
function gf(n) { return farms.find(f => f.name === n) || {}; }
function gd(n) { return drivers.find(d => d.name === n) || {}; }
function afF(p) {
  const f = gf(gv(p + '-farm'));
  sv(p + '-tel', f.tel || ''); sv(p + '-ftel', f.tel || ''); sv(p + '-addr', f.addr || '');
  if (p === 'dp' && f.variety) sv('dp-item', f.variety);
}
function afD(p) { const d = gd(gv(p + '-drv')); sv(p + '-dtel', d.tel || ''); sv(p + '-car', d.car || ''); }

function popSels() {
  ['dp-farm', 'pk-farm', 'oi-farm', 'oo-farm', 'bk-farm'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const v = el.value; el.innerHTML = '<option value="">선택</option>';
    farms.forEach(f => el.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`);
    el.value = v;
  });
  ['dp-drv', 'pk-drv', 'bk-drv'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const v = el.value;
    el.innerHTML = id === 'pk-drv' ? '<option value="">선택사항</option>' : '<option value="">선택</option>';
    drivers.forEach(d => el.innerHTML += `<option value="${esc(d.name)}">${esc(d.name)} (${d.type})</option>`);
    el.value = v;
  });
  const mpf = document.getElementById('mp-farm');
  if (mpf) { const v = mpf.value; mpf.innerHTML = '<option value="">선택</option>'; farms.forEach(f => mpf.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`); mpf.value = v; }
  const mpd = document.getElementById('mp-drv');
  if (mpd) { const v = mpd.value; mpd.innerHTML = '<option value="">선택사항</option>'; drivers.forEach(d => mpd.innerHTML += `<option value="${esc(d.name)}">${esc(d.name)}</option>`); mpd.value = v; }
 ['oi-staff', 'oo-staff'].forEach(id => {
  const el = document.getElementById(id); if (!el) return;
  const v = el.value; el.innerHTML = '<option value="">선택</option>';
  drivers.forEach(d => el.innerHTML += `<option value="${esc(d.name)}">${esc(d.name)}</option>`);
  el.value = v;
});
  const rf = document.getElementById('rp-farm');
  if (rf) { rf.innerHTML = '<option value="">선택</option>'; farms.forEach(f => rf.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`); }
  ['ib-farm', 'so-farm'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const v = el.value; el.innerHTML = '<option value="">선택</option>';
    farms.forEach(f => el.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`);
    el.value = v;
  });
}

function setDates() {
  const t = td();
  ['dp-date', 'pk-date', 'oi-date', 'oo-date', 'ni-date', 'no-date', 'rp-date', 'bk-date',
   'ib-date', 'proc-date', 'so-date', 'wa-date', 'ju-date'].forEach(id => {
    const el = document.getElementById(id); if (el && !el.value) el.value = t;
  });
  const now = new Date();
  const fd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const rf = document.getElementById('rp-from'), rt = document.getElementById('rp-to');
  if (rf && !rf.value) rf.value = fd;
  if (rt && !rt.value) rt.value = t;
}

function gv(id) { return document.getElementById(id)?.value?.trim() || ''; }
function sv(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function n(id) { return parseInt(document.getElementById(id)?.value) || 0; }
function clr(...ids) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmtN(n) { if (n == null) return '-'; return Number(n).toLocaleString('ko-KR'); }
function emr(c, m) { return `<tr><td colspan="${c}" class="empty">${m}</td></tr>`; }
function ftm(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function CM(t) { document.getElementById('modal-' + t).style.display = 'none'; }
function cDel(m) { return confirm('삭제하시겠습니까?\n\n' + m + '\n\n⚠ 삭제된 데이터는 복구할 수 없습니다.'); }

// ── 문자
function buildMsg(d) {
  const f = gf(d.farm);
  const ft = f.tel ? `📞 농가주 연락처: ${f.tel}\n` : '';
  const ht = d.harvest ? `🗓 수확예정일: ${d.harvest}\n` : '';
  const it = d.item ? `🍊 품목: ${d.item}\n` : '';
  return `[감귤 콘테이너 배출 안내]\n\n안녕하세요, ${esc(d.driver)} 기사님.\n배출 업무 안내드립니다.\n\n📅 배출일: ${d.date}\n🏡 농가명: ${esc(d.farm)}\n📍 주소: ${esc(f.addr || '농가에 직접 확인')}\n${ft}📦 콘테이너: ${esc(d.ctype)} ${d.qty}개\n${ht}${it}${d.note && d.note !== '[자동]' ? '📝 특이사항: ' + esc(d.note) + '\n' : ''}\n배출 완료 후 앱에서 완료 등록 부탁드립니다.\n감사합니다.`;
}
function buildBkMsg(d) {
  const f = gf(d.farm);
  const ft = f.tel ? `📞 농가주 연락처: ${f.tel}\n` : '';
  const qtyStr = d.qty > 0 ? `${d.qty}개` : '현장 확인';
  return `[빈 콘테이너 회수 안내]\n\n안녕하세요, ${esc(d.driver)} 기사님.\n빈 콘테이너 회수 업무 안내드립니다.\n\n📅 회수일: ${d.date}\n🏡 농가명: ${esc(d.farm)}\n📍 주소: ${esc(f.addr || '농가에 직접 확인')}\n${ft}📦 회수 수량: ${qtyStr}\n${d.note ? '📝 비고: ' + esc(d.note) + '\n' : ''}\n감사합니다.`;
}
function previewBkMsg() {
  const farm = gv('bk-farm'), drv = gv('bk-drv'), date = gv('bk-date');
  if (!farm || !drv || !date) { alert('날짜, 농가명, 기사를 먼저 입력하세요'); return; }
  const d = gd(drv);
  openBkMsg({ date, farm, driver: drv, dtel: d.tel || '', qty: n('bk-qty'), note: gv('bk-note') });
}
function openBkMsg(d) {
  const drv = drivers.find(x => x.name === d.driver);
  _msgTxt = buildBkMsg(d); _msgDrvTel = d.dtel || drv?.tel || '';
  document.getElementById('msg-text').textContent = _msgTxt;
  sv('sms-to', _msgDrvTel); sv('sms-body', _msgTxt);
  const ss = document.getElementById('sms-stat'); if (ss) ss.style.display = 'none';
  switchMsgTab('c');
  document.getElementById('modal-msg').style.display = 'flex';
}

function openMsg(d) {
  _msgTxt = buildMsg(d); _msgDrvTel = d.dtel || '';
  document.getElementById('msg-text').textContent = _msgTxt;
  sv('sms-to', _msgDrvTel); sv('sms-body', _msgTxt);
  const ss = document.getElementById('sms-stat'); if (ss) ss.style.display = 'none';
  switchMsgTab('c');
  document.getElementById('modal-msg').style.display = 'flex';
}

function previewMsg() {
  const farm = gv('dp-farm'), drv = gv('dp-drv'), qty = n('dp-qty'), date = gv('dp-date'), ctype = gv('dp-ctype');
  if (!farm || !drv || !qty || !date) { alert('날짜, 농가명, 기사명, 수량을 먼저 입력하세요'); return; }
  const d = gd(drv);
  openMsg({ date, farm, driver: drv, dtel: d.tel || '', ctype, qty, harvest: gv('dp-harvest'), item: gv('dp-item'), note: gv('dp-note') });
}

function showMsgById(id) {
  const d = dispatches.find(x => x.id === id); if (!d) return; openMsg(d);
}

function copyMsg() {
  if (!_msgTxt) return;
  navigator.clipboard.writeText(_msgTxt)
    .then(() => alert('📋 복사 완료! 카카오톡 또는 문자에 붙여넣기 하세요.'))
    .catch(() => prompt('아래 내용을 복사하세요:', _msgTxt));
}

// ── 모달: 농가 수정
function openFarmEdit(id) {
  const f = farms.find(x => x.id === id); if (!f) return;
  _editFarmId = id;
  ['name', 'tel', 'addr', 'variety', 'contract', 'staff', 'memo'].forEach(k => {
    const el = document.getElementById('mf-' + k); if (el) el.value = f[k] || '';
  });
  document.getElementById('modal-farm').style.display = 'flex';
}
async function saveFarmEdit() {
  const name = document.getElementById('mf-name').value.trim();
  if (!name) { alert('농가명을 입력하세요'); return; }
  const oldName = farms.find(f => f.id === _editFarmId)?.name;
  const data = {
    name, tel: document.getElementById('mf-tel').value, addr: document.getElementById('mf-addr').value,
    variety: document.getElementById('mf-variety').value, contract: parseInt(document.getElementById('mf-contract').value) || 0,
    staff: document.getElementById('mf-staff').value, memo: document.getElementById('mf-memo').value
  };
  try {
    await dbUpdateFarm(_editFarmId, data);
    farms = farms.map(f => f.id === _editFarmId ? { ...f, ...data } : f);
    if (oldName && oldName !== name) {
      const cascadeTables = ['dispatches', 'picks', 'own_ins', 'own_outs', 'reports', 'harvests'];
      await Promise.all(cascadeTables.map(tbl =>
        fetch(`${SUPABASE_URL}/rest/v1/${tbl}?farm=eq.${encodeURIComponent(oldName)}`, {
          method: 'PATCH',
          headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ farm: name })
        })
      ));
      dispatches = dispatches.map(d => d.farm === oldName ? { ...d, farm: name } : d);
      picks     = picks.map(p => p.farm === oldName ? { ...p, farm: name } : p);
      ownIns    = ownIns.map(o => o.farm === oldName ? { ...o, farm: name } : o);
      ownOuts   = ownOuts.map(o => o.farm === oldName ? { ...o, farm: name } : o);
      reports   = reports.map(r => r.farm === oldName ? { ...r, farm: name } : r);
      harvests  = harvests.map(h => h.farm === oldName ? { ...h, farm: name } : h);
    }
    CM('farm'); popSels(); renderFarm(); renderDash(); renderCal();
  } catch (e) { alert('오류: ' + e.message); }
}

// ── 모달: 기사 수정
function openDrvEdit(id) {
  const d = drivers.find(x => x.id === id); if (!d) return;
  _editDrvId = id;
  sv('md-name', d.name || ''); sv('md-tel', d.tel || ''); sv('md-car', d.car || '');
  document.getElementById('md-type').value = d.type || '내부';
  sv('md-note', d.note || '');
  document.getElementById('modal-drv').style.display = 'flex';
}
async function saveDrvEdit() {
  const name = document.getElementById('md-name').value.trim(), tel = document.getElementById('md-tel').value.trim();
  if (!name || !tel) { alert('기사명과 연락처를 입력하세요'); return; }
  const data = { name, tel, car: document.getElementById('md-car').value, type: document.getElementById('md-type').value, note: document.getElementById('md-note').value };
  try {
    await dbUpdateDriver(_editDrvId, data);
    drivers = drivers.map(d => d.id === _editDrvId ? { ...d, ...data } : d);
    CM('drv'); popSels(); renderDrivers();
  } catch (e) { alert('오류: ' + e.message); }
}

// ── 모달: 수거 수정
function openPickEdit(id) {
  const p = picks.find(x => x.id === id); if (!p) return;
  _editPickId = id;
  sv('mp-date', p.date || ''); sv('mp-farm', p.farm || '');
  document.getElementById('mp-type').value = p.type || '원물수거';
  sv('mp-qty', p.qty || ''); sv('mp-drv', p.driver || ''); sv('mp-car', p.car || ''); sv('mp-note', p.note || '');
  document.getElementById('modal-pick').style.display = 'flex';
}
async function savePickEdit() {
  const date = gv('mp-date'), farm = gv('mp-farm'), type = gv('mp-type'), qty = parseInt(document.getElementById('mp-qty').value) || 0;
  if (!date || !farm || !type || !qty) { alert('필수 항목을 입력하세요'); return; }
  const data = { date, farm, type, qty, driver: gv('mp-drv'), car: gv('mp-car'), note: gv('mp-note'), updated_at: new Date().toISOString() };
  try {
    await dbUpdatePick(_editPickId, data);
    picks = picks.map(p => p.id === _editPickId ? { ...p, ...data } : p);
    CM('pick'); renderPick(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

// ── 모달: 외부용기 수정
function openExtEdit(tp, id) {
  _XT = tp; _XI = id;
  const body = document.getElementById('ext-modal-body');
  const title = document.getElementById('ext-modal-title');
  if (tp === 'ownIn') {
    const o = ownIns.find(x => x.id === id); if (!o) return;
    title.textContent = '✏️ 자가 콘테이너 반입 수정';
    body.innerHTML = `<div class="fg"><label>반입일자</label><input id="em-date" type="date" value="${esc(o.date||'')}"></div><div class="fg"><label>농가명</label><input id="em-farm" value="${esc(o.farm||'')}"></div><div class="fg"><label>수량</label><input id="em-qty" type="number" value="${o.qty||0}"></div><div class="fg"><label>특징</label><input id="em-feature" value="${esc(o.feature||'')}"></div><div class="fg"><label>담당직원</label><input id="em-staff" value="${esc(o.staff||'')}"></div>`;
  } else if (tp === 'ownOut') {
    const o = ownOuts.find(x => x.id === id); if (!o) return;
    title.textContent = '✏️ 자가 콘테이너 반납 수정';
    body.innerHTML = `<div class="fg"><label>반납일자</label><input id="em-date" type="date" value="${esc(o.date||'')}"></div><div class="fg"><label>농가명</label><input id="em-farm" value="${esc(o.farm||'')}"></div><div class="fg"><label>수량</label><input id="em-qty" type="number" value="${o.qty||0}"></div><div class="fg"><label>방법</label><input id="em-method" value="${esc(o.method||'')}"></div><div class="fg"><label>특징</label><input id="em-feature" value="${esc(o.feature||'')}"></div><div class="fg"><label>담당직원</label><input id="em-staff" value="${esc(o.staff||'')}"></div>`;
  } else if (tp === 'nhfIn') {
    const o = nhfIns.find(x => x.id === id); if (!o) return;
    title.textContent = '✏️ 농협 용기 반입 수정';
    body.innerHTML = `<div class="fg"><label>반입일자</label><input id="em-date" type="date" value="${esc(o.date||'')}"></div><div class="fg"><label>농협명</label><input id="em-nhf" value="${esc(o.nhf||'')}"></div><div class="fg"><label>종류</label><input id="em-type" value="${esc(o.type||'')}"></div><div class="fg"><label>수량</label><input id="em-qty" type="number" value="${o.qty||0}"></div><div class="fg"><label>특징</label><input id="em-feature" value="${esc(o.feature||'')}"></div><div class="fg"><label>구매 내용</label><input id="em-goods" value="${esc(o.goods||'')}"></div><div class="fg"><label>담당직원</label><input id="em-staff" value="${esc(o.staff||'')}"></div>`;
  } else if (tp === 'nhfOut') {
    const o = nhfOuts.find(x => x.id === id); if (!o) return;
    title.textContent = '✏️ 농협 용기 반납 수정';
    body.innerHTML = `<div class="fg"><label>반납일자</label><input id="em-date" type="date" value="${esc(o.date||'')}"></div><div class="fg"><label>농협명</label><input id="em-nhf" value="${esc(o.nhf||'')}"></div><div class="fg"><label>종류</label><input id="em-type" value="${esc(o.type||'')}"></div><div class="fg"><label>수량</label><input id="em-qty" type="number" value="${o.qty||0}"></div><div class="fg"><label>방법</label><input id="em-method" value="${esc(o.method||'')}"></div><div class="fg"><label>특징</label><input id="em-feature" value="${esc(o.feature||'')}"></div><div class="fg"><label>담당직원</label><input id="em-staff" value="${esc(o.staff||'')}"></div>`;
  }
  document.getElementById('modal-ext').style.display = 'flex';
}
async function saveExtEdit() {
  const g = i => document.getElementById(i)?.value?.trim() || '';
  const qty = parseInt(document.getElementById('em-qty')?.value) || 0;
  try {
    if (_XT === 'ownIn') { await dbUpdateOwnIn(_XI, { date: g('em-date'), farm: g('em-farm'), qty, feature: g('em-feature'), staff: g('em-staff') }); ownIns = await dbGetOwnIns(); }
    else if (_XT === 'ownOut') { await dbUpdateOwnOut(_XI, { date: g('em-date'), farm: g('em-farm'), qty, method: g('em-method'), feature: g('em-feature'), staff: g('em-staff') }); ownOuts = await dbGetOwnOuts(); }
    else if (_XT === 'nhfIn') { await dbUpdateNhfIn(_XI, { date: g('em-date'), nhf: g('em-nhf'), type: g('em-type'), qty, feature: g('em-feature'), goods: g('em-goods'), staff: g('em-staff') }); nhfIns = await dbGetNhfIns(); }
    else if (_XT === 'nhfOut') { await dbUpdateNhfOut(_XI, { date: g('em-date'), nhf: g('em-nhf'), type: g('em-type'), qty, method: g('em-method'), feature: g('em-feature'), staff: g('em-staff') }); nhfOuts = await dbGetNhfOuts(); }
    CM('ext'); renderOwn(); renderNhf(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

// ── 농가
async function addFarm() {
  const name = gv('f-name');
  if (!name) { alert('농가명을 입력하세요'); return; }
  if (farms.find(f => f.name === name)) { alert('이미 등록된 농가입니다'); return; }
  try {
    const row = await dbInsertFarm({ name, tel: gv('f-tel'), addr: gv('f-addr'), variety: gv('f-variety'), contract: n('f-contract'), staff: gv('f-staff'), memo: gv('f-memo') });
    farms.push(row);
    clr('f-name', 'f-tel', 'f-addr', 'f-variety', 'f-contract', 'f-staff', 'f-memo');
    popSels(); renderFarm();
  } catch (e) { alert('오류: ' + e.message); }
}
async function delFarm(id) {
  if (!cDel('농가 삭제')) return;
  try { await dbDeleteFarm(id); farms = farms.filter(f => f.id !== id); popSels(); renderFarm(); }
  catch (e) { alert('오류: ' + e.message); }
}
function renderFarm() {
  document.getElementById('farm-cnt').textContent = farms.length;
  const el = document.getElementById('farm-cards');
  if (!farms.length) { el.innerHTML = '<div class="note">등록된 농가가 없습니다</div>'; return; }
  el.innerHTML = farms.map((f, i) => `<div class="farm-card">
    <div class="fc-info">
      <div class="fc-name"><span class="badge b-neu">F-${String(i + 1).padStart(3, '0')}</span>${esc(f.name)}${f.variety ? `<span class="badge b-teal">${esc(f.variety)}</span>` : ''}</div>
      <div class="fc-details">
        ${f.tel ? `<span>📞 ${esc(f.tel)}</span>` : ''}
        ${f.addr ? `<span>📍 ${esc(f.addr)}</span>` : ''}
        ${f.contract ? `<span>📦 계약 ${f.contract}개</span>` : ''}
        ${f.staff ? `<span>👤 ${esc(f.staff)}</span>` : ''}
        ${f.memo ? `<span>💬 ${esc(f.memo)}</span>` : ''}
      </div>
    </div>
    <div class="fc-actions"><button class="btn" onclick="openFarmHistory('${esc(f.name)}')">📋 이력</button><button class="btn edt" onclick="openFarmEdit(${f.id})">✏️</button><button class="btn del" onclick="delFarm(${f.id})">삭제</button></div>
  </div>`).join('');
}

// ── 기사·PIN
async function addDriver() {
  const name = gv('dv-name'), tel = gv('dv-tel'), type = gv('dv-type');
  if (!name || !tel) { alert('기사명과 연락처를 입력하세요'); return; }
  if (drivers.find(d => d.name === name)) { alert('이미 등록된 기사입니다'); return; }
  const car = type === '내부' ? (document.getElementById('dv-car-sel')?.value || '') : (gv('dv-car') || '');
  const pin = genPin();
  try {
    const row = await dbInsertDriver({ name, tel, car, type, note: gv('dv-note'), pin, pin_active: true });
    drivers.push(row);
    clr('dv-name', 'dv-tel', 'dv-car', 'dv-note');
    if (document.getElementById('dv-car-sel')) document.getElementById('dv-car-sel').value = '';
    popSels(); renderDrivers(); renderVehicles();
    alert(`✅ ${name} 기사 등록!\n\n📌 발급 PIN: ${pin}\n\n기사에게 전달해 주세요.`);
  } catch (e) { alert('오류: ' + e.message); }
}
async function delDriver(id) {
  if (!cDel('기사 삭제')) return;
  try { await dbDeleteDriver(id); drivers = drivers.filter(d => d.id !== id); popSels(); renderDrivers(); }
  catch (e) { alert('오류: ' + e.message); }
}

// ── 모달: 배차 수정
let _editDispId = null;
function openDispEdit(id) {
  const d = dispatches.find(x => x.id === id); if (!d) return;
  _editDispId = id;
  document.getElementById('ed-date').value = d.date || '';
  const ef = document.getElementById('ed-farm');
  ef.innerHTML = '<option value="">선택</option>';
  farms.forEach(f => ef.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`);
  ef.value = d.farm || '';
  const edrv = document.getElementById('ed-drv');
  edrv.innerHTML = '<option value="">선택</option>';
  drivers.forEach(dr => edrv.innerHTML += `<option value="${esc(dr.name)}">${esc(dr.name)}</option>`);
  edrv.value = d.driver || '';
  document.getElementById('ed-qty').value = d.qty || '';
  document.getElementById('ed-ctype').value = d.ctype || '노랑';
  document.getElementById('ed-harvest').value = d.harvest || '';
  document.getElementById('ed-item').value = d.item || '';
  document.getElementById('ed-note').value = d.note || '';
  document.getElementById('ed-trip').value = d.trip || '';
  document.getElementById('ed-timeslot').value = d.timeslot || '';
  document.getElementById('modal-disp').style.display = 'flex';
}

async function saveDispEdit() {
  const date = document.getElementById('ed-date').value;
  const farm = document.getElementById('ed-farm').value;
  const driver = document.getElementById('ed-drv').value;
  const qtyRaw = document.getElementById('ed-qty').value.trim();
  const qty = qtyRaw === '' ? 0 : parseInt(qtyRaw) || 0;
  if (!date || !farm || !driver) { alert('필수 항목을 입력하세요'); return; }
  const d = gd(driver);
  const data = {
    date, farm, driver,
    dtel: d.tel || '', car: d.car || '', qty,
    ctype: document.getElementById('ed-ctype').value,
    harvest: document.getElementById('ed-harvest').value || null,
    item: document.getElementById('ed-item').value || null,
    note: document.getElementById('ed-note').value || null,
    trip: document.getElementById('ed-trip').value || null,
    timeslot: document.getElementById('ed-timeslot').value || null
  };
  try {
    await dbUpdateDispatch(_editDispId, data);
    dispatches = dispatches.map(x => x.id === _editDispId ? { ...x, ...data } : x);
    CM('disp'); renderDisp(); renderDDash(); renderSC(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

function renderAdmPinChange() {
  const el = document.getElementById('adm-pin-change');
  if (!el) return;
  el.innerHTML = `
    <div class="form-card" style="border-left:3px solid #C05800">
      <div class="form-title">🔐 관리자 PIN 변경</div>
      <div class="form-grid">
        <div class="fg"><label>현재 PIN</label><input id="apc-cur" type="password" maxlength="4" placeholder="현재 PIN" oninput="this.value=this.value.replace(/\\D/g,'')"></div>
        <div class="fg"><label>새 PIN</label><input id="apc-new" type="password" maxlength="4" placeholder="새 PIN (4자리)" oninput="this.value=this.value.replace(/\\D/g,'')"></div>
        <div class="fg"><label>새 PIN 확인</label><input id="apc-confirm" type="password" maxlength="4" placeholder="새 PIN 재입력" oninput="this.value=this.value.replace(/\\D/g,'')"></div>
      </div>
      <div id="apc-msg" style="font-size:12px;margin-bottom:8px;display:none"></div>
      <div class="form-actions"><button class="btn pri" onclick="changeAdmPin()">PIN 변경</button></div>
    </div>
  `;
}

function changeAdmPin() {
  const curEl = document.getElementById('apc-cur');
  const nwEl = document.getElementById('apc-new');
  const cfEl = document.getElementById('apc-confirm');
  const msg = document.getElementById('apc-msg');
  
  if (!curEl || !nwEl || !cfEl || !msg) { alert('PIN 변경 폼을 찾을 수 없습니다'); return; }
  
  const cur = curEl.value;
  const nw = nwEl.value;
  const cf = cfEl.value;
  const currentPin = localStorage.getItem('citrus_adm_pin') || ADM_PIN;
  
  msg.style.display = 'block';
  
  if (!cur) { msg.style.color = '#C62828'; msg.textContent = '❌ 현재 PIN을 입력하세요'; return; }
  if (cur !== currentPin) { msg.style.color = '#C62828'; msg.textContent = '❌ 현재 PIN이 맞지 않습니다 (입력: ' + cur + ')'; return; }
  if (!nw || nw.length < 4) { msg.style.color = '#C62828'; msg.textContent = '❌ 새 PIN은 4자리여야 합니다'; return; }
  if (nw !== cf) { msg.style.color = '#C62828'; msg.textContent = '❌ 새 PIN이 일치하지 않습니다'; return; }
  if (nw === cur) { msg.style.color = '#C62828'; msg.textContent = '❌ 현재 PIN과 동일합니다'; return; }
  
  localStorage.setItem('citrus_adm_pin', nw);
  msg.style.color = '#2E7D32';
  msg.textContent = '✅ PIN 변경 완료! 새 PIN: ' + nw;
  curEl.value = ''; nwEl.value = ''; cfEl.value = '';
}

function renderDrivers() {
  document.getElementById('drv-cnt').textContent = drivers.length;
  const el = document.getElementById('drv-list');
  if (!drivers.length) { el.innerHTML = '<div class="note">등록된 기사가 없습니다</div>'; return; }
  el.innerHTML = drivers.map(d => {
    const hidden = _pinHidden[d.id] === true;
    const pinDisp = hidden ? '••••' : (d.pin || '----');
    const pinColor = hidden ? '#999' : '#C05800';
    return `<div class="pin-mgmt">
      <div class="pm-top">
        <div class="pm-info">
          <div class="pm-name">${esc(d.name)} <span class="badge ${d.type === '내부' ? 'b-ok' : 'b-pur'}">${d.type}</span> <span class="badge ${d.pin_active !== false ? 'b-ok' : 'b-red'}">${d.pin_active !== false ? '활성' : '차단'}</span></div>
          <div class="pm-sub">📞 ${esc(d.tel)} · 🚛 ${esc(d.car || '차량미등록')}</div>
        </div>
        <div class="pm-acts">
          <button class="btn edt" onclick="openDrvEdit(${d.id})">✏️ 수정</button>
          <button class="btn del" onclick="delDriver(${d.id})">삭제</button>
        </div>
      </div>
      <div class="pm-pin-area">
        <span class="pm-pin-label">PIN</span>
        <span style="font-family:monospace;font-size:20px;font-weight:700;letter-spacing:6px;color:${pinColor};min-width:70px">${pinDisp}</span>
        <div class="pm-acts">
          <button class="btn-p hide" onclick="togglePinVis(${d.id})">${hidden ? '👁 보기' : '🙈 숨기기'}</button>
          <button class="btn-p regen" onclick="regenPin(${d.id})">🔄 재발급</button>
          <button class="btn-p ${d.pin_active !== false ? 'block' : 'unblock'}" onclick="togglePinActive(${d.id})">${d.pin_active !== false ? '🚫 차단' : '✅ 해제'}</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── 차량 관리
let _editVehicleId = null;

function renderVehicles() {
  // 기사 등록 폼의 차량 드롭다운 갱신
  const sel = document.getElementById('dv-car-sel');
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">미배정</option>' + vehicles.map(v => `<option value="${esc(v.number)}">${esc(v.number)} (기본${v.capacity_default||'-'}개)</option>`).join('');
    sel.value = cur;
  }

  const el = document.getElementById('vehicle-list');
  if (!el) return;

  const today = td();
  const mStr = today.slice(0, 7);

  if (!vehicles.length) {
    el.innerHTML = '<div class="note">등록된 차량이 없습니다</div>';
    const avail = document.getElementById('vehicle-avail');
    if (avail) avail.innerHTML = '';
    return;
  }

  el.innerHTML = vehicles.map(v => {
    const assigned = drivers.find(d => d.car === v.number);
    const vDisps = dispatches.filter(d => d.car === v.number);
    const pending = vDisps.filter(d => d.status === '배차완료').sort((a, b) => a.date > b.date ? 1 : -1);
    const monthTotal = vDisps.filter(d => d.date && d.date.startsWith(mStr)).length;
    const monthQty = vDisps.filter(d => d.date && d.date.startsWith(mStr) && d.qty > 0).reduce((s, d) => s + d.qty, 0);

    const statusBadge = pending.length > 0
      ? `<span class="badge b-warn">${pending.length}건 대기</span>`
      : `<span class="badge b-ok">대기 없음</span>`;

    const pendingRows = pending.slice(0, 8).map(d => {
      const isToday = d.date === today, isLate = d.date < today;
      const dateStyle = isLate ? 'color:#C62828;font-weight:600' : isToday ? 'color:#C05800;font-weight:600' : 'color:#555';
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 14px;border-top:0.5px solid #f0f0f0;font-size:12px;flex-wrap:wrap">
        <span style="${dateStyle}">${d.date.slice(5).replace('-','/')}</span>
        ${isToday ? '<span style="font-size:10px;background:#FFF3E0;color:#C05800;padding:1px 5px;border-radius:4px">오늘</span>' : isLate ? '<span style="font-size:10px;background:#FFEBEE;color:#C62828;padding:1px 5px;border-radius:4px">지연</span>' : ''}
        <span style="font-weight:600">${esc(d.farm)}</span>
        ${d.driver ? `<span style="color:#888">· ${esc(d.driver)}</span>` : ''}
        <span style="margin-left:auto;color:#555">${d.qty > 0 ? d.qty+'개' : '미정'} ${ctB(d.ctype)}</span>
      </div>`;
    }).join('');

    return `<div style="background:#fff;border-radius:12px;border:1px solid ${pending.length ? '#FFE082' : '#e0e0e0'};overflow:hidden;margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:${pending.length ? '#FFFDE7' : '#fafafa'};flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="font-size:15px;font-weight:700">🚛 ${esc(v.number)}</div>
          <div style="font-size:11px;color:#888">기본 ${v.capacity_default||'-'}개 · 최대 ${v.capacity_max||'-'}개${v.note ? ' · '+esc(v.note) : ''}</div>
          ${assigned ? `<span class="badge b-info" style="font-size:11px">👤 ${esc(assigned.name)}</span>` : '<span class="badge b-neu" style="font-size:11px">기사 미배정</span>'}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          ${statusBadge}
          <span style="font-size:11px;color:#aaa">이번달 ${monthTotal}건 · ${monthQty}개</span>
          <button class="btn edt" style="padding:3px 8px;font-size:11px" onclick="openVehicleEdit(${v.id})">✏️</button>
          <button class="btn del" style="padding:3px 8px;font-size:11px" onclick="delVehicle(${v.id})">삭제</button>
        </div>
      </div>
      ${pending.length
        ? `<div style="padding:4px 14px 2px;background:#FFF8F0;border-top:0.5px solid #FFE082"><span style="font-size:10px;color:#C05800;font-weight:600">배출 대기 ${pending.length}건</span></div>${pendingRows}`
        : '<div style="padding:10px 14px;font-size:12px;color:#aaa">배출 대기 없음</div>'}
    </div>`;
  }).join('');

  // 미배정 기사 차량 요약
  const assignedCars = new Set(drivers.map(d => d.car).filter(Boolean));
  const free = vehicles.filter(v => !assignedCars.has(v.number));
  const avail = document.getElementById('vehicle-avail');
  if (avail) {
    avail.innerHTML = free.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;align-items:center">
          <span style="font-size:11px;color:#888;font-weight:600">기사 미배정 차량 ${free.length}대:</span>
          ${free.map(v => `<span style="padding:4px 10px;background:#E8F5E9;color:#2E7D32;border-radius:20px;font-size:12px;font-weight:500">${esc(v.number)}</span>`).join('')}
        </div>`
      : '';
  }

  // 차량 번호 없는 배차 (등록 차량 외)
  const regNums = new Set(vehicles.map(v => v.number));
  const noCarDisps = dispatches.filter(d => d.status === '배차완료' && (!d.car || !regNums.has(d.car)));
  const noCarEl = document.getElementById('vehicle-no-car-sec');
  if (noCarEl) {
    if (noCarDisps.length) {
      noCarEl.style.display = '';
      noCarEl.innerHTML = `<div style="background:#FFF8F0;border:1px solid #FFE0B2;border-radius:10px;padding:10px 14px">
        <div style="font-size:12px;font-weight:700;color:#C05800;margin-bottom:8px">⚠️ 차량 미지정 배출 대기 (${noCarDisps.length}건)</div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${noCarDisps.sort((a,b) => a.date > b.date ? 1 : -1).map(d => `
            <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:#fff;border-radius:6px;font-size:12px;flex-wrap:wrap">
              <span style="${d.date < today ? 'color:#C62828;font-weight:600' : 'color:#555'}">${d.date.slice(5).replace('-','/')}</span>
              <span style="font-weight:600">${esc(d.farm)}</span>
              ${d.driver ? `<span style="color:#888">· ${esc(d.driver)}</span>` : ''}
              <span style="color:#E65100;font-size:11px">${d.car ? esc(d.car)+' (미등록)' : '차량 없음'}</span>
              <button class="btn edt" style="padding:2px 7px;font-size:11px;margin-left:auto" onclick="openDispEdit(${d.id})">✏️</button>
            </div>`).join('')}
        </div>
      </div>`;
    } else {
      noCarEl.style.display = 'none';
    }
  }
}

async function addVehicle() {
  const number = document.getElementById('vc-number')?.value?.trim();
  const capacity_default = parseInt(document.getElementById('vc-cap-def')?.value) || null;
  const capacity_max = parseInt(document.getElementById('vc-cap-max')?.value) || null;
  const note = document.getElementById('vc-note')?.value?.trim() || null;
  if (!number) { alert('차량번호를 입력하세요'); return; }
  try {
    const row = await dbInsertVehicle({ number, capacity_default, capacity_max, note });
    vehicles.push(row);
    clr('vc-number', 'vc-cap-def', 'vc-cap-max', 'vc-note');
    renderVehicles();
  } catch(e) { alert('오류: ' + e.message); }
}

function openVehicleEdit(id) {
  const v = vehicles.find(x => x.id === id); if (!v) return;
  _editVehicleId = id;
  document.getElementById('mvc-number').value = v.number || '';
  document.getElementById('mvc-cap-def').value = v.capacity_default || '';
  document.getElementById('mvc-cap-max').value = v.capacity_max || '';
  document.getElementById('mvc-note').value = v.note || '';
  document.getElementById('modal-vehicle').style.display = 'flex';
}

async function saveVehicleEdit() {
  const number = document.getElementById('mvc-number').value.trim();
  if (!number) { alert('차량번호를 입력하세요'); return; }
  const data = {
    number,
    capacity_default: parseInt(document.getElementById('mvc-cap-def').value) || null,
    capacity_max: parseInt(document.getElementById('mvc-cap-max').value) || null,
    note: document.getElementById('mvc-note').value.trim() || null
  };
  try {
    await dbUpdateVehicle(_editVehicleId, data);
    vehicles = vehicles.map(v => v.id === _editVehicleId ? { ...v, ...data } : v);
    CM('vehicle'); renderVehicles();
  } catch(e) { alert('오류: ' + e.message); }
}

async function delVehicle(id) {
  if (!cDel('차량 삭제')) return;
  try { await dbDeleteVehicle(id); vehicles = vehicles.filter(v => v.id !== id); renderVehicles(); }
  catch(e) { alert('오류: ' + e.message); }
}

function onDrvTypeChange() {
  const type = document.getElementById('dv-type')?.value;
  const carSel = document.getElementById('dv-car-sel-wrap');
  const carTxt = document.getElementById('dv-car-txt-wrap');
  if (carSel) carSel.style.display = type === '내부' ? '' : 'none';
  if (carTxt) carTxt.style.display = type === '외부' ? '' : 'none';
}

// ── 배차
function ctB(v) { const m = { 노랑: '🟡', 초록: '🟢', 헌콘: '⬜', 사각: '🔲' }; return `${m[v] || '📦'} ${esc(v || '-')}`; }

async function addDisp() {
  const date = gv('dp-date'), farm = gv('dp-farm'), drv = gv('dp-drv'), qty = n('dp-qty'), ctype = gv('dp-ctype');
  if (!date || !farm || !drv) { alert('날짜, 농가명, 기사명을 입력하세요'); return; }
  if (!ctype) { alert('콘테이너 종류를 선택하세요'); return; }
  const d = gd(drv);
  try {
    const row = await dbInsertDispatch({ date, farm, driver: drv, dtel: d.tel || '', car: d.car || '', qty, ctype, harvest: gv('dp-harvest') || null, item: gv('dp-item') || null, note: gv('dp-note') || null, trip: gv('dp-trip') || null, timeslot: gv('dp-timeslot') || null, status: '배차완료' });
    dispatches.unshift(row);
    // 수량이 있을 때만 배출 자동 pick 생성
    if (qty > 0) {
      await dbInsertPick({ date, farm, type: '배출', qty, driver: drv, car: d.car || '', note: '[자동]', dispatch_id: row.id, auto: true });
      picks = await dbGetPicks();
    }
    clr('dp-qty', 'dp-note', 'dp-harvest'); sv('dp-ctype', ''); sv('dp-trip', '');
    document.querySelectorAll('.ctype-btn').forEach(b => b.classList.remove('sel'));
    document.getElementById('dp-stw').style.display = 'none';
    openMsg(row);
    renderSC(); renderDisp(); renderDDash(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

async function updDisp(id, s) {
  try {
    await dbUpdateDispatch(id, { status: s });
    dispatches = dispatches.map(d => d.id === id ? { ...d, status: s } : d);
    if (s === '배출완료') {
      const d = dispatches.find(x => x.id === id);
      if (d && !reports.find(r => r.driver === d.driver && r.farm === d.farm && r.date === d.date)) {
        const rpt = await dbInsertReport({ driver: d.driver, date: d.date, farm: d.farm, qty: d.qty, note: '완료처리' });
        reports.unshift(rpt);
      }
    }
    renderDisp(); renderDDash(); renderMyAssign(); renderMyPending();
    const c = document.getElementById('rep-cnt'); if (c) c.textContent = (_loggedDrv ? reports.filter(r=>r.driver===_loggedDrv.name).length : reports.length) + '건';
    if (_repOpen) renderRep(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

async function delDisp(id) {
  if (!cDel('배차 기록 삭제')) return;
  try {
    const autoPicks = picks.filter(p => p.dispatch_id === id);
    await Promise.all(autoPicks.map(p => dbDeletePick(p.id)));
    await dbDeleteDispatch(id);
    dispatches = dispatches.filter(d => d.id !== id);
    picks = picks.filter(p => p.dispatch_id !== id);
    renderSC(); renderDisp(); renderDDash(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

function tsBadge(ts) {
  if (!ts) return '';
  const style = ts === '오전' ? 'background:#E3F2FD;color:#1565C0' : 'background:#FFF3E0;color:#E65100';
  return `<span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;${style}">${ts === '오전' ? '🌅 오전' : '🌇 오후'}</span>`;
}
function tripBadge(trip) {
  if (!trip) return '';
  return `<span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;background:#F3E5F5;color:#6A1B9A">${esc(trip)}</span>`;
}
function renderDDash() {
  const list = dispatches.filter(d => _dt === 'w' ? d.status === '배차완료' : d.status === '배출완료')
    .sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);
  const el = document.getElementById('d-disp-tb');
  const w = dispatches.filter(d => d.status === '배차완료').length;
  const dn = dispatches.filter(d => d.status === '배출완료').length;
  document.getElementById('disp-dash-badges').innerHTML = `<span class="badge b-info">배출 대기 ${w}건</span><span class="badge b-ok">배출 완료 ${dn}건</span>`;

  if (!list.length) { el.innerHTML = `<div style="padding:16px;text-align:center;color:#aaa;font-size:13px">${_dt === 'w' ? '배출 대기 없음 🎉' : '배출 완료 없음'}</div>`; mkPg('disp-pg', 0, 1, 'goDP'); return; }

  const today = td();

  // 날짜별 → 오전/오후/미지정 → 농가별 그룹
  const dates = [...new Set(list.map(d => d.date))];

  function dispRow(d) {
    const drv = gd(d.driver);
    const farm = gf(d.farm);
    return `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#fff;border-radius:8px;border:0.5px solid #ebebeb;flex-wrap:wrap">
      ${tripBadge(d.trip)}
      <div style="display:flex;flex-direction:column;gap:1px">
        <span style="font-size:12px;font-weight:600">${esc(d.farm)}</span>
        ${farm.addr ? `<span style="font-size:10px;color:#aaa">${esc(farm.addr)}</span>` : ''}
      </div>
      <span style="font-size:11px;color:#888">·</span>
      <span style="font-size:12px">${esc(d.driver)}</span>
      <span class="badge ${drv.type==='외부'?'b-pur':'b-ok'}" style="font-size:9px">${drv.type||'내부'}</span>
      <span style="font-size:12px;color:#555;margin-left:2px">${d.qty > 0 ? d.qty+'개' : '<span style="color:#E65100;font-size:11px">수량미정</span>'} ${ctB(d.ctype)}</span>
      <div style="display:flex;gap:4px;margin-left:auto">
        <button class="btn edt" style="padding:3px 8px;font-size:11px" onclick="openDispEdit(${d.id})">✏️</button>
        ${_dt === 'w'
          ? `<button class="btn grn" style="padding:3px 8px;font-size:11px" onclick="updDisp(${d.id},'배출완료')">✅ 완료</button>`
          : `<button class="btn" style="padding:3px 8px;font-size:11px;background:#EDE7F6;color:#4527A0;border:1px solid #D1C4E9" onclick="updDisp(${d.id},'배차완료')">↩ 되돌리기</button>`}
      </div>
    </div>`;
  }

  el.innerHTML = dates.map(date => {
    const dayItems = list.filter(d => d.date === date);
    const isToday = date === today, isLate = date < today;
    const dateLabel = isToday ? `오늘 <span style="color:#C05800">${date}</span>` : isLate ? `<span style="color:#C62828">⚠ ${date} 지연</span>` : date;

    const tripOrder = t => ({ '1차': 1, '2차': 2, '3차': 3 }[t] || 99);
    const sortTrip = arr => [...arr].sort((a, b) => tripOrder(a.trip) - tripOrder(b.trip));
    const am = sortTrip(dayItems.filter(d => d.timeslot === '오전'));
    const pm = sortTrip(dayItems.filter(d => d.timeslot === '오후'));
    const none = sortTrip(dayItems.filter(d => !d.timeslot));

    function slot(label, icon, items, bg, border) {
      if (!items.length) return '';
      return `<div style="margin-bottom:8px">
        <div style="font-size:11px;font-weight:600;color:#888;margin-bottom:5px;padding:3px 8px;background:${bg};border-radius:6px;display:inline-block;border:1px solid ${border}">${icon} ${label} ${items.length}건</div>
        <div style="display:flex;flex-direction:column;gap:4px">${items.map(dispRow).join('')}</div>
      </div>`;
    }

    return `<div style="background:#fff;border-radius:10px;border:1px solid ${isLate?'#FFCDD2':'#e0e0e0'};overflow:hidden;margin-bottom:10px">
      <div style="padding:9px 14px;background:${isLate?'#FFF8F8':isToday?'#FFFDE7':'#fafafa'};font-size:12px;font-weight:600;border-bottom:0.5px solid #f0f0f0">${dateLabel} <span style="font-weight:400;color:#aaa;font-size:11px">${dayItems.length}건</span></div>
      <div style="padding:10px 14px">
        ${slot('오전','🌅',am,'#E3F2FD','#BBDEFB')}
        ${slot('오후','🌇',pm,'#FFF3E0','#FFE0B2')}
        ${none.length ? `<div style="display:flex;flex-direction:column;gap:4px">${none.map(dispRow).join('')}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  mkPg('disp-pg', dates.length, _dp, 'goDP');
  renderHarvestNoDisp();
}

function renderHarvestNoDisp() {
  const el = document.getElementById('harvest-no-disp-sec');
  if (!el) return;
  const today = td();
  const todayHarvFarms = harvests.filter(h =>
    h.date === today ||
    (h.status === '수확중' && !h.end_date && h.date < today)
  );
  const todayDispFarms = new Set(dispatches.filter(d => d.date === today).map(d => d.farm));
  const missing = todayHarvFarms.filter(h => !todayDispFarms.has(h.farm));
  if (!missing.length) { el.style.display = 'none'; return; }
  el.style.display = '';
  const rows = missing.map(h => {
    const farm = gf(h.farm);
    const st = h.status || '수확전';
    const stBadge = st === '수확중' ? '<span class="badge b-warn">수확중</span>'
      : st === '수확완료' ? '<span class="badge b-ok">수확완료</span>'
      : '<span class="badge b-neu">수확전</span>';
    const farmEsc = h.farm.replace(/'/g, "\\'");
    const itemEsc = (h.item || '').replace(/'/g, "\\'");
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#fff;border-radius:8px;border:0.5px solid #FFE082;flex-wrap:wrap">
      <div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0">
        <span style="font-size:13px;font-weight:700">${esc(h.farm)}</span>
        ${farm.addr ? `<span style="font-size:10px;color:#aaa">${esc(farm.addr)}</span>` : ''}
      </div>
      ${h.item ? `<span style="font-size:11px;color:#888">${esc(h.item)}</span>` : ''}
      ${stBadge}
      <button class="btn pri" style="font-size:11px;padding:4px 12px" onclick="fillDispForm('${farmEsc}','${today}','${itemEsc}')">+ 배차 등록</button>
    </div>`;
  }).join('');
  el.innerHTML = `<div style="background:#FFFDE7;border:1px solid #FFE082;border-radius:10px;padding:10px 14px">
    <div style="font-size:12px;font-weight:700;color:#C05800;margin-bottom:8px">⚠️ 금일 수확 중 배차 미등록 (${missing.length}건)</div>
    <div style="display:flex;flex-direction:column;gap:5px">${rows}</div>
  </div>`;
}

function fillDispForm(farm, harvestDate, item) {
  const fd = document.getElementById('dp-farm');
  if (fd) { fd.value = farm; afF('dp'); }
  const hd = document.getElementById('dp-harvest');
  if (hd) hd.value = harvestDate || '';
  const it = document.getElementById('dp-item');
  if (it && item) it.value = item;
  const dd = document.getElementById('dp-date');
  if (dd && !dd.value) dd.value = harvestDate;
  document.querySelector('#pt-disp-sec .form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDisp() {
  const f = dispatches.filter(d => _dt2 === 'w' ? d.status === '배차완료' : d.status === '배출완료');
  const page = f.slice((_d2p - 1) * PER, _d2p * PER);
  const sc = { '배차완료': 'b-info', '배출완료': 'b-ok' };
  document.getElementById('disp-tb').innerHTML = page.length ? page.map(d => `<tr>
    <td>${d.date}</td><td class="nm">${esc(d.farm)}${gf(d.farm).addr ? `<div style="font-size:10px;color:#aaa;font-weight:400;margin-top:2px">${esc(gf(d.farm).addr)}</div>` : ''}</td><td>${esc(d.driver)}</td>
    <td>${d.timeslot ? tsBadge(d.timeslot) : '-'}</td>
    <td>${d.trip ? `<span class="badge b-neu">${esc(d.trip)}</span>` : '-'}</td>
    <td><span class="badge ${gd(d.driver).type === '외부' ? 'b-pur' : 'b-ok'}">${esc(gd(d.driver).type || '-')}</span></td>
    <td>${d.qty > 0 ? d.qty+'개' : '<span class="badge b-warn">미정</span>'}</td><td>${ctB(d.ctype)}</td><td>${d.harvest || '-'}</td><td>${esc(d.item || '-')}</td><td>${esc(d.car || '-')}</td>
    <td><span class="badge ${sc[d.status] || 'b-neu'}">${esc(d.status)}</span></td>
    <td><button class="btn copy" style="padding:4px 8px" onclick="showMsgById(${d.id})">📱</button></td>
    <td><div style="display:flex;gap:4px;align-items:center">
      ${d.status !== '배출완료'
        ? `<button class="btn grn" onclick="updDisp(${d.id},'배출완료')">완료</button>`
        : `<button class="btn" style="background:#EDE7F6;color:#4527A0;border:1px solid #D1C4E9" onclick="updDisp(${d.id},'배차완료')">↩ 되돌리기</button>`}
      <button class="btn edt" onclick="openDispEdit(${d.id})">✏️</button>
      <button class="btn del" onclick="delDisp(${d.id})">삭제</button>
    </div></td>
  </tr>`).join('') : emr(14, _dt2 === 'w' ? '배출 대기 없음' : '배출 완료 없음');
  mkPg('disp2-pg', f.length, _d2p, 'goD2P');
}

// ── 수거
async function addPick() {
  const date = gv('pk-date'), farm = gv('pk-farm'), type = gv('pk-type'), qty = n('pk-qty');
  if (!date || !farm || !type || !qty) { alert('필수 항목을 입력하세요'); return; }
  const d = gd(gv('pk-drv'));
  try {
    const row = await dbInsertPick({ date, farm, type, qty, driver: gv('pk-drv'), car: d.car || gv('pk-car'), note: gv('pk-note'), auto: false });
    picks.unshift(row);
    clr('pk-qty', 'pk-note'); renderPick(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}
async function delPick(id) {
  if (!cDel('수거 기록 삭제')) return;
  try { await dbDeletePick(id); picks = picks.filter(p => p.id !== id); renderPick(); renderDash(); }
  catch (e) { alert('오류: ' + e.message); }
}
function renderPick() {
  const tb = document.getElementById('pick-tb');
  const list = picks.filter(p => !p.auto);
  if (!list.length) { tb.innerHTML = emr(9, '수거·회수 기록이 없습니다'); return; }
  const cls = { 원물수거: 'b-ok', 잉여회수: 'b-neu', 빈콘회수: 'b-teal' };
  tb.innerHTML = list.map(p => `<tr>
    <td>${p.date}</td><td class="nm">${esc(p.farm)}</td>
    <td><span class="badge ${cls[p.type] || 'b-neu'}">${esc(p.type)}</span></td>
    <td>${p.qty}개</td><td>${esc(p.driver || '-')}</td><td>${esc(p.car || '-')}</td>
    <td>${esc(p.note || '-')}</td>
    <td class="mtime">${p.updated_at ? '✏️ ' + ftm(p.updated_at) : '-'}</td>
    <td><div style="display:flex;gap:4px"><button class="btn edt" onclick="openPickEdit(${p.id})">✏️</button><button class="btn del" onclick="delPick(${p.id})">삭제</button></div></td>
  </tr>`).join('');
}

function onPickTypeChange() {
  const type = document.getElementById('pk-type')?.value;
  const smsBtn = document.getElementById('pk-sms-btn');
  if (smsBtn) smsBtn.style.display = type === '빈콘회수' ? '' : 'none';
}

// ── 자가 콘테이너
async function addOwnIn() {
  const date = gv('oi-date'), farm = gv('oi-farm'), qty = n('oi-qty');
  if (!date || !farm || !qty) { alert('반입일자, 농가명, 수량을 입력하세요'); return; }
  if (!gv('oi-staff')) { alert('담당 기사를 선택하세요'); return; }
  try {
    const row = await dbInsertOwnIn({ date, farm, qty, feature: gv('oi-feature'), staff: gv('oi-staff') });
    ownIns.unshift(row); clr('oi-qty', 'oi-feature', 'oi-staff'); renderOwn(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}
async function addOwnOut() {
  const date = gv('oo-date');
  const farm = gv('oo-farm');
  const qty = n('oo-qty');

  if (!date || !farm || !qty) {
    alert('반납일자, 농가명, 수량을 입력하세요');
    return;
  }

  if (!gv('oo-staff')) {
    alert('담당 기사를 선택하세요');
    return;
  }

  try {
    const row = await dbInsertOwnOut({
      date,
      farm,
      qty,
      method: gv('oo-method'),
      feature: gv('oo-feature'),
      staff: gv('oo-staff')
    });

    ownOuts.unshift(row);
    clr('oo-qty', 'oo-staff', 'oo-feature');
    renderOwn();
    renderDash();
  } catch (e) {
    alert('오류: ' + e.message);
  }
}
async function delOwn(id, t) {
  if (!cDel(t === 'i' ? '반입 기록 삭제' : '반납 기록 삭제')) return;

  try {
    if (t === 'i') {
      await dbDeleteOwnIn(id);
      ownIns = ownIns.filter(o => o.id !== id);
    } else {
      await dbDeleteOwnOut(id);
      ownOuts = ownOuts.filter(o => o.id !== id);
    }

    renderOwn();
    renderDash();
  } catch (e) {
    alert('오류: ' + e.message);
  }
}

function gOwnSt(n) {
  const i = ownIns.filter(o => o.farm === n).reduce((s, o) => s + o.qty, 0);
  const o = ownOuts.filter(o => o.farm === n).reduce((s, o) => s + o.qty, 0);
  return { inQ: i, outQ: o, left: i - o, feature: ownIns.filter(o => o.farm === n).map(o => o.feature).filter(Boolean).join(', ') };
}
function renderOwn() {
  const names = [...new Set([...ownIns.map(o => o.farm), ...ownOuts.map(o => o.farm)])];
  const pend = names.filter(n => gOwnSt(n).left > 0), done = names.filter(n => gOwnSt(n).left <= 0);
  const bg = document.getElementById('own-sum-badge');
  if (bg) { bg.textContent = pend.length > 0 ? `반납필요 ${pend.length}건` : '모두 정산완료'; bg.className = 'badge ' + (pend.length > 0 ? 'b-warn' : 'b-ok'); bg.style.textTransform = 'none'; bg.style.fontSize = '11px'; }
  let rows = '';
  if (pend.length) rows += pend.map(n => { const st = gOwnSt(n); return `<tr><td class="nm">${esc(n)}</td><td>${st.inQ}개</td><td>${st.outQ}개</td><td><span class="badge b-warn">${st.left}개</span></td><td>${esc(st.feature || '-')}</td><td><span class="badge b-warn">반납필요</span></td></tr>`; }).join('');
  if (done.length) { rows += `<tr class="ddiv"><td colspan="6">── 정산 완료 ──</td></tr>`; rows += done.map(n => { const st = gOwnSt(n); return `<tr class="dr"><td class="nm">${esc(n)}</td><td>${st.inQ}개</td><td>${st.outQ}개</td><td><span class="badge b-ok">${st.left}개</span></td><td>${esc(st.feature || '-')}</td><td><span class="badge b-ok">정산완료</span></td></tr>`; }).join(''); }
  document.getElementById('own-sum').innerHTML = rows || emr(6, '기록 없음');
  const all = [...ownIns.map(o => ({ ...o, dir: '반입', xt: 'ownIn', meth: '-' })), ...ownOuts.map(o => ({ ...o, dir: '반납', xt: 'ownOut', meth: o.method || '-' }))].sort((a, b) => b.date > a.date ? 1 : -1);
  const tb = document.getElementById('own-tb-badge'); if (tb) tb.textContent = all.length + '건';
  document.getElementById('own-tb').innerHTML = all.length ? all.map(o => `<tr><td>${o.date}</td><td class="nm">${esc(o.farm)}</td><td><span class="badge ${o.dir === '반입' ? 'b-pur' : 'b-ok'}">${o.dir}</span></td><td>${o.qty}개</td><td>${esc(o.meth)}</td><td>${esc(o.feature || '-')}</td><td>${esc(o.staff || '-')}</td><td style="display:flex;gap:4px"><button class="btn edt" onclick="openExtEdit('${o.xt}',${o.id})">✏️</button><button class="btn del" onclick="delOwn(${o.id},'${o.dir === '반입' ? 'i' : 'o'}')">삭제</button></td></tr>`).join('') : emr(8, '기록 없음');
}

// ── 빈콘 회수
async function addBkCol() {
  const date = gv('bk-date'), farm = gv('bk-farm'), qty = n('bk-qty');
  if (!date || !farm || !qty) { alert('날짜, 농가명, 수량을 입력하세요'); return; }
  try {
    const drvName = gv('bk-drv');
    const drv = drivers.find(d => d.name === drvName);
    const row = await dbInsertPick({ date, farm, type: '빈콘회수', qty, driver: drvName || null, car: drv?.car || null, note: gv('bk-note') || null });
    picks.unshift(row);
    clr('bk-qty', 'bk-note');
    renderBkCol(); renderDash();
    openBkMsg({ date, farm, driver: drvName, qty, note: gv('bk-note') });
  } catch (e) { alert('오류: ' + e.message); }
}
async function delBkCol(id) {
  if (!cDel('빈콘 회수 삭제')) return;
  try { await dbDeletePick(id); picks = picks.filter(p => p.id !== id); renderBkCol(); renderDash(); }
  catch (e) { alert('오류: ' + e.message); }
}
function renderBkCol() {
  const list = picks.filter(p => p.type === '빈콘회수');
  const tb = document.getElementById('bk-tb'); if (!tb) return;
  tb.innerHTML = list.length ? list.map(p => `<tr>
    <td>${p.date}</td><td class="nm">${esc(p.farm)}</td>
    <td>${p.qty > 0 ? p.qty+'개' : '-'}</td><td>${esc(p.driver || '-')}</td>
    <td>${esc(p.note || '-')}</td>
    <td style="display:flex;gap:4px">
      ${p.driver ? `<button class="btn copy" style="padding:4px 8px" onclick="openBkMsg({date:'${p.date}',farm:'${p.farm.replace(/'/g,"\\'")}',driver:'${(p.driver||'').replace(/'/g,"\\'")}',qty:${p.qty},note:'${(p.note||'').replace(/'/g,"\\'")}',dtel:''})">📱</button>` : ''}
      <button class="btn del" onclick="delBkCol(${p.id})">삭제</button>
    </td>
  </tr>`).join('') : emr(6, '빈콘 회수 기록 없음');
}
function showToast(msg) {
  let el = document.getElementById('toast-msg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-msg';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;z-index:9999;opacity:0;transition:opacity .3s';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

// ── 농협
async function addNhfIn() {
  const date = gv('ni-date'), nhf = gv('ni-nhf'), type = gv('ni-type'), qty = n('ni-qty');
  if (!date || !nhf || !qty) { alert('반입일자, 농협명, 수량을 입력하세요'); return; }
  try {
    const row = await dbInsertNhfIn({ date, nhf, type, feature: gv('ni-feature'), qty, goods: gv('ni-goods'), staff: gv('ni-staff') });
    nhfIns.unshift(row); clr('ni-qty', 'ni-goods', 'ni-staff', 'ni-feature'); renderNhf(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}
async function addNhfOut() {
  const date = gv('no-date'), nhf = gv('no-nhf'), type = gv('no-type'), qty = n('no-qty');
  if (!date || !nhf || !qty) { alert('반납일자, 농협명, 수량을 입력하세요'); return; }
  try {
    const row = await dbInsertNhfOut({ date, nhf, type, method: gv('no-method'), feature: gv('no-feature'), qty, staff: gv('no-staff') });
    nhfOuts.unshift(row); clr('no-qty', 'no-staff', 'no-feature'); renderNhf(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}
async function delNhf(id, t) {
  if (!cDel(t === 'i' ? '반입 기록 삭제' : '반납 기록 삭제')) return;
  try {
    if (t === 'i') { await dbDeleteNhfIn(id); nhfIns = nhfIns.filter(o => o.id !== id); }
    else { await dbDeleteNhfOut(id); nhfOuts = nhfOuts.filter(o => o.id !== id); }
    renderNhf(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}
function gNhfSt(nhf, type) {
  const i = nhfIns.filter(o => o.nhf === nhf && o.type === type).reduce((s, o) => s + o.qty, 0);
  const o = nhfOuts.filter(o => o.nhf === nhf && o.type === type).reduce((s, o) => s + o.qty, 0);
  return { inQ: i, outQ: o, left: i - o };
}
function renderNhf() {
  const keys = [...new Set([...nhfIns.map(o => o.nhf + '||' + o.type), ...nhfOuts.map(o => o.nhf + '||' + o.type)])];
  const pend = keys.filter(k => { const [n, t] = k.split('||'); return gNhfSt(n, t).left > 0; });
  const done = keys.filter(k => { const [n, t] = k.split('||'); return gNhfSt(n, t).left <= 0; });
  const bg = document.getElementById('nhf-sum-badge');
  if (bg) { bg.textContent = pend.length > 0 ? `반납필요 ${pend.length}건` : '모두 정산완료'; bg.className = 'badge ' + (pend.length > 0 ? 'b-warn' : 'b-ok'); bg.style.textTransform = 'none'; bg.style.fontSize = '11px'; }
  let rows = '';
  if (pend.length) rows += pend.map(k => { const [nhf, type] = k.split('||'); const st = gNhfSt(nhf, type); return `<tr><td class="nm">${esc(nhf)}</td><td><span class="badge b-teal">${esc(type)}</span></td><td>${st.inQ}개</td><td>${st.outQ}개</td><td><span class="badge b-warn">${st.left}개</span></td><td><span class="badge b-warn">반납필요</span></td></tr>`; }).join('');
  if (done.length) { rows += `<tr class="ddiv"><td colspan="6">── 정산 완료 ──</td></tr>`; rows += done.map(k => { const [nhf, type] = k.split('||'); const st = gNhfSt(nhf, type); return `<tr class="dr"><td class="nm">${esc(nhf)}</td><td><span class="badge b-teal">${esc(type)}</span></td><td>${st.inQ}개</td><td>${st.outQ}개</td><td><span class="badge b-ok">${st.left}개</span></td><td><span class="badge b-ok">정산완료</span></td></tr>`; }).join(''); }
  document.getElementById('nhf-sum').innerHTML = rows || emr(6, '기록 없음');
  const all = [...nhfIns.map(o => ({ ...o, dir: '반입', xt: 'nhfIn', dm: o.goods ? '반입(' + o.goods + ')' : '-' })), ...nhfOuts.map(o => ({ ...o, dir: '반납', xt: 'nhfOut', dm: o.method || '-' }))].sort((a, b) => b.date > a.date ? 1 : -1);
  const tb = document.getElementById('nhf-tb-badge'); if (tb) tb.textContent = all.length + '건';
  document.getElementById('nhf-tb').innerHTML = all.length ? all.map(o => `<tr><td>${o.date}</td><td class="nm">${esc(o.nhf)}</td><td><span class="badge b-teal">${esc(o.type)}</span></td><td><span class="badge ${o.dir === '반입' ? 'b-teal' : 'b-ok'}">${o.dir}</span></td><td>${o.qty}개</td><td>${esc(o.dm)}</td><td>${esc(o.feature || '-')}</td><td>${esc(o.staff || '-')}</td><td style="display:flex;gap:4px"><button class="btn edt" onclick="openExtEdit('${o.xt}',${o.id})">✏️</button><button class="btn del" onclick="delNhf(${o.id},'${o.dir === '반입' ? 'i' : 'o'}')">삭제</button></td></tr>`).join('') : emr(9, '기록 없음');
}

// ── 기사 화면
function renderMyAssign() {
  if (!_loggedDrv) return;
  const el = document.getElementById('my-list');
  const mine = dispatches.filter(d => d.driver === _loggedDrv.name).sort((a, b) => b.date > a.date ? 1 : -1);
  if (!mine.length) { el.innerHTML = '<div class="note">배차된 업무가 없습니다</div>'; return; }
  el.innerHTML = mine.map(d => {
    const done = d.status === '배출완료';
    return `<div class="assign-card">
      <div class="assign-top"><div class="assign-title">📅 ${d.date} · ${esc(d.farm)}</div><span class="badge ${done ? 'b-ok' : 'b-info'}">${done ? '✅ 배출완료' : '대기중'}</span></div>
      <div class="assign-body">${ctB(d.ctype)} <strong>${d.qty}개</strong><br>🚛 차량: ${esc(d.car || '-')}<br>📍 주소: ${esc(gf(d.farm).addr || '농가에 직접 확인')}<br>📞 농가주: ${esc(gf(d.farm).tel || '-')}${d.harvest ? '<br>🗓 수확예정: ' + d.harvest : ''}${d.item ? '<br>🍊 품목: ' + esc(d.item) : ''}${d.note && d.note !== '[자동]' ? '<br>📝 ' + esc(d.note) : ''}</div>
      ${!done ? `<div style="display:flex;justify-content:flex-end"><button class="btn grn" onclick="drvDone(${d.id})">✅ 배출 완료 처리</button></div>` : ''}
    </div>`;
  }).join('');
}

function renderMyPending() {
  if (!_loggedDrv) return;
  const el = document.getElementById('my-pending-list');
  const pend = dispatches.filter(d => d.driver === _loggedDrv.name && d.status === '배차완료');
  if (!pend.length) { el.innerHTML = '<div class="note" style="margin-bottom:0">배출 대기 건이 없습니다 🎉</div>'; return; }
  el.innerHTML = `<div style="font-size:12px;font-weight:500;color:#888;margin-bottom:8px">📦 배출 대기 — 완료 처리 즉시 내역에 반영됩니다</div>` +
    pend.map(d => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#fff;border:0.5px solid #e0e0e0;border-radius:8px;margin-bottom:6px;gap:8px">
      <div><div style="font-weight:500">${esc(d.farm)}</div><div style="font-size:12px;color:#888">${d.date} · ${ctB(d.ctype)} ${d.qty}개${d.harvest ? ' · ' + d.harvest : ''}${d.item ? ' · ' + esc(d.item) : ''}</div></div>
      <button class="btn grn" onclick="drvDone(${d.id})">✅ 완료</button>
    </div>`).join('');
}

async function drvDone(id) {
  const d = dispatches.find(x => x.id === id); if (!d) return;
  try {
    await dbUpdateDispatch(id, { status: '배출완료' });
    dispatches = dispatches.map(x => x.id === id ? { ...x, status: '배출완료' } : x);
    if (!reports.find(r => r.driver === d.driver && r.farm === d.farm && r.date === d.date)) {
      const rpt = await dbInsertReport({ driver: d.driver, date: d.date, farm: d.farm, qty: d.qty, note: '앱에서 완료처리' });
      reports.unshift(rpt);
    }
    const c = document.getElementById('rep-cnt'); if (c) c.textContent = (_loggedDrv ? reports.filter(r=>r.driver===_loggedDrv.name).length : reports.length) + '건';
    if (!_repOpen) { _repOpen = true; document.getElementById('rep-history').style.display = ''; document.getElementById('rep-h-icon').textContent = '▲ 접기'; }
    renderRep(); renderMyPending(); renderMyAssign(); renderDisp(); renderDDash(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

function clearRepF() {
  const now = new Date();
  sv('rp-from', new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  sv('rp-to', now.toISOString().slice(0, 10));
  _rp = 1; renderRep();
}

async function addReport() {
  if (!_loggedDrv) return;
  const date = gv('rp-date'), farm = gv('rp-farm'), qty = n('rp-qty');
  if (!date || !farm || !qty) { alert('날짜, 농가명, 수량을 입력하세요'); return; }
  try {
    const rpt = await dbInsertReport({ driver: _loggedDrv.name, date, farm, qty, note: gv('rp-note') });
    reports.unshift(rpt);
    dispatches = dispatches.map(d => (d.driver === _loggedDrv.name && d.farm === farm && d.date === date) ? { ...d, status: '배출완료' } : d);
    await Promise.all(dispatches.filter(d => d.driver === _loggedDrv.name && d.farm === farm && d.date === date).map(d => dbUpdateDispatch(d.id, { status: '배출완료' })));
    clr('rp-qty', 'rp-note'); _rp = 1;
    if (!_repOpen) { _repOpen = true; document.getElementById('rep-history').style.display = ''; document.getElementById('rep-h-icon').textContent = '▲ 접기'; }
    renderRep(); renderMyPending(); renderDisp(); renderDDash(); renderDash();
  } catch (e) { alert('오류: ' + e.message); }
}

function renderRep() {
  const from = gv('rp-from'), to = gv('rp-to');
  let list = _loggedDrv ? reports.filter(r => r.driver === _loggedDrv.name) : reports;
  if (from) list = list.filter(r => r.date >= from);
  if (to) list = list.filter(r => r.date <= to);
  const page = list.slice((_rp - 1) * PER, _rp * PER);
  document.getElementById('rep-tb').innerHTML = page.length ? page.map(r => `<tr><td>${r.date}</td><td>${esc(r.driver)}</td><td class="nm">${esc(r.farm)}</td><td>${r.qty}개</td><td>${esc(r.note || '-')}</td></tr>`).join('') : emr(5, '내역 없음');
  mkPg('rep-pg', list.length, _rp, 'goRP');
  const c = document.getElementById('rep-cnt');
  if (c) c.textContent = (_loggedDrv ? reports.filter(r => r.driver === _loggedDrv.name).length : reports.length) + '건';
}

// ── 현황판
function getFCS(name) {
  const out = picks.filter(p => p.farm === name && p.type === '배출').reduce((s, p) => s + p.qty, 0);
  const pk = picks.filter(p => p.farm === name && p.type === '원물수거').reduce((s, p) => s + p.qty, 0);
  const ret = picks.filter(p => p.farm === name && p.type === '잉여회수').reduce((s, p) => s + p.qty, 0);
  return { out, pk, ret, hold: out - pk - ret };
}
function getFCtypes(fn) {
  const ob = {}; dispatches.filter(d => d.farm === fn).forEach(d => { ob[d.ctype] = (ob[d.ctype] || 0) + d.qty; });
  const rec = picks.filter(p => p.farm === fn && (p.type === '원물수거' || p.type === '잉여회수')).reduce((s, p) => s + p.qty, 0);
  const tot = Object.values(ob).reduce((s, v) => s + v, 0); if (tot <= 0) return '';
  const ratio = tot > 0 ? (tot - rec) / tot : 0;
  return Object.entries(ob).map(([t, q]) => { const r = Math.round(q * ratio); if (r <= 0) return ''; const cl = { 노랑: 'cty', 초록: 'ctg', 헌콘: 'cto' }[t] || ''; return `<span class="ct ${cl}">${t === '노랑' ? '🟡' : t === '초록' ? '🟢' : '⬜'} ${r}개</span>`; }).filter(Boolean).join('');
}
function renderFarmTbl() {
  const list = farms.filter(f => { const st = getFCS(f.name); return _ft === 'n' ? st.hold !== 0 : st.hold === 0; });
  document.getElementById('d-farm-tb').innerHTML = list.length ? list.map(f => { const st = getFCS(f.name); return `<tr><td class="nm">${esc(f.name)}${f.addr ? `<div style="font-size:10px;color:#aaa;font-weight:400;margin-top:1px">${esc(f.addr)}</div>` : ''}</td><td>${st.out}</td><td>${st.pk}</td><td>${st.ret}</td><td><span class="badge ${st.hold !== 0 ? (st.hold < 0 ? 'b-red' : 'b-warn') : 'b-ok'}">${st.hold}개</span></td><td>${st.hold > 0 ? '<span class="badge b-red">처리필요</span>' : st.hold < 0 ? '<span class="badge b-red">음수(확인필요)</span>' : '<span class="badge b-ok">정상</span>'}</td></tr>`; }).join('') : emr(6, _ft === 'n' ? '처리 필요 농가 없음 🎉' : '없음');
  const need = farms.filter(f => getFCS(f.name).hold !== 0).length;
  document.getElementById('farm-dash-badges').innerHTML = `<span class="badge b-red">처리필요 ${need}개 농가</span><span class="badge b-ok">정상 ${farms.length - need}개 농가</span>`;
}

function renderDash() {
  const dw = dispatches.filter(d => d.status === '배차완료').length, dd = dispatches.filter(d => d.status === '배출완료').length;
  const th = farms.reduce((s, f) => s + getFCS(f.name).hold, 0);
  const on = [...new Set(ownIns.map(o => o.farm))]; const to = on.reduce((s, n) => s + gOwnSt(n).left, 0);
  const nk = [...new Set([...nhfIns.map(o => o.nhf + '||' + o.type), ...nhfOuts.map(o => o.nhf + '||' + o.type)])];
  const nc = nk.filter(k => k.includes('콘테이너')).reduce((s, k) => { const [n, t] = k.split('||'); return s + gNhfSt(n, t).left; }, 0);
  const np = nk.filter(k => k.includes('파렛트')).reduce((s, k) => { const [n, t] = k.split('||'); return s + gNhfSt(n, t).left; }, 0);
  document.getElementById('kpi').innerHTML = `<div class="kpi"><div class="kpi-label">배출 대기</div><div class="kpi-val kv-pu">${dw}</div></div><div class="kpi"><div class="kpi-label">배출 완료</div><div class="kpi-val kv-gr">${dd}</div></div><div class="kpi"><div class="kpi-label">농가보유</div><div class="kpi-val kv-bl">${th}개</div></div><div class="kpi"><div class="kpi-label">자가 공장보유</div><div class="kpi-val kv-pu">${to}개</div></div><div class="kpi"><div class="kpi-label">농협 콘테이너</div><div class="kpi-val kv-teal">${nc}개</div></div><div class="kpi"><div class="kpi-label">농협 파렛트</div><div class="kpi-val kv-teal">${np}개</div></div>`;
  renderSC();
  const fhi = farms.map(f => { const st = getFCS(f.name); const ow = gOwnSt(f.name); const total = st.hold + ow.left; if (total <= 0) return null; return { name: f.name, ctypes: getFCtypes(f.name), ownLeft: ow.left, total }; }).filter(Boolean);
  const ri = nk.map(k => { const [nhf, type] = k.split('||'); const st = gNhfSt(nhf, type); return st.left > 0 ? { name: nhf, detail: `${type} ${st.left}개 반납필요`, total: st.left } : null; }).filter(Boolean);
  const tfTotal = fhi.reduce((s, i) => s + i.total, 0);
  const trTotal = ri.reduce((s, i) => s + i.total, 0);
  document.getElementById('afc').textContent = fhi.length + '곳 · ' + tfTotal + '개';
  document.getElementById('arc').textContent = ri.length + '건 · ' + trTotal + '개';
  document.getElementById('afb').innerHTML = fhi.length ? fhi.map(i => {
    const st = getFCS(i.name);
    return `<div class="alert-item"><div class="alert-item-top"><div class="alert-item-name">${esc(i.name)}</div><span class="alert-cnt w">${i.total}개</span></div>
    <div style="font-size:10px;color:#aaa;margin:2px 0">배출 ${st.out}개 − 원물수거 ${st.pk}개 − 잉여회수 ${st.ret}개 = <strong style="color:#C05800">${st.hold}개</strong> 보유</div>
    <div class="alert-item-ctypes">${i.ctypes || '<span style="font-size:11px;color:#aaa">데이터 없음</span>'}${i.ownLeft > 0 ? `<span class="ct" style="background:#F3E5F5;color:#6A1B9A">자가 ${i.ownLeft}개</span>` : ''}</div></div>`;
  }).join('') : '<div class="alert-none">처리 필요 없음 🎉</div>';
  document.getElementById('arb').innerHTML = ri.length ? ri.map(i => `<div class="alert-item"><div class="alert-item-top"><div class="alert-item-name">${esc(i.name)}</div><span class="alert-cnt g">${i.total}개</span></div><div style="font-size:12px;color:#888">${esc(i.detail)}</div></div>`).join('') : '<div class="alert-none">반납 필요 없음</div>';
  document.getElementById('alert-badges').innerHTML = `<span class="badge b-warn">🟡 농가보유 ${fhi.length}곳 · ${tfTotal}개</span><span class="badge b-ok">🟢 반납필요 ${ri.length}건 · ${trTotal}개</span>`;
  renderDDash(); renderFarmTbl();
  const or = on.map(n => { const st = gOwnSt(n); return st.left > 0 ? `<div class="ext-row"><span>${esc(n)}</span><span class="ext-warn">${st.left}개</span></div>` : ''; }).filter(Boolean).join('');
  const nr = nk.map(k => { const [n, t] = k.split('||'); const st = gNhfSt(n, t); return st.left > 0 ? `<div class="ext-row"><span>${esc(n)} (${esc(t)})</span><span class="ext-warn">${st.left}개</span></div>` : ''; }).filter(Boolean).join('');
  document.getElementById('ext-cards').innerHTML = `<div class="ext-card"><div class="ext-card-title"><span class="badge b-pur">농가 자가 콘테이너</span></div>${or || '<div style="font-size:13px;color:#aaa">없음</div>'}</div><div class="ext-card"><div class="ext-card-title"><span class="badge b-teal">농협 용기 반납 필요</span></div>${nr || '<div style="font-size:13px;color:#aaa">없음</div>'}</div>`;
  const oc = on.filter(n => gOwnSt(n).left > 0).length, nc2 = nk.filter(k => { const [n, t] = k.split('||'); return gNhfSt(n, t).left > 0; }).length;
  document.getElementById('ext-dash-badges').innerHTML = `<span class="badge b-pur">자가 ${oc}개 농가</span><span class="badge b-teal">농협 ${nc2}건 반납필요</span>`;
  // 빈콘 회수 현황
  const bkList = picks.filter(p => p.type === '빈콘회수').slice(0, 10);
  const bkTotal = picks.filter(p => p.type === '빈콘회수').reduce((s, p) => s + p.qty, 0);
  const bkDl = document.getElementById('bk-dash-list');
  if (bkDl) {
    bkDl.innerHTML = bkList.length ? `<div class="tbl-wrap"><table><thead><tr><th>날짜</th><th>농가명</th><th>수량</th><th>기사</th><th>비고</th></tr></thead><tbody>${bkList.map(p => `<tr><td>${p.date}</td><td class="nm">${esc(p.farm)}</td><td>${p.qty}개</td><td>${esc(p.driver || '-')}</td><td>${esc(p.note || '-')}</td></tr>`).join('')}</tbody></table></div>` : '<div style="padding:12px;font-size:13px;color:#aaa">빈콘 회수 기록 없음</div>';
  }
  const bkBadge = document.getElementById('bk-dash-badges');
  if (bkBadge) bkBadge.innerHTML = `<span class="badge b-neu">총 ${picks.filter(p => p.type === '빈콘회수').length}건</span><span class="badge b-ok">누적 ${bkTotal}개 회수</span>`;
}

function renderAll() { renderDash(); renderFarm(); renderDrivers(); renderVehicles(); renderDisp(); renderPick(); renderOwn(); renderNhf(); renderBkCol(); renderAdmPinChange(); }

let _dbView = 'sched';
function switchDBView(v) {
  _dbView = v;
  document.getElementById('dbv-sched').className = 'dtab' + (v === 'sched' ? ' active' : '');
  document.getElementById('dbv-card').className  = 'dtab' + (v === 'card'  ? ' active' : '');
  document.getElementById('dboard-sched').style.display = v === 'sched' ? '' : 'none';
  document.getElementById('dboard-body').style.display  = v === 'card'  ? '' : 'none';
  if (v === 'sched') renderDSchedule();
  else renderDBoard();
}

function renderDSchedule() {
  const el = document.getElementById('dboard-sched'); if (!el) return;
  const today = td();

  // 오늘 → D-1 → D-2 → D-3 → D-4 순
  const dates = [];
  for (let i = 0; i <= 4; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const active = drivers.filter(d => d.pin_active !== false);
  if (!active.length) { el.innerHTML = '<div style="padding:20px;color:#aaa;text-align:center">등록된 기사가 없습니다</div>'; return; }

  const dayLabel = (date) => {
    if (date === today) return `<div style="font-size:11px;font-weight:700;color:#C05800">오늘</div><div style="font-size:10px;color:#C05800">${date.slice(5).replace('-','/')}</div>`;
    const diff = Math.round((new Date(today) - new Date(date)) / 86400000);
    const names = ['', '어제', '그제'];
    const label = names[diff] || `D-${diff}`;
    return `<div style="font-size:10px;color:#888;font-weight:600">${label}</div><div style="font-size:10px;color:#aaa">${date.slice(5).replace('-','/')}</div>`;
  };

  function cell(drv, date) {
    const items = dispatches.filter(d => d.driver === drv.name && d.date === date);
    if (!items.length) return `<td style="background:${date===today?'#FFFDE7':'#fafafa'};text-align:center;color:#ddd;font-size:18px">—</td>`;
    const cards = items.map(d => {
      const done = d.status === '배출완료';
      const bg = done ? '#F1F8E9' : '#FFF8F0';
      const border = done ? '#C8E6C9' : '#FFE0B2';
      return `<div style="background:${bg};border:1px solid ${border};border-radius:6px;padding:4px 7px;margin-bottom:3px;font-size:11px;line-height:1.5">
        <div style="font-weight:600;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px">${esc(d.farm)}</div>
        <div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:2px">
          ${d.timeslot ? tsBadge(d.timeslot) : ''}
          ${d.trip ? tripBadge(d.trip) : ''}
          ${done ? '<span style="font-size:9px;color:#2E7D32;font-weight:600">✅완료</span>' : ''}
        </div>
        <div style="color:#666;font-size:10px;margin-top:1px">${d.qty > 0 ? d.qty+'개 ' : '미정 '}${ctB(d.ctype)}</div>
      </div>`;
    }).join('');
    return `<td style="background:${date===today?'#FFFDE7':'#fff'};vertical-align:top;padding:6px;min-width:120px">${cards}</td>`;
  }

  // 기간 내 배차 있는 기사 / 없는 기사 분리
  const withWork = active.filter(drv => dates.some(date => dispatches.some(d => d.driver === drv.name && d.date === date)));
  const noWork   = active.filter(drv => !dates.some(date => dispatches.some(d => d.driver === drv.name && d.date === date)));

  const headerCells = dates.map(date =>
    `<th style="text-align:center;background:${date===today?'#FFF3E0':'#f8f8f8'};padding:8px 10px;min-width:120px">${dayLabel(date)}</th>`
  ).join('');

  const rows = withWork.map(drv => `<tr>
    <td style="background:#fafafa;padding:8px 12px;white-space:nowrap;position:sticky;left:0;z-index:1;border-right:1px solid #e0e0e0">
      <div style="font-size:13px;font-weight:600">${esc(drv.name)}</div>
      <div style="display:flex;gap:4px;margin-top:2px">
        <span class="badge ${drv.type==='외부'?'b-pur':'b-ok'}" style="font-size:9px">${drv.type||'내부'}</span>
        ${drv.car ? `<span style="font-size:10px;color:#aaa">${esc(drv.car)}</span>` : ''}
      </div>
    </td>
    ${dates.map(date => cell(drv, date)).join('')}
  </tr>`).join('');

  const noWorkList = noWork.length ? `
    <div style="margin-top:14px;background:#fff;border-radius:10px;border:1px solid #e0e0e0;padding:12px 16px">
      <div style="font-size:11px;color:#aaa;font-weight:600;margin-bottom:8px">이 기간 배차 없음 (${noWork.length}명)</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${noWork.map(drv => `<span style="font-size:12px;padding:4px 10px;background:#f5f5f5;border-radius:20px;color:#888">
          ${esc(drv.name)} <span style="font-size:10px;color:#bbb">${drv.type||'내부'}</span>
        </span>`).join('')}
      </div>
    </div>` : '';

  el.innerHTML = `
    <div class="tbl-wrap"><table style="min-width:0">
      <thead><tr>
        <th style="background:#f8f8f8;padding:8px 12px;position:sticky;left:0;z-index:2;min-width:90px">기사</th>
        ${headerCells}
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="${dates.length+1}" style="text-align:center;padding:20px;color:#aaa;font-size:13px">이 기간 배차 없음</td></tr>`}</tbody>
    </table></div>
    ${noWorkList}`;
}

function renderDBoard() {
  const el = document.getElementById('dboard-body'); if (!el) return;
  const today = td();

  // 기사별로 배출 대기 배차 묶기
  const active = drivers.filter(d => d.pin_active !== false);
  if (!active.length) { el.innerHTML = '<div style="padding:20px;color:#aaa;text-align:center">등록된 기사가 없습니다</div>'; return; }

  const pending = dispatches.filter(d => d.status === '배차완료');
  const done    = dispatches.filter(d => d.status === '배출완료');

  // 배출 대기 있는 기사 먼저, 없는 기사 뒤에
  const withWork = active.filter(drv => pending.some(d => d.driver === drv.name));
  const noWork   = active.filter(drv => !pending.some(d => d.driver === drv.name));

  function driverCard(drv) {
    const myPending = pending.filter(d => d.driver === drv.name).sort((a, b) => a.date > b.date ? 1 : -1);
    const myDone    = done.filter(d => d.driver === drv.name).length;
    const typeBadge = `<span class="badge ${drv.type === '외부' ? 'b-pur' : 'b-ok'}" style="font-size:10px">${drv.type || '내부'}</span>`;
    const hasPending = myPending.length > 0;

    const rows = hasPending ? myPending.map(d => {
      const farm = gf(d.farm);
      const isToday = d.date === today;
      const isBefore = d.date < today;
      const dateStyle = isBefore ? 'color:#C62828;font-weight:600' : isToday ? 'color:#C05800;font-weight:600' : 'color:#555';
      return `<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border-bottom:0.5px solid #f5f5f5;flex-wrap:wrap">
        <div style="min-width:60px;text-align:center">
          <div style="font-size:11px;${dateStyle}">${d.date.slice(5).replace('-','/')}</div>
          ${isToday ? '<div style="font-size:9px;color:#C05800;font-weight:600">오늘</div>' : isBefore ? '<div style="font-size:9px;color:#C62828">지연</div>' : ''}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:#222">${esc(d.farm)}${d.trip ? ` ${tripBadge(d.trip)}` : ''}</div>
          ${farm.addr ? `<div style="font-size:10px;color:#aaa;margin-top:1px">${esc(farm.addr)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;min-width:70px">
          <div style="font-size:12px;font-weight:500">${d.qty > 0 ? d.qty+'개' : '<span style="color:#E65100">수량 미정</span>'}</div>
          <div style="font-size:11px">${ctB(d.ctype)}</div>
        </div>
      </div>`;
    }).join('') : `<div style="padding:12px;font-size:12px;color:#aaa;text-align:center">배출 대기 없음</div>`;

    const borderColor = hasPending ? (myPending.some(d => d.date < today) ? '#C62828' : '#C05800') : '#e0e0e0';
    return `<div style="background:#fff;border-radius:12px;border:1px solid ${borderColor};overflow:hidden;margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:${hasPending ? '#FFF8F0' : '#fafafa'};flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="font-size:15px;font-weight:700;color:#222">${esc(drv.name)}</div>
          ${typeBadge}
          ${drv.car ? `<span style="font-size:11px;color:#888">${esc(drv.car)}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${drv.tel ? `<span style="font-size:11px;color:#888">${esc(drv.tel)}</span>` : ''}
          ${hasPending ? `<span class="badge b-warn" style="font-size:11px">대기 ${myPending.length}건</span>` : '<span class="badge b-ok" style="font-size:11px">대기 없음</span>'}
          <span style="font-size:11px;color:#aaa">완료 ${myDone}건</span>
        </div>
      </div>
      ${rows}
    </div>`;
  }

  let html = '';
  if (withWork.length) {
    html += `<div style="font-size:11px;color:#888;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">배출 대기 ${withWork.length}명</div>`;
    html += withWork.map(driverCard).join('');
  }
  if (noWork.length) {
    html += `<div style="font-size:11px;color:#bbb;font-weight:600;margin:16px 0 8px;text-transform:uppercase;letter-spacing:.5px">대기 없음 ${noWork.length}명</div>`;
    html += noWork.map(driverCard).join('');
  }
  el.innerHTML = html;
}
// ── 수확 캘린더
const CAL_PER = 5;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calSelectedDate = null;
let calUpPage = 1;

function calSortOrder(s) { return s === '배차없음' ? 0 : s === '배차완료' ? 1 : 2; }
function calGoDisp(farm, harvestDate, item) {
  T('disp'); switchPT('disp');
  const fd = document.getElementById('dp-farm');
  if (fd) { fd.value = farm; afF('dp'); }
  const hd = document.getElementById('dp-harvest');
  if (hd) hd.value = harvestDate || '';
  const it = document.getElementById('dp-item');
  if (it && item) it.value = item;
  document.getElementById('p-disp')?.querySelector('.form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function calSortItems(arr) {
  return [...arr].sort((a, b) => {
    const od = calSortOrder(a.status) - calSortOrder(b.status);
    if (od !== 0) return od;
    return (a.harvest || '') > (b.harvest || '') ? 1 : -1;
  });
}
function calFmtShort(s) {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function calGetEvents(dStr) {
  const fromDisp = dispatches.filter(d => d.harvest === dStr);
  const fromHarvest = harvests.filter(h =>
    h.date === dStr ||
    (h.date <= dStr && h.end_date && h.end_date >= dStr) ||
    (h.status === '수확중' && h.date < dStr && !h.end_date)
  ).map(h => ({
    ...h, harvest: h.date, driver: null, qty: null, ctype: null,
    status: h.status || '배차없음'
  }));
  const dispFarms = fromDisp.map(d => d.farm);
  const extra = fromHarvest.filter(h => !dispFarms.includes(h.farm));
  return [...fromDisp, ...extra];
}
function calGetAllItems() {
  const mStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const mStart = mStr + '-01';
  const mEnd = mStr + '-31';
  const fromDisp = dispatches.filter(d => d.harvest && d.harvest.startsWith(mStr));
  const fromHarvest = harvests.filter(h =>
    (h.date && h.date.startsWith(mStr)) ||
    (h.date && h.end_date && h.date <= mEnd && h.end_date >= mStart)
  ).map(h => ({ ...h, harvest: h.date, driver: null, qty: null, ctype: null, status: h.status || '배차없음' }));
  const dispFarms = fromDisp.map(d => d.farm + d.harvest);
  const extra = fromHarvest.filter(h => !dispFarms.includes(h.farm + h.date));
  return calSortItems([...fromDisp, ...extra]);
}
function renderCal() {
  if (!document.getElementById('p-cal')?.classList.contains('active')) return;
  const todayStr = td();
  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  document.getElementById('cal-month-title').textContent = `${calYear}년 ${months[calMonth]}`;

  // 통계
  const done = dispatches.filter(d => d.status === '배출완료').length;
  const pend = dispatches.filter(d => d.status === '배차완료').length;
  const none = dispatches.filter(d => !d.harvest || !d.status).length;
  const mStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const thisM = dispatches.filter(d => d.harvest && d.harvest.startsWith(mStr)).length;
  document.getElementById('cal-stats-row').innerHTML = `
    <div class="kpi"><div class="kpi-label">배출 완료</div><div class="kpi-val kv-gr">${done}</div></div>
    <div class="kpi"><div class="kpi-label">배출 대기</div><div class="kpi-val kv-pu">${pend}</div></div>
    <div class="kpi"><div class="kpi-label">배차 없음</div><div class="kpi-val" style="color:#C62828">${dispatches.filter(d=>d.status==='배차없음').length}</div></div>
    <div class="kpi"><div class="kpi-label">이번 달 수확</div><div class="kpi-val kv-bl">${thisM}</div></div>
  `;

  // 공통 헬퍼
  const stBadge = { 수확전: 'b-warn', 수확중: 'b-info', 수확완료: 'b-ok' };
  const stBg    = { 수확전: '#FFF3E0', 수확중: '#EFF8FF', 수확완료: '#F1F8E9' };
  function harvestRow(h, showDate) {
    const st = h.status || '수확전';
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:${stBg[st]||'#FFF3E0'};border-radius:8px;border:0.5px solid #e0e0e0;flex-wrap:wrap">
      ${showDate ? `<span style="font-size:11px;font-weight:600;color:#888;min-width:38px">${h.date.slice(5).replace('-','/')}</span>` : ''}
      ${h.end_date ? `<span style="font-size:10px;color:#bbb">~ ${h.end_date.slice(5).replace('-','/')}</span>` : ''}
      <span style="font-size:13px;font-weight:700">${esc(h.farm)}</span>
      ${h.item ? `<span style="font-size:11px;color:#888">${esc(h.item)}</span>` : ''}
      <span class="badge ${stBadge[st]||'b-warn'}" style="font-size:10px">${st}</span>
      <div style="margin-left:auto;display:flex;gap:4px;flex-wrap:wrap">
        ${st !== '수확중'  ? `<button class="btn" style="font-size:11px;padding:3px 10px;background:#1565C0;color:#fff;border:none;border-radius:6px" onclick="setHarvestStatus(${h.id},'수확중')">▶ 시작</button>` : ''}
        ${st !== '수확완료' ? `<button class="btn grn" style="font-size:11px;padding:3px 10px" onclick="setHarvestStatus(${h.id},'수확완료')">✅ 완료</button>` : ''}
        <button class="btn edt" style="font-size:11px;padding:3px 8px" onclick="openHarvestEdit(${h.id})">✏️</button>
        <button class="btn del" style="font-size:11px;padding:3px 8px" onclick="delHarvest(${h.id})">삭제</button>
      </div>
    </div>`;
  }

  // 금일 수확일정
  // 금일 수확일정: 캘린더와 동일하게 dispatches.harvest + harvests 테이블 통합
  const calTodayEvents = calGetEvents(todayStr);
  // 수확중이지만 오늘 날짜가 아닌 항목도 추가 (진행 중 carry-forward)
  const ongoingHarvests = harvests.filter(h =>
    h.status === '수확중' && h.date < todayStr &&
    !calTodayEvents.find(e => e.farm === h.farm)
  );
  // 농가 기준 중복 제거 (같은 농가 1차/2차 등 여러 배차가 있을 때)
  const seenFarms = new Set();
  const allTodayItems = [...calTodayEvents, ...ongoingHarvests].filter(e => {
    if (seenFarms.has(e.farm)) return false;
    seenFarms.add(e.farm); return true;
  });

  const todayEl = document.getElementById('cal-today-strip');
  if (todayEl) {
    if (allTodayItems.length) {
      todayEl.style.display = '';
      const rows = allTodayItems.map(e => {
        const hEntry = harvests.find(h => h.farm === e.farm && (h.date === todayStr || h.status === '수확중'));
        if (hEntry) return harvestRow(hEntry, false);
        // 배차에서만 온 항목 — auto-create 버튼 포함
        const st = e.status || '수확전';
        const item = e.item || '';
        const farmEsc = e.farm.replace(/'/g, "\\'");
        const itemEsc = item.replace(/'/g, "\\'");
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#FFF8F0;border-radius:8px;border:0.5px solid #FFE0B2;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:700">${esc(e.farm)}</span>
          ${item ? `<span style="font-size:11px;color:#888">${esc(item)}</span>` : ''}
          <span class="badge b-warn" style="font-size:10px">수확전</span>
          <div style="margin-left:auto;display:flex;gap:4px">
            <button class="btn" style="font-size:11px;padding:3px 10px;background:#1565C0;color:#fff;border:none;border-radius:6px" onclick="autoSetHarvestStatus('${farmEsc}','${todayStr}','${itemEsc}','수확중')">▶ 시작</button>
            <button class="btn grn" style="font-size:11px;padding:3px 10px" onclick="autoSetHarvestStatus('${farmEsc}','${todayStr}','${itemEsc}','수확완료')">✅ 완료</button>
            <button class="btn edt" style="font-size:11px;padding:3px 8px" onclick="autoOpenHarvestEdit('${farmEsc}','${todayStr}','${itemEsc}')">✏️</button>
            <button class="btn del" style="font-size:11px;padding:3px 8px" onclick="autoDelHarvest('${farmEsc}','${todayStr}')">삭제</button>
          </div>
        </div>`;
      }).join('');
      todayEl.innerHTML =
        `<div style="font-size:12px;font-weight:700;color:#C05800;margin-bottom:8px">📅 금일 수확 일정 (${allTodayItems.length}건)</div>` +
        `<div style="display:flex;flex-direction:column;gap:5px">${rows}</div>`;
    } else {
      todayEl.style.display = 'none';
    }
  }

  // 경고
  const noD = dispatches.filter(d => d.status === '배차없음').length;
  const strip = document.getElementById('cal-alert-strip');
  if (noD > 0) { strip.style.display = 'flex'; strip.innerHTML = `⚠ 배차 없는 수확 예정 <strong style="margin:0 3px">${noD}곳</strong> — 빨간 일정을 확인하세요.`; }
  else strip.style.display = 'none';

  // 달력 헤더
  document.getElementById('cal-head-grid').innerHTML = ['일','월','화','수','목','금','토'].map(d =>
    `<div style="text-align:center;font-size:11px;font-weight:500;color:#888;padding:4px 0">${d}</div>`
  ).join('');

  // 달력 셀
  const first = new Date(calYear, calMonth, 1);
  const last = new Date(calYear, calMonth + 1, 0);
  const startDay = first.getDay();
  let cells = '';
  const cellStyle = 'min-height:72px;border-radius:8px;border:0.5px solid #e0e0e0;background:#fff;padding:4px;cursor:pointer';
  const otherStyle = 'min-height:72px;border-radius:8px;border:0.5px solid #e0e0e0;background:#f5f5f5;padding:4px;opacity:.4';

  for (let i = 0; i < startDay; i++) {
    const d = new Date(calYear, calMonth, -startDay + i + 1);
    cells += `<div style="${otherStyle}"><div style="font-size:11px;color:#aaa">${d.getDate()}</div></div>`;
  }
  for (let i = 1; i <= last.getDate(); i++) {
    const dStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const evs = calSortItems(calGetEvents(dStr));
    const isToday = dStr === todayStr;
    const isSel = dStr === calSelectedDate;
    let pills = evs.slice(0, 2).map(e => {
      const bg = e.status === '배출완료' ? '#E8F5E9;color:#2E7D32' : e.status === '배차없음' ? '#FFEBEE;color:#C62828' : '#FFF3E0;color:#C05800';
      return `<div style="font-size:10px;padding:2px 5px;border-radius:4px;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:${bg}">${esc(e.farm)}</div>`;
    }).join('');
    if (evs.length > 2) pills += `<div style="font-size:10px;padding:2px 5px;border-radius:4px;background:#f0f0f0;color:#888">+${evs.length - 2}</div>`;
    const border = isToday ? '1.5px solid #C05800' : isSel ? '1.5px solid #C05800' : '0.5px solid #e0e0e0';
    const bg = isSel ? '#f8f8f8' : '#fff';
    cells += `<div style="min-height:72px;border-radius:8px;border:${border};background:${bg};padding:4px;cursor:pointer" onclick="calSelectDay('${dStr}')">
      <div style="font-size:11px;font-weight:500;color:${isToday ? '#C05800' : '#888'};margin-bottom:2px">${i}</div>${pills}
    </div>`;
  }
  const rem = 7 - ((startDay + last.getDate()) % 7);
  if (rem < 7) for (let i = 1; i <= rem; i++) cells += `<div style="${otherStyle}"><div style="font-size:11px;color:#aaa">${i}</div></div>`;
  document.getElementById('cal-body-grid').innerHTML = cells;

  // 수확 일정 등록 폼
  const formEl = document.getElementById('cal-add-form');
  if (formEl) {
    const sf = document.getElementById('cal-add-farm');
    if (sf) {
      sf.innerHTML = '<option value="">농가 선택</option>';
      farms.forEach(f => sf.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`);
    }
  }
  renderCalUpcoming();
}

function calSelectDay(dStr) {
  calSelectedDate = calSelectedDate === dStr ? null : dStr;
  const panel = document.getElementById('cal-detail-panel');
  const evs = calSortItems(calGetEvents(dStr));
  if (!calSelectedDate || evs.length === 0) { panel.style.display = 'none'; renderCal(); return; }
  const d = new Date(dStr + 'T00:00:00');
  document.getElementById('cal-detail-title').textContent = `${d.getMonth()+1}월 ${d.getDate()}일 수확 예정 (${evs.length}건)`;
  const ctIcon = {노랑:'🟡',초록:'🟢',헌콘:'⬜'};
  document.getElementById('cal-detail-list').innerHTML = evs.map(e => {
    const bg = e.status === '배출완료' ? '#F1F8E9' : e.status === '배차없음' ? '#FFEBEE' : '#FFF3E0';
    const bdg = e.status === '배출완료' ? 'b-ok' : e.status === '배차없음' ? 'b-danger' : 'b-warn';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:${bg};margin-bottom:5px;gap:8px;flex-wrap:wrap">
      <div>
        <div style="font-weight:500;font-size:13px">${esc(e.farm)} <span style="font-weight:400;font-size:12px;color:#888">· ${esc(e.item||'-')}</span></div>
        <div style="font-size:11px;color:#888;margin-top:2px">${e.driver?'기사: '+esc(e.driver)+' · ':''} ${e.ctype?ctIcon[e.ctype]+' '+esc(e.ctype)+' '+e.qty+'개 · ':''} ${e.date?'배출일: '+calFmtShort(e.date):'배출일 미정'}</div>
      </div>
      <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
        ${e.status === '배차없음' ? `<button class="btn pri" style="font-size:11px;padding:4px 10px;white-space:nowrap" onclick="calGoDisp('${e.farm.replace(/'/g,"&#39;")}','${e.harvest||''}','${(e.item||'').replace(/'/g,"&#39;")}')">+ 배차 등록</button><button class="btn edt" style="font-size:11px;padding:4px 8px" onclick="openHarvestEdit(${e.id})">✏️</button><button class="btn del" style="font-size:11px;padding:4px 8px" onclick="delHarvest(${e.id})">삭제</button>` : `<span class="badge ${bdg}">${e.status}</span>`}
      </div>
    </div>`;
  }).join('');
  panel.style.display = 'block';
  renderCal();
}
function itemColor(item) {
  const map = {
    '노지감귤': 'background:#FFF3E0;color:#E65100',
    '하우스감귤': 'background:#E8F5E9;color:#1B5E20',
    '한라봉': 'background:#F3E5F5;color:#6A1B9A',
    '천혜향': 'background:#E3F2FD;color:#0D47A1',
    '레드향': 'background:#FCE4EC;color:#880E4F',
    '황금향': 'background:#FFFDE7;color:#F57F17',
    '청견': 'background:#E0F2F1;color:#004D40',
    '세토카': 'background:#FBE9E7;color:#BF360C',
  };
  return map[item] || 'background:#F5F5F5;color:#555';
}

function renderCalUpcoming() {
  const all = calGetAllItems();
  const total = all.length;
  document.getElementById('cal-up-count').textContent = `총 ${total}건`;
  const el = document.getElementById('cal-upcoming-list');
  if (!total) { el.innerHTML = `<div style="text-align:center;color:#aaa;font-size:13px;padding:16px">이번 달 수확 일정이 없습니다</div>`; document.getElementById('cal-pg-bar').style.display = 'none'; return; }
  const pages = Math.ceil(total / CAL_PER);
  if (calUpPage > pages) calUpPage = 1;
  const page = all.slice((calUpPage - 1) * CAL_PER, calUpPage * CAL_PER);
  const ctIcon = {노랑:'🟡',초록:'🟢',헌콘:'⬜'};
  el.innerHTML = page.map(e => {
    const lColor = e.status === '배출완료' ? '#43A047' : e.status === '배차없음' ? '#EF5350' : '#F28C28';
    const bdg = e.status === '배출완료' ? 'b-ok' : e.status === '배차없음' ? 'b-danger' : 'b-warn';
    const dispBox = e.date
      ? `<div style="font-size:10px;font-weight:500;text-align:center;border-radius:5px;padding:3px 4px;background:#E8F5E9;color:#2E7D32;white-space:nowrap">${calFmtShort(e.date)}</div><div style="font-size:9px;text-align:center;color:#aaa">배출일</div>`
      : `<div style="font-size:10px;font-weight:500;text-align:center;border-radius:5px;padding:3px 4px;background:#FFEBEE;color:#C62828;white-space:nowrap">미정</div><div style="font-size:9px;text-align:center;color:#aaa">배출일</div>`;
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:9px 14px;border-bottom:0.5px solid #f0f0f0;border-left:3px solid ${lColor}">
      <div style="display:flex;flex-direction:column;gap:3px;min-width:46px">
        <div style="font-size:10px;font-weight:500;text-align:center;border-radius:5px;padding:3px 4px;background:#E3F2FD;color:#1565C0;white-space:nowrap">${calFmtShort(e.harvest)}</div>
        <div style="font-size:9px;text-align:center;color:#aaa">수확일</div>
        ${dispBox}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:14px;color:#222">${esc(e.farm)} ${e.item ? `<span style="font-weight:500;font-size:11px;padding:2px 7px;border-radius:4px;margin-left:4px;${itemColor(e.item)}">${esc(e.item)}</span>` : ''}</div>
        <div style="font-size:11px;color:#888;margin-top:3px">${e.driver?'👤 '+esc(e.driver)+' &nbsp;':''} ${e.ctype?ctB(e.ctype)+' <strong>'+e.qty+'개</strong>':''}</div>
      </div>
     <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
       ${e.status === '배차없음' ? `<button class="btn pri" style="font-size:11px;padding:4px 10px;white-space:nowrap" onclick="calGoDisp('${e.farm.replace(/'/g,"&#39;")}','${e.harvest||''}','${(e.item||'').replace(/'/g,"&#39;")}')">+ 배차 등록</button><button class="btn edt" style="font-size:11px;padding:4px 8px" onclick="openHarvestEdit(${e.id})">✏️</button><button class="btn del" style="font-size:11px;padding:4px 8px" onclick="delHarvest(${e.id})">삭제</button>` : `<span class="badge ${bdg}" style="white-space:nowrap;font-size:12px">${e.status}</span>`}
     </div>
    </div>`;
  }).join('');

  const pgBar = document.getElementById('cal-pg-bar');
  if (pages <= 1) { pgBar.style.display = 'none'; return; }
  pgBar.style.display = 'flex';
  document.getElementById('cal-pg-info').textContent = `${total}건 · ${(calUpPage-1)*CAL_PER+1}~${Math.min(calUpPage*CAL_PER,total)}`;
  let btns = `<button class="pg-btn" onclick="calGoPage(${calUpPage-1})" ${calUpPage===1?'disabled':''}>◀</button>`;
  for (let i = 1; i <= pages; i++) btns += `<button class="pg-btn${i===calUpPage?' cur':''}" onclick="calGoPage(${i})">${i}</button>`;
  btns += `<button class="pg-btn" onclick="calGoPage(${calUpPage+1})" ${calUpPage===pages?'disabled':''}>▶</button>`;
  document.getElementById('cal-pg-btns').innerHTML = btns;
}

// ── 농가 이력
let _fhFarm = '', _fhTab = 'disp';

function openFarmHistory(name) {
  _fhFarm = name; _fhTab = 'disp';
  document.getElementById('fh-title').textContent = `📋 ${name} 이력`;
  document.getElementById('fh-tab-disp').className = 'dtab active';
  document.getElementById('fh-tab-pick').className = 'dtab';
  document.getElementById('fh-tab-own').className = 'dtab';
  renderFarmHistory();
  document.getElementById('modal-farm-history').style.display = 'flex';
}

function fhTab(t) {
  _fhTab = t;
  document.getElementById('fh-tab-disp').className = 'dtab' + (t === 'disp' ? ' active' : '');
  document.getElementById('fh-tab-pick').className = 'dtab' + (t === 'pick' ? ' active' : '');
  document.getElementById('fh-tab-own').className = 'dtab' + (t === 'own' ? ' active' : '');
  renderFarmHistory();
}

function renderFarmHistory() {
  const el = document.getElementById('fh-body');
  if (_fhTab === 'disp') {
    const list = dispatches.filter(d => d.farm === _fhFarm).sort((a,b) => b.date > a.date ? 1 : -1);
    if (!list.length) { el.innerHTML = '<div class="note">배차 내역이 없습니다</div>'; return; }
    const sc = { '배차완료': 'b-info', '배출완료': 'b-ok' };
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f8f8f8"><th style="padding:8px;text-align:left">날짜</th><th>기사</th><th>수량</th><th>종류</th><th>수확예정일</th><th>상태</th></tr></thead>
      <tbody>${list.map(d => `<tr style="border-bottom:0.5px solid #f0f0f0">
        <td style="padding:8px">${d.date}</td>
        <td style="padding:8px">${esc(d.driver)}</td>
        <td style="padding:8px">${d.qty}개</td>
        <td style="padding:8px">${ctB(d.ctype)}</td>
        <td style="padding:8px">${d.harvest||'-'}</td>
        <td style="padding:8px"><span class="badge ${sc[d.status]||'b-neu'}">${d.status}</span></td>
      </tr>`).join('')}</tbody>
    </table>`;
  } else if (_fhTab === 'pick') {
    const list = picks.filter(p => p.farm === _fhFarm && !p.auto).sort((a,b) => b.date > a.date ? 1 : -1);
    if (!list.length) { el.innerHTML = '<div class="note">수거 내역이 없습니다</div>'; return; }
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f8f8f8"><th style="padding:8px;text-align:left">날짜</th><th>구분</th><th>수량</th><th>기사</th><th>비고</th></tr></thead>
      <tbody>${list.map(p => `<tr style="border-bottom:0.5px solid #f0f0f0">
        <td style="padding:8px">${p.date}</td>
        <td style="padding:8px"><span class="badge ${p.type==='원물수거'?'b-ok':'b-neu'}">${p.type}</span></td>
        <td style="padding:8px">${p.qty}개</td>
        <td style="padding:8px">${esc(p.driver||'-')}</td>
        <td style="padding:8px">${esc(p.note||'-')}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  } else if (_fhTab === 'own') {
    const ins = ownIns.filter(o => o.farm === _fhFarm);
    const outs = ownOuts.filter(o => o.farm === _fhFarm);
    const all = [...ins.map(o=>({...o,dir:'반입'})), ...outs.map(o=>({...o,dir:'반납'}))].sort((a,b)=>b.date>a.date?1:-1);
    if (!all.length) { el.innerHTML = '<div class="note">외부 용기 내역이 없습니다</div>'; return; }
    const st = gOwnSt(_fhFarm);
    el.innerHTML = `<div style="padding:8px 0;margin-bottom:8px;font-size:13px">반입 <strong>${st.inQ}개</strong> · 반납 <strong>${st.outQ}개</strong> · 공장보유 <strong style="color:${st.left>0?'#C05800':'#2E7D32'}">${st.left}개</strong></div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f8f8f8"><th style="padding:8px;text-align:left">날짜</th><th>구분</th><th>수량</th><th>방법</th><th>담당</th></tr></thead>
      <tbody>${all.map(o => `<tr style="border-bottom:0.5px solid #f0f0f0">
        <td style="padding:8px">${o.date}</td>
        <td style="padding:8px"><span class="badge ${o.dir==='반입'?'b-pur':'b-ok'}">${o.dir}</span></td>
        <td style="padding:8px">${o.qty}개</td>
        <td style="padding:8px">${esc(o.method||'-')}</td>
        <td style="padding:8px">${esc(o.staff||'-')}</td>
      </tr>`).join('')}</tbody>
    </table>`;
  }
}

  // ── 기사별 실적 현황
function renderStats() {
  const el = document.getElementById('stats-body');
  if (!el) return;

  const now = new Date();
  const fd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const td = now.toISOString().slice(0, 10);
  const sfEl = document.getElementById('st-from');
  const stEl = document.getElementById('st-to');
  if (sfEl && !sfEl.value) sfEl.value = fd;
  if (stEl && !stEl.value) stEl.value = td;
  const from = sfEl?.value || fd;
  const to = stEl?.value || td;

  const filtered = dispatches.filter(d => d.date >= from && d.date <= to && d.status === '배출완료');
  const pending = dispatches.filter(d => d.date >= from && d.date <= to && d.status === '배차완료');

  if (!drivers.length) { el.innerHTML = '<div class="note">등록된 기사가 없습니다</div>'; return; }

  const stats = drivers.map(d => {
    const done = filtered.filter(x => x.driver === d.name);
    const pend = pending.filter(x => x.driver === d.name);
    const totalQty = done.reduce((s, x) => s + x.qty, 0);
    const pendQty = pend.reduce((s, x) => s + x.qty, 0);
    return { ...d, doneCnt: done.length, doneQty: totalQty, pendCnt: pend.length, pendQty };
  }).sort((a, b) => b.doneQty - a.doneQty);

  const totalDone = stats.reduce((s, d) => s + d.doneCnt, 0);
  const totalQty = stats.reduce((s, d) => s + d.doneQty, 0);

  el.innerHTML = `
    <div class="kpi-grid" style="margin-bottom:16px">
      <div class="kpi"><div class="kpi-label">총 배출 완료</div><div class="kpi-val kv-gr">${totalDone}건</div></div>
      <div class="kpi"><div class="kpi-label">총 배출 수량</div><div class="kpi-val kv-bl">${totalQty.toLocaleString()}개</div></div>
      <div class="kpi"><div class="kpi-label">기간</div><div class="kpi-val" style="font-size:13px">${from} ~ ${to}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#f8f8f8;border-bottom:1px solid #e0e0e0">
          <th style="padding:10px 12px;text-align:left">기사명</th>
          <th style="padding:10px 12px;text-align:left">소속</th>
          <th style="padding:10px 12px;text-align:center">배출완료</th>
          <th style="padding:10px 12px;text-align:center">완료수량</th>
          <th style="padding:10px 12px;text-align:center">배출대기</th>
          <th style="padding:10px 12px;text-align:center">대기수량</th>
          <th style="padding:10px 12px;text-align:left">실적 비율</th>
        </tr>
      </thead>
      <tbody>
        ${stats.map(d => {
          const ratio = totalQty > 0 ? Math.round(d.doneQty / totalQty * 100) : 0;
          return `<tr style="border-bottom:0.5px solid #f0f0f0">
            <td style="padding:10px 12px;font-weight:500">${esc(d.name)}</td>
            <td style="padding:10px 12px"><span class="badge ${d.type==='내부'?'b-ok':'b-pur'}">${d.type}</span></td>
            <td style="padding:10px 12px;text-align:center"><span class="badge b-ok">${d.doneCnt}건</span></td>
            <td style="padding:10px 12px;text-align:center;font-weight:500;color:#2E7D32">${d.doneQty.toLocaleString()}개</td>
            <td style="padding:10px 12px;text-align:center"><span class="badge b-info">${d.pendCnt}건</span></td>
            <td style="padding:10px 12px;text-align:center;color:#C05800">${d.pendQty.toLocaleString()}개</td>
            <td style="padding:10px 12px">
              <div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;background:#f0f0f0;border-radius:4px;height:8px">
                  <div style="width:${ratio}%;background:#2E7D32;border-radius:4px;height:8px;transition:.3s"></div>
                </div>
                <span style="font-size:12px;color:#888;min-width:32px">${ratio}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}
  
let _editHarvestId = null;
function openHarvestEdit(id) {
  const h = harvests.find(x => x.id === id); if (!h) return;
  _editHarvestId = id;
  document.getElementById('mh-date').value = h.date || '';
  document.getElementById('mh-end').value = h.end_date || '';
  const mhf = document.getElementById('mh-farm');
  mhf.innerHTML = '<option value="">선택</option>';
  farms.forEach(f => mhf.innerHTML += `<option value="${esc(f.name)}">${esc(f.name)}</option>`);
  mhf.value = h.farm || '';
  document.getElementById('mh-item').value = h.item || '';
  document.getElementById('mh-note').value = h.note || '';
  document.getElementById('modal-harvest').style.display = 'flex';
}
async function saveHarvestEdit() {
  const date = document.getElementById('mh-date').value;
  const farm = document.getElementById('mh-farm').value;
  if (!date || !farm) { alert('수확 시작일과 농가명을 입력하세요'); return; }
  const data = { date, end_date: document.getElementById('mh-end').value || null, farm, item: document.getElementById('mh-item').value || null, note: document.getElementById('mh-note').value || null };
  try {
    await dbUpdateHarvest(_editHarvestId, data);
    harvests = harvests.map(h => h.id === _editHarvestId ? { ...h, ...data } : h);
    CM('harvest'); renderCal();
  } catch (e) { alert('오류: ' + e.message); }
}
async function autoSetHarvestStatus(farm, date, item, status) {
  let h = harvests.find(x => x.farm === farm && x.date === date);
  if (!h) {
    try {
      const row = await dbInsertHarvest({ date, farm, item: item || null, status });
      harvests.push(row);
    } catch(e) {
      // status 컬럼 없으면 status 빼고 재시도
      try { const row = await dbInsertHarvest({ date, farm, item: item || null }); harvests.push(row); h = row; } catch(e2) {}
      harvests[harvests.length - 1].status = status;
      renderCal(); return;
    }
    harvests[harvests.length - 1].status = status;
    renderCal(); return;
  }
  setHarvestStatus(h.id, status);
}

async function autoOpenHarvestEdit(farm, date, item) {
  let h = harvests.find(x => x.farm === farm && x.date === date);
  if (!h) {
    try { const row = await dbInsertHarvest({ date, farm, item: item || null }); harvests.push(row); h = row; }
    catch(e) { alert('오류: ' + e.message); return; }
  }
  openHarvestEdit(h.id);
}

async function autoDelHarvest(farm, date) {
  const h = harvests.find(x => x.farm === farm && x.date === date);
  if (h) { delHarvest(h.id); } else { renderCal(); }
}

async function setHarvestStatus(id, status) {
  // 우선 로컬 상태 먼저 반영 (DB 성공 여부 무관하게 화면 즉시 업데이트)
  harvests = harvests.map(h => h.id === id ? { ...h, status } : h);
  renderCal();
  try {
    await dbUpdateHarvest(id, { status });
  } catch (e) {
    if (e.message.includes('status') || e.message.includes('column')) {
      // 컬럼 없어도 화면은 동작, 새로고침 시 초기화됨을 안내
      console.warn('status 컬럼 없음 — Supabase SQL 실행 필요');
    } else {
      alert('오류: ' + e.message);
    }
  }
}
async function delHarvest(id) {
  if (!cDel('수확일정 삭제')) return;
  try {
    await dbDeleteHarvest(id);
    harvests = harvests.filter(h => h.id !== id);
    renderCal();
  } catch (e) { alert('오류: ' + e.message); }
}

async function addHarvest() {
  const date = document.getElementById('cal-add-date')?.value;
  const farm = document.getElementById('cal-add-farm')?.value;
  const end_date = document.getElementById('cal-add-end')?.value || null;
  const item = document.getElementById('cal-add-item')?.value || null;
  const note = document.getElementById('cal-add-note')?.value || null;
  if (!date || !farm) { alert('수확 시작일과 농가명을 입력하세요'); return; }
  try {
    const row = await dbInsertHarvest({ date, end_date, farm, item, note, status: '수확전' });
    harvests.push(row);
    document.getElementById('cal-add-date').value = '';
    document.getElementById('cal-add-end').value = '';
    document.getElementById('cal-add-farm').value = '';
    document.getElementById('cal-add-item').value = '';
    document.getElementById('cal-add-note').value = '';
    renderCal();
  } catch (e) { alert('오류: ' + e.message); }
}

async function delHarvest(id) {
  if (!confirm('수확 일정을 삭제할까요?')) return;
  try {
    await dbDeleteHarvest(id);
    harvests = harvests.filter(h => h.id !== id);
    renderCal();
  } catch (e) { alert('오류: ' + e.message); }
}

function calGoPage(p) { calUpPage = p; renderCalUpcoming(); }
function calPrevMonth() { if (calMonth === 0) { calYear--; calMonth = 11; } else calMonth--; calSelectedDate = null; calUpPage = 1; document.getElementById('cal-detail-panel').style.display = 'none'; renderCal(); }
function calNextMonth() { if (calMonth === 11) { calYear++; calMonth = 0; } else calMonth++; calSelectedDate = null; calUpPage = 1; document.getElementById('cal-detail-panel').style.display = 'none'; renderCal(); }

// ── 엑셀 내보내기
function exportExcel(type) {
  const from = document.getElementById('exp-from')?.value;
  const to = document.getElementById('exp-to')?.value;

  function filterByDate(arr) {
    return arr.filter(r => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });
  }

  function toCSV(headers, rows) {
    const h = headers.join(',');
    const r = rows.map(row => row.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(','));
    return [h, ...r].join('\n');
  }

  function download(filename, csv) {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const today = new Date().toISOString().slice(0,10);

  if (type === 'dispatch' || type === 'all') {
    const data = filterByDate(dispatches);
    const csv = toCSV(
      ['날짜','농가명','기사','소속','차량','수량','콘테이너','수확예정일','품목','특이사항','상태'],
      data.map(d => [d.date, d.farm, d.driver, gd(d.driver).type||'', d.car, d.qty, d.ctype, d.harvest||'', d.item||'', d.note||'', d.status])
    );
    download(`배차내역_${today}.csv`, csv);
  }

  if (type === 'pick' || type === 'all') {
    const data = filterByDate(picks.filter(p => !p.auto));
    const csv = toCSV(
      ['날짜','농가명','구분','수량','기사','차량','비고'],
      data.map(p => [p.date, p.farm, p.type, p.qty, p.driver||'', p.car||'', p.note||''])
    );
    download(`수거내역_${today}.csv`, csv);
  }

  if (type === 'farm' || type === 'all') {
    const csv = toCSV(
      ['농가명','연락처','주소','품종','계약수량','담당직원','비고'],
      farms.map(f => [f.name, f.tel||'', f.addr||'', f.variety||'', f.contract||0, f.staff||'', f.memo||''])
    );
    download(`농가목록_${today}.csv`, csv);
  }

  if (type === 'driver' || type === 'all') {
    const csv = toCSV(
      ['기사명','연락처','차량번호','소속','비고'],
      drivers.map(d => [d.name, d.tel||'', d.car||'', d.type||'', d.note||''])
    );
    download(`기사목록_${today}.csv`, csv);
  }

  if (type === 'all') {
    alert('✅ 전체 파일 다운로드 완료!\n배차내역, 수거내역, 농가목록, 기사목록 4개 파일이 저장됩니다.');
  }
}

// ── 위치 마스터 관리 ───────────────────────────────────────────

function parseLocationStr(locStr) {
  if (!locStr) return [];
  return locStr.split('/').map(p => {
    const m = p.trim().match(/^(.+?)\s*\((\d+(?:\.\d+)?)\)$/);
    return m ? { name: m[1].trim(), qty: parseFloat(m[2]) } : { name: p.trim(), qty: null };
  });
}

function getDistGroupTooltip(groupId) {
  const members = inboundRecords.filter(r => !r.is_void && r.distribution_group_id === groupId);
  if (!members.length) return '';
  const total = members.reduce((s, r) => s + r.quantity, 0);
  return '분산: ' + members.map(m => `${m.location || '?'} ${fmtN(m.quantity)}CT`).join(', ') + ` (총 ${fmtN(total)}CT)`;
}

function computeLocStock() {
  const pm = _ibProcessedMap();
  const map = {};
  inboundRecords.filter(r => !r.is_void).forEach(r => {
    if (!r.location) return;
    const rem = r.quantity - (pm[r.id] || 0);
    if (rem <= 0) return;
    parseLocationStr(r.location).forEach(({ name, qty }) => {
      map[name] = (map[name] || 0) + (qty !== null ? Math.min(qty, rem) : rem);
    });
  });
  return map;
}

function buildLocOptHtml() {
  const active = storageLocations.filter(l => l.is_active !== false);
  const zones  = [...new Set(active.map(l => l.zone).filter(Boolean))];
  const noZone = active.filter(l => !l.zone);
  let html = '<option value="">선택 안 함</option>';
  zones.forEach(zone => {
    const items = active.filter(l => l.zone === zone);
    html += `<optgroup label="${esc(zone)}">`;
    items.forEach(l => { html += `<option value="${esc(l.name)}">${esc(l.name)}${l.capacity_ct ? ` (최대 ${l.capacity_ct}CT)` : ''}</option>`; });
    html += '</optgroup>';
  });
  noZone.forEach(l => { html += `<option value="${esc(l.name)}">${esc(l.name)}${l.capacity_ct ? ` (최대 ${l.capacity_ct}CT)` : ''}</option>`; });
  return html;
}

function popLocSelects() {
  const optHtml = buildLocOptHtml();
  ['ib-loc', 'eib-m-loc', 'mv-loc'].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.tagName !== 'SELECT') return;
    const cur = el.value;
    el.innerHTML = optHtml;
    if (cur && [...el.options].some(o => o.value === cur)) el.value = cur;
  });
}

function setLocSelectValue(selectId, value) {
  const el = document.getElementById(selectId);
  if (!el) return;
  if (!value) { el.value = ''; return; }
  if ([...el.options].some(o => o.value === value)) { el.value = value; return; }
  // Value not in master list — add as legacy option so edit round-trips safely
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = value + ' (기존값)';
  opt.style.color = '#888';
  el.appendChild(opt);
  el.value = value;
}

// ── 분산 저장 UI ────────────────────────────────────────────────

function toggleLocMulti(pfx) {
  const isMulti = document.getElementById(`${pfx}-loc-multi`).checked;
  document.getElementById(`${pfx}-loc-single`).style.display = isMulti ? 'none' : '';
  document.getElementById(`${pfx}-loc-rows`).style.display = isMulti ? '' : 'none';
  if (isMulti && document.getElementById(`${pfx}-loc-list`).children.length === 0) {
    addLocRow(pfx);
  }
  if (pfx === 'ib') {
    const qtyEl = document.getElementById('ib-qty');
    if (qtyEl) {
      qtyEl.readOnly = isMulti;
      qtyEl.style.background = isMulti ? '#f5f5f5' : '';
      qtyEl.title = isMulti ? '분산 저장 수량 합계 (자동계산)' : '';
    }
    // ensure total display element exists inside loc-rows
    const rowsEl = document.getElementById('ib-loc-rows');
    if (rowsEl && !document.getElementById('ib-loc-total')) {
      const t = document.createElement('div');
      t.id = 'ib-loc-total';
      t.style.cssText = 'margin-top:4px;font-size:12px;color:#616161;font-weight:600';
      rowsEl.appendChild(t);
    }
    if (isMulti) updateLocTotal('ib');
  }
}

function updateLocTotal(pfx) {
  let total = 0;
  document.querySelectorAll(`#${pfx}-loc-list .loc-dist-row`).forEach(row => {
    total += parseInt(row.querySelector('.loc-dist-qty')?.value) || 0;
  });
  const el = document.getElementById(`${pfx}-loc-total`);
  if (el) el.textContent = total > 0 ? `합계: ${fmtN(total)} CT` : '';
  if (pfx === 'ib') {
    const qtyEl = document.getElementById('ib-qty');
    if (qtyEl && qtyEl.readOnly) qtyEl.value = total || '';
  }
}

function addLocRow(pfx, locName = '', qty = '') {
  const list = document.getElementById(`${pfx}-loc-list`);
  const row = document.createElement('div');
  row.className = 'loc-dist-row';
  row.innerHTML = `
    <select class="loc-dist-sel">${buildLocOptHtml()}</select>
    <input class="loc-dist-qty" type="number" placeholder="CT" min="1" style="width:80px" value="${qty}" oninput="updateLocTotal('${pfx}')">
    <button type="button" class="btn del" style="padding:4px 8px;font-size:12px" onclick="this.closest('.loc-dist-row').remove();updateLocTotal('${pfx}')">✕</button>
  `;
  list.appendChild(row);
  if (locName) {
    const sel = row.querySelector('.loc-dist-sel');
    if ([...sel.options].some(o => o.value === locName)) {
      sel.value = locName;
    } else {
      const opt = document.createElement('option');
      opt.value = locName; opt.textContent = locName + ' (기존값)';
      opt.style.color = '#888';
      sel.appendChild(opt);
      sel.value = locName;
    }
  }
}

function getLocValue(pfx) {
  const isMulti = document.getElementById(`${pfx}-loc-multi`)?.checked;
  if (!isMulti) {
    const selId = pfx === 'ib' ? 'ib-loc' : 'eib-m-loc';
    return document.getElementById(selId)?.value || null;
  }
  const rows = document.querySelectorAll(`#${pfx}-loc-list .loc-dist-row`);
  const parts = [];
  rows.forEach(row => {
    const name = row.querySelector('.loc-dist-sel')?.value;
    const qty = row.querySelector('.loc-dist-qty')?.value;
    if (name) parts.push(qty ? `${name}(${qty})` : name);
  });
  return parts.length ? parts.join('/') : null;
}

function setLocValue(pfx, locStr) {
  const parsed = parseLocationStr(locStr);
  const isMulti = parsed.length > 1 || (parsed.length === 1 && parsed[0].qty !== null);
  const multiChk = document.getElementById(`${pfx}-loc-multi`);
  if (!multiChk) return;
  multiChk.checked = isMulti;
  toggleLocMulti(pfx);
  if (isMulti) {
    document.getElementById(`${pfx}-loc-list`).innerHTML = '';
    parsed.forEach(p => addLocRow(pfx, p.name, p.qty !== null ? p.qty : ''));
  } else {
    const selId = pfx === 'ib' ? 'ib-loc' : 'eib-m-loc';
    setLocSelectValue(selId, locStr || '');
  }
}

function resetLocForm(pfx) {
  const multiChk = document.getElementById(`${pfx}-loc-multi`);
  if (!multiChk) return;
  multiChk.checked = false;
  document.getElementById(`${pfx}-loc-single`).style.display = '';
  document.getElementById(`${pfx}-loc-rows`).style.display = 'none';
  document.getElementById(`${pfx}-loc-list`).innerHTML = '';
  const selId = pfx === 'ib' ? 'ib-loc' : 'eib-m-loc';
  const sel = document.getElementById(selId);
  if (sel) sel.value = '';
  if (pfx === 'ib') {
    const qtyEl = document.getElementById('ib-qty');
    if (qtyEl) { qtyEl.readOnly = false; qtyEl.style.background = ''; qtyEl.title = ''; }
    const totalEl = document.getElementById('ib-loc-total');
    if (totalEl) totalEl.textContent = '';
  }
}

// ── 위치 이동 모달 ─────────────────────────────────────────────

let _moveInboundId = null;

function openMoveModal(id) {
  const r = inboundRecords.find(x => x.id === id);
  if (!r) return;
  _moveInboundId = id;
  const processed = getProcessedForInbound(id);
  const remaining = r.quantity - processed;
  document.getElementById('mv-info').innerHTML =
    `<b>${esc(r.product)}</b> | ${esc(r.farm_name)} | ${r.date} | 잔여 <b>${fmtN(remaining)}CT</b>`;
  document.getElementById('mv-cur-loc').textContent = r.location || '미지정';
  resetLocForm('mv');
  popLocSelects();
  document.getElementById('modal-move-loc').style.display = 'flex';
}

function closeMoveModal() {
  document.getElementById('modal-move-loc').style.display = 'none';
  _moveInboundId = null;
}

async function saveMoveLocation() {
  const id = _moveInboundId;
  if (!id) return;
  const r = inboundRecords.find(x => x.id === id);
  if (!r) return;
  const newLoc = getLocValue('mv') || null;
  if (newLoc === (r.location || null)) { closeMoveModal(); return; }
  try {
    const updated = await dbUpdateInbound(id, { location: newLoc });
    await dbInsertAuditLog({
      target_table: 'inbound_records', target_id: id,
      action: 'UPDATE', changed_by: 'admin',
      old_data: { location: r.location || null },
      new_data: { location: newLoc },
      reason: '위치 이동'
    });
    Object.assign(r, updated);
    renderInvSummary(); renderInboundList();
    closeMoveModal();
    showToast('위치가 변경되었습니다.');
  } catch(e) { alert('저장 오류: ' + e.message); }
}

function buildLocStockCards(locStock) {
  const pm = _ibProcessedMap();
  // 위치별로 입고 레코드 그룹핑
  const locMap = {};   // locName → [{r, allocQty}]
  const unassigned = [];
  inboundRecords.filter(r => !r.is_void).forEach(r => {
    const rem = r.quantity - (pm[r.id] || 0);
    if (rem <= 0) return;
    if (!r.location) { unassigned.push({ r, allocQty: rem }); return; }
    const parts = parseLocationStr(r.location);
    if (parts.length === 1 && parts[0].qty === null) {
      const name = parts[0].name;
      if (!locMap[name]) locMap[name] = [];
      locMap[name].push({ r, allocQty: rem });
    } else {
      parts.forEach(({ name, qty }) => {
        if (!locMap[name]) locMap[name] = [];
        locMap[name].push({ r, allocQty: qty !== null ? Math.min(qty, rem) : rem });
      });
    }
  });

  const allLocNames = [
    ...storageLocations.map(l => l.name),
    ...Object.keys(locMap).filter(n => !storageLocations.some(l => l.name === n))
  ];

  const cards = allLocNames.map(name => {
    const entries = locMap[name] || [];
    const total = entries.reduce((s, e) => s + e.allocQty, 0);
    if (!total) return '';
    const loc = storageLocations.find(l => l.name === name);
    const cap = loc?.capacity_ct;
    const pct = cap ? Math.min(100, Math.round(total / cap * 100)) : null;
    const barColor = pct >= 90 ? '#ef5350' : pct >= 70 ? '#FF9800' : '#43A047';
    const rows = entries.map(({ r, allocQty }) => {
      const rem = r.quantity - (pm[r.id] || 0);
      return `<tr>
        <td>${r.date}</td>
        <td class="nm">${esc(r.product)}</td>
        <td class="nm">${esc(r.farm_name)}</td>
        <td style="text-align:right;font-weight:600;color:#1565C0">${allocQty.toLocaleString()}</td>
        <td style="text-align:right;color:#888;font-size:12px">${rem.toLocaleString()} 잔여</td>
        <td><button class="btn sm" onclick="openMoveModal('${r.id}')" title="이동" style="padding:3px 7px">🚚</button></td>
      </tr>`;
    }).join('');
    return `<div class="loc-stock-card">
      <div class="loc-stock-hdr">
        <span style="font-weight:700">${esc(name)}</span>
        <span style="font-size:13px;color:#1565C0;font-weight:700">${total.toLocaleString()} CT</span>
        ${cap ? `<span style="font-size:12px;color:#888">(최대 ${cap} CT · ${pct}%)</span>` : ''}
      </div>
      ${cap ? `<div style="background:#e0e0e0;border-radius:4px;height:6px;margin:6px 0 10px">
        <div style="width:${pct}%;background:${barColor};height:6px;border-radius:4px;transition:width .3s"></div>
      </div>` : ''}
      <div class="tbl-wrap" style="margin:0"><table style="font-size:12px">
        <thead><tr><th>날짜</th><th>품목</th><th>농가</th><th style="text-align:right">배정 CT</th><th style="text-align:right">잔여</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }).filter(Boolean);

  const unCard = unassigned.length ? (() => {
    const total = unassigned.reduce((s, e) => s + e.allocQty, 0);
    const rows = unassigned.map(({ r, allocQty }) =>
      `<tr>
        <td>${r.date}</td>
        <td class="nm">${esc(r.product)}</td>
        <td class="nm">${esc(r.farm_name)}</td>
        <td style="text-align:right;font-weight:600;color:#888">${allocQty.toLocaleString()}</td>
        <td></td>
        <td><button class="btn sm" onclick="openMoveModal('${r.id}')" title="이동" style="padding:3px 7px">🚚</button></td>
      </tr>`
    ).join('');
    return `<div class="loc-stock-card" style="border-color:#e0e0e0">
      <div class="loc-stock-hdr">
        <span style="font-weight:700;color:#888">미지정</span>
        <span style="font-size:13px;color:#888;font-weight:700">${total.toLocaleString()} CT</span>
      </div>
      <div class="tbl-wrap" style="margin:0"><table style="font-size:12px">
        <thead><tr><th>날짜</th><th>품목</th><th>농가</th><th style="text-align:right">잔여 CT</th><th></th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  })() : '';

  if (!cards.length && !unCard) return '<div class="empty">현재 보관 중인 재고가 없습니다.</div>';
  return cards.join('') + unCard;
}

function renderStorageLocations() {
  const el = document.getElementById('inv-loc-div');
  if (!el) return;
  const isAdm = sessionStorage.getItem('citrus_role') === 'admin';
  const locStock = computeLocStock();
  const zones = [...new Set(storageLocations.map(l => l.zone).filter(Boolean))];
  const datalist = `<datalist id="loc-zone-dl">${zones.map(z => `<option value="${esc(z)}">`).join('')}</datalist>`;

  const rows = storageLocations.map(loc => {
    const stock = locStock[loc.name];
    const stockStr = stock > 0 ? `<strong style="color:#1565C0">${stock.toLocaleString()} CT</strong>` : '<span style="color:#bbb">—</span>';
    const activeChip = loc.is_active !== false
      ? '<span style="color:#059669;font-size:12px;font-weight:600">● 사용</span>'
      : '<span style="color:#bbb;font-size:12px">○ 미사용</span>';
    return `<tr>
      <td style="color:#888;font-size:12px">${esc(loc.zone || '—')}</td>
      <td style="font-weight:600">${esc(loc.name)}${loc.capacity_ct ? `<span style="font-size:11px;color:#aaa;font-weight:400"> · 최대 ${loc.capacity_ct}CT</span>` : ''}</td>
      <td style="text-align:right">${stockStr}</td>
      <td>${activeChip}</td>
      ${isAdm ? `<td style="white-space:nowrap">
        <button class="btn edt" onclick="openLocModal(${loc.id})">수정</button>
        <button class="btn del" onclick="deleteLocation(${loc.id})">삭제</button>
      </td>` : '<td></td>'}
    </tr>`;
  }).join('');

  el.innerHTML = `${datalist}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div>
        <div style="font-size:14px;font-weight:700">위치 관리</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">미사용 위치는 드롭다운에서 숨겨집니다.</div>
      </div>
      ${isAdm ? `<button class="btn pri" style="font-size:12px;padding:5px 14px;white-space:nowrap" onclick="openLocModal(null)">+ 위치 추가</button>` : ''}
    </div>
    ${storageLocations.length ? `
    <div class="tbl-wrap"><table>
      <thead><tr><th>구역</th><th>위치명</th><th style="text-align:right">현재 재고</th><th>상태</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>` : `<div class="empty">등록된 위치가 없습니다.</div>`}
    <div style="margin-top:24px">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px">📊 위치별 재고 현황</div>
      ${buildLocStockCards(locStock)}
    </div>`;
}

function openLocModal(id) {
  _editLocId = id;
  const loc = id ? storageLocations.find(l => l.id === id) : null;
  document.getElementById('loc-modal-title').textContent = loc ? '위치 수정' : '위치 추가';
  document.getElementById('loc-delete-btn').style.display = loc ? '' : 'none';
  document.getElementById('loc-m-name').value = loc?.name ?? '';
  document.getElementById('loc-m-name').readOnly = false;
  document.getElementById('loc-m-zone').value = loc?.zone ?? '';
  document.getElementById('loc-m-capacity').value = loc?.capacity_ct ?? '';
  document.getElementById('loc-m-desc').value = loc?.description ?? '';
  document.getElementById('loc-m-active').checked = loc?.is_active !== false;
  document.getElementById('loc-m-order').value = loc?.sort_order ?? (storageLocations.length + 1);
  document.getElementById('modal-loc').style.display = 'flex';
}

function closeLocModal() {
  document.getElementById('modal-loc').style.display = 'none';
  _editLocId = null;
}

async function saveLocation() {
  const name = document.getElementById('loc-m-name').value.trim();
  if (!name) return alert('위치 이름을 입력해주세요.');
  if (storageLocations.some(l => l.name === name && l.id !== _editLocId))
    return alert(`"${name}"은 이미 등록된 위치입니다.`);
  const data = {
    name,
    zone:        document.getElementById('loc-m-zone').value.trim() || null,
    capacity_ct: parseFloat(document.getElementById('loc-m-capacity').value) || null,
    description: document.getElementById('loc-m-desc').value.trim() || null,
    is_active:   document.getElementById('loc-m-active').checked,
    sort_order:  parseInt(document.getElementById('loc-m-order').value) || 0,
  };
  try {
    if (_editLocId) {
      const updated = await dbUpdateLocation(_editLocId, data);
      const idx = storageLocations.findIndex(l => l.id === _editLocId);
      if (idx !== -1) storageLocations[idx] = updated;
    } else {
      storageLocations.push(await dbInsertLocation(data));
    }
    storageLocations.sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999) || a.name.localeCompare(b.name, 'ko'));
    closeLocModal();
    renderStorageLocations();
    popLocSelects();
    showToast(_editLocId ? '위치가 수정되었습니다.' : `"${name}" 위치가 추가되었습니다.`);
  } catch(e) { alert('저장 오류: ' + e.message); }
}

async function deleteLocation(id) {
  const loc = storageLocations.find(l => l.id === id);
  if (!loc || !confirm(`"${loc.name}" 위치를 삭제할까요?\n입고 내역의 위치값은 유지됩니다.`)) return;
  try {
    await dbDeleteLocation(id);
    storageLocations = storageLocations.filter(l => l.id !== id);
    if (_editLocId === id) closeLocModal();
    renderStorageLocations();
    popLocSelects();
    showToast('삭제되었습니다.');
  } catch(e) { alert('삭제 오류: ' + e.message); }
}

// ── 품질 기준 관리 ─────────────────────────────────────────────

let _editQcId = null;

function getQcForProduct(productName) {
  return qualityCriteria.find(q => q.product_name === productName) || null;
}

async function loadQualityCriteria() {
  qualityCriteria = await dbGetQualityCriteria();
  renderQualityCriteria();
}

function renderQualityCriteria() {
  const el = document.getElementById('inv-qc-div');
  if (!el) return;
  const isAdm = sessionStorage.getItem('citrus_role') === 'admin';

  const CHIP = {
    '상': 'background:#D1FAE5;color:#059669;border-color:#6EE7B7',
    '중': 'background:#FEF3C7;color:#D97706;border-color:#FCD34D',
    '하': 'background:#FEE2E2;color:#DC2626;border-color:#FCA5A5',
  };
  const chip = g => `<span style="display:inline-block;padding:0 7px;border-radius:4px;border:1px solid;font-size:11px;font-weight:700;${CHIP[g]}">${g}</span>`;

  const gradeRows = (high, mid, unit) => {
    if (!high && !mid) return `<div style="color:#aaa;font-size:12px">미설정</div>`;
    return [
      `<div style="display:flex;align-items:center;gap:6px;line-height:2">${chip('상')} <span style="font-size:12px">${high} ${unit} 이상</span></div>`,
      `<div style="display:flex;align-items:center;gap:6px;line-height:2">${chip('중')} <span style="font-size:12px">${mid} ~ ${high} ${unit} 미만</span></div>`,
      `<div style="display:flex;align-items:center;gap:6px;line-height:2">${chip('하')} <span style="font-size:12px">${mid} ${unit} 미만</span></div>`,
    ].join('');
  };

  const cards = qualityCriteria.map(qc => `
    <div class="form-card" style="margin-bottom:0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:14px;font-weight:700">🍊 ${esc(qc.product_name)}</div>
        ${isAdm ? `<button class="btn edt" style="padding:2px 8px;font-size:12px" onclick="openQcModal(${qc.id})">편집</button>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:4px">당도 (Brix)</div>
          ${gradeRows(qc.brix_high_min, qc.brix_mid_min, '')}
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:4px">산도 (%)</div>
          ${gradeRows(qc.acidity_high_min, qc.acidity_mid_min, '')}
        </div>
      </div>
      ${qc.notes ? `<div style="margin-top:8px;font-size:11px;color:#888;border-top:1px solid var(--border);padding-top:6px">📝 ${esc(qc.notes)}</div>` : ''}
    </div>`).join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div>
        <div style="font-size:14px;font-weight:700">품목별 품질 기준</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">기준 미등록 품목은 고급 입력 수치 범위로만 표시됩니다.</div>
      </div>
      ${isAdm ? `<button class="btn pri" style="font-size:12px;padding:5px 14px;white-space:nowrap" onclick="openQcModal(null)">+ 품목 추가</button>` : ''}
    </div>
    ${qualityCriteria.length
      ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">${cards}</div>`
      : `<div class="empty">등록된 품질 기준이 없습니다.<br>품목 추가 버튼으로 기준을 등록해주세요.</div>`}`;
}

function buildQcProductOpts(editProductName) {
  const registered = new Set(qualityCriteria.map(q => q.product_name));
  const optItem = name => {
    const alreadyReg = registered.has(name) && name !== editProductName;
    return alreadyReg
      ? `<option value="${esc(name)}" disabled style="color:#bbb">${esc(name)} (이미 등록됨)</option>`
      : `<option value="${esc(name)}">${esc(name)}</option>`;
  };
  let html = '<option value="">품목 선택</option>';
  categories.forEach(cat => {
    const items = itemDefs.filter(i => i.category_id === cat.id).sort((a, b) => a.name.localeCompare(b.name));
    if (!items.length) return;
    html += `<optgroup label="${esc(cat.name)}">`;
    items.forEach(i => { html += optItem(i.name); });
    html += '</optgroup>';
  });
  const uncategorized = itemDefs.filter(i => !i.category_id).sort((a, b) => a.name.localeCompare(b.name));
  if (uncategorized.length) {
    html += '<optgroup label="기타">';
    uncategorized.forEach(i => { html += optItem(i.name); });
    html += '</optgroup>';
  }
  return html;
}

function openQcModal(id) {
  _editQcId = id;
  const isNew = !id;
  document.getElementById('qc-modal-title').textContent = isNew ? '품목 추가' : '품질 기준 편집';
  const deleteBtn = document.getElementById('qc-delete-btn');
  if (deleteBtn) deleteBtn.style.display = isNew ? 'none' : '';
  const qc = id ? qualityCriteria.find(q => q.id === id) : null;
  const prodEl = document.getElementById('qc-product');
  const hintEl = document.getElementById('qc-product-hint');
  if (isNew) {
    prodEl.innerHTML = buildQcProductOpts(null);
    prodEl.disabled = false;
    prodEl.style.background = '';
    if (hintEl) hintEl.textContent = itemDefs.length ? '' : '⚠️ 품목 마스터가 비어 있습니다. ⚙️ 선과 기준 탭에서 품목을 먼저 추가하세요.';
  } else {
    prodEl.innerHTML = `<option value="${esc(qc.product_name)}">${esc(qc.product_name)}</option>`;
    prodEl.disabled = true;
    prodEl.style.background = '#f5f5f5';
    if (hintEl) hintEl.textContent = '품목명은 변경할 수 없습니다.';
  }
  prodEl.value = qc ? qc.product_name : '';
  document.getElementById('qc-brix-high').value = qc?.brix_high_min ?? '';
  document.getElementById('qc-brix-mid').value = qc?.brix_mid_min ?? '';
  document.getElementById('qc-acid-high').value = qc?.acidity_high_min ?? '';
  document.getElementById('qc-acid-mid').value = qc?.acidity_mid_min ?? '';
  document.getElementById('qc-notes').value = qc?.notes ?? '';
  document.getElementById('modal-qc').style.display = 'flex';
}

function closeQcModal() {
  document.getElementById('modal-qc').style.display = 'none';
  _editQcId = null;
}

async function saveQcCriteria() {
  const productName = document.getElementById('qc-product').value.trim();
  if (!productName) return alert('품목을 선택해주세요.');
  if (!_editQcId && !itemDefs.some(i => i.name === productName))
    return alert('선택한 품목이 품목 마스터에 존재하지 않습니다.\n⚙️ 선과 기준 탭에서 먼저 품목을 등록해주세요.');
  const brixHigh = parseFloat(document.getElementById('qc-brix-high').value) || null;
  const brixMid  = parseFloat(document.getElementById('qc-brix-mid').value)  || null;
  const acidHigh = parseFloat(document.getElementById('qc-acid-high').value) || null;
  const acidMid  = parseFloat(document.getElementById('qc-acid-mid').value)  || null;
  const notes    = document.getElementById('qc-notes').value.trim() || null;
  if (brixHigh && brixMid && brixMid >= brixHigh) return alert('당도 중 최소값은 상 최소값보다 낮아야 합니다.');
  if (acidHigh && acidMid && acidMid >= acidHigh) return alert('산도 중 최소값은 상 최소값보다 낮아야 합니다.');
  const data = { product_name: productName, brix_high_min: brixHigh, brix_mid_min: brixMid,
    acidity_high_min: acidHigh, acidity_mid_min: acidMid, notes, updated_at: new Date().toISOString() };
  try {
    if (_editQcId) {
      const updated = await dbUpdateQualityCriteria(_editQcId, data);
      const idx = qualityCriteria.findIndex(q => q.id === _editQcId);
      if (idx !== -1) qualityCriteria[idx] = updated;
    } else {
      const row = await dbInsertQualityCriteria(data);
      qualityCriteria.push(row);
      qualityCriteria.sort((a, b) => a.product_name.localeCompare(b.product_name, 'ko'));
    }
    closeQcModal();
    renderQualityCriteria();
    showToast(_editQcId ? '품질 기준이 수정되었습니다.' : `"${productName}" 기준이 추가되었습니다.`);
  } catch(e) { alert('저장 오류: ' + e.message); }
}

async function deleteQcCriteria() {
  if (!_editQcId) return;
  const qc = qualityCriteria.find(q => q.id === _editQcId);
  if (!qc || !confirm(`"${qc.product_name}" 품질 기준을 삭제할까요?`)) return;
  try {
    await dbDeleteQualityCriteria(_editQcId);
    qualityCriteria = qualityCriteria.filter(q => q.id !== _editQcId);
    closeQcModal();
    renderQualityCriteria();
    showToast('삭제되었습니다.');
  } catch(e) { alert('삭제 오류: ' + e.message); }
}

// ── 재고관리 ──────────────────────────────────────────────────

function invTab(t) {
  ['sum', 'uns', 'srt', 'wj', 'loc', 'qc', 'cfg', 'log'].forEach(s => {
    const div = document.getElementById('inv-' + s + '-div');
    const btn = document.getElementById('it-' + s);
    if (div) div.style.display = t === s ? '' : 'none';
    if (btn) btn.className = 'etab' + (t === s ? ' af' : '');
  });
  if (t === 'cfg') renderSizeCfg();
  if (t === 'log') loadAuditLogs();
  if (t === 'loc') renderStorageLocations();
  if (t === 'qc') loadQualityCriteria();
}

function ibTab(t) {
  ['list', 'proc'].forEach(s => {
    const div = document.getElementById('ib-' + s + '-div');
    const btn = document.getElementById('ib-t-' + s);
    if (div) div.style.display = t === s ? '' : 'none';
    if (btn) btn.className = 'etab' + (t === s ? ' af' : '');
  });
  if (t === 'proc') renderProcessingTab();
}

function ibListTab(t) {
  ibViewMode = t;
  // 뷰 전환 시 메모 전체 열기 상태 리셋
  _allMemosExpanded = false;
  const memoBtn = document.getElementById('btn-toggle-all-memos');
  if (memoBtn) memoBtn.textContent = '📝 메모 모두 열기';
  ['list', 'farm', 'cat', 'done'].forEach(s => {
    const el = document.getElementById('ib-view-' + s);
    const btn = document.getElementById('ib-vt-' + s);
    if (el) el.style.display = t === s ? '' : 'none';
    if (btn) btn.className = 'etab' + (t === s ? ' af' : '');
  });
  if (t === 'farm') renderIbFarmView();
  if (t === 'cat') renderIbCatView();
  if (t === 'done') renderIbDoneView();
}

async function loadAndRenderInv() {
  showLoading('재고 불러오는 중...');
  try {
    const [newIn, newProc, legacyIn, sorted, waste, juice, sizeCfg, catSys] = await Promise.all([
      dbGetInbounds().catch(() => []),
      dbGetProcessings().catch(() => []),
      dbGetUnsorted(null).catch(() => []),
      dbGetSorted(null), dbGetWaste(null), dbGetJuice(null),
      loadSizeConfig(), loadCategorySystem()
    ]);
    // 레거시 데이터(inventory_unsorted)가 있고 새 테이블이 비어있으면 레거시를 표시
    // 마이그레이션 후에는 newIn에 데이터가 채워짐
    if (newIn.length === 0 && legacyIn.length > 0) {
      // 레거시 데이터를 inbound_records 형식으로 변환해서 표시
      inboundRecords = legacyIn.map(r => ({
        id: r.id, date: r.date, farm_name: r.farm_name, product: r.product,
        quantity: (r.quantity || 0) + (r.sub_quantity || 0),
        location: r.location, note: r.note, created_at: r.created_at,
        _legacy: true
      }));
    } else {
      inboundRecords = newIn;
    }
    processingRecords = newProc;
    invUnsorted = legacyIn;
    [invSorted, invWaste, invJuice, invSizeConfig] = [sorted, waste, juice, sizeCfg];
    categories = catSys.cats; sizeGrades = catSys.grades; itemDefs = catSys.itemList; itemSizeRules = catSys.rules;
    popInvProductSelects();
    popLocSelects();
  } catch(e) { console.error('재고 로드 오류:', e); }
  hideLoading();
  renderInvAll();
}

// ── 카테고리 시스템 헬퍼
function _parseCountNum(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)/);
  return m ? parseInt(m[1]) : null;
}

function _getCatById(id) { return categories.find(c => c.id === id) || null; }
function _getItemDef(productName) { return itemDefs.find(i => i.name === productName) || null; }
function _getCatForProduct(productName) {
  const item = _getItemDef(productName);
  return item ? _getCatById(item.category_id) : null;
}

function getGroupForSorted(product, countNum) {
  const item = _getItemDef(product);
  if (!item) {
    // fallback: old count-based logic
    const n = _parseCountNum(countNum);
    const cfg = invSizeConfig[product] || { 대과: 14, 중과: 22 };
    return n === null ? '중과' : n <= cfg.대과 ? '대과' : n <= cfg.중과 ? '중과' : '소과';
  }
  const cat = _getCatById(item.category_id);
  if (!cat) return countNum;
  if (cat.classification_type === 'grade') {
    const grade = sizeGrades.find(g => g.category_id === cat.id && g.grade_name === countNum);
    return grade ? grade.group_name : countNum;
  } else {
    const n = _parseCountNum(countNum);
    if (n === null) return '기타';
    const rules = itemSizeRules.filter(r => r.item_id === item.id);
    const matched = rules.find(r => n >= r.min_su && n <= r.max_su);
    return matched ? matched.group_name : '기타';
  }
}

function buildCountSelectOpts(product) {
  const cat = _getCatForProduct(product);
  if (cat && cat.classification_type === 'grade') {
    const catGrades = sizeGrades.filter(g => g.category_id === cat.id);
    const groupOrder = [], groupMap = {};
    catGrades.forEach(g => {
      if (!groupMap[g.group_name]) { groupMap[g.group_name] = []; groupOrder.push(g.group_name); }
      groupMap[g.group_name].push(g.grade_name);
    });
    let opts = '<option value="">선택</option>';
    groupOrder.forEach(grp => {
      opts += `<optgroup label="━ ${esc(grp)} ━">`;
      groupMap[grp].forEach(gn => { opts += `<option value="${esc(gn)}">${esc(gn)}</option>`; });
      opts += '</optgroup>';
    });
    return opts;
  }
  // default: count-based 5~26수
  let opts = '<option value="">선택</option>';
  for (let i = 5; i <= 26; i++) opts += `<option value="${i}수">${i}수</option>`;
  return opts;
}

function onSortedProductChange() {
  const product = gv('so-product');
  const sel = document.getElementById('so-count');
  if (sel) sel.innerHTML = buildCountSelectOpts(product);
}

function buildProductOptgroupHTML() {
  let html = '<option value="">선택</option>';
  if (!itemDefs.length) return html;
  // 카테고리 순서: id 순 (categories 배열 순서 유지)
  categories.forEach(cat => {
    const catItems = itemDefs
      .filter(i => i.category_id === cat.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!catItems.length) return;
    html += `<optgroup label="${esc(cat.name)}">`;
    catItems.forEach(i => { html += `<option value="${esc(i.name)}">${esc(i.name)}</option>`; });
    html += '</optgroup>';
  });
  // 카테고리 미지정 품목
  const uncategorized = itemDefs.filter(i => !i.category_id).sort((a, b) => a.name.localeCompare(b.name));
  if (uncategorized.length) {
    html += '<optgroup label="기타">';
    uncategorized.forEach(i => { html += `<option value="${esc(i.name)}">${esc(i.name)}</option>`; });
    html += '</optgroup>';
  }
  return html;
}

function popInvProductSelects() {
  if (!itemDefs.length) return;
  const optHtml = buildProductOptgroupHTML();
  ['ib-product', 'so-product', 'wa-product'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = optHtml;
    if (cur) el.value = cur;
  });
  onSortedProductChange();
}

// ── 크기 설정 UI (v2: 카테고리·등급·과수 기준 통합)
function renderSizeCfg() {
  const el = document.getElementById('inv-cfg-div');
  if (!el) return;
  el.innerHTML = `
    <div class="form-card">
      <div class="form-title">⚙️ 품목 분류 시스템 설정</div>
      <div class="note">💡 카테고리·품목·크기 기준을 설정합니다. 변경 후 전체현황에 즉시 반영됩니다.</div>
      <div style="display:flex;gap:0;margin:12px 0 0;border-bottom:1px solid var(--border)">
        <button class="cfg-stab af" id="cst-cat"   onclick="cfgSubTab('cat')">📁 카테고리·품목</button>
        <button class="cfg-stab"   id="cst-grade" onclick="cfgSubTab('grade')">🍊 감귤류 등급</button>
        <button class="cfg-stab"   id="cst-rule"  onclick="cfgSubTab('rule')">📐 만감류 기준</button>
      </div>
      <div id="csp-cat"   style="padding-top:14px">${_renderCfgCatHTML()}</div>
      <div id="csp-grade" style="display:none;padding-top:14px">${_renderCfgGradeHTML()}</div>
      <div id="csp-rule"  style="display:none;padding-top:14px">${_renderCfgRuleHTML()}</div>
    </div>`;
}

function cfgSubTab(t) {
  ['cat', 'grade', 'rule'].forEach(s => {
    const btn = document.getElementById('cst-' + s);
    const div = document.getElementById('csp-' + s);
    if (btn) btn.className = 'cfg-stab' + (t === s ? ' af' : '');
    if (div) div.style.display = t === s ? '' : 'none';
  });
}

function _cfgTH(txt) { return `<th style="padding:7px 10px;text-align:left;font-size:12px;color:#666;font-weight:500;background:#f5f5f5">${txt}</th>`; }
function _cfgTD(txt, center) { return `<td style="padding:7px 10px${center ? ';text-align:center' : ''}">${txt}</td>`; }

function _renderCfgCatHTML() {
  const ACT = 'width:100px;background:#f5f5f5';
  const catRows = categories.length
    ? categories.map(c => `<tr id="cat-tr-${c.id}" style="border-bottom:0.5px solid #f0f0f0">
        ${_cfgTD(esc(c.name))}
        ${_cfgTD(c.classification_type === 'grade' ? '🍊 등급형' : '🔢 과수형')}
        <td style="padding:4px 8px;text-align:center;white-space:nowrap">
          <button class="btn sm" onclick="editCatRow(${c.id})" style="margin-right:3px">수정</button>
          <button class="btn del sm" onclick="deleteCat(${c.id})">삭제</button>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#bbb">카테고리 없음</td></tr>`;

  const itemRows = itemDefs.length
    ? itemDefs.map(i => {
        const cat = categories.find(c => c.id === i.category_id);
        return `<tr id="item-tr-${i.id}" style="border-bottom:0.5px solid #f0f0f0">
          ${_cfgTD(`<strong>${esc(i.name)}</strong>`)}
          ${_cfgTD(cat ? esc(cat.name) : '-')}
          <td style="padding:4px 8px;text-align:center;white-space:nowrap">
            <button class="btn sm" onclick="editItemRow(${i.id})" style="margin-right:3px">수정</button>
            <button class="btn del sm" onclick="deleteItem(${i.id})">삭제</button>
          </td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#bbb">품목 없음</td></tr>`;

  const catOpts = categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

  return `
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px">카테고리 목록</div>
      <div class="tbl-wrap" style="margin-bottom:10px"><table style="width:100%;border-collapse:collapse">
        <thead><tr>${_cfgTH('이름')}${_cfgTH('분류 방식')}<th style="width:60px;background:#f5f5f5"></th></tr></thead>
        <tbody>${catRows}</tbody>
      </table></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="new-cat-name" placeholder="카테고리명" style="flex:1;min-width:90px;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px">
        <select id="new-cat-type" style="padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px">
          <option value="count">과수형</option>
          <option value="grade">등급형</option>
        </select>
        <button class="btn pri" onclick="addCat()">추가</button>
      </div>
    </div>
    <div>
      <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:8px">품목 목록</div>
      <div class="tbl-wrap" style="margin-bottom:10px"><table style="width:100%;border-collapse:collapse">
        <thead><tr>${_cfgTH('품목명')}${_cfgTH('카테고리')}<th style="width:60px;background:#f5f5f5"></th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="new-item-name" placeholder="품목명" style="flex:1;min-width:90px;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px">
        <select id="new-item-cat" style="padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px">
          <option value="">카테고리 선택</option>${catOpts}
        </select>
        <button class="btn pri" onclick="addItem()">추가</button>
      </div>
    </div>`;
}

function _renderCfgGradeHTML() {
  const gradeCat = categories.find(c => c.classification_type === 'grade');
  if (!gradeCat) return '<div class="note">등급형 카테고리가 없습니다. 카테고리·품목 탭에서 추가하세요.</div>';
  const catGrades = sizeGrades.filter(g => g.category_id === gradeCat.id);
  const gradeRows = catGrades.length
    ? catGrades.map(g => `<tr id="grade-tr-${g.id}" style="border-bottom:0.5px solid #f0f0f0">
        ${_cfgTD(g.sort_order, true)}
        ${_cfgTD(`<strong>${esc(g.grade_name)}</strong>`)}
        ${_cfgTD(esc(g.group_name))}
        <td style="padding:4px 8px;text-align:center;white-space:nowrap">
          <button class="btn sm" onclick="editGradeRow(${g.id})" style="margin-right:3px">수정</button>
          <button class="btn del sm" onclick="deleteSizeGrade(${g.id})">삭제</button>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="padding:12px;text-align:center;color:#bbb">등록된 등급 없음</td></tr>`;
  const groups = [...new Set(catGrades.map(g => g.group_name))].join(' · ');
  return `
    <div class="note" style="margin-bottom:10px">💡 ${esc(gradeCat.name)}의 크기 등급을 관리합니다. 현재 그룹: <strong>${groups || '없음'}</strong></div>
    <div class="tbl-wrap" style="margin-bottom:10px"><table style="width:100%;border-collapse:collapse">
      <thead><tr>${_cfgTH('순서')}${_cfgTH('등급명')}${_cfgTH('그룹')}<th style="width:60px;background:#f5f5f5"></th></tr></thead>
      <tbody>${gradeRows}</tbody>
    </table></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input id="new-grade-name"  placeholder="등급명 (예: S1)"  style="width:90px;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px">
      <input id="new-grade-group" placeholder="그룹 (예: 로얄과)" style="width:110px;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px">
      <input id="new-grade-order" type="number" placeholder="순서" style="width:65px;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px">
      <button class="btn pri" onclick="addSizeGrade(${gradeCat.id})">추가</button>
    </div>`;
}

function _renderCfgRuleHTML() {
  const countCat = categories.find(c => c.classification_type === 'count');
  if (!countCat) return '<div class="note">과수형 카테고리가 없습니다. 카테고리·품목 탭에서 추가하세요.</div>';
  const countItems = itemDefs.filter(i => i.category_id === countCat.id);
  if (!countItems.length) return '<div class="note">과수형 카테고리에 품목이 없습니다. 카테고리·품목 탭에서 추가하세요.</div>';
  const sections = countItems.map(item => {
    const rules = itemSizeRules.filter(r => r.item_id === item.id).sort((a, b) => a.min_su - b.min_su);
    const ruleRows = rules.length
      ? rules.map(r => `<tr id="rule-tr-${r.id}" style="border-bottom:0.5px solid #f0f0f0">
          ${_cfgTD(`<strong>${esc(r.group_name)}</strong>`)}
          ${_cfgTD(r.min_su + '수', true)}
          ${_cfgTD(r.max_su + '수', true)}
          <td style="padding:4px 8px;text-align:center;white-space:nowrap">
            <button class="btn sm" onclick="editRuleRow(${r.id})" style="margin-right:3px">수정</button>
            <button class="btn del sm" onclick="deleteItemRule(${r.id})">삭제</button>
          </td>
        </tr>`).join('')
      : `<tr><td colspan="4" style="padding:10px;text-align:center;color:#bbb">기준 없음</td></tr>`;
    return `<div style="margin-bottom:14px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <div style="background:#EEF2FF;padding:9px 12px;font-size:13px;font-weight:600;border-bottom:1px solid var(--border)">${esc(item.name)}</div>
      <div class="tbl-wrap"><table style="width:100%;border-collapse:collapse">
        <thead><tr>${_cfgTH('그룹')}${_cfgTH('최소 수')}${_cfgTH('최대 수')}<th style="width:60px;background:#f5f5f5"></th></tr></thead>
        <tbody>${ruleRows}</tbody>
      </table></div>
      <div style="padding:10px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:#fafafa;border-top:1px solid var(--border)">
        <input id="nr-grp-${item.id}" placeholder="그룹 (예: 대과)" style="width:100px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:12px">
        <input id="nr-min-${item.id}" type="number" placeholder="최소 수" min="1" max="99" style="width:70px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:12px">
        <input id="nr-max-${item.id}" type="number" placeholder="최대 수" min="1" max="99" style="width:70px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:12px">
        <button class="btn pri" style="font-size:12px;padding:6px 12px" onclick="addItemRule(${item.id})">추가</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="note" style="margin-bottom:12px">💡 수(數)가 낮을수록 큰 과일입니다. 각 품목의 그룹별 수 범위를 설정하세요.</div>${sections}`;
}

// ── 인라인 편집 공통
const _inp = (id, val, w) =>
  `<input id="${id}" value="${esc(val)}" style="width:${w || '100%'};padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px">`;
const _num = (id, val, w) =>
  `<input id="${id}" type="number" value="${val}" min="1" max="99" style="width:${w || '65px'};padding:5px 6px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px;text-align:center">`;
const _actCell = (saveCall, cancelTab) =>
  `<td style="padding:5px 8px;text-align:center;white-space:nowrap">
    <button class="btn pri sm" onclick="${saveCall}">저장</button>
    <button class="btn sm" onclick="cancelEdit('${cancelTab}')" style="margin-left:3px">취소</button>
  </td>`;

function cancelEdit(tab) {
  renderSizeCfg();
  if (tab !== 'cat') cfgSubTab(tab);
}

// 카테고리 수정
function editCatRow(id) {
  const c = categories.find(x => x.id === id);
  if (!c) return;
  const tr = document.getElementById('cat-tr-' + id);
  if (!tr) return;
  tr.innerHTML = `
    <td style="padding:5px 8px">${_inp('ecat-name-' + id, c.name)}</td>
    <td style="padding:5px 8px">
      <select id="ecat-type-${id}" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px">
        <option value="count" ${c.classification_type === 'count' ? 'selected' : ''}>🔢 과수형</option>
        <option value="grade" ${c.classification_type === 'grade' ? 'selected' : ''}>🍊 등급형</option>
      </select>
    </td>
    ${_actCell('saveCatEdit(' + id + ')', 'cat')}`;
}
async function saveCatEdit(id) {
  const name = (document.getElementById('ecat-name-' + id)?.value || '').trim();
  const type = document.getElementById('ecat-type-' + id)?.value;
  if (!name) return alert('카테고리명을 입력하세요.');
  if (categories.some(c => c.id !== id && c.name === name)) return alert('같은 이름의 카테고리가 이미 있습니다.');
  const prev = categories.find(c => c.id === id);
  if (prev && prev.classification_type !== type) {
    const n = itemDefs.filter(i => i.category_id === id).length;
    if (n > 0 && !confirm(`분류 방식 변경은 기존 ${n}개 품목에 영향을 줍니다. 계속할까요?`)) return;
  }
  try {
    await dbUpdateCategory(id, { name, classification_type: type });
    const idx = categories.findIndex(c => c.id === id);
    if (idx !== -1) categories[idx] = { ...categories[idx], name, classification_type: type };
    renderSizeCfg(); popInvProductSelects(); renderInvSummary();
  } catch(e) { alert('오류: ' + e.message); }
}

// 품목 수정
function editItemRow(id) {
  const item = itemDefs.find(x => x.id === id);
  if (!item) return;
  const tr = document.getElementById('item-tr-' + id);
  if (!tr) return;
  const catOpts = categories.map(c =>
    `<option value="${c.id}" ${c.id === item.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  tr.innerHTML = `
    <td style="padding:5px 8px">${_inp('eitem-name-' + id, item.name)}</td>
    <td style="padding:5px 8px">
      <select id="eitem-cat-${id}" style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px">
        <option value="">카테고리 없음</option>${catOpts}
      </select>
    </td>
    ${_actCell('saveItemEdit(' + id + ')', 'cat')}`;
}
async function saveItemEdit(id) {
  const name  = (document.getElementById('eitem-name-' + id)?.value || '').trim();
  const catId = parseInt(document.getElementById('eitem-cat-' + id)?.value) || null;
  if (!name) return alert('품목명을 입력하세요.');
  if (itemDefs.some(i => i.id !== id && i.name === name)) return alert('같은 이름의 품목이 이미 있습니다.');
  try {
    await dbUpdateItem(id, { name, category_id: catId });
    const idx = itemDefs.findIndex(i => i.id === id);
    if (idx !== -1) itemDefs[idx] = { ...itemDefs[idx], name, category_id: catId };
    renderSizeCfg(); popInvProductSelects(); renderInvSummary();
  } catch(e) { alert('오류: ' + e.message); }
}

// 감귤류 등급 수정
function editGradeRow(id) {
  const g = sizeGrades.find(x => x.id === id);
  if (!g) return;
  const tr = document.getElementById('grade-tr-' + id);
  if (!tr) return;
  const existGrps = [...new Set(sizeGrades.filter(s => s.category_id === g.category_id).map(s => s.group_name))];
  const grpList = existGrps.map(grp => `<option value="${esc(grp)}">`).join('');
  tr.innerHTML = `
    <td style="padding:5px 8px;text-align:center">${_num('egrade-ord-' + id, g.sort_order, '55px')}</td>
    <td style="padding:5px 8px">${_inp('egrade-name-' + id, g.grade_name, '80px')}</td>
    <td style="padding:5px 8px">
      <input id="egrade-grp-${id}" value="${esc(g.group_name)}" list="egrp-dl-${id}"
        style="width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px">
      <datalist id="egrp-dl-${id}">${grpList}</datalist>
    </td>
    ${_actCell('saveGradeEdit(' + id + ')', 'grade')}`;
}
async function saveGradeEdit(id) {
  const g = sizeGrades.find(x => x.id === id);
  if (!g) return;
  const name = (document.getElementById('egrade-name-' + id)?.value || '').trim();
  const grp  = (document.getElementById('egrade-grp-' + id)?.value || '').trim();
  const ord  = parseInt(document.getElementById('egrade-ord-' + id)?.value) || g.sort_order;
  if (!name || !grp) return alert('등급명과 그룹명을 입력하세요.');
  if (sizeGrades.some(s => s.id !== id && s.category_id === g.category_id && s.grade_name === name))
    return alert('같은 이름의 등급이 이미 있습니다.');
  try {
    await dbUpdateSizeGrade(id, { grade_name: name, group_name: grp, sort_order: ord });
    const idx = sizeGrades.findIndex(s => s.id === id);
    if (idx !== -1) sizeGrades[idx] = { ...sizeGrades[idx], grade_name: name, group_name: grp, sort_order: ord };
    sizeGrades.sort((a, b) => a.sort_order - b.sort_order);
    renderSizeCfg(); cfgSubTab('grade'); renderInvSummary();
  } catch(e) { alert('오류: ' + e.message); }
}

// 만감류 과수 기준 수정
function editRuleRow(id) {
  const r = itemSizeRules.find(x => x.id === id);
  if (!r) return;
  const tr = document.getElementById('rule-tr-' + id);
  if (!tr) return;
  tr.innerHTML = `
    <td style="padding:5px 8px">${_inp('erule-grp-' + id, r.group_name)}</td>
    <td style="padding:5px 8px;text-align:center">${_num('erule-min-' + id, r.min_su)} 수</td>
    <td style="padding:5px 8px;text-align:center">${_num('erule-max-' + id, r.max_su)} 수</td>
    ${_actCell('saveRuleEdit(' + id + ')', 'rule')}`;
}
async function saveRuleEdit(id) {
  const r = itemSizeRules.find(x => x.id === id);
  if (!r) return;
  const grp = (document.getElementById('erule-grp-' + id)?.value || '').trim();
  const min = parseInt(document.getElementById('erule-min-' + id)?.value) || 0;
  const max = parseInt(document.getElementById('erule-max-' + id)?.value) || 0;
  if (!grp) return alert('그룹명을 입력하세요.');
  if (!min || !max) return alert('최소수와 최대수를 입력하세요.');
  if (min > max) return alert('최소수가 최대수보다 클 수 없습니다.');
  const overlap = itemSizeRules.find(o => o.item_id === r.item_id && o.id !== id && min <= o.max_su && max >= o.min_su);
  if (overlap && !confirm(`'${overlap.group_name}' 그룹(${overlap.min_su}~${overlap.max_su}수)과 수 범위가 겹칩니다. 계속할까요?`)) return;
  try {
    await dbUpdateItemSizeRule(id, { group_name: grp, min_su: min, max_su: max });
    const idx = itemSizeRules.findIndex(o => o.id === id);
    if (idx !== -1) itemSizeRules[idx] = { ...itemSizeRules[idx], group_name: grp, min_su: min, max_su: max };
    renderSizeCfg(); cfgSubTab('rule'); renderInvSummary();
  } catch(e) { alert('오류: ' + e.message); }
}

// ── 카테고리 CRUD
async function addCat() {
  const name = (document.getElementById('new-cat-name')?.value || '').trim();
  const type = document.getElementById('new-cat-type')?.value || 'count';
  if (!name) return alert('카테고리명을 입력하세요.');
  try {
    const row = await dbInsertCategory({ name, classification_type: type });
    categories.push(row);
    sv('new-cat-name', '');
    renderSizeCfg();
    popInvProductSelects(); renderInvSummary();
  } catch(e) { alert('오류: ' + e.message); }
}
async function deleteCat(id) {
  if (!confirm('카테고리를 삭제하면 관련 등급도 모두 삭제됩니다. 계속하시겠습니까?')) return;
  try {
    await dbDeleteCategory(id);
    categories = categories.filter(c => c.id !== id);
    sizeGrades = sizeGrades.filter(g => g.category_id !== id);
    itemDefs = itemDefs.map(i => i.category_id === id ? { ...i, category_id: null } : i);
    renderSizeCfg();
    popInvProductSelects(); renderInvSummary();
  } catch(e) { alert('오류: ' + e.message); }
}
async function addSizeGrade(catId) {
  const name = (document.getElementById('new-grade-name')?.value || '').trim();
  const grp  = (document.getElementById('new-grade-group')?.value || '').trim();
  const ord  = parseInt(document.getElementById('new-grade-order')?.value) ||
    (sizeGrades.filter(g => g.category_id === catId).length + 1);
  if (!name || !grp) return alert('등급명과 그룹명을 입력하세요.');
  try {
    const row = await dbInsertSizeGrade({ category_id: catId, grade_name: name, group_name: grp, sort_order: ord });
    sizeGrades.push(row);
    sizeGrades.sort((a, b) => a.sort_order - b.sort_order);
    renderSizeCfg(); cfgSubTab('grade');
    renderInvSummary();
  } catch(e) { alert('오류: ' + e.message); }
}
async function deleteSizeGrade(id) {
  if (!confirm('삭제하시겠습니까?')) return;
  try {
    await dbDeleteSizeGrade(id);
    sizeGrades = sizeGrades.filter(g => g.id !== id);
    renderSizeCfg(); cfgSubTab('grade');
    renderInvSummary();
  } catch(e) { alert('오류: ' + e.message); }
}
async function addItem() {
  const name  = (document.getElementById('new-item-name')?.value || '').trim();
  const catId = parseInt(document.getElementById('new-item-cat')?.value) || null;
  if (!name) return alert('품목명을 입력하세요.');
  try {
    const row = await dbInsertItem({ name, category_id: catId });
    itemDefs.push(row);
    sv('new-item-name', '');
    renderSizeCfg();
    popInvProductSelects(); renderInvSummary();
  } catch(e) { alert('오류: ' + e.message); }
}
async function deleteItem(id) {
  if (!confirm('품목과 관련 과수 기준을 모두 삭제합니다. 계속하시겠습니까?')) return;
  try {
    await dbDeleteItem(id);
    itemDefs = itemDefs.filter(i => i.id !== id);
    itemSizeRules = itemSizeRules.filter(r => r.item_id !== id);
    renderSizeCfg();
    popInvProductSelects(); renderInvSummary();
  } catch(e) { alert('오류: ' + e.message); }
}
async function addItemRule(itemId) {
  const grp = (document.getElementById('nr-grp-' + itemId)?.value || '').trim();
  const min = parseInt(document.getElementById('nr-min-' + itemId)?.value) || 0;
  const max = parseInt(document.getElementById('nr-max-' + itemId)?.value) || 0;
  if (!grp || !min || !max) return alert('그룹명, 최소수, 최대수를 입력하세요.');
  if (min > max) return alert('최소수가 최대수보다 클 수 없습니다.');
  try {
    const row = await dbInsertItemSizeRule({ item_id: itemId, group_name: grp, min_su: min, max_su: max });
    itemSizeRules.push(row);
    renderSizeCfg(); cfgSubTab('rule');
    renderInvSummary();
  } catch(e) { alert('오류: ' + e.message); }
}
async function deleteItemRule(id) {
  if (!confirm('삭제하시겠습니까?')) return;
  try {
    await dbDeleteItemSizeRule(id);
    itemSizeRules = itemSizeRules.filter(r => r.id !== id);
    renderSizeCfg(); cfgSubTab('rule');
    renderInvSummary();
  } catch(e) { alert('오류: ' + e.message); }
}

function _renderSortedSummarySection(num, title, dataMap, catType) {
  const TH  = 'background:#1565C0;color:#fff;padding:8px 10px;font-size:12px;font-weight:600;text-align:center;border:1px solid #0D47A1';
  const NUM = 'padding:7px 10px;border:1px solid #e0e0e0;font-size:13px;text-align:right;font-weight:600;color:#E65100';
  const NUMhl = NUM + ';background:#FFF8E1';
  const EMPTY = 'padding:10px;border:1px solid #e0e0e0;font-size:13px;text-align:center;color:#bbb';
  const fmt = v => v ? Number(v).toLocaleString() : '';
  const secHdr = (n, t) => `<div style="background:#1565C0;color:#fff;text-align:center;padding:9px;font-size:14px;font-weight:700;border-radius:8px 8px 0 0;margin-top:18px">${n}. ${t}</div>`;
  const wrap = inner => `<div class="tbl-wrap" style="border:1px solid #e0e0e0;border-radius:0 0 8px 8px;overflow:hidden">${inner}</div>`;

  // Determine columns
  let colNames;
  if (catType === 'grade') {
    const gradeCatId = categories.find(c => c.classification_type === 'grade')?.id;
    colNames = [...new Set(
      sizeGrades.filter(g => g.category_id === gradeCatId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(g => g.group_name)
    )];
    if (!colNames.length) colNames = ['대과', '중과', '소과'];
  } else {
    const usedGroups = new Set();
    Object.values(dataMap).forEach(m => Object.keys(m).forEach(k => usedGroups.add(k)));
    const preferred = ['대과', '중과', '소과'];
    const extras = [...usedGroups].filter(g => !preferred.includes(g));
    colNames = [...preferred.filter(g => usedGroups.has(g)), ...extras];
    if (!colNames.length) colNames = ['대과', '중과', '소과'];
  }

  const products = Object.keys(dataMap);
  const bodyRows = products.length === 0
    ? `<tr><td colspan="${colNames.length + 2}" style="${EMPTY}">데이터 없음</td></tr>`
    : products.map(p => {
        const m = dataMap[p] || {};
        const tot = Object.values(m).reduce((s, v) => s + v, 0);
        const cells = colNames.map(col => `<td style="${NUM}">${m[col] ? fmt(m[col]) + ' kg' : ''}</td>`).join('');
        return `<tr>
          <td style="padding:7px 10px;border:1px solid #e0e0e0;font-size:13px;text-align:left">${esc(p)}</td>
          ${cells}
          <td style="${NUMhl}">${tot ? fmt(tot) + ' kg' : ''}</td>
        </tr>`;
      }).join('');

  const thCols = colNames.map(col => `<th style="${TH}">${esc(col)} (kg)</th>`).join('');
  const minW = Math.max(340, 130 + colNames.length * 110) + 'px';

  return secHdr(num, title) + wrap(`<table style="width:100%;border-collapse:collapse;min-width:${minW}">
    <thead><tr>
      <th style="${TH}">품목</th>
      ${thCols}
      <th style="${TH}">합계 (kg)</th>
    </tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>`);
}

function _buildSortedTableWrap(dataMap, catType) {
  const TH    = 'background:#1565C0;color:#fff;padding:8px 10px;font-size:12px;font-weight:600;text-align:center;border:1px solid #0D47A1';
  const NUM   = 'padding:7px 10px;border:1px solid #e0e0e0;font-size:13px;text-align:right;font-weight:600;color:#E65100';
  const NUMhl = NUM + ';background:#FFF8E1';
  const fmt   = v => v ? Number(v).toLocaleString() : '';
  const wrap  = inner => `<div class="tbl-wrap" style="border:1px solid #e0e0e0;border-radius:0 0 8px 8px;overflow:hidden">${inner}</div>`;

  let colNames;
  if (catType === 'grade') {
    const gradeCatId = categories.find(c => c.classification_type === 'grade')?.id;
    colNames = [...new Set(
      sizeGrades.filter(g => g.category_id === gradeCatId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(g => g.group_name)
    )];
    if (!colNames.length) colNames = ['대과', '중과', '소과'];
  } else {
    const usedGroups = new Set();
    Object.values(dataMap).forEach(m => Object.keys(m).forEach(k => usedGroups.add(k)));
    const preferred = ['대과', '중과', '소과'];
    const extras = [...usedGroups].filter(g => !preferred.includes(g));
    colNames = [...preferred.filter(g => usedGroups.has(g)), ...extras];
    if (!colNames.length) colNames = ['대과', '중과', '소과'];
  }

  const rows = Object.entries(dataMap).map(([p, m]) => {
    const tot = Object.values(m).reduce((s, v) => s + v, 0);
    const cells = colNames.map(col => `<td style="${NUM}">${m[col] ? fmt(m[col]) + ' kg' : ''}</td>`).join('');
    return `<tr>
      <td style="padding:7px 10px;border:1px solid #e0e0e0;font-size:13px;text-align:left">${esc(p)}</td>
      ${cells}
      <td style="${NUMhl}">${tot ? fmt(tot) + ' kg' : ''}</td>
    </tr>`;
  }).join('');

  const thCols = colNames.map(col => `<th style="${TH}">${esc(col)} (kg)</th>`).join('');
  const minW = Math.max(340, 130 + colNames.length * 110) + 'px';
  return wrap(`<table style="width:100%;border-collapse:collapse;min-width:${minW}">
    <thead><tr>
      <th style="${TH}">품목</th>${thCols}<th style="${TH}">합계 (kg)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`);
}

function renderInvAll() {
  renderInvSummary();
  renderInboundList();
  renderSortedList();
  renderWasteList();
  renderJuiceList();
}


function renderInvSummary() {
  const el = document.getElementById('inv-summary-cards');
  if (!el) return;

  // 날짜 헤더
  const [y, mo, d] = td().split('-');
  const dateLabel = `${y}년 ${mo}월 ${d}일`;

  const kgPerCtOf = p => (p && p.includes('한라봉')) ? 13 : 17;

  // 선과: 카테고리 타입별 분류
  const sortGrade = {}, sortCount = {};
  const gradeCatId = categories.find(c => c.classification_type === 'grade')?.id;
  const countCatId = categories.find(c => c.classification_type === 'count')?.id;

  invSorted.forEach(r => {
    const item = _getItemDef(r.product);
    const cat = item ? _getCatById(item.category_id) : null;
    const catType = cat ? cat.classification_type : 'count';
    const group = getGroupForSorted(r.product, r.count_num);
    const kg = (Number(r.quantity) || 0) * kgPerCtOf(r.product);
    if (catType === 'grade') {
      if (!sortGrade[r.product]) sortGrade[r.product] = {};
      sortGrade[r.product][group] = (sortGrade[r.product][group] || 0) + kg;
    } else {
      if (!sortCount[r.product]) sortCount[r.product] = {};
      sortCount[r.product][group] = (sortCount[r.product][group] || 0) + kg;
    }
  });

  // 미선과 재고 = 입고 합계 - 처리 합계 (실시간, 무효 제외)
  const processedByInbound = {};
  processingRecords.forEach(r => {
    processedByInbound[r.inbound_id] = (processedByInbound[r.inbound_id] || 0) + r.quantity;
  });
  const unsMap = {};
  inboundRecords.filter(r => !r.is_void).forEach(r => {
    const remaining = r.quantity - (processedByInbound[r.id] || 0);
    if (remaining > 0) unsMap[r.product] = (unsMap[r.product] || 0) + remaining;
  });

  const wasteMap = {};
  invWaste.forEach(r => {
    if (!wasteMap[r.product]) wasteMap[r.product] = { ct: 0, kgPerCt: kgPerCtOf(r.product) };
    wasteMap[r.product].ct += Number(r.quantity) || 0;
  });

  const juiceMap = {};
  invJuice.forEach(r => {
    if (!juiceMap[r.product]) juiceMap[r.product] = { qty: 0, unit: r.unit || '병', note: r.note || '' };
    juiceMap[r.product].qty += Number(r.total_qty) || 0;
    if (r.note && !juiceMap[r.product].note) juiceMap[r.product].note = r.note;
  });

  // 스타일 상수
  const TH  = 'background:#1565C0;color:#fff;padding:8px 10px;font-size:12px;font-weight:600;text-align:center;border:1px solid #0D47A1';
  const TD  = 'padding:7px 10px;border:1px solid #e0e0e0;font-size:13px;text-align:center';
  const NUM = 'padding:7px 10px;border:1px solid #e0e0e0;font-size:13px;text-align:right;font-weight:600;color:#E65100';
  const NUMhl = NUM + ';background:#FFF8E1';
  const fmt = v => v ? Number(v).toLocaleString() : '';

  const secHdr = (num, title) => `
    <div style="background:#1565C0;color:#fff;text-align:center;padding:9px;font-size:14px;font-weight:700;border-radius:8px 8px 0 0;margin-top:18px">
      ${num}. ${title}
    </div>`;
  const wrap = inner => `<div class="tbl-wrap" style="border:1px solid #e0e0e0;border-radius:0 0 8px 8px;overflow:hidden">${inner}</div>`;

  // 데이터 있는 섹션만 수집
  const sections = [];

  if (Object.keys(unsMap).length > 0) {
    const rows = Object.entries(unsMap).map(([p, qty]) => `<tr>
      <td style="${TD};text-align:left">${esc(p)}</td>
      <td style="${NUMhl}">${fmt(qty)} CT</td>
    </tr>`).join('');
    sections.push({ title: '미선과 재고 (단위 : CT)', body: wrap(`<table style="width:100%;border-collapse:collapse;min-width:280px">
      <thead><tr><th style="${TH}">품목</th><th style="${TH}">재고 (CT)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`) });
  }

  if (Object.keys(sortCount).length > 0)
    sections.push({ title: '만감류 선과 재고 (단위: kg)', body: _buildSortedTableWrap(sortCount, 'count') });

  if (Object.keys(sortGrade).length > 0)
    sections.push({ title: '감귤류 선과 재고 (단위: kg)', body: _buildSortedTableWrap(sortGrade, 'grade') });

  if (Object.keys(wasteMap).length > 0) {
    const rows = Object.entries(wasteMap).map(([p, v]) => {
      const totalKg = v.ct * v.kgPerCt;
      return `<tr>
        <td style="${TD};text-align:left">${esc(p)}</td>
        <td style="${NUM}">${fmt(v.ct)}</td>
        <td style="${TD}">${v.kgPerCt}</td>
        <td style="${NUMhl}">${totalKg ? fmt(totalKg) + 'kg' : ''}</td>
      </tr>`;
    }).join('');
    sections.push({ title: '파치 재고', body: wrap(`<table style="width:100%;border-collapse:collapse;min-width:300px">
      <thead><tr>
        <th style="${TH}">품목</th><th style="${TH}">CT수</th><th style="${TH}">규격 (kg/CT)</th><th style="${TH}">총중량 (kg)</th>
      </tr></thead><tbody>${rows}</tbody>
    </table>`) });
  }

  if (Object.keys(juiceMap).length > 0) {
    const rows = Object.entries(juiceMap).map(([p, v]) => `<tr>
      <td style="${TD};text-align:left">${esc(p)}</td>
      <td style="${NUM}">${fmt(v.qty)}</td>
      <td style="${TD}">${esc(v.unit)}</td>
      <td style="${TD}">${esc(v.note)}</td>
    </tr>`).join('');
    sections.push({ title: '주스 / 청 재고', body: wrap(`<table style="width:100%;border-collapse:collapse;min-width:280px">
      <thead><tr>
        <th style="${TH}">품목</th><th style="${TH}">수량</th><th style="${TH}">단위</th><th style="${TH}">비고</th>
      </tr></thead><tbody>${rows}</tbody>
    </table>`) });
  }

  const mainBody = sections.length === 0
    ? '<div style="text-align:center;padding:48px 20px;color:#bbb;font-size:15px">등록된 재고가 없습니다</div>'
    : sections.map((s, i) => secHdr(i + 1, s.title) + s.body).join('');

  el.innerHTML = `
    <div class="inv-excel-wrap">
      <div style="background:#0D47A1;color:#fff;text-align:center;padding:13px;font-size:17px;font-weight:700;border-radius:10px 10px 0 0">
        📦 현장 재고 전체 현황
      </div>
      <div style="text-align:center;padding:8px;font-size:13px;background:#E3F2FD;border:1px solid #90CAF9;border-radius:0 0 8px 8px;margin-bottom:4px">
        ${dateLabel} 기준
      </div>
      ${mainBody}
      <div style="text-align:right;margin-top:14px">
        <button class="btn" onclick="window.print()" style="background:#1565C0;color:#fff;border:none;padding:8px 18px;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit">🖨️ 인쇄 / PDF</button>
      </div>
    </div>`;
}

function getProcessedForInbound(id) {
  return processingRecords.filter(r => r.inbound_id === id).reduce((s, r) => s + r.quantity, 0);
}

function categoryBadge(cat, reclassSource, reclassReason, origDate) {
  if (!cat || cat === '상품') return `<span class="badge" style="background:#E3F2FD;color:#1565C0">상품</span>`;
  if (cat === '대과') return `<span class="badge" style="background:#FFF3E0;color:#E65100">대과</span>`;
  if (cat === '소과') return `<span class="badge" style="background:#E0F2F1;color:#00695C">소과</span>`;
  if (cat === '파치') return `<span class="badge" style="background:#F5F5F5;color:#757575">파치</span>`;
  if (cat === '재선별') {
    const srcLabel = { '신규입고': '신규입고', '선과결과': '선과결과', '포장라인': '포장라인', '반품': '반품', '기타': '기타' }[reclassSource] || '';
    const parts = [srcLabel, reclassReason, origDate && `원본일 ${origDate}`].filter(Boolean);
    const title = parts.length ? ` title="${esc(parts.join(' / '))}"` : '';
    return `<span class="badge" style="background:#F3E8FF;color:#7C3AED;cursor:${parts.length ? 'help' : 'default'}"${title}>재선별</span>`;
  }
  return `<span class="badge">${esc(cat)}</span>`;
}

const DEFECT_QUALITY = new Set(['고산도','저산도','고당도','저당도']);
const DEFECT_APPEARANCE = new Set(['잔싸비','약해','영덩이파치','부끔','봉나옴','찍힘','변색']);
const DEFECT_TIPS = {
  고산도:'산도가 높음', 저산도:'산도가 낮음', 고당도:'당도가 높음', 저당도:'당도가 낮음',
  잔싸비:'잔류 나방 피해', 약해:'약제 피해', 영덩이파치:'꼭지 반대쪽 부패',
  부끔:'과피 부패', 봉나옴:'봉 돌출', 찍힘:'압상 피해', 변색:'색깔 이상'
};

function defectChip(tag) {
  const t = tag.trim();
  const style = DEFECT_QUALITY.has(t)
    ? 'background:#FFF3E0;color:#E65100;border-color:#FFCC80'
    : DEFECT_APPEARANCE.has(t)
    ? 'background:#FFEBEE;color:#C62828;border-color:#EF9A9A'
    : 'background:#F5F5F5;color:#616161;border-color:#E0E0E0';
  const tip = DEFECT_TIPS[t] ? ` title="${DEFECT_TIPS[t]}"` : '';
  return `<span class="defect-chip" style="${style}"${tip}>${esc(t)}</span>`;
}

function defectChipsHtml(tagsStr, recordId, maxShow = 3) {
  if (!tagsStr) return '';
  const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
  if (!tags.length) return '';
  const visible = tags.slice(0, maxShow);
  const rest = tags.length - maxShow;
  const moreBtn = rest > 0
    ? `<button class="btn sm" onclick="openQualityModal('${recordId}')" style="padding:1px 5px;font-size:10px;border-radius:9999px">+${rest}</button>`
    : '';
  return `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:3px">${visible.map(defectChip).join('')}${moreBtn}</div>`;
}

function qualityCompact(r, recordId) {
  const GS = { '상': 'background:#D1FAE5;color:#059669;border-color:#6EE7B7', '중': 'background:#FEF3C7;color:#D97706;border-color:#FCD34D', '하': 'background:#FEE2E2;color:#DC2626;border-color:#FCA5A5' };
  const chip = (lbl, val) => val ? `<span style="font-size:11px;padding:1px 6px;border-radius:4px;border:1px solid;${GS[val]};font-weight:700;white-space:nowrap">${lbl}${val}</span>` : '';
  const chips = [chip('당', r.brix_grade), chip('산', r.acidity_grade), chip('외', r.appearance_grade)].filter(Boolean);
  const gradeRow = chips.length ? `<div style="display:flex;gap:3px;flex-wrap:wrap">${chips.join('')}</div>` : '';
  const defectRow = defectChipsHtml(r.defect_tags, recordId || r.id);
  if (!gradeRow && !defectRow) return '';
  return gradeRow + defectRow;
}

function hasQualityDetail(r) {
  return !!(r.brix_grade || r.acidity_grade || r.appearance_grade || r.defect_tags ||
            r.brix_range || r.acidity_range || r.size_distribution);
}

let _expandedMemoId = null;
let _allMemosExpanded = false;
let _openMenuId = null;

function toggleRowMenu(id, e) {
  e.stopPropagation();
  if (_openMenuId && _openMenuId !== id) {
    const prev = document.getElementById(`row-menu-${_openMenuId}`);
    if (prev) prev.style.display = 'none';
  }
  const menu = document.getElementById(`row-menu-${id}`);
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  if (isOpen) {
    menu.style.display = 'none';
    _openMenuId = null;
  } else {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    menu.style.display = '';
    const menuH = menu.offsetHeight;
    const top = (window.innerHeight - rect.bottom >= menuH + 4 || rect.top < menuH + 4)
      ? rect.bottom + 4
      : rect.top - menuH - 4;
    const right = window.innerWidth - rect.right;
    menu.style.top = Math.max(4, top) + 'px';
    menu.style.right = Math.max(4, right) + 'px';
    menu.style.left = 'auto';
    _openMenuId = id;
  }
}

function qualityInline(r) {
  const GS = { '상': 'background:#D1FAE5;color:#059669;border-color:#6EE7B7', '중': 'background:#FEF3C7;color:#D97706;border-color:#FCD34D', '하': 'background:#FEE2E2;color:#DC2626;border-color:#FCA5A5' };
  const gChip = (lbl, val) => val ? `<span style="font-size:11px;padding:1px 6px;border-radius:4px;border:1px solid;${GS[val]};font-weight:700;white-space:nowrap">${lbl}${val}</span>` : '';
  const chips = [
    gChip('당', r.brix_grade), gChip('산', r.acidity_grade), gChip('외', r.appearance_grade),
    ...(r.defect_tags ? r.defect_tags.split(',').map(t => defectChip(t.trim())).filter(Boolean) : [])
  ].filter(Boolean);
  return chips.length ? `<div style="display:flex;gap:3px;flex-wrap:wrap">${chips.join('')}</div>` : '';
}

function toggleMemo(id) {
  const prev = _expandedMemoId;
  // 항상 이전 메모 행 제거
  if (prev) {
    const oldRow = document.getElementById(`ib-memo-row-${prev}`);
    if (oldRow) oldRow.remove();
    _expandedMemoId = null;
  }
  if (prev === id) return; // 같은 행이면 닫기만
  const r = inboundRecords.find(x => x.id === id);
  if (!r || !r.note) return;
  const mainRow = document.getElementById(`ib-tr-${id}`);
  if (!mainRow) return;
  const colCount = mainRow.cells.length;
  const tr = document.createElement('tr');
  tr.id = `ib-memo-row-${id}`;
  tr.innerHTML = `<td colspan="${colCount}" style="padding:0 10px 10px">
    <div class="memo-expanded">${esc(r.note).replace(/\n/g, '<br>')}</div>
  </td>`;
  mainRow.after(tr);
  _expandedMemoId = id;
}

function toggleFarmMemo(id) {
  const el = document.getElementById(`farm-memo-${id}`);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  document.querySelectorAll('[id^="farm-memo-"]').forEach(e => { e.style.display = 'none'; });
  if (!isOpen) el.style.display = '';
}

function toggleAllMemos() {
  _allMemosExpanded = !_allMemosExpanded;
  const btn = document.getElementById('btn-toggle-all-memos');

  if (ibViewMode === 'farm') {
    document.querySelectorAll('[id^="farm-memo-"]').forEach(el => {
      el.style.display = _allMemosExpanded ? '' : 'none';
    });
  } else {
    // 목록(list) / 카테고리별 보기
    if (_allMemosExpanded) {
      // 기존 단일 메모 닫기
      if (_expandedMemoId) {
        const old = document.getElementById(`ib-memo-row-${_expandedMemoId}`);
        if (old) old.remove();
        _expandedMemoId = null;
      }
      // 메모 있는 모든 행 펼침
      inboundRecords.filter(r => !r.is_void && r.note).forEach(r => {
        if (document.getElementById(`ib-memo-row-${r.id}`)) return;
        const mainRow = document.getElementById(`ib-tr-${r.id}`);
        if (!mainRow) return;
        const tr = document.createElement('tr');
        tr.id = `ib-memo-row-${r.id}`;
        tr.innerHTML = `<td colspan="${mainRow.cells.length}" style="padding:0 10px 10px">
          <div class="memo-expanded">${esc(r.note).replace(/\n/g, '<br>')}</div>
        </td>`;
        mainRow.after(tr);
      });
    } else {
      document.querySelectorAll('[id^="ib-memo-row-"]').forEach(el => el.remove());
      _expandedMemoId = null;
    }
  }

  if (btn) btn.textContent = _allMemosExpanded ? '📝 메모 모두 닫기' : '📝 메모 모두 열기';
}

let _qModalId = null;
function openQualityModal(id) {
  const r = inboundRecords.find(x => x.id === id);
  if (!r) return;
  _qModalId = id;
  const GS = { '상': 'background:#D1FAE5;color:#059669;border-color:#6EE7B7', '중': 'background:#FEF3C7;color:#D97706;border-color:#FCD34D', '하': 'background:#FEE2E2;color:#DC2626;border-color:#FCA5A5' };
  const gradeRow = (lbl, val) => val
    ? `<div style="display:flex;align-items:center;gap:8px;padding:3px 0">
        <span style="color:#888;width:40px;font-size:12px">${lbl}</span>
        <span style="font-size:12px;padding:2px 10px;border-radius:5px;border:1px solid;${GS[val]};font-weight:700">${val}</span>
       </div>` : '';
  const gradeBlock = [gradeRow('당도', r.brix_grade), gradeRow('산도', r.acidity_grade), gradeRow('외관', r.appearance_grade)].filter(Boolean).join('');
  const defectBlock = r.defect_tags
    ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${
        r.defect_tags.split(',').map(t => `<span style="font-size:12px;padding:2px 10px;border-radius:5px;border:1px solid #FFCC80;background:#FFF3E0;color:#E65100;font-weight:600">${esc(t.trim())}</span>`).join('')
      }</div>` : '';
  const measureBlock = [
    r.brix_range     ? `<div style="padding:3px 0;font-size:12px"><span style="color:#888;width:60px;display:inline-block">당도 범위</span>${esc(r.brix_range)}</div>` : '',
    r.acidity_range  ? `<div style="padding:3px 0;font-size:12px"><span style="color:#888;width:60px;display:inline-block">산도 범위</span>${esc(r.acidity_range)}</div>` : '',
    r.size_distribution ? `<div style="padding:3px 0;font-size:12px"><span style="color:#888;width:60px;display:inline-block">크기 분포</span>${esc(r.size_distribution)}</div>` : '',
  ].filter(Boolean).join('');
  const reclassBlock = r.inbound_category === '재선별' && (r.reclassification_source || r.reclassification_reason)
    ? `<div style="margin-top:12px"><div style="font-size:11px;font-weight:700;color:#7C3AED;margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">재선별 정보</div>
        ${r.reclassification_source ? `<div style="font-size:12px;padding:3px 0"><span style="color:#888;width:60px;display:inline-block">출처</span>${esc(r.reclassification_source)}</div>` : ''}
        ${r.reclassification_reason ? `<div style="font-size:12px;padding:3px 0;color:#7C3AED">${esc(r.reclassification_reason)}</div>` : ''}
       </div>` : '';

  document.getElementById('qm-header').textContent = `${r.product} · ${r.farm_name} · ${r.date} · ${fmtN(r.quantity)}CT`;
  document.getElementById('qm-grades').innerHTML = gradeBlock || '<span style="color:#bbb;font-size:12px">등급 없음</span>';
  document.getElementById('qm-defects').innerHTML = defectBlock;
  document.getElementById('qm-memo').textContent = r.note || '';
  document.getElementById('qm-memo-wrap').style.display = r.note ? '' : 'none';
  document.getElementById('qm-measures').innerHTML = measureBlock;
  document.getElementById('qm-measures-wrap').style.display = measureBlock ? '' : 'none';
  document.getElementById('qm-reclass').innerHTML = reclassBlock;
  document.getElementById('modal-quality').style.display = 'flex';
}
function closeQualityModal() {
  document.getElementById('modal-quality').style.display = 'none';
  _qModalId = null;
}

function qualityDisplay(r) {
  const GRADE_STYLE = { '상': 'background:#D1FAE5;color:#059669;border-color:#6EE7B7', '중': 'background:#FEF3C7;color:#D97706;border-color:#FCD34D', '하': 'background:#FEE2E2;color:#DC2626;border-color:#FCA5A5' };
  const gradeChip = (label, val) => val ? `<span style="font-size:11px;padding:1px 8px;border-radius:4px;border:1px solid;${GRADE_STYLE[val] || ''};font-weight:600">${label} ${esc(val)}</span>` : '';
  const gradeChips = [gradeChip('당도', r.brix_grade), gradeChip('산도', r.acidity_grade), gradeChip('외관', r.appearance_grade)].filter(Boolean);
  const defectChips = r.defect_tags ? r.defect_tags.split(',').map(t => `<span style="font-size:11px;padding:1px 8px;border-radius:4px;border:1px solid #FFCC80;background:#FFF3E0;color:#E65100;font-weight:600">${esc(t.trim())}</span>`).join('') : '';
  const gradeLine = (gradeChips.length || defectChips)
    ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px">${gradeChips.join('')}${defectChips}</div>`
    : '';
  const textParts = [];
  if (r.brix_range) textParts.push(`당도 ${esc(r.brix_range)}`);
  if (r.acidity_range) textParts.push(`산도 ${esc(r.acidity_range)}`);
  if (r.size_distribution) textParts.push(`크기: ${esc(r.size_distribution)}`);
  if (r.brix && !r.brix_range) textParts.push(`당 ${r.brix}°`);
  if (r.acidity && !r.acidity_range) textParts.push(`산 ${r.acidity}`);
  const textLine = textParts.length
    ? `<div style="font-size:11px;color:#1565C0;margin-top:3px;line-height:1.6">${textParts.join(' / ')}</div>`
    : '';
  const reclassParts = [];
  if (r.inbound_category === '재선별') {
    if (r.reclassification_source) reclassParts.push(`출처: ${esc(r.reclassification_source)}`);
    if (r.reclassification_reason) reclassParts.push(esc(r.reclassification_reason));
    if (r.original_work_date) reclassParts.push(`원본 ${r.original_work_date}`);
  }
  const reclassLine = reclassParts.length
    ? `<div style="font-size:11px;color:#7C3AED;margin-top:3px;line-height:1.6">${reclassParts.join(' / ')}</div>`
    : '';
  return gradeLine + textLine + reclassLine;
}

// ── 변경 이력 ──────────────────────────────────────────────────

function getAuditActionType(log) {
  if (!log.after_val) return '삭제';
  const bv = log.before_val || {};
  const av = log.after_val || {};
  if (bv.is_void === false && av.is_void === true) return '무효처리';
  if (bv.is_void === true  && av.is_void === false) return '복구';
  if (!log.before_val) return '등록';
  return '수정';
}

function getAuditContext(log) {
  const bv = log.before_val || {};
  if (bv.record) {
    const r = bv.record;
    return { farm: r.farm_name || '', product: r.product || '', date: r.date || '', qty: r.quantity || '' };
  }
  if (log.target_table === 'inbound_records') {
    const r = inboundRecords.find(x => x.id === log.target_id);
    if (r) return { farm: r.farm_name, product: r.product, date: r.date, qty: r.quantity };
  }
  const merged = { ...(log.before_val || {}), ...(log.after_val || {}) };
  return { farm: merged.farm_name || '', product: merged.product || '', date: merged.date || '', qty: merged.quantity || '' };
}

const AUDIT_FIELD_LABELS = {
  date: '날짜', quantity: '수량(CT)', location: '위치', note: '메모',
  inbound_category: '카테고리', is_priority: '우선사용',
  brix_grade: '당도등급', acidity_grade: '산도등급', appearance_grade: '외관등급', defect_tags: '특이사항',
  brix_range: '당도범위', acidity_range: '산도범위', size_distribution: '크기분포',
  is_void: '무효여부',
  reclassification_source: '재선별출처', reclassification_reason: '재선별사유', original_work_date: '원본작업일'
};

function getAuditDiff(log) {
  if (!log.before_val || !log.after_val) return [];
  const bv = log.before_val.record ? log.before_val.record : log.before_val;
  const av = log.after_val.record ? log.after_val.record : log.after_val;
  const changes = [];
  new Set([...Object.keys(bv), ...Object.keys(av)]).forEach(k => {
    if (!AUDIT_FIELD_LABELS[k]) return;
    const b = bv[k], a = av[k];
    if (JSON.stringify(b) === JSON.stringify(a)) return;
    const fmt = v => v === null || v === undefined ? '-' : typeof v === 'boolean' ? (v ? '예' : '아니오') : String(v);
    changes.push(`${AUDIT_FIELD_LABELS[k]}: ${fmt(b)} → ${fmt(a)}`);
  });
  return changes;
}

function getAuditTableLabel(t) {
  return ({ inbound_records: '미선과 입고', processing_records: '선과 처리',
    inventory_sorted: '선과 재고', inventory_waste: '파치', inventory_juice: '주스',
    inventory_unsorted: '미선과(구)', inventory_unsorted_backup: '미선과 백업' })[t] || t;
}

const AUDIT_ACTION_STYLE = {
  '수정':    { bg: '#FFF8E1', color: '#F57F17', border: '#FFE082',  icon: '✏️' },
  '무효처리': { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80',  icon: '🚫' },
  '복구':    { bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9',  icon: '↩️' },
  '삭제':    { bg: '#FFEBEE', color: '#C62828', border: '#EF9A9A',  icon: '🗑️' },
  '등록':    { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7',  icon: '✅' },
};

async function loadAuditLogs(reset = true) {
  if (reset) { auditLogs = []; auditLogOffset = 0; }
  showLoading('이력 불러오는 중...');
  try {
    const rows = await dbGetAuditLogs(AUDIT_PAGE_SIZE, auditLogOffset);
    auditLogs = auditLogs.concat(rows);
    auditLogOffset += rows.length;
    const moreBtn = document.getElementById('audit-load-more');
    if (moreBtn) moreBtn.style.display = rows.length === AUDIT_PAGE_SIZE ? '' : 'none';
    renderAuditLogs(true);
  } catch(e) {
    const el = document.getElementById('audit-log-list');
    if (el) el.innerHTML = `<div style="padding:20px;color:#C62828">이력 불러오기 실패: ${esc(e.message)}</div>`;
  } finally { hideLoading(); }
}

async function loadMoreAuditLogs() { await loadAuditLogs(false); }

function clearAuditFilters() {
  ['al-date-from','al-date-to','al-search'].forEach(id => sv(id, ''));
  const a = document.getElementById('al-action'); if (a) a.value = '';
  const t = document.getElementById('al-table');  if (t) t.value = '';
  renderAuditLogs(true);
}

function renderAuditLogs(resetPage = false) {
  const el = document.getElementById('audit-log-list');
  if (!el) return;

  if (resetPage) auditLogPage = 1;

  const fromDate   = document.getElementById('al-date-from')?.value || '';
  const toDate     = document.getElementById('al-date-to')?.value   || '';
  const actionFilt = document.getElementById('al-action')?.value    || '';
  const tableFilt  = document.getElementById('al-table')?.value     || '';
  const search     = (document.getElementById('al-search')?.value   || '').toLowerCase().trim();

  let filtered = auditLogs;
  if (fromDate) filtered = filtered.filter(l => l.created_at >= fromDate);
  if (toDate)   filtered = filtered.filter(l => l.created_at <= toDate + 'T23:59:59');
  if (tableFilt) filtered = filtered.filter(l => l.target_table === tableFilt);
  if (actionFilt) filtered = filtered.filter(l => getAuditActionType(l) === actionFilt);
  if (search) filtered = filtered.filter(l => {
    const ctx = getAuditContext(l);
    return (l.reason || '').toLowerCase().includes(search) ||
           ctx.farm.toLowerCase().includes(search) ||
           ctx.product.toLowerCase().includes(search);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PER_PAGE));
  if (auditLogPage > totalPages) auditLogPage = totalPages;

  const countEl = document.getElementById('al-result-count');
  if (countEl) countEl.textContent = total ? `전체 ${total}건` : '';

  if (!total) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:#bbb">
      <div style="margin-bottom:10px">조건에 맞는 변경 이력이 없습니다.</div>
      <button class="btn sm" onclick="clearAuditFilters()">필터 초기화</button>
    </div>`;
    document.getElementById('al-pagination')?.remove();
    return;
  }

  const start = (auditLogPage - 1) * AUDIT_PER_PAGE;
  const pageItems = filtered.slice(start, start + AUDIT_PER_PAGE);

  el.innerHTML = pageItems.map((log, i) => {
    const num = start + i + 1;
    const action = getAuditActionType(log);
    const st = AUDIT_ACTION_STYLE[action] || { bg: '#f5f5f5', color: '#555', border: '#ddd', icon: '📝' };
    const ctx = getAuditContext(log);
    const diff = getAuditDiff(log);
    const dt = new Date(log.created_at);
    const dtStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    const ctxParts = [ctx.farm && esc(ctx.farm), ctx.product && esc(ctx.product), ctx.qty && `${fmtN(ctx.qty)}CT`, ctx.date].filter(Boolean);

    return `<div style="background:#fff;border:1px solid var(--border);border-left:4px solid ${st.border};border-radius:8px;padding:12px 14px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <span style="font-size:11px;color:#aaa;font-weight:600;min-width:24px">${num}.</span>
        <span style="background:${st.bg};color:${st.color};font-size:11px;padding:2px 9px;border-radius:10px;font-weight:700;white-space:nowrap">${st.icon} ${action}</span>
        <span style="font-size:11px;font-weight:600;color:#666;background:#f5f5f5;padding:2px 7px;border-radius:8px">${getAuditTableLabel(log.target_table)}</span>
        <span style="font-size:11px;color:#aaa;margin-left:auto;white-space:nowrap">${dtStr}</span>
      </div>
      ${ctxParts.length ? `<div style="font-size:13px;font-weight:600;color:#222;margin-bottom:${diff.length || log.reason ? '5' : '0'}px;padding-left:32px">${ctxParts.join(' · ')}</div>` : ''}
      ${diff.length ? `<div style="font-size:12px;color:#555;margin-bottom:${log.reason ? '5' : '0'}px;display:flex;flex-wrap:wrap;gap:4px;padding-left:32px">${diff.map(d => `<span style="background:#f9f9f9;border:1px solid #eee;border-radius:4px;padding:1px 6px">${esc(d)}</span>`).join('')}</div>` : ''}
      ${log.reason ? `<div style="font-size:12px;color:#888;padding-left:32px">사유: <em>"${esc(log.reason)}"</em></div>` : ''}
    </div>`;
  }).join('');

  // pagination controls
  let pgEl = document.getElementById('al-pagination');
  if (!pgEl) {
    pgEl = document.createElement('div');
    pgEl.id = 'al-pagination';
    el.parentNode.insertBefore(pgEl, el.nextSibling);
  }
  pgEl.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:12px;padding:16px 0 8px;font-size:13px';
  const prevDis = auditLogPage <= 1;
  const nextDis = auditLogPage >= totalPages;
  pgEl.innerHTML = `
    <button class="btn sm" onclick="auditLogPrev()" ${prevDis ? 'disabled' : ''} style="min-width:64px">◀ 이전</button>
    <span style="color:#555;font-weight:600">${auditLogPage} / ${totalPages}</span>
    <button class="btn sm" onclick="auditLogNext()" ${nextDis ? 'disabled' : ''} style="min-width:64px">다음 ▶</button>
  `;
}

function auditLogPrev() { if (auditLogPage > 1) { auditLogPage--; renderAuditLogs(); } }
function auditLogNext() {
  const total = _auditFilteredCount();
  if (auditLogPage < Math.ceil(total / AUDIT_PER_PAGE)) { auditLogPage++; renderAuditLogs(); }
}

function _auditFilteredCount() {
  const fromDate   = document.getElementById('al-date-from')?.value || '';
  const toDate     = document.getElementById('al-date-to')?.value   || '';
  const actionFilt = document.getElementById('al-action')?.value    || '';
  const tableFilt  = document.getElementById('al-table')?.value     || '';
  const search     = (document.getElementById('al-search')?.value   || '').toLowerCase().trim();
  let list = auditLogs;
  if (fromDate) list = list.filter(l => l.created_at >= fromDate);
  if (toDate)   list = list.filter(l => l.created_at <= toDate + 'T23:59:59');
  if (tableFilt) list = list.filter(l => l.target_table === tableFilt);
  if (actionFilt) list = list.filter(l => getAuditActionType(l) === actionFilt);
  if (search) list = list.filter(l => {
    const ctx = getAuditContext(l);
    return (l.reason || '').toLowerCase().includes(search) ||
           ctx.farm.toLowerCase().includes(search) ||
           ctx.product.toLowerCase().includes(search);
  });
  return list.length;
}

const IB_CATS = [
  { key: '상품',  color: '#1565C0', bg: '#E3F2FD', border: '#90CAF9' },
  { key: '대과',  color: '#E65100', bg: '#FFF3E0', border: '#FFCC80' },
  { key: '소과',  color: '#00695C', bg: '#E0F2F1', border: '#80CBC4' },
  { key: '파치',  color: '#757575', bg: '#F5F5F5', border: '#BDBDBD' },
  { key: '재선별', color: '#7C3AED', bg: '#F3E8FF', border: '#C4B5FD' },
];

const PRODUCT_COLORS = {
  '천혜향':   { bg: '#FDDCB5', color: '#9A3412', border: '#F97316' },
  '카라향':   { bg: '#FED7AA', color: '#C2410C', border: '#FB923C' },
  '한라봉':   { bg: '#FCD9A0', color: '#B45309', border: '#F59E0B' },
  '레드향':   { bg: '#FECACA', color: '#991B1B', border: '#F87171' },
  '수라향':   { bg: '#FBCFE8', color: '#9D174D', border: '#F472B6' },
  '황금향':   { bg: '#FEF08A', color: '#A16207', border: '#FACC15' },
  '노지감귤': { bg: '#BBF7D0', color: '#14532D', border: '#4ADE80' },
  '하우스감귤':{ bg: '#D9F99D', color: '#365314', border: '#A3E635' },
  '비가림':   { bg: '#A7F3D0', color: '#064E3B', border: '#34D399' },
  '타이벡':   { bg: '#99F6E4', color: '#134E4A', border: '#2DD4BF' },
  '주스':     { bg: '#DDD6FE', color: '#4C1D95', border: '#A78BFA' },
  '청':       { bg: '#E9D5FF', color: '#581C87', border: '#C084FC' },
  '모나카':   { bg: '#F5D0FE', color: '#701A75', border: '#E879F9' },
};
function productChip(name) {
  const c = PRODUCT_COLORS[name] || { bg: '#F5F5F5', color: '#616161', border: '#E0E0E0' };
  return `<span class="product-chip" style="background:${c.bg};color:${c.color};border-color:${c.border}">${esc(name)}</span>`;
}

const RECLASS_REASONS = {
  '선과결과': ['고산도', '중품 (애매)', '80g이하', '고당파치', '기타'],
  '포장라인': ['상처', '변색', '크기 애매', '부패 의심', '기타'],
  '반품':     ['품질 불만', '운송 손상', '기타'],
  '신규입고': ['기타'],
  '기타':     [],
};

// ── 목록 필터
const IB_FILTER_STYLES = {
  '상품':  { bg: '#E3F2FD', color: '#1565C0', border: '#90CAF9' },
  '대과':  { bg: '#FFF3E0', color: '#E65100', border: '#FFCC80' },
  '소과':  { bg: '#E0F2F1', color: '#00695C', border: '#80CBC4' },
  '파치':  { bg: '#F5F5F5', color: '#757575', border: '#BDBDBD' },
  '재선별': { bg: '#F3E8FF', color: '#7C3AED', border: '#C4B5FD' },
};

function setIbFilter(cat) {
  ibFilterCat = cat;
  ibFilterSrc = '';
  ibPage = 1;
  const srcWrap = document.getElementById('ib-filter-src-wrap');
  if (srcWrap) srcWrap.style.display = cat === '재선별' ? '' : 'none';
  const srcEl = document.getElementById('ib-filter-src');
  if (srcEl) srcEl.value = '';
  _updateIbFilterBtns();
  renderInboundList();
}

function onIbSrcFilterChange() {
  ibFilterSrc = document.getElementById('ib-filter-src')?.value || '';
  ibPage = 1;
  renderInboundList();
}

function _updateIbFilterBtns() {
  document.querySelectorAll('.ib-fcat').forEach(btn => {
    const active = btn.dataset.cat === ibFilterCat;
    const st = IB_FILTER_STYLES[btn.dataset.cat];
    if (active && st) {
      btn.style.cssText = `font-size:12px;padding:3px 11px;border-radius:12px;border:1px solid ${st.border};background:${st.bg};color:${st.color};font-weight:700;cursor:pointer;font-family:inherit`;
    } else if (active) {
      btn.style.cssText = 'font-size:12px;padding:3px 11px;border-radius:12px;border:1px solid #555;background:#333;color:#fff;font-weight:700;cursor:pointer;font-family:inherit';
    } else {
      btn.style.cssText = 'font-size:12px;padding:3px 11px;border-radius:12px;border:1px solid var(--border);background:#f5f5f5;color:var(--text-secondary);cursor:pointer;font-family:inherit';
    }
  });
}

function ibToggleSort(col) {
  if (ibSortCol === col) {
    if (ibSortDir === 'desc') ibSortDir = 'asc';
    else { ibSortCol = null; ibSortDir = null; }
  } else {
    ibSortCol = col;
    ibSortDir = 'desc';
  }
  ibPage = 1;
  renderInboundList();
}

function _applyIbSort(arr) {
  if (!ibSortCol) return arr;
  return [...arr].sort((a, b) => {
    let va, vb;
    if (ibSortCol === 'date')  { va = a.date || '';       vb = b.date || ''; }
    else if (ibSortCol === 'farm') { va = a.farm_name || ''; vb = b.farm_name || ''; }
    else if (ibSortCol === 'qty')  { va = a.quantity || 0;   vb = b.quantity || 0; }
    if (va < vb) return ibSortDir === 'asc' ? -1 : 1;
    if (va > vb) return ibSortDir === 'asc' ?  1 : -1;
    return 0;
  });
}

function ibSetSearch(val) {
  ibSearch = val.trim();
  ibPage = 1;
  renderInboundList();
}

function ibSetPageSize(n) {
  ibPageSize = n === 'all' ? Infinity : parseInt(n);
  ibPage = 1;
  renderInboundList();
}

function ibGoPage(p) {
  ibPage = p;
  renderInboundList();
  document.getElementById('ib-view-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _renderIbPagination(total) {
  const el = document.getElementById('ib-pagination');
  if (!el) return;
  const pageSize = ibPageSize === Infinity ? total : ibPageSize;
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;
  if (total === 0 || totalPages <= 1) { el.innerHTML = ''; return; }
  const start = (ibPage - 1) * pageSize + 1;
  const end = Math.min(ibPage * pageSize, total);
  let pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages = [1];
    if (ibPage > 3) pages.push('...');
    for (let i = Math.max(2, ibPage - 1); i <= Math.min(totalPages - 1, ibPage + 1); i++) pages.push(i);
    if (ibPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }
  const pageBtns = pages.map(p =>
    p === '...'
      ? `<span style="padding:0 4px;color:#bbb;font-size:12px">…</span>`
      : `<button class="pg-btn${p === ibPage ? ' active' : ''}" onclick="ibGoPage(${p})">${p}</button>`
  ).join('');
  const sizeOpts = [10, 25, 50, 100].map(n =>
    `<option value="${n}"${ibPageSize === n ? ' selected' : ''}>${n}</option>`
  ).join('') + `<option value="all"${ibPageSize === Infinity ? ' selected' : ''}>전체</option>`;
  el.innerHTML = `
    <span style="font-size:12px;color:var(--text-secondary);white-space:nowrap">${start}–${end} / 총 ${total}건</span>
    <button class="pg-btn" onclick="ibGoPage(${ibPage - 1})" ${ibPage === 1 ? 'disabled' : ''}>이전</button>
    ${pageBtns}
    <button class="pg-btn" onclick="ibGoPage(${ibPage + 1})" ${ibPage === totalPages ? 'disabled' : ''}>다음</button>
    <label style="font-size:12px;color:var(--text-secondary);margin-left:8px;display:flex;align-items:center;gap:4px;white-space:nowrap">페이지당
      <select onchange="ibSetPageSize(this.value)" style="font-size:12px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;font-family:inherit">${sizeOpts}</select>
    </label>`;
}

function _updateIbSortIcons() {
  ['date', 'farm', 'qty'].forEach(col => {
    const el = document.getElementById(`ib-si-${col}`);
    if (!el) return;
    if (ibSortCol === col) {
      el.textContent = ibSortDir === 'asc' ? '↑' : '↓';
      el.className = 'sort-icon active';
    } else {
      el.textContent = '↕';
      el.className = 'sort-icon';
    }
  });
}

async function migrateInboundGrades() {
  if (sessionStorage.getItem('citrus_role') !== 'admin') return alert('관리자만 실행할 수 있습니다.');
  const parseAvg = str => {
    if (!str) return null;
    const m = str.match(/(\d+\.?\d*)~(\d+\.?\d*)/);
    return m ? (parseFloat(m[1]) + parseFloat(m[2])) / 2 : null;
  };
  const toMigrate = inboundRecords.filter(r => !r.is_void && (
    (r.brix_range && !r.brix_grade) || (r.acidity_range && !r.acidity_grade)
  ));
  if (!toMigrate.length) return alert('변환할 데이터가 없습니다.\n(등급이 이미 설정되었거나 수치 범위가 없는 경우)');
  const preview = toMigrate.slice(0, 5).map(r => {
    const bAvg = parseAvg(r.brix_range);
    const aAvg = parseAvg(r.acidity_range);
    const bG = !r.brix_grade && bAvg !== null ? (bAvg >= 15 ? '상' : bAvg >= 12 ? '중' : '하') : null;
    const aG = !r.acidity_grade && aAvg !== null ? (aAvg <= 1.0 ? '상' : aAvg <= 1.5 ? '중' : '하') : null;
    return `${r.date} ${r.product}(${r.farm_name}): 당도${bG || '-'} 산도${aG || '-'}`;
  }).join('\n');
  if (!confirm(`${toMigrate.length}건 자동 변환 예정\n\n미리보기 (최대 5건):\n${preview}\n\n계속할까요?`)) return;
  let count = 0, err = 0;
  for (const r of toMigrate) {
    const payload = {};
    if (r.brix_range && !r.brix_grade) {
      const avg = parseAvg(r.brix_range);
      if (avg !== null) payload.brix_grade = avg >= 15 ? '상' : avg >= 12 ? '중' : '하';
    }
    if (r.acidity_range && !r.acidity_grade) {
      const avg = parseAvg(r.acidity_range);
      if (avg !== null) payload.acidity_grade = avg <= 1.0 ? '상' : avg <= 1.5 ? '중' : '하';
    }
    if (!Object.keys(payload).length) continue;
    try {
      await dbUpdateInbound(r.id, payload);
      Object.assign(r, payload);
      count++;
    } catch(e) { err++; console.error('마이그레이션 오류:', r.id, e); }
  }
  renderInvSummary(); renderInboundList();
  showToast(`${count}건 변환 완료${err ? ` (오류 ${err}건)` : ''}`);
}

async function migrateDistributedStorage() {
  if (sessionStorage.getItem('citrus_role') !== 'admin') return alert('관리자만 실행할 수 있습니다.');
  const toMigrate = inboundRecords.filter(r =>
    !r.is_void && r.location && r.location.includes('/') && !r.distribution_group_id && !r._legacy
  );
  if (!toMigrate.length) return alert('마이그레이션할 분산 저장 데이터가 없습니다.');
  const preview = toMigrate.slice(0, 5).map(r => `  ${r.date} ${r.product}(${r.farm_name}): ${r.location}`).join('\n');
  if (!confirm(`${toMigrate.length}건의 분산 저장 기록을 개별 row로 분리합니다.\n\n미리보기 (최대 5건):\n${preview}\n\n원본 row는 무효 처리됩니다. 계속할까요?`)) return;
  let ok = 0, fail = 0;
  for (const r of toMigrate) {
    try {
      const parts = parseLocationStr(r.location);
      if (parts.length < 2) continue;
      const distribution_group_id = generateUUID();
      const totalQty = r.quantity;
      const noQtyParts = parts.filter(p => p.qty === null);
      const sumWithQty = parts.filter(p => p.qty !== null).reduce((s, p) => s + p.qty, 0);
      const evenShare = noQtyParts.length > 0 ? Math.floor((totalQty - sumWithQty) / noQtyParts.length) : 0;
      let noQtyIdx = 0;
      const { id, location, quantity, created_at, updated_at, is_void, void_reason, void_at, void_by, _legacy, distribution_group_id: _dgid, ...baseData } = r;
      for (const p of parts) {
        let qty = p.qty !== null ? p.qty : evenShare;
        if (!qty || qty <= 0) qty = 1;
        await dbInsertInbound({ ...baseData, location: p.name, quantity: qty, distribution_group_id });
      }
      await dbUpdateInbound(r.id, { is_void: true, void_reason: '분산저장 분리 마이그레이션', void_at: new Date().toISOString(), void_by: 'admin' });
      ok++;
    } catch(e) {
      fail++;
      console.error('분산저장 마이그레이션 오류:', r.id, e);
    }
  }
  showToast(`분산저장 마이그레이션 완료: ${ok}건 성공${fail ? `, ${fail}건 실패` : ''}`);
  await loadAndRenderInv();
}

function setGrade(btn) {
  const group = btn.closest('.grade-group');
  const wasActive = btn.classList.contains('active');
  group.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('active'));
  if (!wasActive) btn.classList.add('active');
}
function getGradeVal(groupId) {
  const active = document.querySelector(`#${groupId} .grade-btn.active`);
  return active ? active.dataset.val : null;
}
function setGradeVal(groupId, val) {
  document.querySelectorAll(`#${groupId} .grade-btn`).forEach(b => {
    b.classList.toggle('active', b.dataset.val === val);
  });
}
function getDefectTags(wrapId) {
  const checked = [...document.querySelectorAll(`#${wrapId} input:checked`)].map(cb => cb.value);
  return checked.length ? checked.join(',') : null;
}
function setDefectTags(wrapId, val) {
  document.querySelectorAll(`#${wrapId} input`).forEach(cb => {
    cb.checked = val ? val.split(',').includes(cb.value) : false;
  });
}
function showGradeHint(el, field, prefix) {
  const productId = prefix === 'ib' ? 'ib-product' : 'eib-m-product';
  const productName = (document.getElementById(productId)?.value || '').trim();
  const qc = getQcForProduct(productName);
  let title, rows;
  if (field === 'brix') {
    title = productName ? `${esc(productName)} 당도 기준` : '당도 기준';
    const h = qc?.brix_high_min, m = qc?.brix_mid_min;
    rows = h && m
      ? `<div>상: <strong>${h}</strong> 이상</div><div>중: <strong>${m} ~ ${h}</strong> 미만</div><div>하: <strong>${m}</strong> 미만</div>`
      : productName
        ? `<div style="color:#aaa">이 품목의 기준 미등록</div><div style="color:#aaa;font-size:11px">🎯 품질 기준 탭에서 추가 가능</div>`
        : `<div style="color:#aaa">품목 선택 시 해당 기준 표시</div>`;
  } else {
    title = productName ? `${esc(productName)} 산도 기준` : '산도 기준';
    const h = qc?.acidity_high_min, m = qc?.acidity_mid_min;
    rows = h && m
      ? `<div>상: <strong>${h}%</strong> 이상</div><div>중: <strong>${m} ~ ${h}%</strong> 미만</div><div>하: <strong>${m}%</strong> 미만</div>`
      : productName
        ? `<div style="color:#aaa">이 품목의 기준 미등록</div><div style="color:#aaa;font-size:11px">🎯 품질 기준 탭에서 추가 가능</div>`
        : `<div style="color:#aaa">품목 선택 시 해당 기준 표시</div>`;
  }
  const tooltip = document.getElementById('grade-tooltip');
  if (!tooltip) return;
  tooltip.innerHTML = `<div style="font-weight:700;color:var(--text);margin-bottom:5px">${title}</div>${rows}`;
  const rect = el.getBoundingClientRect();
  const tw = 210;
  const left = Math.min(rect.left, window.innerWidth - tw - 10);
  tooltip.style.left = left + 'px';
  tooltip.style.top = (rect.bottom + 6) + 'px';
  tooltip.style.display = 'block';
}
function hideGradeHint() {
  const tooltip = document.getElementById('grade-tooltip');
  if (tooltip) tooltip.style.display = 'none';
}

function clearGrades(prefix) {
  ['brix-grade', 'acid-grade', 'appearance-grade'].forEach(suffix => {
    document.querySelectorAll(`#${prefix}-${suffix} .grade-btn`).forEach(b => b.classList.remove('active'));
  });
  setDefectTags(`${prefix}-defect-wrap`, null);
}
function toggleAdvQuality(prefix) {
  const panel = document.getElementById(`${prefix}-adv-quality`);
  const toggle = document.getElementById(`${prefix}-adv-toggle`);
  if (!panel || !toggle) return;
  const open = panel.style.display === 'none';
  panel.style.display = open ? '' : 'none';
  toggle.textContent = (open ? '▼' : '▶') + ' 고급 입력 (수치)';
}

function onIbCatChange(prefix) {
  const catEl = document.getElementById(prefix === 'ib' ? 'ib-category' : 'eib-m-cat');
  const sec   = document.getElementById(prefix === 'ib' ? 'ib-reclass-section' : 'eib-reclass-section');
  if (!sec) return;
  const show = catEl?.value === '재선별';
  sec.style.display = show ? '' : 'none';
  if (!show) {
    ['src', 'reason', 'date'].forEach(f => {
      const el = document.getElementById(`${prefix}-reclass-${f}`);
      if (el) el.value = '';
    });
    syncReclassList(prefix);
  }
}

function syncReclassList(prefix) {
  const src = document.getElementById(`${prefix}-reclass-src`)?.value || '';
  const dl  = document.getElementById(`${prefix}-reclass-reason-dl`);
  if (!dl) return;
  dl.innerHTML = (RECLASS_REASONS[src] || []).map(o => `<option value="${o}">`).join('');
}

function _ibProcessedMap() {
  const m = {};
  processingRecords.forEach(r => { m[r.inbound_id] = (m[r.inbound_id] || 0) + r.quantity; });
  return m;
}

function ibToggleFarm(name) {
  if (_farmExpanded.has(name)) _farmExpanded.delete(name);
  else _farmExpanded.add(name);
  renderIbFarmView();
}
function ibFarmSetSearch(val) { _farmViewSearch = val.trim(); renderIbFarmView(); }
function ibFarmSetSort(val)   { _farmViewSort = val; renderIbFarmView(); }
function ibFarmToggleAllBtn(btn) {
  const allExpanded = btn.dataset.allExpanded === 'true';
  if (allExpanded) _currentFarmList.forEach(n => _farmExpanded.delete(n));
  else             _currentFarmList.forEach(n => _farmExpanded.add(n));
  renderIbFarmView();
}
function ibToggleCat(key) {
  if (_catExpanded.has(key)) _catExpanded.delete(key);
  else _catExpanded.add(key);
  renderIbCatView();
}
function ibCatToggleAllBtn(btn) {
  const allExpanded = btn.dataset.allExpanded === 'true';
  if (allExpanded) _currentCatList.forEach(k => _catExpanded.delete(k));
  else             _currentCatList.forEach(k => _catExpanded.add(k));
  renderIbCatView();
}

function renderIbFarmView() {
  const el = document.getElementById('ib-view-farm');
  if (!el) return;

  const isAdm = sessionStorage.getItem('citrus_role') === 'admin';
  const pm = _ibProcessedMap();
  const active = inboundRecords.filter(r => !r.is_void);
  const emptyGrades = () => ({ 상: 0, 중: 0, 하: 0, total: 0 });

  // farm → { remaining, cats{}, rows[], hasPriority, brixG{}, acidG{}, appearG{}, latestDate }
  const farmMap = {};
  active.forEach(r => {
    const rem = r.quantity - (pm[r.id] || 0);
    if (!farmMap[r.farm_name]) farmMap[r.farm_name] = {
      remaining: 0, cats: {}, rows: [], hasPriority: false, latestDate: '',
      brixG: emptyGrades(), acidG: emptyGrades(), appearG: emptyGrades()
    };
    const f = farmMap[r.farm_name];
    const cat = r.inbound_category || '상품';
    f.cats[cat] = (f.cats[cat] || 0) + rem;
    f.remaining += rem;
    if (r.is_priority) f.hasPriority = true;
    if (r.date > f.latestDate) f.latestDate = r.date;
    if (r.brix_grade      && f.brixG[r.brix_grade]   !== undefined) { f.brixG[r.brix_grade]++;   f.brixG.total++; }
    if (r.acidity_grade   && f.acidG[r.acidity_grade]  !== undefined) { f.acidG[r.acidity_grade]++;  f.acidG.total++; }
    if (r.appearance_grade && f.appearG[r.appearance_grade] !== undefined) { f.appearG[r.appearance_grade]++; f.appearG.total++; }
    f.rows.push({ ...r, rem });
  });

  // 검색 필터
  let farms = Object.keys(farmMap);
  if (_farmViewSearch) {
    const q = _farmViewSearch.toLowerCase();
    farms = farms.filter(f => f.toLowerCase().includes(q));
  }

  // 정렬
  farms.sort((a, b) => {
    const fa = farmMap[a], fb = farmMap[b];
    switch (_farmViewSort) {
      case 'remaining-asc':  return fa.remaining - fb.remaining;
      case 'name-asc':       return a.localeCompare(b, 'ko');
      case 'date-desc':      return fb.latestDate.localeCompare(fa.latestDate);
      default:               return fb.remaining - fa.remaining;
    }
  });

  _currentFarmList = farms;
  const allExpanded = farms.length > 0 && farms.every(f => _farmExpanded.has(f));
  const toolbar = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
    <input type="text" placeholder="🔍 농가명 검색..." value="${esc(_farmViewSearch)}"
      oninput="ibFarmSetSearch(this.value)"
      style="font-size:12px;padding:5px 10px;border:1px solid var(--border);border-radius:8px;width:160px;font-family:inherit">
    <select onchange="ibFarmSetSort(this.value)"
      style="font-size:12px;padding:5px 8px;border:1px solid var(--border);border-radius:8px;font-family:inherit">
      <option value="remaining-desc"${_farmViewSort==='remaining-desc'?' selected':''}>재고 많은순</option>
      <option value="remaining-asc"${_farmViewSort==='remaining-asc'?' selected':''}>재고 적은순</option>
      <option value="name-asc"${_farmViewSort==='name-asc'?' selected':''}>농가명 가나다순</option>
      <option value="date-desc"${_farmViewSort==='date-desc'?' selected':''}>입고일 최신순</option>
    </select>
    <button class="btn" data-all-expanded="${allExpanded}" onclick="ibFarmToggleAllBtn(this)"
      style="font-size:12px;padding:4px 10px">${allExpanded ? '📁 모두 접기' : '📂 모두 펼치기'}</button>
    <span style="font-size:12px;color:var(--text-secondary);margin-left:auto">${farms.length}개 농가</span>
  </div>`;

  if (!Object.keys(farmMap).length) {
    el.innerHTML = toolbar + '<div style="padding:30px;text-align:center;color:#bbb">입고 기록 없음</div>';
    return;
  }
  if (!farms.length) {
    el.innerHTML = toolbar + '<div style="padding:24px;text-align:center;color:#bbb">검색 결과 없음</div>';
    return;
  }

  const statusChip = rem => rem >= 200
    ? `<span style="background:#E8F5E9;color:#2E7D32;font-size:11px;padding:2px 7px;border-radius:10px;font-weight:700">🟢 충분</span>`
    : rem >= 50
    ? `<span style="background:#FFF8E1;color:#F57F17;font-size:11px;padding:2px 7px;border-radius:10px;font-weight:700">🟡 보통</span>`
    : rem > 0
    ? `<span style="background:#FFEBEE;color:#C62828;font-size:11px;padding:2px 7px;border-radius:10px;font-weight:700">🔴 부족</span>`
    : `<span style="background:#F5F5F5;color:#9E9E9E;font-size:11px;padding:2px 7px;border-radius:10px">완료</span>`;

  const GCOL = { '상': '#059669', '중': '#D97706', '하': '#DC2626' };
  const gradeStat = (label, counts) => {
    if (!counts.total) return '';
    const parts = ['상', '중', '하'].filter(g => counts[g] > 0)
      .map(g => `<span style="color:${GCOL[g]};font-weight:700">${g}&thinsp;${counts[g]}</span>`).join(' ');
    return `<span style="color:#888;margin-right:2px">${label}</span>${parts}`;
  };
  const gradeHeaderChip = (label, counts) => {
    if (!counts.total) return '';
    const dom = ['상', '중', '하'].find(g => counts[g] > 0);
    return dom ? `<span style="font-size:10px;color:${GCOL[dom]};opacity:0.85">${label}${dom}</span>` : '';
  };

  let cardsHtml = '';
  farms.forEach((farm, idx) => {
    const { remaining, cats, rows, hasPriority, brixG, acidG, appearG } = farmMap[farm];
    const isExpanded = _farmExpanded.has(farm);
    const borderColor = remaining >= 200 ? '#2E7D32' : remaining >= 50 ? '#F57F17' : remaining > 0 ? '#C62828' : '#BDBDBD';

    const catRows = IB_CATS
      .filter(c => (cats[c.key] || 0) > 0)
      .map((c, i, arr) => {
        const isLast = i === arr.length - 1;
        return `<div style="display:flex;align-items:center;gap:6px;padding:4px 14px 4px 36px">
          <span style="color:#ccc;font-size:11px">${isLast ? '└─' : '├─'}</span>
          <span style="background:${c.bg};color:${c.color};font-size:11px;padding:1px 7px;border-radius:8px;font-weight:700">${c.key}</span>
          <span style="font-weight:700;color:${c.color}">${cats[c.key]} CT</span>
        </div>`;
      }).join('');

    const detailRows = [...rows]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r, i, arr) => {
        const isLast = i === arr.length - 1;
        const remColor = r.rem <= 0 ? '#aaa' : r.rem < 50 ? '#C62828' : '#E65100';
        const memoBtn = r.note ? `<button class="memo-icon-btn" onclick="toggleFarmMemo('${r.id}')" title="${esc(r.note)}" style="font-size:13px;margin-left:2px">📝</button>` : '';
        const compactGrade = qualityInline(r);
        const farmMenuItems = isAdm
          ? `<button onclick="editInboundRow('${r.id}')">✏️ 수정</button>
             ${r.rem > 0 ? `<button onclick="openMoveModal('${r.id}')">🚚 위치 이동</button>` : ''}
             <button onclick="openQualityModal('${r.id}')">📋 품질 상세</button>
             <button onclick="openRecordHistory('${r.id}')">📜 변경 이력</button>
             <div class="menu-divider"></div>
             <button onclick="deleteInbound('${r.id}')" class="menu-danger">🗑️ 삭제</button>`
          : `<button onclick="openRecordHistory('${r.id}')">📜 변경 이력</button>`;
        const farmMenu = `<div style="position:relative;display:inline-block">
          <button class="menu-trigger" onclick="toggleRowMenu('${r.id}',event)" style="font-size:13px;width:24px;height:24px">⋮</button>
          <div id="row-menu-${r.id}" class="row-menu" style="display:none">${farmMenuItems}</div>
        </div>`;
        const memoDiv = r.note
          ? `<div id="farm-memo-${r.id}" class="memo-expanded" style="display:none;margin:4px 0 0 20px">${esc(r.note).replace(/\n/g, '<br>')}</div>` : '';
        return `<div style="padding:5px 14px 5px 36px;${isLast ? '' : 'border-bottom:1px solid #f5f5f5'}">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="color:#ccc;font-size:11px">${isLast ? '└─' : '├─'}</span>
            <span style="font-size:12px;color:#555">${r.date}</span>
            ${productChip(r.product)}
            <span style="font-weight:700;color:${remColor};font-size:13px">${r.rem > 0 ? r.rem + ' CT' : '완료'}</span>
            ${r.location ? `<span style="font-size:11px;color:#888">(${esc(r.location)})</span>` : ''}
            ${r.is_priority ? '<span style="font-size:11px">⭐</span>' : ''}
            ${compactGrade}
            ${memoBtn}${farmMenu}
          </div>
          ${memoDiv}
        </div>`;
      }).join('');

    const gradeParts = [gradeStat('당도', brixG), gradeStat('산도', acidG), gradeStat('외관', appearG)].filter(Boolean);
    const gradeRow = gradeParts.length
      ? `<div style="border-top:1px solid #f0f0f0;padding:5px 14px;background:#fafafa;font-size:11px;display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <span style="font-size:10px;font-weight:700;color:#bbb;letter-spacing:.04em;text-transform:uppercase">품질</span>
          ${gradeParts.join('<span style="color:#e0e0e0">│</span>')}
         </div>`
      : '';

    const hdrChips = [gradeHeaderChip('당', brixG), gradeHeaderChip('산', acidG), gradeHeaderChip('외', appearG)].filter(Boolean);

    cardsHtml += `<div style="background:#fff;border:1px solid #e8e8e8;border-left:4px solid ${borderColor};border-radius:8px;margin-bottom:10px;overflow:hidden">
      <div data-farm="${esc(farm)}" onclick="ibToggleFarm(this.dataset.farm)"
           style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fafafa;cursor:pointer;user-select:none;flex-wrap:wrap">
        <span style="font-size:11px;color:#888;display:inline-block;width:10px">${isExpanded ? '▼' : '▶'}</span>
        <span style="font-size:16px">👨‍🌾</span>
        <span style="display:inline-block;width:14px;text-align:center;font-size:12px">${hasPriority ? '⭐' : ''}</span>
        <span style="font-weight:700;font-size:14px;color:#222">${esc(farm)}</span>
        <span style="font-size:13px;color:#555">남은 재고 <strong style="color:#1565C0">${fmtN(remaining)} CT</strong></span>
        <span style="font-size:11px;color:#aaa">${rows.length}건</span>
        ${statusChip(remaining)}
        ${hdrChips.length ? `<span style="margin-left:auto;display:flex;gap:5px">${hdrChips.join('')}</span>` : ''}
      </div>
      <div id="farm-body-${idx}" style="display:${isExpanded ? '' : 'none'}">
        ${gradeRow}
        ${catRows ? `<div style="border-top:1px solid #f0f0f0;padding:6px 0 4px">${catRows}</div>` : ''}
        <div style="border-top:1px solid #f0f0f0">${detailRows}</div>
      </div>
    </div>`;
  });

  const grandTotal = farms.reduce((s, f) => s + farmMap[f].remaining, 0);
  const footer = `<div style="text-align:right;padding:10px 4px 4px;font-size:13px;color:#555;border-top:2px solid #ddd;margin-top:4px">
    ${_farmViewSearch ? '검색된 농가 재고 합계' : '전체 남은 재고'}: <strong style="color:#1565C0;font-size:15px">${grandTotal.toLocaleString()} CT</strong>
  </div>`;
  el.innerHTML = toolbar + cardsHtml + footer;
}

function renderIbCatView() {
  const el = document.getElementById('ib-view-cat');
  if (!el) return;

  const pm = _ibProcessedMap();
  const active = inboundRecords.filter(r => !r.is_void);

  const catMap = {};
  IB_CATS.forEach(c => { catMap[c.key] = { total: 0, farms: {} }; });

  active.forEach(r => {
    const rem = r.quantity - (pm[r.id] || 0);
    const cat = r.inbound_category || '상품';
    if (!catMap[cat]) catMap[cat] = { total: 0, farms: {} };
    if (!catMap[cat].farms[r.farm_name])
      catMap[cat].farms[r.farm_name] = { qty: 0, dates: [], products: [] };
    catMap[cat].farms[r.farm_name].qty += rem;
    catMap[cat].total += rem;
    if (r.date && !catMap[cat].farms[r.farm_name].dates.includes(r.date))
      catMap[cat].farms[r.farm_name].dates.push(r.date);
    if (r.product && !catMap[cat].farms[r.farm_name].products.includes(r.product))
      catMap[cat].farms[r.farm_name].products.push(r.product);
  });

  const activeCats = IB_CATS.filter(c => catMap[c.key].total > 0);
  _currentCatList = activeCats.map(c => c.key);
  const allCatExpanded = activeCats.length > 0 && activeCats.every(c => _catExpanded.has(c.key));
  const catToolbar = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
    <button class="btn" data-all-expanded="${allCatExpanded}" onclick="ibCatToggleAllBtn(this)"
      style="font-size:12px;padding:4px 10px">${allCatExpanded ? '📁 모두 접기' : '📂 모두 펼치기'}</button>
    <span style="font-size:12px;color:var(--text-secondary)">${activeCats.length}개 카테고리</span>
  </div>`;

  let html = '';
  let catIdx = 0;
  IB_CATS.forEach(c => {
    const { total, farms } = catMap[c.key];
    if (total === 0) return;
    const isExpanded = _catExpanded.has(c.key);
    const idx = catIdx++;

    const farmEntries = Object.entries(farms)
      .filter(([, v]) => v.qty > 0)
      .sort(([, a], [, b]) => b.qty - a.qty);

    const farmRows = farmEntries.map(([farm, { qty, dates, products }], i, arr) => {
      const isLast = i === arr.length - 1;
      const datesStr = [...dates].sort().map(d => d.slice(5)).join(', ');
      const prodChips = products.map(p => productChip(p)).join('');
      return `<div style="display:flex;align-items:center;gap:6px;padding:6px 14px 6px 24px;${isLast ? '' : 'border-bottom:1px solid #f5f5f5;'}flex-wrap:wrap">
        <span style="color:#ccc;font-size:11px">${isLast ? '└─' : '├─'}</span>
        <span style="font-weight:700;font-size:13px;color:#222">${esc(farm)}</span>
        <span style="font-weight:700;color:${c.color};font-size:13px">${fmtN(qty)} CT</span>
        ${prodChips}
        <span style="font-size:11px;color:#bbb">(${datesStr})</span>
      </div>`;
    }).join('');

    html += `<div style="background:#fff;border:1px solid ${c.border};border-left:4px solid ${c.color};border-radius:8px;margin-bottom:12px;overflow:hidden">
      <div style="background:${c.bg};padding:10px 14px;display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none"
           data-cat="${esc(c.key)}" onclick="ibToggleCat(this.dataset.cat)">
        <span style="font-size:11px;color:${c.color};opacity:0.7;display:inline-block;width:10px">${isExpanded ? '▼' : '▶'}</span>
        <span style="font-weight:700;font-size:14px;color:${c.color}">${c.key}</span>
        <span style="font-size:13px;color:#555">총 <strong style="color:${c.color}">${total.toLocaleString()} CT</strong></span>
        <span style="font-size:11px;color:#aaa">${farmEntries.length}개 농가</span>
      </div>
      <div id="cat-body-${idx}" style="display:${isExpanded ? '' : 'none'}">${farmRows}</div>
    </div>`;
  });

  if (!html) html = '<div style="padding:30px;text-align:center;color:#bbb">미선과 재고 없음</div>';
  el.innerHTML = catToolbar + html;
}

function ibCatToggleAll(keys, allExpanded) {
  if (allExpanded) keys.forEach(k => _catExpanded.delete(k));
  else             keys.forEach(k => _catExpanded.add(k));
  renderIbCatView();
}

// ── 선과 완료 필터 상태
let _doneFilter = { farm:'', product:'', cat:'', dateFrom:'', dateTo:'', sort:'date-desc', view:'list' };

function setDoneFilter(key, val) { _doneFilter[key] = val; renderIbDoneView(); }

function renderIbDoneView() {
  const el = document.getElementById('ib-view-done');
  if (!el) return;

  const pm = _ibProcessedMap();
  const done = inboundRecords.filter(r => {
    if (r.is_void) return false;
    const processed = pm[r.id] || 0;
    return processed > 0 && r.quantity - processed <= 0;
  });

  // 필터 적용
  let filtered = done;
  if (_doneFilter.farm)     filtered = filtered.filter(r => r.farm_name === _doneFilter.farm);
  if (_doneFilter.product)  filtered = filtered.filter(r => r.product   === _doneFilter.product);
  if (_doneFilter.cat)      filtered = filtered.filter(r => (r.inbound_category||'상품') === _doneFilter.cat);
  if (_doneFilter.dateFrom) filtered = filtered.filter(r => r.date >= _doneFilter.dateFrom);
  if (_doneFilter.dateTo)   filtered = filtered.filter(r => r.date <= _doneFilter.dateTo);

  // 정렬
  filtered = [...filtered].sort((a,b) => {
    if (_doneFilter.sort === 'date-asc')  return a.date.localeCompare(b.date);
    if (_doneFilter.sort === 'farm')      return a.farm_name.localeCompare(b.farm_name);
    if (_doneFilter.sort === 'qty-desc')  return b.quantity - a.quantity;
    return b.date.localeCompare(a.date); // date-desc
  });

  // 드롭다운 옵션
  const farmOpts  = [...new Set(done.map(r=>r.farm_name))].sort().map(f=>`<option value="${esc(f)}" ${_doneFilter.farm===f?'selected':''}>${esc(f)}</option>`).join('');
  const prodOpts  = [...new Set(done.map(r=>r.product).filter(Boolean))].sort().map(p=>`<option value="${esc(p)}" ${_doneFilter.product===p?'selected':''}>${esc(p)}</option>`).join('');
  const catOpts   = [...new Set(done.map(r=>r.inbound_category||'상품'))].sort().map(c=>`<option value="${esc(c)}" ${_doneFilter.cat===c?'selected':''}>${esc(c)}</option>`).join('');

  // 요약 통계
  const totalCT   = filtered.reduce((s,r)=>s+r.quantity,0);
  const farmCount = new Set(filtered.map(r=>r.farm_name)).size;

  const SEL = 'padding:5px 8px;border:1px solid var(--border);border-radius:7px;font-family:inherit;font-size:12px;background:#fff';

  // 필터 바
  const filterBar = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;padding:10px 12px;background:#f8f8f8;border-radius:8px;font-size:12px">
      <select style="${SEL}" onchange="setDoneFilter('farm',this.value)"><option value="">농가 전체</option>${farmOpts}</select>
      <select style="${SEL}" onchange="setDoneFilter('product',this.value)"><option value="">품목 전체</option>${prodOpts}</select>
      <select style="${SEL}" onchange="setDoneFilter('cat',this.value)"><option value="">카테고리 전체</option>${catOpts}</select>
      <input type="date" value="${_doneFilter.dateFrom}" style="${SEL}" placeholder="시작일" onchange="setDoneFilter('dateFrom',this.value)">
      <span style="color:#aaa">~</span>
      <input type="date" value="${_doneFilter.dateTo}" style="${SEL}" placeholder="종료일" onchange="setDoneFilter('dateTo',this.value)">
      <select style="${SEL}" onchange="setDoneFilter('sort',this.value)">
        <option value="date-desc" ${_doneFilter.sort==='date-desc'?'selected':''}>입고일 최신순</option>
        <option value="date-asc"  ${_doneFilter.sort==='date-asc' ?'selected':''}>입고일 오래된순</option>
        <option value="farm"      ${_doneFilter.sort==='farm'     ?'selected':''}>농가명순</option>
        <option value="qty-desc"  ${_doneFilter.sort==='qty-desc' ?'selected':''}>수량 많은순</option>
      </select>
      ${(_doneFilter.farm||_doneFilter.product||_doneFilter.cat||_doneFilter.dateFrom||_doneFilter.dateTo)
        ? `<button class="btn" onclick="_doneFilter={..._doneFilter,farm:'',product:'',cat:'',dateFrom:'',dateTo:''};renderIbDoneView()" style="font-size:11px;padding:3px 8px">✕ 초기화</button>` : ''}
      <div style="margin-left:auto;display:flex;gap:4px">
        <button class="btn${_doneFilter.view==='list'?' pri':''}" onclick="setDoneFilter('view','list')" style="font-size:11px;padding:3px 10px">📋 목록</button>
        <button class="btn${_doneFilter.view==='farm'?' pri':''}" onclick="setDoneFilter('view','farm')" style="font-size:11px;padding:3px 10px">👨‍🌾 농가별</button>
      </div>
    </div>`;

  // 요약 카드
  const summaryCard = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      ${[['✅ 완료 건수', filtered.length+'건', '#E8F5E9','#2E7D32'],
         ['📦 총 입고량', totalCT.toLocaleString()+' CT','#E3F2FD','#1565C0'],
         ['👨‍🌾 농가 수', farmCount+'개','#FFF3E0','#E65100']].map(([lbl,val,bg,col])=>`
        <div style="background:${bg};border-radius:8px;padding:10px 16px;flex:1;min-width:100px;text-align:center">
          <div style="font-size:11px;color:${col};font-weight:600;margin-bottom:3px">${lbl}</div>
          <div style="font-size:17px;font-weight:800;color:${col}">${val}</div>
        </div>`).join('')}
    </div>`;

  // 콘텐츠: 목록 또는 농가별
  let content = '';
  if (!filtered.length) {
    content = '<div style="padding:30px;text-align:center;color:#bbb">선과 완료 데이터 없음</div>';
  } else if (_doneFilter.view === 'farm') {
    // 농가별 카드
    const farmMap = {};
    filtered.forEach(r => {
      if (!farmMap[r.farm_name]) farmMap[r.farm_name] = { rows:[], totalCT:0, products:[] };
      const f = farmMap[r.farm_name];
      f.rows.push(r);
      f.totalCT += r.quantity;
      if (r.product && !f.products.includes(r.product)) f.products.push(r.product);
    });
    content = Object.entries(farmMap).sort((a,b)=>b[1].totalCT-a[1].totalCT).map(([farm,{rows,totalCT,products}])=>{
      const rowsHtml = [...rows].sort((a,b)=>b.date.localeCompare(a.date)).map(r=>{
        const qInline = qualityInline(r)||'';
        const loc = r.location?`<span style="font-size:11px;color:#888">📍${esc(r.location)}</span>`:'';
        return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:5px 14px 5px 24px;border-bottom:1px solid #f5f5f5;font-size:12px">
          <span style="color:#aaa;font-size:10px">${r.date}</span>
          ${productChip(r.product)}
          <span style="font-weight:700;color:#2E7D32">${fmtN(r.quantity)} CT</span>
          ${categoryBadge(r.inbound_category,r.reclassification_source,r.reclassification_reason,r.original_work_date)}
          ${loc}${qInline}
        </div>`;
      }).join('');
      return `<div style="background:#fff;border:1px solid #e8e8e8;border-left:4px solid #4CAF50;border-radius:8px;margin-bottom:8px;overflow:hidden">
        <div style="display:flex;align-items:center;gap:8px;padding:9px 14px;background:#F1F8E9;flex-wrap:wrap">
          <span style="font-size:14px">✅</span>
          <span style="font-weight:700;font-size:14px;color:#222">${esc(farm)}</span>
          ${products.map(p=>productChip(p)).join('')}
          <span style="font-weight:700;color:#2E7D32;margin-left:auto">${totalCT.toLocaleString()} CT · ${rows.length}건</span>
        </div>
        <div>${rowsHtml}</div>
      </div>`;
    }).join('');
  } else {
    // 목록 테이블
    const TH = 'background:#f5f5f5;padding:7px 10px;font-size:11px;font-weight:700;color:var(--text-secondary);white-space:nowrap;text-align:left';
    const TD = 'padding:7px 10px;font-size:13px;border-bottom:1px solid #f5f5f5;vertical-align:middle';
    const rows = filtered.map(r=>{
      const qInline = qualityInline(r)||'<span style="color:#e0e0e0;font-size:12px">—</span>';
      const loc = r.location ? esc(r.location) : '<span style="color:#ccc">-</span>';
      return `<tr>
        <td style="${TD}">${r.date}</td>
        <td style="${TD}">${esc(r.farm_name)}</td>
        <td style="${TD}">${productChip(r.product)}</td>
        <td style="${TD}">${categoryBadge(r.inbound_category,r.reclassification_source,r.reclassification_reason,r.original_work_date)}</td>
        <td style="${TD};text-align:right;font-weight:700;color:#2E7D32">${fmtN(r.quantity)}</td>
        <td style="${TD}">${loc}</td>
        <td style="${TD}">${qInline}</td>
      </tr>`;
    }).join('');
    content = `<div class="tbl-wrap"><table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="${TH}">날짜</th><th style="${TH}">농가명</th><th style="${TH}">품목</th>
        <th style="${TH}">카테고리</th><th style="${TH};text-align:right">입고량(CT)</th>
        <th style="${TH}">위치</th><th style="${TH}">품질</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  el.innerHTML = filterBar + summaryCard + content;
}

function renderIbCatSummary() {
  const catEl = document.getElementById('ib-cat-summary');
  const priEl = document.getElementById('ib-priority-alert');
  if (!catEl) return;

  const processedByInbound = {};
  processingRecords.forEach(r => {
    processedByInbound[r.inbound_id] = (processedByInbound[r.inbound_id] || 0) + r.quantity;
  });

  const active = inboundRecords.filter(r => !r.is_void && !r.exclude_from_unsorted);

  // (카테고리, 품목, 출처) 조합별 집계
  const catTotals = {};
  const catProducts = {};   // cat → { product → qty }
  const catSources  = {};   // cat → { source → qty }  (재선별 전용)
  let grandTotal = 0;
  IB_CATS.forEach(c => { catTotals[c.key] = 0; catProducts[c.key] = {}; catSources[c.key] = {}; });
  active.forEach(r => {
    const remaining = r.quantity - (processedByInbound[r.id] || 0);
    if (remaining <= 0) return;
    const cat = r.inbound_category || '상품';
    if (catTotals[cat] !== undefined) {
      catTotals[cat] += remaining;
      catProducts[cat][r.product] = (catProducts[cat][r.product] || 0) + remaining;
      if (cat === '재선별') {
        const src = r.reclassification_source || '미지정';
        catSources[cat][src] = (catSources[cat][src] || 0) + remaining;
      }
    }
    grandTotal += remaining;
  });

  const _catProductChip = (product, qty) => {
    const itemCat = _getCatForProduct(product);
    const isCount = !itemCat || itemCat.classification_type === 'count';
    const icon  = isCount ? '🍊' : '🍋';
    const color = isCount ? '#C05800' : '#2E7D32';
    return `<span style="font-size:11px;color:${color};white-space:nowrap">${icon} ${esc(product)} <strong>${fmtN(qty)}</strong></span>`;
  };

  const SRC_LABELS = { '신규입고': '신규', '선과결과': '선과', '포장라인': '포장', '반품': '반품', '기타': '기타', '미지정': '-' };

  catEl.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:8px">
      ${IB_CATS.map(c => {
        const prods = Object.entries(catProducts[c.key])
          .filter(([, q]) => q > 0)
          .sort(([, a], [, b]) => b - a);
        const prodLine = prods.length
          ? `<div style="border-top:1px solid ${c.border};margin-top:7px;padding-top:6px;display:flex;flex-direction:column;gap:3px;text-align:left">
              ${prods.map(([p, q]) => _catProductChip(p, q)).join('')}
             </div>`
          : '';
        const srcLine = (c.key === '재선별' && Object.keys(catSources[c.key]).length)
          ? `<div style="border-top:1px solid ${c.border};margin-top:6px;padding-top:5px;display:flex;flex-direction:column;gap:2px;text-align:left">
              ${Object.entries(catSources[c.key])
                .filter(([, q]) => q > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([s, q]) => `<span style="font-size:10px;color:${c.color};white-space:nowrap">${SRC_LABELS[s] || esc(s)}: <strong>${q}</strong></span>`)
                .join('')}
             </div>`
          : '';
        return `
        <div style="background:${c.bg};border:1px solid ${c.border};border-radius:10px;padding:10px 8px">
          <div style="text-align:center">
            <div style="font-size:11px;font-weight:700;color:${c.color};margin-bottom:4px">${c.key}</div>
            <div style="font-size:18px;font-weight:800;color:${c.color};line-height:1.1">${catTotals[c.key].toLocaleString()}</div>
            <div style="font-size:10px;color:#aaa;margin-top:2px">CT</div>
          </div>
          ${prodLine}
          ${srcLine}
        </div>`;
      }).join('')}
    </div>
    <div style="text-align:right;font-size:12px;color:var(--text-secondary);margin-bottom:12px">
      전체 미선과 재고: <strong style="color:var(--text)">${grandTotal.toLocaleString()} CT</strong>
    </div>`;

  if (!priEl) return;
  const priList = active
    .filter(r => r.is_priority)
    .map(r => ({ ...r, remaining: r.quantity - (processedByInbound[r.id] || 0) }))
    .filter(r => r.remaining > 0);

  if (!priList.length) { priEl.innerHTML = ''; return; }

  const _today = new Date(); _today.setHours(0,0,0,0);
  const _daysSince = ds => Math.floor((_today - new Date(ds)) / 86400000);
  const _urgLevel  = d  => d >= 21 ? 'high' : d >= 14 ? 'mid' : 'low';
  const _URG = {
    high: { label: '🔴 매우 시급 (3주+)', col: '#991B1B' },
    mid:  { label: '🟡 시급 (2~3주)',     col: '#92400E' },
    low:  { label: '🟢 일반 (2주 미만)',   col: '#14532D' },
  };
  const _GSCORE = { '상':3, '중':2, '하':1 };
  const _GBACK  = [null,'하','중','상'];
  const _avgGrade = (rows, field) => {
    const valid = rows.filter(r => r[field]);
    if (!valid.length) return null;
    return _GBACK[Math.round(valid.reduce((s,r) => s+(_GSCORE[r[field]]||0), 0) / valid.length)] || null;
  };
  const _GCOL = { '상':'#059669', '중':'#D97706', '하':'#DC2626' };
  const _gChip = (label, g) => g
    ? `<span style="font-size:10px;color:#888">${label}</span><span style="color:${_GCOL[g]};font-weight:700;font-size:11px">${g}</span>`
    : '';

  // 농가별 그룹화
  const _farmMap = {};
  priList.forEach(r => {
    if (!_farmMap[r.farm_name]) _farmMap[r.farm_name] = { rows:[], totalCT:0, oldestDate:r.date, products:[] };
    const f = _farmMap[r.farm_name];
    f.rows.push(r);
    f.totalCT += r.remaining;
    if (r.date < f.oldestDate) f.oldestDate = r.date;
    if (r.product && !f.products.includes(r.product)) f.products.push(r.product);
  });

  // 정렬: 가장 오래된 입고일 → 총 CT 내림차순
  const _farmEntries = Object.entries(_farmMap).sort(([,a],[,b]) =>
    a.oldestDate !== b.oldestDate ? a.oldestDate.localeCompare(b.oldestDate) : b.totalCT - a.totalCT
  );

  const totalPriCT = priList.reduce((s,r) => s+r.remaining, 0);

  const _cards = _farmEntries.map(([farm, { rows, totalCT, oldestDate, products }], fi) => {
    const cardId = `pri-card-${fi}`;

    // 시급도 분류
    const buckets = { high:[], mid:[], low:[] };
    rows.forEach(r => { const d = _daysSince(r.date); buckets[_urgLevel(d)].push({...r, days:d}); });

    const urgRows = ['high','mid','low'].filter(k => buckets[k].length).map(k => {
      const b = buckets[k]; const u = _URG[k];
      const ct = b.reduce((s,r) => s+r.remaining, 0);
      return `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px">
        <span style="color:${u.col};font-weight:600;min-width:140px">${u.label}</span>
        <span style="color:#555">${ct.toLocaleString()} CT · ${b.length}건</span>
      </div>`;
    }).join('');

    // 위치 요약
    const locMap = {};
    rows.forEach(r => { if (r.location) locMap[r.location] = (locMap[r.location]||0)+1; });
    const locStr = Object.entries(locMap).length
      ? Object.entries(locMap).sort((a,b)=>b[1]-a[1]).map(([l,n]) => n>1?`${esc(l)} (${n}건)`:esc(l)).join(', ')
      : '-';

    // 평균 품질
    const bg  = _avgGrade(rows,'brix_grade');
    const ag  = _avgGrade(rows,'acidity_grade');
    const apg = _avgGrade(rows,'appearance_grade');
    const qualStr = [_gChip('당',bg),_gChip('산',ag),_gChip('외',apg)].filter(Boolean).join('&ensp;');

    // 경과일
    const oldDays = _daysSince(oldestDate);
    const oldCol  = oldDays >= 21 ? '#991B1B' : oldDays >= 14 ? '#92400E' : '#14532D';

    // 왼쪽 보더 색
    const bdrCol = buckets.high.length ? '#F87171' : buckets.mid.length ? '#FBBF24' : '#86EFAC';

    // 펼침 상세 rows
    const detailHtml = ['high','mid','low'].filter(k=>buckets[k].length).map(k => {
      const u = _URG[k];
      const rowsHtml = buckets[k].sort((a,b)=>a.date.localeCompare(b.date)).map(r => {
        const qInline = qualityInline(r) || '';
        const locBit  = r.location ? `<span style="color:#888;font-size:10px">📍${esc(r.location)}</span>` : '';
        const daysCol = r.days >= 21 ? '#991B1B' : r.days >= 14 ? '#92400E' : '#14532D';
        return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:4px 0 4px 8px;border-bottom:1px solid #f5f5f5;font-size:12px">
          <span style="color:#aaa;font-size:10px">${r.date.slice(5)}</span>
          ${productChip(r.product)}
          <span style="font-weight:700;color:#333">${fmtN(r.remaining)}CT</span>
          <span style="color:${daysCol};font-size:10px">(${r.days}일)</span>
          ${locBit}${qInline}
        </div>`;
      }).join('');
      return `<div style="margin-bottom:6px">
        <div style="font-size:11px;font-weight:700;color:${u.col};margin:6px 0 2px">${u.label}</div>
        ${rowsHtml}
      </div>`;
    }).join('');

    return `<div style="background:#fff;border:1px solid #e8e8e8;border-left:4px solid ${bdrCol};border-radius:8px;margin-bottom:8px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:9px 14px;background:#fafafa;flex-wrap:wrap">
        <span style="font-size:14px">⚠️</span>
        <span style="font-weight:700;font-size:14px;color:#222">${esc(farm)}</span>
        ${products.map(p=>productChip(p)).join('')}
        <span style="font-weight:700;color:#1565C0;margin-left:auto;font-size:13px">${totalCT.toLocaleString()} CT</span>
      </div>
      <div style="padding:8px 14px 4px">
        ${urgRows}
        <div style="margin-top:6px;font-size:12px;color:#555;display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <span>📍 ${locStr}</span>
          ${qualStr ? `<span style="display:flex;gap:3px;align-items:center">📊&ensp;${qualStr}</span>` : ''}
          <span style="color:${oldCol}">⏰ ${oldestDate} <strong>(${oldDays}일 경과)</strong></span>
        </div>
      </div>
      <div style="padding:4px 14px 8px">
        <button onclick="togglePriDetail('${cardId}')" id="${cardId}-btn"
          style="font-size:12px;color:#1565C0;background:none;border:none;cursor:pointer;padding:4px 0">
          ▼ ${rows.length}건 모두 보기
        </button>
        <div id="${cardId}" style="display:none;margin-top:4px">${detailHtml}</div>
      </div>
    </div>`;
  }).join('');

  priEl.innerHTML = `<div style="margin-bottom:12px">
    <div onclick="togglePriSection()" id="pri-section-hdr"
      style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#FFF5F5;border:1px solid #FECACA;border-radius:8px;cursor:pointer;user-select:none;margin-bottom:0">
      <span id="pri-section-arrow" style="font-size:11px;color:#C62828;transition:transform .2s">▶</span>
      <span style="font-size:13px;font-weight:700;color:#C62828">⚠️ 우선 처리 필요</span>
      <span style="font-size:12px;color:#888">${_farmEntries.length}개 농가 · ${priList.length}건 · 총 ${totalPriCT.toLocaleString()} CT</span>
    </div>
    <div id="pri-section-body" style="display:none;margin-top:8px">
      ${_cards}
    </div>
  </div>`;
}

function togglePriSection() {
  const body  = document.getElementById('pri-section-body');
  const arrow = document.getElementById('pri-section-arrow');
  if (!body) return;
  const open = body.style.display === 'none';
  body.style.display = open ? '' : 'none';
  if (arrow) arrow.textContent = open ? '▼' : '▶';
}

function togglePriDetail(id) {
  const el  = document.getElementById(id);
  const btn = document.getElementById(id + '-btn');
  if (!el) return;
  const open = el.style.display === 'none';
  el.style.display  = open ? 'block' : 'none';
  if (btn) btn.textContent = open ? '▲ 접기' : `▼ ${el.querySelectorAll('[style*="border-bottom"]').length}건 모두 보기`;
}

function renderInboundList() {
  _expandedMemoId = null;
  renderIbCatSummary();

  // void count는 뷰 모드 무관하게 항상 업데이트
  const voidCount = inboundRecords.filter(r => r.is_void).length;
  const voidCountEl = document.getElementById('ib-void-count');
  if (voidCountEl) voidCountEl.textContent = voidCount > 0 ? `(무효 ${voidCount}건)` : '';

  // 분산저장 마이그레이션 버튼: 레거시 분산 기록이 있을 때만 표시
  const migrateBtn = document.getElementById('btn-dist-migrate');
  if (migrateBtn) {
    const hasMigratable = inboundRecords.some(r => !r.is_void && r.location && r.location.includes('/') && !r.distribution_group_id && !r._legacy);
    migrateBtn.style.display = hasMigratable ? '' : 'none';
  }

  // 농가별/카테고리별/선과완료 뷰 모드면 해당 함수에 위임
  if (ibViewMode === 'farm') { renderIbFarmView(); return; }
  if (ibViewMode === 'cat')  { renderIbCatView();  return; }
  if (ibViewMode === 'done') { renderIbDoneView(); return; }

  const tbody = document.getElementById('ib-tb');
  if (!tbody) return;
  const isAdm = sessionStorage.getItem('citrus_role') === 'admin';

  let visible = showVoidData ? inboundRecords : inboundRecords.filter(r => !r.is_void);

  // 카테고리·출처 필터 적용
  if (ibFilterCat) visible = visible.filter(r => (r.inbound_category || '상품') === ibFilterCat);
  if (ibFilterCat === '재선별' && ibFilterSrc) visible = visible.filter(r => (r.reclassification_source || '') === ibFilterSrc);

  // 농가명 검색 필터
  if (ibSearch) {
    const q = ibSearch.toLowerCase();
    visible = visible.filter(r => (r.farm_name || '').toLowerCase().includes(q));
  }

  // 필터 카운트 업데이트
  const fcountEl = document.getElementById('ib-filter-count');
  if (fcountEl) fcountEl.textContent = (ibFilterCat || ibSearch) ? `${visible.length}건 표시 중` : '';

  // 버튼 활성 상태 동기화 (뷰 전환 후에도 유지)
  _updateIbFilterBtns();
  _updateIbSortIcons();

  if (!visible.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">${
      ibFilterCat ? `'${ibFilterCat}' 카테고리 입고 기록 없음` :
      ibSearch ? `'${esc(ibSearch)}' 검색 결과 없음` :
      !inboundRecords.length ? '입고 기록 없음' : '표시할 입고 기록 없음 (무효 데이터 숨김)'
    }</td></tr>`;
    document.getElementById('ib-pagination') && (document.getElementById('ib-pagination').innerHTML = '');
    return;
  }

  // 정렬 적용
  visible = _applyIbSort(visible);

  // 페이지네이션 계산
  const totalFiltered = visible.length;
  const pageSize = ibPageSize === Infinity ? totalFiltered : ibPageSize;
  const totalPages = Math.ceil(totalFiltered / pageSize);
  if (ibPage > totalPages) ibPage = totalPages;
  const startIdx = (ibPage - 1) * pageSize;
  const pageRows = ibPageSize === Infinity ? visible : visible.slice(startIdx, startIdx + pageSize);

  const IS = 'width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:13px;box-sizing:border-box';
  const hasLegacy = pageRows.some(r => r._legacy);
  tbody.innerHTML = (hasLegacy ? [`<tr><td colspan="9" style="background:#FFF8E1;color:#E65100;font-size:12px;padding:6px 10px;text-align:center">
    ⚠️ 아래는 기존 데이터(inventory_unsorted)입니다. Supabase에서 마이그레이션 SQL을 실행하면 수정/삭제 기능이 활성화됩니다.
  </td></tr>`] : []).concat(pageRows.map(r => {
    if (r.is_void) {
      const voidTime = r.void_at ? r.void_at.replace('T', ' ').slice(0, 16) : '';
      const voidTip = `사유: ${r.void_reason || '-'}${voidTime ? '\n처리일: ' + voidTime : ''}`;
      const voidBadge = `<span title="${esc(voidTip)}" style="background:#ef5350;color:#fff;font-size:10px;padding:1px 5px;border-radius:4px;font-weight:700;cursor:help;white-space:nowrap;display:inline-block;margin-left:4px;vertical-align:middle">🚫</span>`;
      const voidMenuItems = isAdm && !r._legacy
        ? `<button onclick="restoreInbound('${r.id}')">🔄 무효 해제 (복원)</button>
           <button onclick="openRecordHistory('${r.id}')">📜 변경 이력</button>
           <div class="menu-divider"></div>
           <button onclick="permanentDeleteInbound('${r.id}')" class="menu-danger">🗑️ 영구 삭제</button>`
        : `<button onclick="openRecordHistory('${r.id}')">📜 변경 이력</button>`;
      const voidActionCell = `<div style="position:relative;text-align:center">
        <button class="menu-trigger" onclick="toggleRowMenu('${r.id}',event)">⋮</button>
        <div id="row-menu-${r.id}" class="row-menu" style="display:none">${voidMenuItems}</div>
      </div>`;
      const td = 'text-decoration:line-through;color:#999';
      return `<tr id="ib-tr-${r.id}" style="opacity:0.55;background:#f5f5f5">
        <td style="${td}">${r.date}</td>
        <td class="nm" title="${esc(r.farm_name)}"><span style="display:inline-block;width:16px"></span> ${esc(r.farm_name)}${voidBadge}</td>
        <td style="${td}">${esc(r.product)}</td>
        <td style="color:#999">-</td>
        <td style="text-align:right;${td}">${fmtN(r.quantity)}</td>
        <td style="${td}">${esc(r.location || '-')}</td>
        <td style="color:#999">—</td>
        <td></td>
        <td>${voidActionCell}</td>
      </tr>`;
    }
    const processed = getProcessedForInbound(r.id);
    const remaining = r.quantity - processed;
    const qtyTitle = processed > 0 ? `입고 ${fmtN(r.quantity)}CT · 처리 ${fmtN(processed)}CT · 잔여 ${fmtN(remaining)}CT` : `입고 ${fmtN(r.quantity)}CT`;
    const remBadge = remaining <= 0
      ? `<span style="background:#E8F5E9;color:#2E7D32;font-size:10px;padding:1px 5px;border-radius:4px;font-weight:700;white-space:nowrap;display:inline-block;margin-top:2px">✓ 완료</span>`
      : `<span style="${remaining < 20 ? 'color:#C62828;font-weight:700' : 'color:#E65100;font-weight:700'}">잔 ${fmtN(remaining)}</span>`;
    const qtyDisplay = processed > 0
      ? `<span title="${qtyTitle}" style="cursor:default;display:inline-block">${fmtN(r.quantity)}<br>${remBadge}</span>`
      : `<span title="${qtyTitle}" style="cursor:default">${fmtN(r.quantity)}</span>`;
    const priorityStyle = r.is_priority ? 'background:#FFFDE7' : '';
    const qInline = qualityInline(r);
    const gradeCell = qInline || '<span style="color:#e0e0e0;font-size:12px">—</span>';
    const memoCell = r.note
      ? `<button class="memo-icon-btn" onclick="toggleMemo('${r.id}')" title="${esc(r.note)}">📝</button>`
      : `<span style="color:#D1D5DB">-</span>`;
    const menuItems = isAdm && !r._legacy
      ? `<button onclick="editInboundRow('${r.id}')">✏️ 수정</button>
         ${remaining > 0 ? `<button onclick="openMoveModal('${r.id}')">🚚 위치 이동</button>` : ''}
         <button onclick="openQualityModal('${r.id}')">📋 품질 상세</button>
         <button onclick="openRecordHistory('${r.id}')">📜 변경 이력</button>
         <div class="menu-divider"></div>
         <button onclick="deleteInbound('${r.id}')" class="menu-danger">🗑️ 삭제</button>`
      : r._legacy
        ? '<span style="padding:6px 12px;font-size:12px;color:#bbb;display:block">마이그레이션 필요</span>'
        : `<button onclick="openRecordHistory('${r.id}')">📜 변경 이력</button>`;
    const actionCell = `<div style="position:relative;text-align:center">
      <button class="menu-trigger" onclick="toggleRowMenu('${r.id}',event)">⋮</button>
      <div id="row-menu-${r.id}" class="row-menu" style="display:none">${menuItems}</div>
    </div>`;
    const locCell = r.distribution_group_id
      ? `<span title="${esc(getDistGroupTooltip(r.distribution_group_id))}" style="cursor:help;white-space:nowrap">📦 ${esc(r.location || '-')}</span>`
      : esc(r.location || '-');
    return `<tr id="ib-tr-${r.id}" style="${priorityStyle}">
      <td>${r.date}</td>
      <td class="nm" title="${esc(r.farm_name)}"><span style="display:inline-block;width:16px;text-align:center;font-size:12px">${r.is_priority ? '⭐' : ''}</span> ${esc(r.farm_name)}</td>
      <td>${productChip(r.product)}</td>
      <td>${categoryBadge(r.inbound_category, r.reclassification_source, r.reclassification_reason, r.original_work_date)}</td>
      <td style="text-align:right">${qtyDisplay}</td>
      <td title="${esc(r.location || '')}">${locCell}</td>
      <td>${gradeCell}</td>
      <td>${memoCell}</td>
      <td>${actionCell}</td>
    </tr>`;
  })).join('');
  _renderIbPagination(totalFiltered);
}

function renderProcessingTab() {
  const sel = document.getElementById('proc-inbound');
  if (sel) {
    const active = inboundRecords.filter(r => !r.is_void && r.quantity - getProcessedForInbound(r.id) > 0);
    sel.innerHTML = '<option value="">선택</option>' + active.map(r => {
      const rem = r.quantity - getProcessedForInbound(r.id);
      return `<option value="${r.id}">${esc(r.product)} | ${esc(r.farm_name)} | ${r.date} (${fmtN(rem)}CT 남음)</option>`;
    }).join('');
  }
  const tbody = document.getElementById('proc-tb');
  if (!tbody) return;
  const isAdm = sessionStorage.getItem('citrus_role') === 'admin';
  if (!processingRecords.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">처리 기록 없음</td></tr>';
    return;
  }
  tbody.innerHTML = processingRecords.map(pr => {
    const ib = inboundRecords.find(r => r.id === pr.inbound_id);
    const ibLabel = ib ? `${esc(ib.product)} / ${esc(ib.farm_name)} <small style="color:var(--text-secondary)">${ib.date}</small>` : '(삭제된 입고)';
    return `<tr id="proc-tr-${pr.id}">
      <td>${pr.date}</td>
      <td style="white-space:normal">${ibLabel}</td>
      <td>${esc(pr.process_type)}</td>
      <td style="text-align:right;font-weight:700">${pr.quantity}</td>
      <td style="white-space:normal;min-width:80px">${esc(pr.note || '-')}</td>
      <td>${isAdm ? `<button class="btn sm del" onclick="deleteProcessing('${pr.id}')">삭제</button>` : ''}</td>
    </tr>`;
  }).join('');
}

let _editInboundId = null;

function editInboundRow(id) {
  const r = inboundRecords.find(x => x.id === id);
  if (!r) return;
  _editInboundId = id;
  const processed = getProcessedForInbound(id);

  document.getElementById('eib-m-date').value = r.date || '';
  document.getElementById('eib-m-product').value = r.product || '';
  document.getElementById('eib-m-farm').value = r.farm_name || '';
  setLocValue('eib', r.location || '');
  document.getElementById('eib-m-qty').value = r.quantity || '';
  document.getElementById('eib-m-qty').min = processed || 1;
  const hint = document.getElementById('eib-m-qty-hint');
  if (processed > 0) { hint.textContent = `이미 ${fmtN(processed)}CT 처리됨 — ${fmtN(processed)}CT 미만으로 줄일 수 없습니다`; hint.style.display = ''; }
  else hint.style.display = 'none';
  document.getElementById('eib-m-cat').value = r.inbound_category || '상품';
  setGradeVal('eib-m-brix-grade', r.brix_grade || null);
  setGradeVal('eib-m-acid-grade', r.acidity_grade || null);
  setGradeVal('eib-m-appearance-grade', r.appearance_grade || null);
  setDefectTags('eib-m-defect-wrap', r.defect_tags || null);
  document.getElementById('eib-m-brix-range').value = r.brix_range || '';
  document.getElementById('eib-m-acid-range').value = r.acidity_range || '';
  document.getElementById('eib-m-size').value = r.size_distribution || '';
  document.getElementById('eib-m-note').value = r.note || '';
  document.getElementById('eib-m-priority').checked = !!r.is_priority;
  document.getElementById('eib-m-reason').value = '';

  // 재선별 필드 복원
  const reclassSec = document.getElementById('eib-reclass-section');
  const isReclass = (r.inbound_category === '재선별');
  if (reclassSec) reclassSec.style.display = isReclass ? '' : 'none';
  const srcEl = document.getElementById('eib-reclass-src');
  if (srcEl) srcEl.value = r.reclassification_source || '';
  const reasonEl = document.getElementById('eib-reclass-reason');
  if (reasonEl) reasonEl.value = r.reclassification_reason || '';
  const dateEl = document.getElementById('eib-reclass-date');
  if (dateEl) dateEl.value = r.original_work_date || '';
  syncReclassList('eib');

  document.getElementById('modal-edit-inbound').style.display = 'flex';
}

function closeEditInboundModal() {
  const reason = document.getElementById('eib-m-reason')?.value || '';
  const r = inboundRecords.find(x => x.id === _editInboundId);
  if (r) {
    const changed =
      document.getElementById('eib-m-date').value !== (r.date || '') ||
      document.getElementById('eib-m-qty').value !== String(r.quantity) ||
      getLocValue('eib') !== (r.location || null) ||
      document.getElementById('eib-m-note').value !== (r.note || '') ||
      document.getElementById('eib-m-cat').value !== (r.inbound_category || '상품') ||
      getGradeVal('eib-m-brix-grade') !== (r.brix_grade || null) ||
      getGradeVal('eib-m-acid-grade') !== (r.acidity_grade || null) ||
      getGradeVal('eib-m-appearance-grade') !== (r.appearance_grade || null) ||
      getDefectTags('eib-m-defect-wrap') !== (r.defect_tags || null) ||
      document.getElementById('eib-m-brix-range').value !== (r.brix_range || '') ||
      document.getElementById('eib-m-acid-range').value !== (r.acidity_range || '') ||
      document.getElementById('eib-m-size').value !== (r.size_distribution || '') ||
      document.getElementById('eib-m-priority').checked !== !!r.is_priority ||
      (document.getElementById('eib-reclass-src')?.value || '') !== (r.reclassification_source || '') ||
      (document.getElementById('eib-reclass-reason')?.value || '') !== (r.reclassification_reason || '') ||
      (document.getElementById('eib-reclass-date')?.value || '') !== (r.original_work_date || '');
    if (changed && !confirm('변경사항이 있습니다. 취소할까요?')) return;
  }
  document.getElementById('modal-edit-inbound').style.display = 'none';
  _editInboundId = null;
}

async function saveInboundModal() {
  const id = _editInboundId;
  if (!id) return;
  const date = document.getElementById('eib-m-date').value;
  const qty = parseInt(document.getElementById('eib-m-qty').value) || 0;
  const location = getLocValue('eib') || null;
  const note = document.getElementById('eib-m-note').value.trim() || null;
  const inbound_category = document.getElementById('eib-m-cat').value || '상품';
  const brix_grade = getGradeVal('eib-m-brix-grade');
  const acidity_grade = getGradeVal('eib-m-acid-grade');
  const appearance_grade = getGradeVal('eib-m-appearance-grade');
  const defect_tags = getDefectTags('eib-m-defect-wrap');
  const brix_range = document.getElementById('eib-m-brix-range').value.trim() || null;
  const acidity_range = document.getElementById('eib-m-acid-range').value.trim() || null;
  const size_distribution = document.getElementById('eib-m-size').value.trim() || null;
  const is_priority = document.getElementById('eib-m-priority').checked;
  const reason = document.getElementById('eib-m-reason').value.trim();
  const isReclass = inbound_category === '재선별';
  const reclassification_source = isReclass ? (document.getElementById('eib-reclass-src')?.value || null) : null;
  const reclassification_reason = isReclass ? (document.getElementById('eib-reclass-reason')?.value.trim() || null) : null;
  const original_work_date = isReclass ? (document.getElementById('eib-reclass-date')?.value || null) : null;

  if (!date || !qty) return alert('날짜와 수량은 필수입니다.');

  const prev = inboundRecords.find(r => r.id === id);
  const changed =
    date !== (prev.date || '') ||
    qty !== prev.quantity ||
    location !== (prev.location || null) ||
    note !== (prev.note || null) ||
    inbound_category !== (prev.inbound_category || '상품') ||
    brix_grade !== (prev.brix_grade || null) ||
    acidity_grade !== (prev.acidity_grade || null) ||
    appearance_grade !== (prev.appearance_grade || null) ||
    defect_tags !== (prev.defect_tags || null) ||
    brix_range !== (prev.brix_range || null) ||
    acidity_range !== (prev.acidity_range || null) ||
    size_distribution !== (prev.size_distribution || null) ||
    is_priority !== !!prev.is_priority ||
    reclassification_source !== (prev.reclassification_source || null) ||
    reclassification_reason !== (prev.reclassification_reason || null) ||
    original_work_date !== (prev.original_work_date || null);

  if (changed && !reason) return alert('변경사항이 있습니다. 수정 사유를 입력해주세요.');

  const processed = getProcessedForInbound(id);
  if (qty < processed) return alert(`이미 ${fmtN(processed)}CT가 처리되었습니다. ${fmtN(processed)}CT 미만으로 줄일 수 없습니다.`);

  const updatePayload = {
    date, quantity: qty, location, note, inbound_category, is_priority,
    brix_grade, acidity_grade, appearance_grade, defect_tags,
    brix_range, acidity_range, size_distribution,
    reclassification_source, reclassification_reason, original_work_date,
  };
  try {
    await dbUpdateInbound(id, updatePayload);
    if (changed) {
      await dbInsertAuditLog({
        target_table: 'inbound_records', target_id: id,
        before_val: { date: prev.date, quantity: prev.quantity, location: prev.location, note: prev.note,
          inbound_category: prev.inbound_category, is_priority: prev.is_priority,
          brix_grade: prev.brix_grade, acidity_grade: prev.acidity_grade, appearance_grade: prev.appearance_grade, defect_tags: prev.defect_tags,
          brix_range: prev.brix_range, acidity_range: prev.acidity_range, size_distribution: prev.size_distribution,
          reclassification_source: prev.reclassification_source, reclassification_reason: prev.reclassification_reason, original_work_date: prev.original_work_date },
        after_val: { date, quantity: qty, location, note, inbound_category, is_priority,
          brix_grade, acidity_grade, appearance_grade, defect_tags,
          brix_range, acidity_range, size_distribution,
          reclassification_source, reclassification_reason, original_work_date },
        reason, staff: 'admin'
      });
    }
    const idx = inboundRecords.findIndex(r => r.id === id);
    if (idx !== -1) inboundRecords[idx] = { ...inboundRecords[idx],
      date, quantity: qty, location, note, inbound_category, is_priority,
      brix_grade, acidity_grade, appearance_grade, defect_tags,
      brix_range, acidity_range, size_distribution,
      reclassification_source, reclassification_reason, original_work_date };
    document.getElementById('modal-edit-inbound').style.display = 'none';
    _editInboundId = null;
    renderInvSummary(); renderInboundList();
    showToast('입고 기록이 수정되었습니다.');
  } catch(e) { alert('수정 오류: ' + e.message); }
}

async function deleteInbound(id) {
  if (sessionStorage.getItem('citrus_role') !== 'admin') return;
  const processed = getProcessedForInbound(id);
  if (processed > 0) { showVoidModal(id); return; }
  if (!confirm('이 입고 기록을 삭제하시겠습니까?')) return;
  try {
    await dbDeleteInbound(id);
    inboundRecords = inboundRecords.filter(r => r.id !== id);
    renderInvSummary(); renderInboundList();
  } catch(e) { alert('삭제 오류: ' + e.message); }
}

function toggleVoidData() {
  showVoidData = document.getElementById('ib-show-void').checked;
  renderInboundList();
}

function showVoidModal(id) {
  _voidTargetId = id;
  const r = inboundRecords.find(x => x.id === id);
  if (!r) return;
  const processed = getProcessedForInbound(id);
  const remaining = r.quantity - processed;
  document.getElementById('void-modal-info').innerHTML =
    `<strong>${esc(r.farm_name)}</strong> · ${esc(r.product)} · ${r.date}<br>` +
    `입고 <strong>${fmtN(r.quantity)}CT</strong> / 처리됨 <strong style="color:#E65100">${fmtN(processed)}CT</strong> / 남은재고 ${fmtN(remaining)}CT`;
  document.getElementById('void-reason').value = '';
  document.getElementById('void-opt-void').checked = true;
  document.getElementById('modal-void-inbound').style.display = 'flex';
}

async function confirmVoidAction() {
  const id = _voidTargetId;
  if (!id) return;
  const action = document.querySelector('input[name="void-action"]:checked')?.value;
  const reason = (document.getElementById('void-reason').value || '').trim();
  if (!reason) return alert('사유를 입력해주세요.');
  CM('void-inbound');
  if (action === 'void') {
    await voidInbound(id, reason);
  } else if (action === 'force') {
    await forceDeleteInbound(id, reason);
  }
}

async function voidInbound(id, reason) {
  try {
    const now = new Date().toISOString();
    await dbUpdateInbound(id, { is_void: true, void_reason: reason, void_at: now, void_by: 'admin' });
    await dbInsertAuditLog({
      target_table: 'inbound_records', target_id: id,
      before_val: { is_void: false }, after_val: { is_void: true, void_reason: reason },
      reason, staff: 'admin'
    });
    const idx = inboundRecords.findIndex(r => r.id === id);
    if (idx !== -1) inboundRecords[idx] = { ...inboundRecords[idx], is_void: true, void_reason: reason, void_at: now, void_by: 'admin' };
    renderInvSummary(); renderInboundList(); renderProcessingTab();
  } catch(e) { alert('무효 처리 오류: ' + e.message); }
}

async function restoreInbound(id) {
  try {
    await dbUpdateInbound(id, { is_void: false, void_reason: null, void_at: null, void_by: null });
    await dbInsertAuditLog({
      target_table: 'inbound_records', target_id: id,
      before_val: { is_void: true }, after_val: { is_void: false },
      reason: '무효 해제 (복원)', staff: 'admin'
    });
    const idx = inboundRecords.findIndex(r => r.id === id);
    if (idx !== -1) inboundRecords[idx] = { ...inboundRecords[idx], is_void: false, void_reason: null, void_at: null, void_by: null };
    renderInvSummary(); renderInboundList(); renderProcessingTab();
    showToast('무효가 해제되어 정상 데이터로 복원되었습니다.');
  } catch(e) { alert('복원 오류: ' + e.message); }
}

async function permanentDeleteInbound(id) {
  if (sessionStorage.getItem('citrus_role') !== 'admin') return;
  const r = inboundRecords.find(rec => rec.id === id);
  if (!r) return;
  const label = `${r.farm_name}  ${r.product}  ${fmtN(r.quantity)}CT  (${r.date})`;
  if (!confirm(`⚠️ 영구 삭제\n\n정말로 이 데이터를 영구 삭제하시겠습니까?\n\n${label}\n\n한 번 삭제하면 복구할 수 없습니다.`)) return;
  try {
    await dbInsertAuditLog({
      target_table: 'inbound_records', target_id: id,
      before_val: { ...r }, after_val: null,
      reason: '영구 삭제 (관리자)', staff: 'admin'
    });
    await dbDeleteInbound(id);
    inboundRecords = inboundRecords.filter(rec => rec.id !== id);
    renderInvSummary(); renderInboundList(); renderProcessingTab();
    showToast('영구 삭제되었습니다.');
  } catch(e) { alert('영구 삭제 오류: ' + e.message); }
}

async function forceDeleteInbound(id, reason) {
  if (!confirm(`[강제 삭제] 입고 기록과 연관된 처리 기록 모두 영구 삭제됩니다.\n되돌릴 수 없습니다. 계속할까요?\n\n사유: ${reason}`)) return;
  try {
    const r = inboundRecords.find(x => x.id === id);
    const procs = processingRecords.filter(x => x.inbound_id === id);
    await dbInsertAuditLog({
      target_table: 'inbound_records', target_id: id,
      before_val: { record: r, processings: procs }, after_val: null,
      reason, staff: 'admin'
    });
    for (const pr of procs) await dbDeleteProcessing(pr.id);
    await dbDeleteInbound(id);
    inboundRecords = inboundRecords.filter(x => x.id !== id);
    processingRecords = processingRecords.filter(x => x.inbound_id !== id);
    renderInvSummary(); renderInboundList(); renderProcessingTab();
  } catch(e) { alert('강제 삭제 오류: ' + e.message); }
}

async function addInbound() {
  if (sessionStorage.getItem('citrus_role') !== 'admin') return alert('관리자만 등록할 수 있습니다.');
  const date = gv('ib-date'), product = gv('ib-product'), farm_name = gv('ib-farm');
  if (!date || !product || !farm_name) return alert('날짜, 품목, 농가명은 필수입니다.');
  const inbound_category = gv('ib-category') || '상품';
  const brix_grade = getGradeVal('ib-brix-grade');
  const acidity_grade = getGradeVal('ib-acid-grade');
  const appearance_grade = getGradeVal('ib-appearance-grade');
  const defect_tags = getDefectTags('ib-defect-wrap');
  const brix_range = (document.getElementById('ib-brix-range')?.value || '').trim() || null;
  const acidity_range = (document.getElementById('ib-acidity-range')?.value || '').trim() || null;
  const size_distribution = (document.getElementById('ib-size-dist')?.value || '').trim() || null;
  const is_priority = document.getElementById('ib-priority')?.checked || false;
  const isReclass = inbound_category === '재선별';
  const reclassification_source = isReclass ? (document.getElementById('ib-reclass-src')?.value || null) : null;
  const reclassification_reason = isReclass ? (document.getElementById('ib-reclass-reason')?.value.trim() || null) : null;
  const original_work_date = isReclass ? (document.getElementById('ib-reclass-date')?.value || null) : null;
  const note = gv('ib-note') || null;
  const isDistributed = document.getElementById('ib-loc-multi')?.checked;

  const commonData = {
    date, product, farm_name,
    note, staff: 'admin',
    inbound_category, is_priority,
    ...(brix_grade && { brix_grade }),
    ...(acidity_grade && { acidity_grade }),
    ...(appearance_grade && { appearance_grade }),
    ...(defect_tags && { defect_tags }),
    ...(brix_range && { brix_range }),
    ...(acidity_range && { acidity_range }),
    ...(size_distribution && { size_distribution }),
    ...(reclassification_source && { reclassification_source }),
    ...(reclassification_reason && { reclassification_reason }),
    ...(original_work_date && { original_work_date }),
  };

  const clearForm = () => {
    sv('ib-qty', ''); sv('ib-note', ''); resetLocForm('ib'); clearGrades('ib');
    ['ib-brix-range', 'ib-acidity-range', 'ib-size-dist',
     'ib-reclass-src', 'ib-reclass-reason', 'ib-reclass-date']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const priEl = document.getElementById('ib-priority');
    if (priEl) priEl.checked = false;
    syncReclassList('ib');
  };

  try {
    if (isDistributed) {
      const locRows = document.querySelectorAll('#ib-loc-list .loc-dist-row');
      const locs = [];
      locRows.forEach(row => {
        const name = row.querySelector('.loc-dist-sel')?.value;
        const qty = parseInt(row.querySelector('.loc-dist-qty')?.value) || 0;
        if (name) locs.push({ name, qty });
      });
      if (locs.length < 2) return alert('분산 저장은 위치를 2개 이상 지정해야 합니다.');
      if (locs.some(l => !l.qty || l.qty <= 0)) return alert('각 위치의 수량을 입력해 주세요.');
      const locNames = locs.map(l => l.name);
      if (new Set(locNames).size !== locNames.length) return alert('중복된 위치가 있습니다.');
      const distribution_group_id = generateUUID();
      const inserted = [];
      for (const loc of locs) {
        const row = await dbInsertInbound({ ...commonData, location: loc.name, quantity: loc.qty, distribution_group_id });
        inserted.push(row);
      }
      inserted.forEach(row => inboundRecords.unshift(row));
    } else {
      const qty = parseInt(document.getElementById('ib-qty').value) || 0;
      if (!qty) return alert('수량은 필수입니다.');
      const row = await dbInsertInbound({ ...commonData, quantity: qty, location: getLocValue('ib') || null });
      inboundRecords.unshift(row);
    }
    renderInvSummary(); renderInboundList();
    clearForm();
  } catch(e) { alert('등록 오류: ' + e.message); }
}

async function addProcessing() {
  if (sessionStorage.getItem('citrus_role') !== 'admin') return alert('관리자만 등록할 수 있습니다.');
  const inboundId = gv('proc-inbound');
  const processType = gv('proc-type');
  const date = gv('proc-date');
  const qty = parseInt(document.getElementById('proc-qty').value) || 0;
  if (!inboundId || !date || !qty) return alert('입고 건, 처리일, 수량은 필수입니다.');
  const ib = inboundRecords.find(r => r.id === inboundId);
  if (!ib) return alert('선택한 입고 건을 찾을 수 없습니다.');
  const remaining = ib.quantity - getProcessedForInbound(inboundId);
  if (qty > remaining) return alert(`처리 수량(${fmtN(qty)}CT)이 남은 재고(${fmtN(remaining)}CT)를 초과합니다.`);
  const data = {
    inbound_id: inboundId, date, process_type: processType, quantity: qty,
    note: gv('proc-note') || null, staff: 'admin'
  };
  try {
    const row = await dbInsertProcessing(data);
    processingRecords.unshift(row);
    renderInvSummary(); renderInboundList(); renderProcessingTab();
    sv('proc-qty', ''); sv('proc-note', '');
  } catch(e) { alert('등록 오류: ' + e.message); }
}

async function deleteProcessing(id) {
  if (sessionStorage.getItem('citrus_role') !== 'admin') return;
  if (!confirm('처리 기록을 삭제하시겠습니까? 삭제 시 미선과 재고가 복원됩니다.')) return;
  try {
    await dbDeleteProcessing(id);
    processingRecords = processingRecords.filter(r => r.id !== id);
    renderInvSummary(); renderInboundList(); renderProcessingTab();
  } catch(e) { alert('삭제 오류: ' + e.message); }
}

function _daysSince(dateStr) {
  if (!dateStr) return 999;
  const today = new Date(td() + 'T00:00:00');
  const d = new Date(dateStr + 'T00:00:00');
  return Math.max(0, Math.floor((today - d) / 86400000));
}
function _dateChip(dates) {
  if (!dates || !dates.length) return '';
  const sorted = [...dates].sort();
  const oldest = sorted[0];
  const days = _daysSince(oldest);
  const color = days <= 3 ? '#2E7D32' : days <= 7 ? '#F57F17' : '#C62828';
  const mmdd = d => d.slice(5);
  const dLabel = n => n === 0 ? '오늘 🆕' : n === 1 ? '1일 전' : `${n}일 전`;
  const text = sorted.length === 1
    ? `📅 ${mmdd(oldest)} (${dLabel(days)})`
    : `📅 ${mmdd(oldest)}~${mmdd(sorted[sorted.length - 1])} (${sorted.length}건)`;
  return `<span style="font-size:11px;color:${color};white-space:nowrap;flex-shrink:0;margin-left:6px">${text}</span>`;
}

function setSortedView(v) {
  sortedView = v;
  const listDiv = document.getElementById('srt-list-div');
  const aggDiv  = document.getElementById('srt-agg-div');
  const farmDiv = document.getElementById('srt-farm-div');
  const filters = document.getElementById('srt-agg-filters');
  const btnList = document.getElementById('srt-v-list');
  const btnAgg  = document.getElementById('srt-v-agg');
  const btnFarm = document.getElementById('srt-v-farm');
  if (listDiv) listDiv.style.display = v === 'list' ? '' : 'none';
  if (aggDiv)  aggDiv.style.display  = v === 'agg'  ? '' : 'none';
  if (farmDiv) farmDiv.style.display = v === 'farm' ? '' : 'none';
  if (filters) filters.style.display = (v === 'agg' || v === 'farm') ? 'flex' : 'none';
  if (btnList) btnList.className = 'etab' + (v === 'list' ? ' af' : '');
  if (btnAgg)  btnAgg.className  = 'etab' + (v === 'agg'  ? ' af' : '');
  if (btnFarm) btnFarm.className = 'etab' + (v === 'farm' ? ' af' : '');
  if (v === 'agg')  renderSortedAgg();
  if (v === 'farm') renderSortedAggFarm();
}

function renderSortedAgg() {
  const el = document.getElementById('srt-agg-div');
  if (!el) return;

  const hideEmpty  = document.getElementById('srt-hide-empty')?.checked ?? true;
  const filterCat  = document.getElementById('srt-filter-cat')?.value || '';
  const filterFarm = (document.getElementById('srt-filter-farm')?.value || '').trim().toLowerCase();

  let data = invSorted;
  if (filterFarm) data = data.filter(r => r.farm_name.toLowerCase().includes(filterFarm));

  const getItemCatType = p => {
    const item = _getItemDef(p);
    if (!item) return 'count';
    const cat = _getCatById(item.category_id);
    return cat ? cat.classification_type : 'count';
  };

  const countData = data.filter(r => getItemCatType(r.product) === 'count');
  const gradeData = data.filter(r => getItemCatType(r.product) === 'grade');

  // count_num 별 집계: { total, entries: [{farm_name, product, product_type, qty}] }
  const groupBy = rows => {
    const map = {};
    rows.forEach(r => {
      const key = r.count_num;
      if (!map[key]) map[key] = { total: 0, entries: [] };
      const qty = Number(r.quantity) || 0;
      const eKey = `${r.farm_name}||${r.product}||${r.product_type}`;
      const ex = map[key].entries.find(e => e._key === eKey);
      if (ex) { ex.qty += qty; if (r.date && !ex.dates.includes(r.date)) ex.dates.push(r.date); }
      else map[key].entries.push({ _key: eKey, farm_name: r.farm_name, product: r.product, product_type: r.product_type, qty, dates: r.date ? [r.date] : [] });
      map[key].total += qty;
    });
    return map;
  };

  const countMap = groupBy(countData);
  const gradeMap = groupBy(gradeData);

  // 만감류: 재고 없는 항목 숨기지 않을 때 5~26수 전부 표시
  if (!hideEmpty) {
    for (let i = 5; i <= 26; i++) {
      const k = `${i}수`;
      if (!countMap[k]) countMap[k] = { total: 0, entries: [] };
    }
    const gradeCatId = categories.find(c => c.classification_type === 'grade')?.id;
    if (gradeCatId) {
      sizeGrades.filter(g => g.category_id === gradeCatId).forEach(g => {
        if (!gradeMap[g.grade_name]) gradeMap[g.grade_name] = { total: 0, entries: [] };
      });
    }
  }

  const sortCountKeys = keys => keys.sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  const sortGradeKeys = keys => keys.sort((a, b) => {
    const oa = sizeGrades.find(g => g.grade_name === a)?.sort_order ?? 999;
    const ob = sizeGrades.find(g => g.grade_name === b)?.sort_order ?? 999;
    return oa - ob;
  });

  const renderSection = (map, sortFn) => {
    let keys = sortFn(Object.keys(map));
    if (hideEmpty) keys = keys.filter(k => map[k].total > 0);
    if (!keys.length) return '<div style="padding:20px;text-align:center;color:#bbb;font-size:13px">재고 없음</div>';

    const catTotal = keys.reduce((s, k) => s + map[k].total, 0);
    const maxTotal = Math.max(...keys.map(k => map[k].total));
    let html = '';

    keys.forEach(key => {
      const { total, entries } = map[key];
      let borderColor, tag;
      if (total >= 50) {
        borderColor = '#2E7D32';
        tag = '<span style="background:#E8F5E9;color:#2E7D32;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">충분</span>';
      } else if (total >= 10) {
        borderColor = '#F57F17';
        tag = '<span style="background:#FFF3E0;color:#E65100;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">보통</span>';
      } else if (total > 0) {
        borderColor = '#C62828';
        tag = '<span style="background:#FFEBEE;color:#C62828;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600">부족</span>';
      } else {
        borderColor = '#BDBDBD';
        tag = '<span style="background:#f5f5f5;color:#bbb;padding:2px 8px;border-radius:10px;font-size:11px">없음</span>';
      }
      const isTop = total > 0 && total === maxTotal && keys.filter(k => map[k].total > 0).length > 1;
      const sorted = [...entries].sort((a, b) => b.qty - a.qty);
      const maxEntry = sorted[0]?.qty ?? 0;

      const rows = sorted.map((e, i) => {
        const last = i === sorted.length - 1;
        const eColor = e.qty >= 50 ? '#2E7D32' : e.qty >= 10 ? '#E65100' : '#C62828';
        const isBest = sorted.length > 1 && e.qty === maxEntry;
        const ptLabel = e.product_type && e.product_type !== '일반'
          ? ` <span style="font-size:11px;color:#999">[${esc(e.product_type)}]</span>` : '';
        return `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;padding:7px 14px 7px 18px;${last ? '' : 'border-bottom:1px solid #f5f5f5'}">
          <span style="color:#ccc;font-size:11px;margin-right:6px;flex-shrink:0">${last ? '└─' : '├─'}</span>
          <span style="font-size:13px;font-weight:500;color:#333;flex:1;min-width:80px">${esc(e.farm_name)}</span>
          <span style="font-size:12px;color:#888;margin-right:6px">${esc(e.product)}${ptLabel}</span>
          <span style="font-weight:700;color:${eColor};font-size:13px;min-width:50px;text-align:right">${e.qty} CT${isBest ? ' ⭐' : ''}</span>
          ${_dateChip(e.dates)}
        </div>`;
      }).join('');

      html += `<div style="background:#fff;border:1px solid #e8e8e8;border-left:4px solid ${borderColor};border-radius:8px;margin-bottom:8px;overflow:hidden">
        <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fafafa;flex-wrap:wrap">
          <span style="font-weight:700;font-size:15px;color:#222;min-width:48px">${esc(key)}</span>
          <span style="font-size:13px;color:#555">(총 <strong style="color:#1565C0">${fmtN(total)}</strong> CT)</span>
          ${tag}
          ${isTop ? '<span style="font-size:12px;color:#F57F17;font-weight:600">⭐ 최다</span>' : ''}
        </div>
        ${total > 0 ? `<div style="border-top:1px solid #f0f0f0">${rows}</div>` : ''}
      </div>`;
    });

    html += `<div style="text-align:right;padding:10px 4px 4px;font-size:13px;color:#555;border-top:2px solid #ddd;margin-top:4px">
      합계: <strong style="color:#1565C0;font-size:15px">${fmtN(catTotal)} CT</strong>
    </div>`;
    return html;
  };

  let html = '';
  const showCount = !filterCat || filterCat === 'count';
  const showGrade = !filterCat || filterCat === 'grade';

  if (showCount) {
    html += `<div style="margin-bottom:18px">
      <div style="background:#0D47A1;color:#fff;padding:9px 14px;border-radius:8px 8px 0 0;font-size:13px;font-weight:700">🍊 만감류 — 과수별 재고</div>
      <div style="background:#F0F4FF;border:1px solid #90CAF9;border-top:none;border-radius:0 0 8px 8px;padding:12px">
        ${renderSection(countMap, sortCountKeys)}
      </div>
    </div>`;
  }
  if (showGrade) {
    html += `<div style="margin-bottom:18px">
      <div style="background:#1B5E20;color:#fff;padding:9px 14px;border-radius:8px 8px 0 0;font-size:13px;font-weight:700">🍋 감귤류 — 등급별 재고</div>
      <div style="background:#F1F8F1;border:1px solid #A5D6A7;border-top:none;border-radius:0 0 8px 8px;padding:12px">
        ${renderSection(gradeMap, sortGradeKeys)}
      </div>
    </div>`;
  }
  if (!html) html = '<div style="text-align:center;padding:48px;color:#bbb">표시할 데이터가 없습니다</div>';

  el.innerHTML = html;
}

function renderSortedAggFarm() {
  const el = document.getElementById('srt-farm-div');
  if (!el) return;

  const filterCat  = document.getElementById('srt-filter-cat')?.value || '';
  const filterFarm = (document.getElementById('srt-filter-farm')?.value || '').trim().toLowerCase();

  let data = invSorted;
  if (filterFarm) data = data.filter(r => r.farm_name.toLowerCase().includes(filterFarm));

  const getItemCatType = p => {
    const item = _getItemDef(p);
    if (!item) return 'count';
    const cat = _getCatById(item.category_id);
    return cat ? cat.classification_type : 'count';
  };

  // farm → product+type → count_num → {qty, dates[]}
  const groupByFarm = rows => {
    const map = {};
    rows.forEach(r => {
      if (!map[r.farm_name]) map[r.farm_name] = { total: 0, products: {} };
      const pk = `${r.product}||${r.product_type}`;
      if (!map[r.farm_name].products[pk])
        map[r.farm_name].products[pk] = { product: r.product, product_type: r.product_type, total: 0, counts: {} };
      if (!map[r.farm_name].products[pk].counts[r.count_num])
        map[r.farm_name].products[pk].counts[r.count_num] = { qty: 0, dates: [] };
      const qty = Number(r.quantity) || 0;
      map[r.farm_name].products[pk].counts[r.count_num].qty += qty;
      if (r.date && !map[r.farm_name].products[pk].counts[r.count_num].dates.includes(r.date))
        map[r.farm_name].products[pk].counts[r.count_num].dates.push(r.date);
      map[r.farm_name].products[pk].total += qty;
      map[r.farm_name].total += qty;
    });
    return map;
  };

  const sortCountKeys = keys => keys.sort((a, b) => {
    const oa = sizeGrades.find(g => g.grade_name === a)?.sort_order;
    const ob = sizeGrades.find(g => g.grade_name === b)?.sort_order;
    if (oa !== undefined && ob !== undefined) return oa - ob;
    return (parseInt(a) || 0) - (parseInt(b) || 0);
  });

  const renderFarmSection = map => {
    const farms = Object.keys(map).sort((a, b) => map[b].total - map[a].total);
    if (!farms.length) return '<div style="padding:20px;text-align:center;color:#bbb;font-size:13px">재고 없음</div>';

    const catTotal = farms.reduce((s, f) => s + map[f].total, 0);
    let html = '';

    farms.forEach(farm => {
      const { total, products } = map[farm];
      const borderColor = total >= 50 ? '#2E7D32' : total >= 10 ? '#F57F17' : '#C62828';
      const prodKeys = Object.keys(products);

      const prodRows = prodKeys.map((pk, pi) => {
        const prod = products[pk];
        const isLastProd = pi === prodKeys.length - 1;
        const ptLabel = prod.product_type && prod.product_type !== '일반' ? ` [${esc(prod.product_type)}]` : '';
        const countKeys = sortCountKeys(Object.keys(prod.counts));

        const countRows = countKeys.map((ck, ci) => {
          const { qty, dates } = prod.counts[ck];
          const isLast = ci === countKeys.length - 1;
          const eColor = qty >= 50 ? '#2E7D32' : qty >= 10 ? '#E65100' : '#C62828';
          return `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;padding:6px 14px 6px 40px;${isLast ? '' : 'border-bottom:1px solid #f8f8f8'}">
            <span style="color:#ddd;font-size:11px;margin-right:6px;flex-shrink:0">${isLast ? '└─' : '├─'}</span>
            <span style="font-weight:600;color:#444;font-size:13px;min-width:52px">${esc(ck)}</span>
            <span style="font-weight:700;color:${eColor};font-size:13px;min-width:48px;text-align:right">${fmtN(qty)} CT</span>
            ${_dateChip(dates)}
          </div>`;
        }).join('');

        return `<div>
          <div style="display:flex;align-items:center;padding:7px 14px 7px 20px;background:#f5f7fa;${isLastProd ? '' : 'border-bottom:1px solid #ebebeb'}">
            <span style="color:#bbb;font-size:11px;margin-right:8px;flex-shrink:0">${isLastProd ? '└─' : '├─'}</span>
            <span style="font-size:13px;font-weight:600;color:#1565C0">🍊 ${esc(prod.product)}${ptLabel}</span>
            <span style="font-size:12px;color:#888;margin-left:8px">(${fmtN(prod.total)} CT)</span>
          </div>
          ${countRows}
        </div>`;
      }).join('');

      html += `<div style="background:#fff;border:1px solid #e8e8e8;border-left:4px solid ${borderColor};border-radius:8px;margin-bottom:10px;overflow:hidden">
        <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fafafa">
          <span style="font-size:16px">👨‍🌾</span>
          <span style="font-weight:700;font-size:14px;color:#222">${esc(farm)}</span>
          <span style="font-size:13px;color:#555">(총 <strong style="color:#1565C0">${fmtN(total)}</strong> CT)</span>
        </div>
        <div style="border-top:1px solid #f0f0f0">${prodRows}</div>
      </div>`;
    });

    html += `<div style="text-align:right;padding:10px 4px 4px;font-size:13px;color:#555;border-top:2px solid #ddd;margin-top:4px">
      합계: <strong style="color:#1565C0;font-size:15px">${fmtN(catTotal)} CT</strong>
    </div>`;
    return html;
  };

  let html = '';
  const showCount = !filterCat || filterCat === 'count';
  const showGrade = !filterCat || filterCat === 'grade';

  if (showCount) {
    const map = groupByFarm(data.filter(r => getItemCatType(r.product) === 'count'));
    html += `<div style="margin-bottom:18px">
      <div style="background:#0D47A1;color:#fff;padding:9px 14px;border-radius:8px 8px 0 0;font-size:13px;font-weight:700">🍊 만감류 — 농가별 재고</div>
      <div style="background:#F0F4FF;border:1px solid #90CAF9;border-top:none;border-radius:0 0 8px 8px;padding:12px">
        ${renderFarmSection(map)}
      </div>
    </div>`;
  }
  if (showGrade) {
    const map = groupByFarm(data.filter(r => getItemCatType(r.product) === 'grade'));
    html += `<div style="margin-bottom:18px">
      <div style="background:#1B5E20;color:#fff;padding:9px 14px;border-radius:8px 8px 0 0;font-size:13px;font-weight:700">🍋 감귤류 — 농가별 재고</div>
      <div style="background:#F1F8F1;border:1px solid #A5D6A7;border-top:none;border-radius:0 0 8px 8px;padding:12px">
        ${renderFarmSection(map)}
      </div>
    </div>`;
  }
  if (!html) html = '<div style="text-align:center;padding:48px;color:#bbb">표시할 데이터가 없습니다</div>';

  el.innerHTML = html;
}

function renderSortedList() {
  const tbody = document.getElementById('so-tb');
  if (!tbody) return;
  const isAdm = sessionStorage.getItem('citrus_role') === 'admin';
  const data = invSorted;
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">선과 기록 없음</td></tr>'; return; }
  tbody.innerHTML = data.map(r => `<tr>
    <td>${r.date}</td>
    <td class="nm">${esc(r.farm_name)}</td>
    <td>${esc(r.product)}</td>
    <td>${esc(r.product_type)}</td>
    <td>${esc(r.count_num)}</td>
    <td>${fmtN(r.quantity)} CT</td>
    <td>${esc(r.location || '-')}</td>
    <td>${isAdm ? `<button class="btn del" onclick="deleteSorted('${r.id}')">삭제</button>` : ''}</td>
  </tr>`).join('');
  if (sortedView === 'agg')  renderSortedAgg();
  if (sortedView === 'farm') renderSortedAggFarm();
}

function renderWasteList() {
  const tbody = document.getElementById('wa-tb');
  if (!tbody) return;
  const isAdm = sessionStorage.getItem('citrus_role') === 'admin';
  const data = invWaste;
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">파치 기록 없음</td></tr>'; return; }
  tbody.innerHTML = data.map(r => `<tr>
    <td>${r.date}</td>
    <td>${esc(r.product)}</td>
    <td>${fmtN(r.quantity)} CT</td>
    <td>${esc(r.location)}</td>
    <td>${esc(r.purpose)}</td>
    <td>${isAdm ? `<button class="btn del" onclick="deleteWaste('${r.id}')">삭제</button>` : ''}</td>
  </tr>`).join('');
}

function renderJuiceList() {
  const tbody = document.getElementById('ju-tb');
  if (!tbody) return;
  const isAdm = sessionStorage.getItem('citrus_role') === 'admin';
  const data = invJuice;
  if (!data.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">주스/청 기록 없음</td></tr>'; return; }
  tbody.innerHTML = data.map(r => `<tr>
    <td>${r.date}</td>
    <td class="nm">${esc(r.product)}</td>
    <td>${r.total_qty} ${esc(r.unit)}</td>
    <td>${r.expiry_date || '-'}</td>
    <td>${isAdm ? `<button class="btn del" onclick="deleteJuice('${r.id}')">삭제</button>` : ''}</td>
  </tr>`).join('');
}


async function addSorted() {
  if (sessionStorage.getItem('citrus_role') !== 'admin') return alert('관리자만 등록할 수 있습니다.');
  const date = gv('so-date'), product = gv('so-product'), product_type = gv('so-ptype');
  const farm_name = gv('so-farm'), count_num = gv('so-count');
  const qty = parseFloat(document.getElementById('so-qty').value) || 0;
  if (!date || !product || !product_type || !farm_name || !count_num || !qty)
    return alert('모든 필수 항목을 입력해주세요.');
  const data = { date, product, product_type, farm_name, count_num, quantity: qty, location: gv('so-loc') || null };
  try {
    const row = await dbInsertSorted(data);
    invSorted.unshift(row);
    renderInvSummary(); renderSortedList();
    sv('so-qty', ''); sv('so-loc', '');
  } catch(e) { alert('등록 오류: ' + e.message); }
}

async function deleteSorted(id) {
  if (sessionStorage.getItem('citrus_role') !== 'admin') return;
  if (!confirm('삭제하시겠습니까?')) return;
  try {
    await dbDeleteSorted(id);
    invSorted = invSorted.filter(r => r.id !== id);
    renderInvSummary(); renderSortedList();
  } catch(e) { alert('삭제 오류: ' + e.message); }
}

async function addWaste() {
  if (sessionStorage.getItem('citrus_role') !== 'admin') return alert('관리자만 등록할 수 있습니다.');
  const date = gv('wa-date'), product = gv('wa-product');
  const qty = parseInt(document.getElementById('wa-qty').value) || 0;
  const loc = gv('wa-loc'), purpose = gv('wa-purpose');
  if (!date || !product || !qty || !loc || !purpose) return alert('모든 필수 항목을 입력해주세요.');
  const data = { date, product, quantity: qty, location: loc, purpose, note: gv('wa-note') || null };
  try {
    const row = await dbInsertWaste(data);
    invWaste.unshift(row);
    renderInvSummary(); renderWasteList();
    ['wa-qty', 'wa-purpose', 'wa-note'].forEach(id => sv(id, ''));
  } catch(e) { alert('등록 오류: ' + e.message); }
}

async function deleteWaste(id) {
  if (sessionStorage.getItem('citrus_role') !== 'admin') return;
  if (!confirm('삭제하시겠습니까?')) return;
  try {
    await dbDeleteWaste(id);
    invWaste = invWaste.filter(r => r.id !== id);
    renderInvSummary(); renderWasteList();
  } catch(e) { alert('삭제 오류: ' + e.message); }
}

function calcJuiceTotal() {
  const box = parseInt(document.getElementById('ju-box').value) || 0;
  const single = parseInt(document.getElementById('ju-single').value) || 0;
  sv('ju-total', box + single);
}

async function addJuice() {
  if (sessionStorage.getItem('citrus_role') !== 'admin') return alert('관리자만 등록할 수 있습니다.');
  const date = gv('ju-date'), product = gv('ju-product'), unit = gv('ju-unit');
  const total_qty = parseInt(document.getElementById('ju-total').value) || 0;
  if (!date || !product || !unit || !total_qty) return alert('날짜, 품명, 단위, 수량은 필수입니다.');
  const boxVal = document.getElementById('ju-box').value;
  const singleVal = document.getElementById('ju-single').value;
  const data = {
    date, product, unit, total_qty,
    box_qty: boxVal ? parseInt(boxVal) : null,
    single_qty: singleVal ? parseInt(singleVal) : null,
    expiry_date: gv('ju-expiry') || null,
    note: gv('ju-note') || null
  };
  try {
    const row = await dbInsertJuice(data);
    invJuice.unshift(row);
    renderInvSummary(); renderJuiceList();
    ['ju-product', 'ju-note'].forEach(id => sv(id, ''));
    ['ju-box', 'ju-single', 'ju-total', 'ju-expiry'].forEach(id => sv(id, ''));
  } catch(e) { alert('등록 오류: ' + e.message); }
}

async function deleteJuice(id) {
  if (sessionStorage.getItem('citrus_role') !== 'admin') return;
  if (!confirm('삭제하시겠습니까?')) return;
  try {
    await dbDeleteJuice(id);
    invJuice = invJuice.filter(r => r.id !== id);
    renderInvSummary(); renderJuiceList();
  } catch(e) { alert('삭제 오류: ' + e.message); }
}

// ── IME 안내 배너
function initImeNotice() {
  // Windows 이외 환경(Mac, iOS, Android)에서는 이 문제가 없으므로 표시 안 함
  const isWindows = /Win/i.test(navigator.platform || navigator.userAgent);
  if (!isWindows) return;
  if (localStorage.getItem('ime_notice_dismissed') === '1') return;
  const el = document.getElementById('ime-notice');
  if (el) el.style.display = 'flex';
}

function dismissImeNotice() {
  localStorage.setItem('ime_notice_dismissed', '1');
  const el = document.getElementById('ime-notice');
  if (el) el.style.display = 'none';
}

// ── 개별 이력 모달 ───────────────────────────────────────────

async function openRecordHistory(id) {
  const r = inboundRecords.find(x => x.id === id);
  const modal = document.getElementById('modal-record-history');
  const title = document.getElementById('rh-title');
  const info  = document.getElementById('rh-record-info');
  const tl    = document.getElementById('rh-timeline');
  if (!modal) return;

  // 헤더 정보
  if (r) {
    title.textContent = '변경 이력';
    info.innerHTML = `<strong>${esc(r.farm_name)}</strong> · ${esc(r.product)} · ${r.date}
      <span style="margin-left:8px;color:#aaa">${fmtN(r.quantity)}CT 입고</span>
      ${r.is_void ? '<span style="margin-left:6px;background:#ef5350;color:#fff;font-size:10px;padding:1px 6px;border-radius:4px">무효</span>' : ''}`;
  } else {
    title.textContent = '변경 이력 (삭제된 기록)';
    info.innerHTML = '<span style="color:#aaa">삭제된 입고 기록</span>';
  }
  tl.innerHTML = '<div style="text-align:center;padding:20px;color:#aaa">불러오는 중...</div>';
  modal.style.display = 'flex';

  const logs = await dbGetAuditLogsForRecord('inbound_records', id);
  renderRecordHistoryModal(logs, r);
}

function renderRecordHistoryModal(logs, record) {
  const tl = document.getElementById('rh-timeline');
  if (!tl) return;

  if (!logs.length) {
    tl.innerHTML = '<div style="text-align:center;padding:24px;color:#bbb;font-size:13px">변경 이력 없음<br><small style="color:#ccc">수정·무효·삭제 시 자동 기록됩니다</small></div>';
    return;
  }

  const fmtDt = iso => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  // 현재 상태를 맨 마지막에 "현재" 항목으로 추가
  const items = [...logs];

  tl.innerHTML = `<div style="position:relative;padding-left:24px">
    ${items.map((log, i) => {
      const action = getAuditActionType(log);
      const st = AUDIT_ACTION_STYLE[action] || { bg: '#f5f5f5', color: '#555', border: '#ddd', icon: '📝' };
      const diff = getAuditDiff(log);
      const isLast = i === items.length - 1;

      return `
        <!-- 타임라인 선 -->
        <div style="position:absolute;left:7px;top:0;bottom:0;width:2px;background:#e0e0e0;${i === 0 ? 'top:12px' : ''}${isLast ? ';bottom:calc(100% - 24px)' : ''}"></div>
        <div style="position:relative;margin-bottom:${isLast ? '0' : '14px'}">
          <!-- 타임라인 점 -->
          <div style="position:absolute;left:-21px;top:10px;width:10px;height:10px;border-radius:50%;background:${st.border};border:2px solid #fff;box-shadow:0 0 0 2px ${st.border}"></div>
          <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:10px 12px">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:${diff.length || log.reason ? '6' : '0'}px">
              <span style="background:${st.bg};color:${st.color};font-size:11px;padding:1px 8px;border-radius:8px;font-weight:700">${st.icon} ${action}</span>
              <span style="font-size:11px;color:#aaa;margin-left:auto">${fmtDt(log.created_at)}</span>
            </div>
            ${diff.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:${log.reason ? '5' : '0'}px">
              ${diff.map(d => `<span style="background:#f9f9f9;border:1px solid #eee;border-radius:4px;padding:1px 6px;font-size:12px;color:#555">${esc(d)}</span>`).join('')}
            </div>` : ''}
            ${log.reason ? `<div style="font-size:12px;color:#888">사유: <em>"${esc(log.reason)}"</em></div>` : ''}
          </div>
        </div>`;
    }).join('')}

    ${record && !record.is_void ? `
    <div style="position:relative">
      <div style="position:absolute;left:-21px;top:10px;width:10px;height:10px;border-radius:50%;background:#1565C0;border:2px solid #fff;box-shadow:0 0 0 2px #1565C0"></div>
      <div style="background:#E3F2FD;border:1px solid #90CAF9;border-radius:8px;padding:10px 12px">
        <div style="font-size:12px;font-weight:700;color:#1565C0">📌 현재 상태</div>
        <div style="font-size:12px;color:#555;margin-top:4px">
          ${[record.date, `${record.quantity}CT`, record.location, record.inbound_category, record.note].filter(Boolean).map(v => esc(String(v))).join(' · ')}
        </div>
      </div>
    </div>` : ''}
  </div>`;
}

// ── ESC 키로 모달 닫기
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('modal-quality')?.style.display !== 'none') { closeQualityModal(); return; }
  if (document.getElementById('modal-move-loc')?.style.display !== 'none') { closeMoveModal(); return; }
  if (_expandedMemoId) { toggleMemo(_expandedMemoId); return; }
  if (document.getElementById('modal-record-history')?.style.display !== 'none') { CM('record-history'); return; }
  if (document.getElementById('modal-edit-inbound')?.style.display !== 'none') { closeEditInboundModal(); return; }
  if (document.getElementById('modal-void-inbound')?.style.display !== 'none') { CM('void-inbound'); return; }
});

// ── 시작
document.addEventListener('DOMContentLoaded', initApp);
document.addEventListener('click', e => {
  if (!e.target.classList.contains('grade-hint')) hideGradeHint();
  if (_openMenuId && !e.target.closest('.row-menu') && !e.target.classList.contains('menu-trigger')) {
    const menu = document.getElementById(`row-menu-${_openMenuId}`);
    if (menu) menu.style.display = 'none';
    _openMenuId = null;
  }
});
