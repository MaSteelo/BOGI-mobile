-- ============================================================
-- BOGI 마이그레이션: 세부 별점 + 신고 기능
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. reviews 테이블에 세부 별점 컬럼 추가
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS story_rating      smallint CHECK (story_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS difficulty_rating smallint CHECK (difficulty_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS replay_rating     smallint CHECK (replay_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS quality_rating    smallint CHECK (quality_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS convenience_rating smallint CHECK (convenience_rating BETWEEN 1 AND 5);

-- 2. reports 테이블 생성
CREATE TABLE IF NOT EXISTS reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id    uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reporter_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason       text NOT NULL,
  detail       text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, reporter_id)
);

-- 3. RLS 정책
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 로그인한 유저는 신고 삽입 가능
CREATE POLICY "reports_insert" ON reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- 본인 신고 조회 가능
CREATE POLICY "reports_select_own" ON reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- 관리자용: service_role은 모든 신고 조회 가능 (기본적으로 bypass RLS)
-- AdminPage에서 supabase service role key 또는 별도 정책으로 처리하세요
-- 또는 아래를 활성화 (관리자 uid를 직접 지정):
-- CREATE POLICY "reports_admin_select" ON reports
--   FOR SELECT TO authenticated
--   USING (auth.uid() = '<admin-user-uuid>');
