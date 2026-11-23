/*
  선과장 박스 자동 카운터 — 2단계 와이파이판 (관제판 연결) · v2: 벨트 화면
  ESP32 + 투과형 광센서(E3Z-T61) + PC817 절연 모듈 — 배선은 1단계와 똑같습니다.

  하는 일
  - 광센서 빛이 가려질 때마다 박스 1개로 셉니다(1단계와 같은 거르기).
  - 센 숫자를 와이파이로 관제판 서버에 보냅니다. 숫자가 바뀌면 바로, 안 바뀌어도 30초마다 '살아 있음'.
  - 보내는 숫자는 '켜진 뒤 누적'이라, 와이파이가 잠깐 끊겨도 다시 붙으면 빠진 것 없이 채워집니다.
  - v2: 같은 와이파이의 휴대폰·태블릿으로 http://(이 기기 주소)/ 를 열면 '벨트 화면'.
        방금 지나간 박스가 어떤 품목인지 0.3초 안에 보여 줍니다(서버를 안 거침). 주소는 시리얼과 관제판 센서 줄에 나옵니다.
  - 보드 파란 LED: 빛이 가려진 동안 켜짐(센서 정렬 확인).
                   가려지지 않았는데 2초마다 짧게 깜빡이면 = 와이파이·서버 연결 안 됨.

  처음 한 번 — 아래 두 줄만 고치세요 (따옴표는 지우지 마세요)
  - WIFI_SSID : 공장 와이파이 이름   - WIFI_PASS : 비밀번호
  - ESP32는 2.4GHz 와이파이만 됩니다. 이름 뒤에 _5G 붙은 것은 안 됩니다.

  켤 때 주의 — 켜고 처음 2초 동안 센서 사이를 비워 두세요(빛 통과 상태를 기준으로 잡음).
  시리얼 명령(115200): r = 숫자 0으로,  c = 기준 다시 잡기,  s = 지금 상태,  w = 와이파이 다시 붙기
  ※ 아래 DEV_KEY는 이 센서 전용 열쇠입니다. 다른 사람에게 보내거나 사진 찍어 올리지 마세요.
*/
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ESPmDNS.h>

const char* WIFI_SSID = "";
const char* WIFI_PASS = "";

const char* DEV_ID  = "bulk1";   // 벌크 라인 테이핑기 출구
const char* DEV_KEY = "";
const char* SERVER  = "https://pogrtghqsxryphfkyfgb.supabase.co/functions/v1/counter";

const int PIN_IN  = 27;   // 절연 모듈 OUT
const int PIN_LED = 2;    // 보드 파란 LED

// 거르는 기준 — 설치한 뒤 실제 박스로 맞춥니다(1단계와 같음)
const uint32_t BLOCK_MIN_MS = 40;     // 이보다 짧게 가려지면 무시(잡음·스치는 손)
const uint32_t CLEAR_MIN_MS = 120;    // 박스 사이 틈이 이보다 짧으면 같은 박스로 봄
const uint32_t STUCK_MS     = 20000;  // 이보다 오래 가려져 있으면 '막힘'
// 보내기
const uint32_t SEND_GAP_MS  = 300;    // 숫자가 바뀌어도 이 간격보다 자주는 안 보냄(몰리면 한꺼번에)
const uint32_t BEAT_MS      = 30000;  // 안 바뀌어도 이 간격마다 '살아 있음'

// ── 세는 쪽(loop)과 보내는 쪽(netTask)이 같이 보는 값 ──
portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
volatile uint32_t total = 0;       // 켜진 뒤(또는 r 뒤) 센 박스
volatile uint32_t bootTag = 0;     // 켜질 때·r 할 때마다 새로 뽑음 → 서버가 '0부터 다시'를 알아봄
volatile bool blockedNow = false;
volatile bool stuckNow = false;
volatile bool netOk = false;       // 마지막 보내기가 성공했나
volatile uint32_t netOkAt = 0, netFail = 0, netSent = 0;
volatile bool wifiKick = false;
volatile uint32_t lastCountMs = 0;  // 마지막으로 센 시각(벨트 화면용)

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

void printStatus() {
  bool raw = digitalRead(PIN_IN) != idleLevel;
  Serial.printf("[상태] 누적 %lu개 · 지금 %s · 핀 %s · 켜진 지 %lu초\n",
                (unsigned long)total, raw ? "가림" : "통과",
                digitalRead(PIN_IN) == HIGH ? "HIGH" : "LOW", (unsigned long)(millis() / 1000));
  if (WiFi.status() == WL_CONNECTED)
    Serial.printf("       와이파이 연결됨 · 신호 %d dBm · 서버 %s (보냄 %lu · 실패 %lu) · 벨트 화면 http://%s/\n", WiFi.RSSI(),
                  netOk ? "정상" : "안 됨", (unsigned long)netSent, (unsigned long)netFail, WiFi.localIP().toString().c_str());
  else
    Serial.printf("       와이파이 안 됨 — 이름·비밀번호·2.4GHz인지 확인 (\"%s\")\n", WIFI_SSID);
}

// ── 벨트 화면: 같은 와이파이 안에서 바로 보는 화면 (서버를 안 거쳐 0.3초 안) ──
//   /now  = 지금 누적 숫자(JSON)   그 밖 = 관제판 화면을 불러와 '벨트' 모드로 띄우는 문
WebServer web(80);
static const char LOADER[] = R"HTML(<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>벨트 화면</title></head>
<body style="font-family:sans-serif;padding:30px;color:#555;font-size:18px">벨트 화면 불러오는 중… (인터넷이 되는 와이파이여야 합니다)
<script>
if(!/[?&]view=/.test(location.search))location.replace('/?view=belt');
else fetch('https://pogrtghqsxryphfkyfgb.supabase.co/functions/v1/board/px?k=seonkwa2026',{method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({conn:'main',path:'op_settings?key=eq.board_html&select=value',method:'GET'})})
 .then(function(r){if(!r.ok)throw new Error('서버 응답 '+r.status);return r.json();})
 .then(function(rows){var h=rows&&rows[0]&&rows[0].value&&rows[0].value.html;if(!h)throw new Error('화면 없음');document.open();document.write(h);document.close();})
 .catch(function(e){document.body.innerHTML='불러오지 못했습니다: '+e.message+'<br>새로고침 해 보세요.';});
</script></body></html>)HTML";

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
  while (WiFi.status() != WL_CONNECTED) vTaskDelay(pdMS_TO_TICKS(300));
  web.on("/now", webNow);
  web.onNotFound([]() { web.sendHeader("Cache-Control", "no-store"); web.send(200, "text/html; charset=utf-8", LOADER); });
  web.begin();
  if (MDNS.begin("boxcounter")) MDNS.addService("http", "tcp", 80);
  for (;;) { web.handleClient(); vTaskDelay(pdMS_TO_TICKS(2)); }
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
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("[와이파이] \"%s\" 에 붙는 중…\n", WIFI_SSID);
  uint32_t tryAt = millis(), lastPost = 0, sentTotal = 0xFFFFFFFF, sentTag = 0;
  bool wasUp = false;
  for (;;) {
    if (wifiKick) { wifiKick = false; WiFi.disconnect(); delay(200); WiFi.begin(WIFI_SSID, WIFI_PASS); tryAt = millis();
      Serial.println("[와이파이] 다시 붙는 중…"); }
    if (WiFi.status() != WL_CONNECTED) {
      if (wasUp) { wasUp = false; netOk = false; Serial.println("[와이파이] 끊김 — 다시 붙는 중 (숫자는 계속 셉니다)"); }
      if (millis() - tryAt > 20000) { WiFi.disconnect(); delay(200); WiFi.begin(WIFI_SSID, WIFI_PASS); tryAt = millis(); }
      vTaskDelay(pdMS_TO_TICKS(300));
      continue;
    }
    if (!wasUp) { wasUp = true; Serial.printf("[와이파이] 연결됨 · %s · 신호 %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI()); lastPost = 0;
      Serial.printf("[벨트 화면] 같은 와이파이 휴대폰·태블릿에서  http://%s/  (또는 http://boxcounter.local/)\n", WiFi.localIP().toString().c_str()); }

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
        netOk = true; netOkAt = millis(); netSent++;
        if (changed || first) Serial.printf("[서버] %lu개 보냄 ✓ (%.1f초)%s\n", (unsigned long)t, (millis() - t0) / 1000.0,
                                            first ? " — 관제판 연결됨" : "");
        sentTotal = t; sentTag = tag;
        int a = resp.indexOf("\"adv\":");
        if (a >= 0 && resp.substring(a + 6).toInt() > 0)
          Serial.printf("[관제판] 센서 숫자가 지시 수량에 닿아 '끝 · 다음' 했습니다 (%ld줄)\n", resp.substring(a + 6).toInt());
      } else {
        netOk = false; netFail++;
        if (code == 401) Serial.println("[서버] 기기 열쇠(DEV_KEY)가 맞지 않습니다 — 받은 파일 그대로인지 확인");
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
  Serial.println();
  Serial.println("=== 박스 카운터 · 와이파이판 v2 ===");
  Serial.println("센서 사이를 비워 두세요 — 2초 동안 기준을 잡습니다");
  delay(1000);
  calibrate();
  xTaskCreatePinnedToCore(netTask, "net", 12288, nullptr, 1, nullptr, 0);
  xTaskCreatePinnedToCore(webTask, "web", 6144, nullptr, 1, nullptr, 0);
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

  // LED: 가림이면 켜짐. 안 가렸는데 서버 연결이 안 되면 2초마다 짧게 깜빡
  bool led = blocked || (!netOk && (now % 2000) < 80);
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
