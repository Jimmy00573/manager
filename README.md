# 🍊 감귤 수송·콘테이너 통합 관리 시스템

## 배포 순서 (A-Z)

---

## STEP 1 — Supabase 설정

### 1-1. 가입
1. [supabase.com](https://supabase.com) 접속
2. **Start your project** → 구글 계정으로 로그인

### 1-2. 프로젝트 생성
1. **New project** 클릭
2. 설정:
   - Name: `citrus-manager`
   - Database Password: 안전한 비밀번호 (메모 필수!)
   - Region: **Northeast Asia (Seoul)**
3. **Create new project** → 약 2분 대기

### 1-3. 테이블 생성
1. 좌측 메뉴 **SQL Editor** 클릭
2. `setup.sql` 파일 내용 전체 복사 → 붙여넣기
3. **Run** 클릭 → `Success` 확인

### 1-4. API 키 복사
1. 좌측 메뉴 **Settings** → **API**
2. 아래 두 값을 메모장에 복사:
   - **Project URL** (예: `https://abcdefgh.supabase.co`)
   - **anon public** 키

---

## STEP 2 — 앱 설정

### `src/supabase-client.js` 파일 수정

```javascript
const SUPABASE_URL = 'https://여기에_URL_입력.supabase.co';
const SUPABASE_ANON_KEY = '여기에_ANON_KEY_입력';

// 관리자 PIN 변경 (4자리 숫자)
const ADM_PIN = '0000';  // ← 원하는 번호로 변경하세요
```

---

## STEP 3 — GitHub 업로드

### 3-1. 저장소 생성
1. [github.com](https://github.com) 가입/로그인
2. 우상단 `+` → **New repository**
3. Repository name: `citrus-manager`
4. **Public** 선택 → **Create repository**

### 3-2. 파일 업로드
1. `uploading an existing file` 클릭
2. 아래 파일 구조 전체를 드래그 앤 드롭:
   ```
   citrus-manager/
   ├── index.html
   ├── setup.sql
   ├── README.md
   └── src/
       ├── style.css
       ├── supabase-client.js  ← URL과 키 입력 완료 후
       ├── db.js
       ├── app.js
       └── sms.js
   ```
3. **Commit changes** 클릭

---

## STEP 4 — Vercel 배포

### 4-1. 가입
1. [vercel.com](https://vercel.com) 접속
2. **Sign Up** → **Continue with GitHub**

### 4-2. 배포
1. **Add New** → **Project**
2. GitHub에서 `citrus-manager` 저장소 선택 → **Import**
3. 설정 변경 없이 바로 **Deploy** 클릭
4. 약 1분 후 배포 완료

### 4-3. URL 확인
- 배포 완료 후 `citrus-manager-xxx.vercel.app` 형태의 URL 생성
- 이 URL을 직원들에게 공유!

---

## 접속 방법

| 역할 | 접속 방법 |
|------|----------|
| 관리자 | URL 접속 → 관리자 탭 → PIN: `0000` (변경 권장) |
| 기사 | URL 접속 → 기사 로그인 → 이름 선택 → PIN 입력 |

---

## 기사 PIN 관리

- **기사 등록** 시 PIN 자동 발급 → 팝업으로 확인 → 기사에게 전달
- **퇴사 기사**: 기사·PIN 관리 탭 → 🚫 차단 → 즉시 로그인 불가
- **신규 기사**: 기사 등록 → 자동 발급된 PIN 전달
- **PIN 분실**: 🔄 재발급 → 새 PIN 팝업 → 기사에게 전달

---

## SMS 발송 설정 (선택사항)

`src/sms.js` 파일에서 API 키 입력:

```javascript
const SMS_CONFIG = {
  aligo: {
    apiKey: '알리고_API_KEY',
    userId: '알리고_USER_ID',
    sender: '발신번호'
  }
};
```

**추천 서비스**: [알리고](https://smartsms.aligo.in) — 건당 약 8원, 가입 간단

---

## 문의 사항

배포 과정에서 문제가 생기면 에러 메시지와 함께 문의해 주세요!
