-- ============================================================
--  감귤 수송·콘테이너 통합 관리 — Supabase 테이블 생성
--  사용법: Supabase > SQL Editor > 전체 복사 > Run
-- ============================================================

-- 1. 농가 테이블
CREATE TABLE IF NOT EXISTS farms (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  tel         TEXT,
  addr        TEXT,
  variety     TEXT,
  contract    INTEGER DEFAULT 0,
  staff       TEXT,
  memo        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 기사 테이블
CREATE TABLE IF NOT EXISTS drivers (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  tel         TEXT NOT NULL,
  car         TEXT,
  type        TEXT DEFAULT '내부',   -- '내부' | '외부'
  note        TEXT,
  pin         TEXT NOT NULL,          -- 4자리 숫자 PIN
  pin_active  BOOLEAN DEFAULT TRUE,   -- FALSE = 차단(퇴사)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 배차 테이블
CREATE TABLE IF NOT EXISTS dispatches (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  farm        TEXT NOT NULL,
  driver      TEXT NOT NULL,
  dtel        TEXT,
  car         TEXT,
  qty         INTEGER NOT NULL,
  ctype       TEXT NOT NULL,          -- '노랑' | '초록' | '헌콘'
  harvest     DATE,                   -- 수확 예정일
  item        TEXT,                   -- 품목
  note        TEXT,
  status      TEXT DEFAULT '배차완료', -- '배차완료' | '배출완료'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 수거/배출 기록 테이블
CREATE TABLE IF NOT EXISTS picks (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  farm        TEXT NOT NULL,
  type        TEXT NOT NULL,          -- '배출' | '원물수거' | '잉여회수'
  qty         INTEGER NOT NULL,
  driver      TEXT,
  car         TEXT,
  note        TEXT,
  dispatch_id BIGINT REFERENCES dispatches(id) ON DELETE SET NULL,
  auto        BOOLEAN DEFAULT FALSE,  -- 배차 등록 시 자동 생성 여부
  updated_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 농가 자가 콘테이너 반입
CREATE TABLE IF NOT EXISTS own_ins (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  farm        TEXT NOT NULL,
  qty         INTEGER NOT NULL,
  desc        TEXT,                   -- 콘테이너 특징
  staff       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 농가 자가 콘테이너 반납
CREATE TABLE IF NOT EXISTS own_outs (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  farm        TEXT NOT NULL,
  qty         INTEGER NOT NULL,
  method      TEXT,                   -- 반납 방법
  desc        TEXT,                   -- 콘테이너 특징
  staff       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 농협 용기 반입
CREATE TABLE IF NOT EXISTS nhf_ins (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  nhf         TEXT NOT NULL,          -- 농협명·지점
  type        TEXT NOT NULL,          -- 콘테이너 / 파렛트 / 사각 등
  desc        TEXT,                   -- 용기 특징
  qty         INTEGER NOT NULL,
  goods       TEXT,                   -- 구매 내용
  staff       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 농협 용기 반납
CREATE TABLE IF NOT EXISTS nhf_outs (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  nhf         TEXT NOT NULL,
  type        TEXT NOT NULL,
  method      TEXT,                   -- 반납 방법
  desc        TEXT,
  qty         INTEGER NOT NULL,
  staff       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 완료 보고
CREATE TABLE IF NOT EXISTS reports (
  id          BIGSERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  driver      TEXT NOT NULL,
  farm        TEXT NOT NULL,
  qty         INTEGER NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  RLS (Row Level Security) 설정
--  anon key로 모든 테이블에 읽기/쓰기 허용
--  (실제 운영 시 더 엄격한 정책 권장)
-- ============================================================

ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE own_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE own_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhf_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhf_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 모든 테이블 전체 접근 허용 (anon)
CREATE POLICY "allow_all_farms"      ON farms      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_drivers"    ON drivers    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_dispatches" ON dispatches FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_picks"      ON picks      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_own_ins"    ON own_ins    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_own_outs"   ON own_outs   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_nhf_ins"    ON nhf_ins    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_nhf_outs"   ON nhf_outs   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_reports"    ON reports    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
--  재고 관리 테이블 (현장재고 관리 기능)
-- ============================================================

-- 10. 미선과 입고 테이블
CREATE TABLE IF NOT EXISTS inventory_unsorted (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  date          DATE NOT NULL,
  farm_name     TEXT NOT NULL,
  product       TEXT NOT NULL,
  quantity      INTEGER NOT NULL,
  sub_quantity  INTEGER,
  size_dist     TEXT,
  location      TEXT NOT NULL,
  brix_min      NUMERIC,
  brix_max      NUMERIC,
  acid_min      NUMERIC,
  acid_max      NUMERIC,
  note          TEXT
);

-- 11. 선과 재고 테이블
CREATE TABLE IF NOT EXISTS inventory_sorted (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  date          DATE NOT NULL,
  farm_name     TEXT NOT NULL,
  product       TEXT NOT NULL,
  product_type  TEXT NOT NULL,
  count_num     TEXT NOT NULL,
  quantity      NUMERIC NOT NULL,
  location      TEXT
);

-- 12. 파치 재고 테이블
CREATE TABLE IF NOT EXISTS inventory_waste (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  date          DATE NOT NULL,
  product       TEXT NOT NULL,
  quantity      INTEGER NOT NULL,
  location      TEXT NOT NULL,
  purpose       TEXT NOT NULL,
  note          TEXT
);

-- 13. 주스/청 재고 테이블
CREATE TABLE IF NOT EXISTS inventory_juice (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  date          DATE NOT NULL,
  product       TEXT NOT NULL,
  unit          TEXT NOT NULL,
  box_qty       INTEGER,
  single_qty    INTEGER,
  total_qty     INTEGER NOT NULL,
  expiry_date   DATE,
  note          TEXT
);

ALTER TABLE inventory_unsorted ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_sorted   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_waste    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_juice    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_inv_unsorted" ON inventory_unsorted FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_inv_sorted"   ON inventory_sorted   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_inv_waste"    ON inventory_waste    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_inv_juice"    ON inventory_juice    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
--  완료! 이제 앱에서 데이터를 저장할 수 있습니다.
-- ============================================================

-- ============================================================
--  카테고리 기반 크기 분류 시스템 (v2)
-- ============================================================

-- 14. 카테고리 테이블
CREATE TABLE IF NOT EXISTS categories (
  id                  BIGSERIAL PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  classification_type TEXT NOT NULL DEFAULT 'count'
    CHECK (classification_type IN ('grade', 'count'))
);

-- 15. 크기 등급 테이블 (감귤류용)
CREATE TABLE IF NOT EXISTS size_grades (
  id          BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  grade_name  TEXT NOT NULL,
  group_name  TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (category_id, grade_name)
);

-- 16. 품목 테이블
CREATE TABLE IF NOT EXISTS items (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL
);

-- 17. 만감류 품목별 과수 기준
CREATE TABLE IF NOT EXISTS item_size_rules (
  id          BIGSERIAL PRIMARY KEY,
  item_id     BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  group_name  TEXT NOT NULL,
  min_su      INTEGER NOT NULL,
  max_su      INTEGER NOT NULL,
  UNIQUE (item_id, group_name)
);

ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE size_grades     ENABLE ROW LEVEL SECURITY;
ALTER TABLE items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_size_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_categories"      ON categories      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_size_grades"     ON size_grades     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_items"           ON items           FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_item_size_rules" ON item_size_rules FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT ALL ON TABLE categories      TO anon;
GRANT ALL ON TABLE size_grades     TO anon;
GRANT ALL ON TABLE items           TO anon;
GRANT ALL ON TABLE item_size_rules TO anon;
GRANT USAGE, SELECT ON SEQUENCE categories_id_seq      TO anon;
GRANT USAGE, SELECT ON SEQUENCE size_grades_id_seq     TO anon;
GRANT USAGE, SELECT ON SEQUENCE items_id_seq           TO anon;
GRANT USAGE, SELECT ON SEQUENCE item_size_rules_id_seq TO anon;

-- 기본 카테고리
INSERT INTO categories (name, classification_type) VALUES
  ('감귤류', 'grade'),
  ('만감류', 'count')
ON CONFLICT (name) DO NOTHING;

-- 감귤류 크기 등급 (13개)
INSERT INTO size_grades (category_id, grade_name, group_name, sort_order)
SELECT c.id, v.gn, v.grp, v.ord
FROM categories c
CROSS JOIN (VALUES
  ('0',   '극소과', 1),  ('00',  '극소과', 2),
  ('3S',  '소과',   3),  ('2S1', '소과',   4),  ('2S2', '소과',   5),
  ('S1',  '로얄과', 6),  ('S2',  '로얄과', 7),  ('M1',  '로얄과', 8),  ('M2',  '로얄과', 9),
  ('L',   '중과',   10), ('2L',  '중과',   11),
  ('왕1', '대과',   12), ('왕2', '대과',   13)
) AS v(gn, grp, ord)
WHERE c.name = '감귤류'
ON CONFLICT (category_id, grade_name) DO NOTHING;

-- 만감류 품목
INSERT INTO items (name, category_id)
SELECT v.n, c.id FROM categories c
CROSS JOIN (VALUES ('카라향'), ('한라봉'), ('천혜향'), ('레드향'), ('황금향'), ('수라향')) AS v(n)
WHERE c.name = '만감류'
ON CONFLICT (name) DO NOTHING;

-- 감귤류 품목
INSERT INTO items (name, category_id)
SELECT v.n, c.id FROM categories c
CROSS JOIN (VALUES ('노지감귤'), ('하우스감귤'), ('비가림'), ('타이벡')) AS v(n)
WHERE c.name = '감귤류'
ON CONFLICT (name) DO NOTHING;

-- 카라향 기본 과수 기준
INSERT INTO item_size_rules (item_id, group_name, min_su, max_su)
SELECT i.id, v.grp, v.mn, v.mx FROM items i
CROSS JOIN (VALUES ('대과', 5, 14), ('중과', 15, 22), ('소과', 23, 26)) AS v(grp, mn, mx)
WHERE i.name = '카라향'
ON CONFLICT (item_id, group_name) DO NOTHING;

-- 한라봉 기본 과수 기준
INSERT INTO item_size_rules (item_id, group_name, min_su, max_su)
SELECT i.id, v.grp, v.mn, v.mx FROM items i
CROSS JOIN (VALUES ('대과', 5, 10), ('중과', 11, 13), ('소과', 14, 26)) AS v(grp, mn, mx)
WHERE i.name = '한라봉'
ON CONFLICT (item_id, group_name) DO NOTHING;

-- 천혜향 기본 과수 기준
INSERT INTO item_size_rules (item_id, group_name, min_su, max_su)
SELECT i.id, v.grp, v.mn, v.mx FROM items i
CROSS JOIN (VALUES ('대과', 5, 14), ('중과', 15, 22), ('소과', 23, 26)) AS v(grp, mn, mx)
WHERE i.name = '천혜향'
ON CONFLICT (item_id, group_name) DO NOTHING;
