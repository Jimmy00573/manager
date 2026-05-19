-- [1단계] inbound_records에 수송기사 필드 추가
-- 실행 위치: Supabase SQL Editor
-- 롤백: ALTER TABLE inbound_records DROP COLUMN driver_id; DROP COLUMN driver_name_manual;

ALTER TABLE inbound_records
  ADD COLUMN IF NOT EXISTS driver_id BIGINT REFERENCES drivers(id),
  ADD COLUMN IF NOT EXISTS driver_name_manual TEXT;
