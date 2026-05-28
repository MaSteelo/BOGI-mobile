-- ============================================================
-- image_proposals 테이블 & RLS 정책
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS image_proposals (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id      uuid        NOT NULL REFERENCES games(id)      ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url    text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid
);

-- status 값 제한
ALTER TABLE image_proposals
  DROP CONSTRAINT IF EXISTS image_proposals_status_check;
ALTER TABLE image_proposals
  ADD CONSTRAINT image_proposals_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- RLS 활성화
ALTER TABLE image_proposals ENABLE ROW LEVEL SECURITY;

-- 1. 로그인한 유저는 자기 제안 INSERT 가능
CREATE POLICY "Users can insert own proposals"
  ON image_proposals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. 유저는 자기 제안만 SELECT 가능
CREATE POLICY "Users can view own proposals"
  ON image_proposals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. 관리자는 모든 제안 SELECT 가능
CREATE POLICY "Admins can view all proposals"
  ON image_proposals FOR SELECT
  TO authenticated
  USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
  );

-- 4. 관리자만 UPDATE 가능 (status 변경)
CREATE POLICY "Admins can update proposals"
  ON image_proposals FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
  );
