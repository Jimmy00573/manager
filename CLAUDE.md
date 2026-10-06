# 시트리앙 통합관리 — 작업 규칙 (Claude Code용)

제주 감귤 선과장 통합관리 웹앱. 바닐라 JS 단일 파일(src/app.js, 빌드 없음) + Supabase + Vercel(main 푸시 = 자동 배포).
역할: 공장장(사용자) = 결정·운영 / 설계·검증 담당 Claude(채팅) = 설계·프롬프트·diff 검증 / Claude Code = 코딩·커밋·푸시.
이 파일은 공개 저장소에 있다 — 키·비밀번호·개인 이름·연락처를 적지 말 것.

## 1. 작업 원칙
- 지시 범위만 고친다. 범위 밖 문제를 발견하면 고치지 말고 보고의 "알아 두실 점"에 적는다.
- 새 함수·헬퍼를 만들기 전에 grep으로 같은 기능을 먼저 찾는다. 있으면 재사용, 없을 때만 신규.
- 옛 화면·함수를 복사해서 새로 만들지 않는다(옛 결함까지 복제된다). 고칠 일은 원본을 고쳐 모든 호출처에 반영.
- 표시 로직은 공용 헬퍼를 호출로 통일한다(아래 4장).
- 운영 중 잘 도는 코드는 실익 없는 리팩토링 금지.

## 2. 배포 · 커밋
- 코드를 바꾸면 index.html의 해당 파일 캐시 버전(app.js?v=N, db.js?v=N 등)을 매번 +1. 바뀐 파일만.
- 커밋 후 push, git log origin/main..HEAD가 비어 있는지 확인(푸시 누락 사고가 반복됐다).
- node --check로 바뀐 JS 파일 문법 검사.
- 디버깅용 console.log는 검증 뒤 별도 커밋으로 제거.

## 3. 검증 · 보고
- 헤드리스로 실제 앱을 띄워 검증할 때 실DB는 읽기만. 쓰기(insert/update/delete/이력)는 가짜 함수로 가로챈다.
- 실DB 쓰기가 필요한 확인은 사용자에게 넘기고, 확인용 SQL 한 줄을 같이 적는다.
- 보고 순서: 바뀐 것 → 검증 결과 → 자가점검 → **지시와 다르게 한 것** → **질문/알아 두실 점**.
  마지막 두 칸은 사용자가 그대로 복사해 전달하므로 짧고 독립적으로 쓴다.

## 4. 공용 헬퍼 (새로 만들지 말고 이걸 쓴다)
- 날짜: td()(오늘, 로컬) · ymd(dt) · _dayBefore(ds) · _dayAfter(ds) · _ibDaysSince(ds)
- 표시: esc · fmtN · showToast · _sizeGroupCols · fruitNoBadge · _sizeDistInline(축약 '소30 · 로50')
- 확인창: showConfirmDanger({...}) / cDel(메시지)(위험 삭제, 작업자·사유) · showConfirmEdit(title, msg, { confirmText, altText }) → true / false / 'alt'
- 선택칸: buildSupplierOptHtml · buildInboundSupplierOptHtml · buildLocOptHtml · _selEnsureVal(el, val, label)(목록에 없는 저장값 유지)
- 기사: _activeDrivers()(차단 제외) · _drvOptsHtml(valueBy)(직원/기사 optgroup) · _drvKeepLabel(name)
- 품목·사이즈: _kgPerCt(품목) · getSizeGroupsFor(품목) · gradeOf(r)(null = '일반') · PACHI_TYPES
- 미선과: _isUnsortedTarget · _ibProcessedMap · _ibUnsortedRows() · _ibIsUrgent(row, { includeStarred })
- 선과 비율·예상: _srRatios(details, groups) · _scForecast(rec, detailsBySr) · _fcBarHtml(fc)
- 같은 차 판정: _ibShareCluster(rows, target)(2분 묶음) · _ibTruckGroups · _dispSameTrip(d)
- 배차 완료: _completeDispatch(d)(멱등, 배출 pick + 보고) · 오늘 작업 순서: _scPlanNo · _scPlanNextNo()
- 콘테이너: getFCS · getFCtypeMap · getSt · _isExtraOutPick · _qrHoldTypes · _ctQtyHint
- 수확: _hvAskDoneDate(h)(완료일 확인창)
- DB: sbGet · sbInsert · sbUpdate · sbDeleteStrict · dbGetSortingDetails · dbInsertAuditLog

## 5. 데이터 규칙
- inventory_records는 soft delete(is_void=true). 물리 삭제 금지.
- 등급(quality_grade: 고당 등, null = 일반)별로 수정·삭제를 분리. 한 등급 작업이 다른 등급을 건드리면 데이터 손실.
- 선과품 출고는 weight_kg가 대부분 NULL → kg = weight_kg 있으면 그것, 없으면 CT × _kgPerCt(품목).
- 재고 배치 구분 키 = 농가 + groupId(sorting이면 sorting_result_id, manual이면 manual_날짜).
- 품목 유형(감귤류/만감류)은 items 테이블 category가 기준(하드코딩 표 아님).
- 삭제·수정은 작업자·사유를 남기고, 다른 기기에 알려야 하는 변경은 audit_logs 한 줄을 남긴다.

## 6. 반복 함정 (교훈)
- 날짜: toISOString().slice(0,10) 금지(UTC → 한국 시간과 하루 어긋남). 문자열 날짜는 new Date(ds + 'T00:00:00').
- id 정렬: 주요 테이블 id가 uuid다. a.id - b.id 금지(NaN) → String(a.id).localeCompare(String(b.id)).
- Supabase 조회는 한 번에 1,000행에서 소리 없이 잘린다. 많을 수 있으면 나눠 받는다(예: id 20개씩).
- '같은 날·같은 농가·같은 기사'만으로 묶으면 다른 차까지 묶인다 → 같은 차는 _dispSameTrip / _ibShareCluster.
- 차단(pin_active=false)된 기사는 새로 고르는 칸에서 빼고, 옛 기록 수정 칸에선 저장값을 유지(_selEnsureVal).
- 입력 중 화면을 다시 그리면 커서·값이 날아간다 — 입력칸에 포커스가 있으면 계산 칸만 제자리 갱신.
- DB 저장은 성공한 뒤에 로컬 상태를 바꾼다. 연타는 busy 플래그로 막는다.
- 확인창·버튼을 숨기는 것만으로는 부족 — 함수 첫 줄에서도 관리자 권한을 검사.

## 7. 화면 디자인
- 미니멀: 흰 배경, 옅은 회색 보더(#E5E7EB), 색 절제. 인쇄는 @media print 보고서 톤.
- 색 토큰: 고당 #1565C0 · 중립 #6B7280/#374151 · 위험 #DC2626 · 강조 #7C3AED · 펼침/선택 #1E3A5F · 흐림 #9CA3AF
- 폰트 weight 400/500(600은 기존 패턴 따를 때만). 새 색·간격을 즉흥적으로 만들지 않는다.
- 한 줄 가로 나열을 2열 그리드보다 선호. 폰은 표 가로 스크롤로 흡수.

## 8. 도메인
- 감귤류 사이즈: 000, 00, 3S, 2S1, 2S2, S1, S2, M1, M2, L, 2L, 3L, 왕1, 왕2
  그룹: 극소과(000·00) / 소과(3S·2S1·2S2) / 로얄과(S1~M2) / 중과(L·2L) / 대과(3L·왕1·왕2)
- 만감류: N수(5~27수), 그룹 대/중/소. getSizeGroupsFor는 만감류를 대→소 순으로 준다.
- 입고 카테고리: 상품·대과·소과·청과·파치·왕대과(파치류는 _IB_PACHI_SRC). 대과·소과는 보통 선과 없이 바로 출고.
