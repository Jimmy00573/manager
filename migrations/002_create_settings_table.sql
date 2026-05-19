-- urgency_thresholds 초기값 삽입 (settings 테이블은 이미 존재)
-- 실행 위치: Supabase SQL Editor
INSERT INTO settings (key, value, updated_at)
VALUES ('urgency_thresholds', '{"high": 21, "mid": 14}', NOW())
ON CONFLICT (key) DO NOTHING;
