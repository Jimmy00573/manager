# 펌웨어 (ESP32)

## box_counter_wifi — 벌크 라인 박스 카운터 (테이핑기 출구 광센서)
- `box_counter_wifi/box_counter_wifi.ino` — 최신본 (2026-11-10). 휴대폰 설정 화면(/setup)으로 와이파이 입력.
- `old/box_counter_wifi_1109a.ino`, `old/box_counter_wifi_1109b.ino` — 11/9 이전 판(참고용).

## ⚠️ 비밀 값은 비워 두었다
이 저장소는 공개라서 아래 값은 빈칸("")으로 올렸다. 기기에 올릴 때 직접 채운다.
- `WIFI_SSID`, `WIFI_PASS` (현장 와이파이) — 최신본은 비워 둬도 휴대폰 설정 화면에서 넣을 수 있음
- `AP_PASS` (설정용 와이파이 비밀번호)
- `DEV_KEY` (이 센서 전용 키 — 서버 등록값과 같아야 함)

실제 값이 들어 있는 원본은 공장 PC `manager/Claude outputs/` 폴더에만 있다(git에 안 올라감).
