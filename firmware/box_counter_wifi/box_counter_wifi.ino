/*
  선과장 박스 자동 카운터 — 와이파이판 v6 (관제판 연결 · 벨트 화면 · 휴대폰으로 와이파이 설정 · 주소 고정)
  ESP32 + 투과형 광센서(E3Z-T61) + PC817 절연 모듈 — 배선은 1단계와 똑같습니다.

  하는 일
  - 광센서 빛이 가려질 때마다 박스 1개로 셉니다(1단계와 같은 거르기).
  - 센 숫자를 와이파이로 관제판 서버에 보냅니다. 숫자가 바뀌면 바로, 안 바뀌어도 30초마다 '살아 있음'.
  - 보내는 숫자는 '켜진 뒤 누적'이라, 와이파이가 잠깐 끊겨도 다시 붙으면 빠진 것 없이 채워집니다.
  - 같은 와이파이의 휴대폰·태블릿으로 http://(이 기기 주소)/ 를 열면 '벨트 화면'(방금 지나간 박스 품목).

  와이파이 넣는 법 — PC 없이 휴대폰으로 (v5)
  - 켜고 30초 안에 와이파이에 못 붙으면, 기기가 스스로 설정용 와이파이를 켭니다.
        이름: BoxCounter-Setup     비밀번호: (PC 원본 파일 참고 — 공개 저장소라 지움)
  - 휴대폰으로 그 와이파이에 붙으면 설정 화면이 뜹니다(안 뜨면 인터넷 창에 192.168.4.1).
  - 화면에 '이 기기에 보이는 와이파이 목록'과 '안 붙는 이유'가 나옵니다.
    공장 와이파이를 누르고 비밀번호를 넣고 [저장하고 붙기] → 끝. 기기가 기억해서 다시 켜도 그대로입니다.
  - 붙은 뒤에도 같은 와이파이에서 http://(기기 주소)/setup 으로 다시 바꿀 수 있습니다.
  - 아래 WIFI_SSID / WIFI_PASS 는 처음 값일 뿐입니다(비워 둬도 됨). 휴대폰으로 넣은 값이 있으면 그걸 씁니다.
  - ESP32는 2.4GHz 와이파이만 됩니다. 이름 뒤에 _5G 붙은 것은 목록에 안 나옵니다.

  주소 고정 (v6) — 포장대·뒤쪽 화면이 늘 같은 주소로 열리게
  - 붙은 상태에서 같은 와이파이 휴대폰으로 http://(기기 주소)/setup → [이 주소로 고정].
  - 그 와이파이에서만 고정합니다(다른 와이파이에 가져가면 저절로 자동 주소). [고정 풀기]로 되돌림.
  - 가능하면 공유기 설정에서도 이 기기를 같은 주소로 '예약'해 두면 다른 기기와 겹칠 일이 없습니다.

  켤 때 주의 — 켜고 처음 2초 동안 센서 사이를 비워 두세요(빛 통과 상태를 기준으로 잡음).
  시리얼 명령(115200): r = 숫자 0으로,  c = 기준 다시 잡기,  s = 지금 상태,  w = 와이파이 다시 찾고 붙기
  ※ 아래 DEV_KEY는 이 센서 전용 열쇠입니다. 다른 사람에게 보내거나 사진 찍어 올리지 마세요.
*/
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <DNSServer.h>
#include <Preferences.h>

const char* WIFI_SSID = "";   // 처음 값(선택) — 휴대폰 설정 화면에서 넣어도 됩니다
const char* WIFI_PASS = "";
const char* AP_NAME   = "BoxCounter-Setup";   // 설정용 와이파이
const char* AP_PASS   = "";

const char* DEV_ID  = "bulk1";   // 벌크 라인 테이핑기 출구
const char* DEV_KEY = "";
const char* SERVER  = "https://pogrtghqsxryphfkyfgb.supabase.co/functions/v1/counter";

const int PIN_IN  = 27;   // 절연 모듈 OUT
const int PIN_LED = 2;    // 보드 LED(있는 보드만 — 없으면 상관없음)

// 거르는 기준 — 설치한 뒤 실제 박스로 맞춥니다(1단계와 같음)
const uint32_t BLOCK_MIN_MS = 40;     // 이보다 짧게 가려지면 무시(잡음·스치는 손)
const uint32_t CLEAR_MIN_MS = 120;    // 박스 사이 틈이 이보다 짧으면 같은 박스로 봄
const uint32_t STUCK_MS     = 20000;  // 이보다 오래 가려져 있으면 '막힘'
// 보내기
const uint32_t SEND_GAP_MS  = 300;    // 숫자가 바뀌어도 이 간격보다 자주는 안 보냄(몰리면 한꺼번에)
const uint32_t BEAT_MS      = 30000;  // 안 바뀌어도 이 간격마다 '살아 있음'
// 설정용 와이파이
const uint32_t AP_AFTER_MS  = 30000;  // 이만큼 못 붙으면 설정용 와이파이를 켬
const uint32_t AP_RETRY_MS  = 300000; // 설정 화면에 아무도 없으면 이 간격마다 원래 와이파이에 다시 붙어 봄

// ── 세는 쪽(loop)과 보내는 쪽(netTask)이 같이 보는 값 ──
portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
volatile uint32_t total = 0;       // 켜진 뒤(또는 r 뒤) 센 박스
volatile uint32_t bootTag = 0;     // 켜질 때·r 할 때마다 새로 뽑음 → 서버가 '0부터 다시'를 알아봄
volatile bool blockedNow = false;
volatile bool stuckNow = false;
volatile bool netOk = false;       // 마지막 보내기가 성공했나
volatile uint32_t netOkAt = 0, netFail = 0, netSent = 0;
volatile bool wifiKick = false, scanReq = false, cfgChanged = false;
volatile bool apMode = false, wifiReady = false;
volatile int netCode = 1;          // LED 깜빡 횟수: 0 정상 · 1 이름 못 찾음 · 2 비밀번호 · 3 인터넷 안 나감
volatile uint8_t wifiReason = 0;   // 마지막으로 끊긴 이유(ESP32 번호)
volatile uint32_t lastCountMs = 0; // 마지막으로 센 시각(벨트 화면용)

// 와이파이 설정·목록 — 여러 작업이 같이 보므로 wlock 으로 지킴
SemaphoreHandle_t wlock;
String cfgSsid, cfgPass;           // 지금 쓰는 와이파이
String scanHtml;                   // 설정 화면에 보일 목록
String fixSsid, fixIp, fixGw, fixMask, fixDns;   // 주소 고정(그 와이파이에서만)
Preferences prefs;
DNSServer dns;

// ── 세는 쪽 상태(1단계와 같음) ──
int  idleLevel = HIGH;
bool blocked   = false;
bool rawPrev   = false;
uint32_t rawSince = 0, blockStart = 0;
bool stuckWarned = false;
uint32_t lastBlockMs = 0, lastGapMs = 0, lastCountAt = 0, lastStatusAt = 0;

uint32_t newTag() { uint32_t t; do { t = esp_random(); } while (t == 0); return t; }

void calibrate() {
  uint32_t hi = 0, lo = 0, t0 = millis();
  while (millis() - t0 < 2000) {
    if (digitalRead(PIN_IN) == HIGH) hi++; else lo++;
    delay(1);
  }
  idleLevel = (hi >= lo) ? HIGH : LOW;
  blocked = false; rawPrev = false; rawSince = millis(); stuckWarned = false;
  blockedNow = false; stuckNow = false;
  Serial.printf("[기준] 빛 통과 상태 = %s  (HIGH %lu / LOW %lu)\n",
                idleLevel == HIGH ? "HIGH" : "LOW", (unsigned long)hi, (unsigned long)lo);
  if (hi > 0 && lo > 0 && (hi < lo * 9 && lo < hi * 9)) {
    Serial.println("[주의] 2초 동안 상태가 계속 바뀌었습니다 — 센서 정렬·배선을 확인하고 c 를 보내 다시 잡으세요");
  }
}

const char* reasonKo(uint8_t r) {
  switch (r) {
    case 0:   return "붙는 중";
    case 201: return "와이파이 이름을 못 찾음 (이름 오타 · 5GHz 전용 · 공유기가 너무 멂)";
    case 2: case 15: case 202: case 204: return "비밀번호가 틀린 것 같음";
    case 203: return "공유기가 접속을 거절함 (접속 기기 수 제한·MAC 필터 확인)";
    case 210: case 211: return "공유기 보안 방식이 안 맞음 (WPA3 전용이면 WPA2/WPA3 같이로)";
    case 212: return "신호가 너무 약함 (공유기를 가깝게)";
    default:  return "공유기와 연결이 안 됨";
  }
}

String cfgSsidCopy() { String s; xSemaphoreTake(wlock, portMAX_DELAY); s = cfgSsid; xSemaphoreGive(wlock); return s; }

void printStatus() {
  bool raw = digitalRead(PIN_IN) != idleLevel;
  Serial.printf("[상태] 누적 %lu개 · 지금 %s · 핀 %s · 켜진 지 %lu초\n",
                (unsigned long)total, raw ? "가림" : "통과",
                digitalRead(PIN_IN) == HIGH ? "HIGH" : "LOW", (unsigned long)(millis() / 1000));
  String s = cfgSsidCopy();
  if (WiFi.status() == WL_CONNECTED)
    Serial.printf("       와이파이 \"%s\" 연결됨 · 신호 %d dBm · 서버 %s (보냄 %lu · 실패 %lu) · 벨트 화면 http://%s/\n", s.c_str(), WiFi.RSSI(),
                  netOk ? "정상" : "안 됨", (unsigned long)netSent, (unsigned long)netFail, WiFi.localIP().toString().c_str());
  else
    Serial.printf("       와이파이 \"%s\" 안 됨 — %s%s\n", s.c_str(), reasonKo(wifiReason),
                  apMode ? " · 설정용 와이파이 BoxCounter-Setup 켜져 있음(휴대폰으로 붙어 192.168.4.1)" : "");
}

// ── 와이파이 설정 기억(기기 안 저장소) ──
void loadCfg() {
  prefs.begin("wifi", true);
  String s = prefs.getString("ssid", ""), p = prefs.getString("pass", "");
  String fs = prefs.getString("fssid", ""), fi = prefs.getString("fip", ""), fg = prefs.getString("fgw", ""),
         fm = prefs.getString("fmask", ""), fd = prefs.getString("fdns", "");
  prefs.end();
  xSemaphoreTake(wlock, portMAX_DELAY); fixSsid = fs; fixIp = fi; fixGw = fg; fixMask = fm; fixDns = fd; xSemaphoreGive(wlock);
  if (s.length() == 0 && strlen(WIFI_SSID) > 0) { s = WIFI_SSID; p = WIFI_PASS; }
  xSemaphoreTake(wlock, portMAX_DELAY); cfgSsid = s; cfgPass = p; xSemaphoreGive(wlock);
}
void saveCfg(const String& s, const String& p) {
  prefs.begin("wifi", false); prefs.putString("ssid", s); prefs.putString("pass", p); prefs.end();
  xSemaphoreTake(wlock, portMAX_DELAY); cfgSsid = s; cfgPass = p; xSemaphoreGive(wlock);
}

String htmlEsc(const String& s) {
  String o; o.reserve(s.length() + 8);
  for (size_t i = 0; i < s.length(); i++) {
    char c = s[i];
    if (c == '&') o += "&amp;"; else if (c == '<') o += "&lt;"; else if (c == '>') o += "&gt;";
    else if (c == '"') o += "&quot;"; else if (c == '\'') o += "&#39;"; else o += c;
  }
  return o;
}

// ── 와이파이 찾기 — 보이는 2.4GHz 와이파이 목록(시리얼 + 설정 화면) ──
void doScan() {
  String me = cfgSsidCopy();
  Serial.println("[와이파이 찾기] 주변 2.4GHz 와이파이를 찾는 중… (ESP32에는 5GHz는 안 보입니다)");
  int n = WiFi.scanNetworks();
  bool seen = false;
  String h;
  for (int i = 0; i < n && i < 20; i++) {
    String s = WiFi.SSID(i);
    if (s.length() == 0) continue;
    bool dup = false;
    for (int j = 0; j < i; j++) if (WiFi.SSID(j) == s) { dup = true; break; }
    if (dup) continue;
    bool hit = (s == me);
    if (hit) seen = true;
    int r = (int)WiFi.RSSI(i);
    Serial.printf("   %s \"%s\"  신호 %d dBm%s\n", hit ? "▶" : " ", s.c_str(), r, WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? " (비번 없음)" : "");
    h += "<button class=n data-s=\"" + htmlEsc(s) + "\">" + (hit ? "▶ " : "") + htmlEsc(s) +
         " <small>신호 " + String(r) + (r > -67 ? " 좋음" : r > -78 ? " 보통" : " 약함") + "</small></button>";
  }
  if (h.length() == 0) h = "<p class=bad>보이는 와이파이가 없습니다</p>";
  if (n <= 0) Serial.println("   보이는 와이파이가 없습니다");
  if (me.length()) {
    if (seen) Serial.printf("   → \"%s\" 보임. 그래도 안 붙으면 비밀번호를 확인하세요\n", me.c_str());
    else Serial.printf("   → \"%s\" 안 보임: 이름이 목록과 글자 하나까지 같은지 · 5GHz 전용인지 · 공유기가 너무 먼지 확인\n", me.c_str());
  }
  WiFi.scanDelete();
  xSemaphoreTake(wlock, portMAX_DELAY); scanHtml = h; xSemaphoreGive(wlock);
}

void saveFix(bool on) {
  String fs, fi, fg, fm, fd;
  if (on) { fs = cfgSsidCopy(); fi = WiFi.localIP().toString(); fg = WiFi.gatewayIP().toString(); fm = WiFi.subnetMask().toString(); fd = WiFi.dnsIP(0).toString(); }
  prefs.begin("wifi", false); prefs.putString("fssid", fs); prefs.putString("fip", fi); prefs.putString("fgw", fg);
  prefs.putString("fmask", fm); prefs.putString("fdns", fd); prefs.end();
  xSemaphoreTake(wlock, portMAX_DELAY); fixSsid = fs; fixIp = fi; fixGw = fg; fixMask = fm; fixDns = fd; xSemaphoreGive(wlock);
}
String fixedIpFor(const String& ssid) { String r; xSemaphoreTake(wlock, portMAX_DELAY); if (fixIp.length() && fixSsid == ssid) r = fixIp; xSemaphoreGive(wlock); return r; }

void staBegin() {
  String s, p, fi, fg, fm, fd, fs;
  xSemaphoreTake(wlock, portMAX_DELAY); s = cfgSsid; p = cfgPass; fs = fixSsid; fi = fixIp; fg = fixGw; fm = fixMask; fd = fixDns; xSemaphoreGive(wlock);
  if (s.length() == 0) { Serial.println("[와이파이] 아직 넣은 와이파이가 없습니다 — 휴대폰으로 BoxCounter-Setup 에 붙어 설정하세요"); return; }
  IPAddress ip, gw, mk, dn;
  if (fi.length() && fs == s && ip.fromString(fi) && gw.fromString(fg) && mk.fromString(fm)) {
    if (!dn.fromString(fd)) dn = gw;
    WiFi.config(ip, gw, mk, dn);
    Serial.printf("[주소] 고정 주소 %s 로 붙습니다\n", fi.c_str());
  } else {
    WiFi.config(IPAddress(0, 0, 0, 0), IPAddress(0, 0, 0, 0), IPAddress(0, 0, 0, 0));   // 자동 주소(공유기가 줌)
  }
  WiFi.begin(s.c_str(), p.c_str());
  Serial.printf("[와이파이] \"%s\" 에 붙는 중…\n", s.c_str());
}

void apStart() {
  WiFi.setAutoReconnect(false);
  WiFi.disconnect();
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_NAME, AP_PASS);
  delay(300);
  doScan();
  xSemaphoreTake(wlock, portMAX_DELAY); dns.start(53, "*", WiFi.softAPIP()); apMode = true; xSemaphoreGive(wlock);
  Serial.printf("[설정] 와이파이에 못 붙어서 설정용 와이파이를 켰습니다 — 휴대폰으로 \"%s\"(비번 %s)에 붙고 http://192.168.4.1\n", AP_NAME, AP_PASS);
}
void apStop() {
  xSemaphoreTake(wlock, portMAX_DELAY); apMode = false; dns.stop(); xSemaphoreGive(wlock);
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  Serial.println("[설정] 설정용 와이파이를 껐습니다");
}

// ── 화면: 벨트 화면 불러오기 · /now 숫자 · /setup 와이파이 설정 ──
WebServer web(80);
static const char LOADER[] = R"HTML(<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>벨트 화면</title></head>
<body style="font-family:sans-serif;padding:30px;color:#555;font-size:18px">벨트 화면 불러오는 중… (인터넷이 되는 와이파이여야 합니다)
<script>
if(!/[?&]view=/.test(location.search))location.replace('/?view=belt');
else fetch('https://pogrtghqsxryphfkyfgb.supabase.co/functions/v1/board/px?k=seonkwa2026',{method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({conn:'main',path:'op_settings?key=eq.board_html&select=value',method:'GET'})})
 .then(function(r){if(!r.ok)throw new Error('서버 응답 '+r.status);return r.json();})
 .then(function(rows){var h=rows&&rows[0]&&rows[0].value&&rows[0].value.html;if(!h)throw new Error('화면 없음');document.open();document.write(h);document.close();})
 .catch(function(e){document.body.innerHTML='불러오지 못했습니다: '+e.message+'<br>새로고침 해 보세요. 와이파이 설정은 <a href="/setup">/setup</a>';});
</script></body></html>)HTML";
static const char SETUP_HEAD[] = R"HTML(<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>박스 카운터 와이파이 설정</title>
<style>body{font-family:sans-serif;margin:16px;color:#222;font-size:17px;max-width:560px}h1{font-size:21px;margin:4px 0 10px}.box{border:1px solid #ccc;border-radius:10px;padding:12px;margin:10px 0}
.bad{color:#c62828}.ok{color:#2e7d32}button.n{display:block;width:100%;text-align:left;padding:11px;margin:5px 0;font-size:17px;border:1px solid #bbb;border-radius:8px;background:#fafafa}
button.n small{color:#666;margin-left:6px}input{width:100%;font-size:18px;padding:10px;box-sizing:border-box;margin:4px 0 12px;border:1px solid #999;border-radius:8px}
button.s{width:100%;font-size:19px;padding:13px;background:#1e3a5f;color:#fff;border:0;border-radius:8px}a{color:#1e3a5f}</style></head><body><h1>박스 카운터 · 와이파이 설정</h1>)HTML";

void sendLoader() { web.sendHeader("Cache-Control", "no-store"); web.send(200, "text/html; charset=utf-8", LOADER); }

void webSetup() {
  if (web.hasArg("scan")) {
    scanReq = true;
    web.send(200, "text/html; charset=utf-8", String(SETUP_HEAD) + "<p>와이파이를 다시 찾는 중… 잠시 뒤 목록이 새로 나옵니다.</p><meta http-equiv=refresh content='7;url=/setup'></body></html>");
    return;
  }
  String s, list;
  xSemaphoreTake(wlock, portMAX_DELAY); s = cfgSsid; list = scanHtml; xSemaphoreGive(wlock);
  String h = SETUP_HEAD;
  if (WiFi.status() == WL_CONNECTED)
    h += "<div class='box ok'>와이파이 \"" + htmlEsc(s) + "\" 연결됨 · 주소 " + WiFi.localIP().toString() + " · 서버 " +
         (netOk ? "정상 (관제판 연결됨)" : "<span class=bad>안 됨 — 와이파이는 붙었는데 인터넷으로 못 나감</span>") + "</div>";
  else if (s.length() == 0)
    h += "<div class='box bad'>아직 넣은 와이파이가 없습니다. 아래 목록에서 고르고 비밀번호를 넣으세요.</div>";
  else
    h += "<div class='box bad'>와이파이 \"" + htmlEsc(s) + "\" 안 붙음 — " + reasonKo(wifiReason) + "</div>";
  h += "<div class=box><b>이 기기에 보이는 와이파이</b><br><small>누르면 이름이 아래 칸에 들어갑니다 · 5GHz 와이파이는 안 보입니다 · ▶ = 지금 넣은 것</small>" + list +
       "<a href='/setup?scan=1'>↻ 다시 찾기</a></div>";
  h += "<form method=post action=/save><div class=box><b>와이파이 이름</b><input name=ssid id=ss value=\"" + htmlEsc(s) +
       "\" autocomplete=off><b>비밀번호</b><input name=pass type=password placeholder='비밀번호 (없으면 비움)' autocomplete=off>"
       "<button class=s>저장하고 붙기</button></div></form>";
  if (WiFi.status() == WL_CONNECTED) {
    String fx = fixedIpFor(s), cur = WiFi.localIP().toString();
    h += "<form method=post action=/fix><div class=box><b>주소 고정</b><br>";
    if (fx.length())
      h += "<span class=ok>지금 주소 " + htmlEsc(fx) + " 로 고정됨</span> (이 와이파이에서만)<br><small>포장대·뒤쪽 화면이 늘 이 주소로 열립니다.</small>"
           "<input type=hidden name=off value=1><button class=s style='background:#777;margin-top:10px'>고정 풀기</button>";
    else
      h += "지금 주소 <b>" + cur + "</b> (자동 — 기기를 다시 켜면 바뀔 수 있음)<br><small>고정하면 포장대·뒤쪽 화면 주소가 안 바뀝니다. 그 와이파이에서만 적용.</small>"
           "<button class=s style='margin-top:10px'>이 주소(" + cur + ")로 고정</button>";
    h += "</div></form>";
  }
  h += "<p><small>저장하면 기기가 기억해서 다시 켜도 그대로입니다. 붙으면 이 설정용 와이파이는 꺼집니다.</small></p>"
       "<script>document.querySelectorAll('button.n').forEach(function(b){b.onclick=function(e){e.preventDefault();document.getElementById('ss').value=b.dataset.s;"
       "document.querySelector('input[name=pass]').focus();};});</script></body></html>";
  web.sendHeader("Cache-Control", "no-store");
  web.send(200, "text/html; charset=utf-8", h);
}

void webSave() {
  String s = web.arg("ssid"), p = web.arg("pass");
  s.trim();
  if (s.length() == 0 || s.length() > 32 || p.length() > 63) {
    web.send(200, "text/html; charset=utf-8", String(SETUP_HEAD) + "<p class=bad>와이파이 이름을 넣어 주세요(32자 이내).</p><a href='/setup'>돌아가기</a></body></html>");
    return;
  }
  saveCfg(s, p);
  cfgChanged = true;
  web.send(200, "text/html; charset=utf-8", String(SETUP_HEAD) + "<div class='box ok'>저장했습니다. 기기가 \"" + htmlEsc(s) +
           "\" 에 붙는 중입니다.</div><p>붙으면 설정용 와이파이(BoxCounter-Setup)가 꺼지고 휴대폰은 원래 와이파이로 돌아갑니다. "
           "관제판 박스 센서 줄이 <b>센서 연결됨</b>으로 바뀌면 끝입니다.</p><p>1분 뒤에도 BoxCounter-Setup 이 다시 보이면 안 붙은 것이니, 다시 붙어서 이유를 확인하세요.</p></body></html>");
}

void webFix() {
  if (WiFi.status() != WL_CONNECTED) { web.sendHeader("Location", "/setup", true); web.send(302, "text/plain", ""); return; }
  bool off = web.hasArg("off");
  saveFix(!off);
  Serial.printf("[주소] %s\n", off ? "고정을 풀었습니다 — 다음에 붙을 때부터 자동 주소" : ("지금 주소로 고정했습니다: " + WiFi.localIP().toString()).c_str());
  web.sendHeader("Location", "/setup", true); web.send(302, "text/plain", "");
}

void webNow() {
  uint32_t t, tag, lc; bool blk;
  portENTER_CRITICAL(&mux); t = total; tag = bootTag; blk = blockedNow; lc = lastCountMs; portEXIT_CRITICAL(&mux);
  char b[160];
  snprintf(b, sizeof b, "{\"boot\":\"%08lx\",\"total\":%lu,\"blocked\":%s,\"ago\":%lu,\"up\":%lu}",
           (unsigned long)tag, (unsigned long)t, blk ? "true" : "false",
           (unsigned long)(lc ? millis() - lc : 0), (unsigned long)(millis() / 1000));
  web.sendHeader("Cache-Control", "no-store");
  web.sendHeader("Access-Control-Allow-Origin", "*");
  web.send(200, "application/json", b);
}

void webTask(void*) {
  while (!wifiReady) vTaskDelay(pdMS_TO_TICKS(100));
  web.on("/now", webNow);
  web.on("/setup", webSetup);
  web.on("/save", webSave);
  web.on("/fix", webFix);
  web.on("/", []() { if (apMode) webSetup(); else sendLoader(); });
  web.onNotFound([]() {
    if (apMode) { web.sendHeader("Location", "http://192.168.4.1/setup", true); web.send(302, "text/plain", ""); }   // 휴대폰 '로그인 화면'으로 띄우기
    else sendLoader();
  });
  web.begin();
  for (;;) {
    if (apMode && xSemaphoreTake(wlock, 0) == pdTRUE) { if (apMode) dns.processNextRequest(); xSemaphoreGive(wlock); }
    web.handleClient();
    vTaskDelay(pdMS_TO_TICKS(2));
  }
}

// ── 보내는 쪽: 와이파이 붙이기 + 서버로 숫자 보내기 (코어 0에서 따로 돈다 → 세는 건 절대 안 멈춤) ──
WiFiClientSecure tls;
HTTPClient http;

int postOnce(uint32_t t, uint32_t tag, bool blk, bool stk, String& resp) {
  char body[300];
  snprintf(body, sizeof body,
           "{\"dev\":\"%s\",\"key\":\"%s\",\"boot\":\"%08lx\",\"total\":%lu,\"blocked\":%s,\"stuck\":%s,\"rssi\":%d,\"up\":%lu,\"ip\":\"%s\"}",
           DEV_ID, DEV_KEY, (unsigned long)tag, (unsigned long)t, blk ? "true" : "false", stk ? "true" : "false",
           (int)WiFi.RSSI(), (unsigned long)(millis() / 1000), WiFi.localIP().toString().c_str());
  if (!http.begin(tls, SERVER)) return -100;
  http.addHeader("Content-Type", "application/json");
  int code = http.POST((uint8_t*)body, strlen(body));
  resp = code > 0 ? http.getString() : String();
  http.end();
  return code;
}

void netTask(void*) {
  tls.setInsecure();          // 인증서 확인 생략(공장 와이파이 안에서 쓰는 장치용)
  http.setReuse(true);        // 한 번 붙은 연결을 다시 씀 → 보내기가 빨라짐
  http.setTimeout(6000);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.onEvent([](WiFiEvent_t e, WiFiEventInfo_t info) {
    if (e == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) wifiReason = info.wifi_sta_disconnected.reason;
  });
  wifiReady = true;
  doScan();
  staBegin();
  uint32_t tryAt = millis(), downSince = millis(), apAt = 0, lastPost = 0, sentTotal = 0xFFFFFFFF, sentTag = 0, saidAt = 0;
  if (cfgSsidCopy().length() == 0) { apStart(); apAt = millis(); }   // 넣은 와이파이가 없으면 바로 설정용 와이파이
  bool wasUp = false, mdnsOn = false;
  for (;;) {
    if (cfgChanged) {   // 휴대폰에서 새 와이파이를 저장함
      cfgChanged = false; delay(800);   // 저장 화면이 휴대폰에 다 가도록 잠깐
      if (apMode) apStop();
      WiFi.disconnect(); delay(200); wifiReason = 0; netOk = false;
      staBegin(); tryAt = downSince = millis();
    }
    if (wifiKick) { wifiKick = false; if (apMode) apStop(); WiFi.disconnect(); delay(300); doScan(); staBegin(); tryAt = downSince = millis(); }
    if (scanReq) { scanReq = false; doScan(); }

    if (WiFi.status() != WL_CONNECTED) {
      if (wasUp) { wasUp = false; netOk = false; Serial.println("[와이파이] 끊김 — 다시 붙는 중 (숫자는 계속 셉니다)"); }
      uint8_t r = wifiReason;
      netCode = (r == 2 || r == 15 || r == 202 || r == 204) ? 2 : 1;
      if (!apMode && r && millis() - saidAt > 10000) { saidAt = millis(); Serial.printf("[와이파이] 안 붙음 — %s (이유 번호 %u)\n", reasonKo(r), r); }
      if (!apMode) {
        if (millis() - downSince > AP_AFTER_MS) { apStart(); apAt = millis(); }
        else if (millis() - tryAt > 20000) { WiFi.disconnect(); delay(200); staBegin(); tryAt = millis(); }
      } else if (millis() - apAt > AP_RETRY_MS && WiFi.softAPgetStationNum() == 0) {
        // 설정 화면에 아무도 없으면 원래 와이파이에 다시 붙어 봄(공유기가 다시 켜졌을 수도)
        apStop(); staBegin(); tryAt = downSince = millis();
      }
      vTaskDelay(pdMS_TO_TICKS(300));
      continue;
    }
    downSince = millis(); wifiReason = 0;
    if (!wasUp) {
      wasUp = true; lastPost = 0;
      Serial.printf("[와이파이] \"%s\" 연결됨 · %s%s · 신호 %d dBm\n", cfgSsidCopy().c_str(), WiFi.localIP().toString().c_str(),
                    fixedIpFor(cfgSsidCopy()).length() ? " (고정)" : " (자동 — 고정하려면 /setup)", WiFi.RSSI());
      Serial.printf("[벨트 화면] 같은 와이파이 휴대폰·태블릿에서  http://%s/  (또는 http://boxcounter.local/) · 와이파이 바꾸기 http://%s/setup\n",
                    WiFi.localIP().toString().c_str(), WiFi.localIP().toString().c_str());
      if (!mdnsOn && MDNS.begin("boxcounter")) { MDNS.addService("http", "tcp", 80); mdnsOn = true; }
    }
    if (!netOk) netCode = 3;

    uint32_t t, tag; bool blk, stk;
    portENTER_CRITICAL(&mux); t = total; tag = bootTag; blk = blockedNow; stk = stuckNow; portEXIT_CRITICAL(&mux);
    uint32_t now = millis();
    bool changed = (t != sentTotal || tag != sentTag);
    if ((changed && (lastPost == 0 || now - lastPost >= SEND_GAP_MS)) || lastPost == 0 || now - lastPost >= BEAT_MS) {
      String resp;
      uint32_t t0 = millis();
      int code = postOnce(t, tag, blk, stk, resp);
      lastPost = millis();
      if (code == 200) {
        bool first = !netOk;
        netOk = true; netCode = 0; netOkAt = millis(); netSent++;
        if (apMode) apStop();   // 서버까지 붙었으면 설정용 와이파이는 끔
        if (changed || first) Serial.printf("[서버] %lu개 보냄 ✓ (%.1f초)%s\n", (unsigned long)t, (millis() - t0) / 1000.0,
                                            first ? " — 관제판 연결됨" : "");
        sentTotal = t; sentTag = tag;
        int a = resp.indexOf("\"adv\":");
        if (a >= 0 && resp.substring(a + 6).toInt() > 0)
          Serial.printf("[관제판] 센서 숫자가 지시 수량에 닿아 '끝 · 다음' 했습니다 (%ld줄)\n", resp.substring(a + 6).toInt());
      } else {
        netOk = false; netCode = 3; netFail++;
        if (code == 401) Serial.println("[서버] 기기 열쇠(DEV_KEY)가 맞지 않습니다 — 받은 파일 그대로인지 확인");
        else if (code < 0) Serial.printf("[서버] 못 보냄 (코드 %d) — 와이파이는 붙었는데 인터넷으로 못 나감: 로그인 화면 있는 와이파이거나 인터넷이 막힌 와이파이\n", code);
        else Serial.printf("[서버] 못 보냄 (코드 %d) — 잠시 뒤 다시 보냅니다\n", code);
        vTaskDelay(pdMS_TO_TICKS(code == 401 ? 30000 : 2000));
      }
    }
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(PIN_IN, INPUT_PULLUP);
  pinMode(PIN_LED, OUTPUT);
  bootTag = newTag();
  wlock = xSemaphoreCreateMutex();
  Serial.println();
  Serial.println("=== 박스 카운터 · 와이파이판 v6 ===");
  Serial.println("센서 사이를 비워 두세요 — 2초 동안 기준을 잡습니다");
  delay(1000);
  calibrate();
  loadCfg();
  xTaskCreatePinnedToCore(netTask, "net", 12288, nullptr, 1, nullptr, 0);
  xTaskCreatePinnedToCore(webTask, "web", 8192, nullptr, 1, nullptr, 0);
  Serial.println("준비 끝 — 가렸다 떼면 1씩 올라갑니다 (r=0으로, c=기준, s=상태, w=와이파이)");
}

void loop() {
  uint32_t now = millis();
  bool raw = digitalRead(PIN_IN) != idleLevel;   // true = 가림

  if (raw != rawPrev) { rawPrev = raw; rawSince = now; }
  uint32_t held = now - rawSince;

  if (!blocked && raw && held >= BLOCK_MIN_MS) {
    blocked = true;
    blockStart = rawSince;
    lastGapMs = lastCountAt ? (blockStart - lastCountAt - lastBlockMs) : 0;
    portENTER_CRITICAL(&mux); total++; blockedNow = true; lastCountMs = now; portEXIT_CRITICAL(&mux);
    lastCountAt = blockStart;
    stuckWarned = false;
    Serial.printf("[카운트] %lu  (앞 박스와 틈 %.2f초)\n", (unsigned long)total, lastGapMs / 1000.0);
  } else if (blocked && !raw && held >= CLEAR_MIN_MS) {
    blocked = false;
    blockedNow = false; stuckNow = false;
    lastBlockMs = rawSince - blockStart;
    Serial.printf("         가린 시간 %.2f초\n", lastBlockMs / 1000.0);
  }

  if (blocked && !stuckWarned && now - blockStart > STUCK_MS) {
    stuckWarned = true; stuckNow = true;
    Serial.println("[막힘] 20초 넘게 가려져 있습니다 — 박스가 걸렸거나 센서가 틀어졌는지 보세요");
  }

  // LED(있는 보드만): 가림이면 켜짐. 안 가렸는데 연결 문제면 2.5초마다 netCode 번 깜빡(1 이름 · 2 비번 · 3 인터넷)
  int nc = netCode; uint32_t ph = now % 2500;
  bool led = blocked || (nc > 0 && ph < (uint32_t)nc * 300 && (ph % 300) < 150);
  digitalWrite(PIN_LED, led ? HIGH : LOW);

  if (Serial.available()) {
    char ch = Serial.read();
    if (ch == 'r') {
      portENTER_CRITICAL(&mux); total = 0; bootTag = newTag(); portEXIT_CRITICAL(&mux);
      lastCountAt = 0; Serial.println("[0으로] 누적을 0으로 했습니다(서버에는 '새로 켜짐'으로 알림 — 관제판 숫자는 안 줄어듦)");
    }
    else if (ch == 'c') { Serial.println("센서 사이를 비우세요 — 기준 다시 잡는 중"); calibrate(); }
    else if (ch == 's') { printStatus(); }
    else if (ch == 'w') { wifiKick = true; }
  }

  if (now - lastStatusAt > 60000) { lastStatusAt = now; printStatus(); }

  delay(1);
}
