-- ─────────────────────────────────────────────────────────────────────────────
-- Resgate de benefícios do programa de pontos FordCare
--
-- Separa SALDO (points, gasto ao resgatar) de STATUS (lifetime_points, nunca
-- decresce). Sem isso, resgatar um benefício rebaixaria o nível do cliente —
-- que é exatamente o oposto do que um programa de fidelidade deve fazer.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Pontos acumulados na vida toda — base do nível (bronze/prata/ouro)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lifetime_points integer NOT NULL DEFAULT 0;

-- Backfill: quem já tem saldo, tem pelo menos isso de acumulado
UPDATE profiles
   SET lifetime_points = GREATEST(lifetime_points, COALESCE(points, 0))
 WHERE lifetime_points < COALESCE(points, 0);

-- 2. Histórico de resgates
CREATE TABLE IF NOT EXISTS benefit_redemptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  benefit_label text NOT NULL,
  points_spent  integer NOT NULL CHECK (points_spent > 0),
  status        text NOT NULL DEFAULT 'disponivel',  -- 'disponivel' | 'utilizado'
  redeemed_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE benefit_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_redemptions" ON benefit_redemptions;
CREATE POLICY "select_own_redemptions" ON benefit_redemptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_redemptions" ON benefit_redemptions;
CREATE POLICY "insert_own_redemptions" ON benefit_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Resgate atômico — evita saldo negativo por corrida entre dispositivos
CREATE OR REPLACE FUNCTION resgatar_beneficio(p_label text, p_cost integer)
RETURNS benefit_redemptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_saldo integer;
  v_row   benefit_redemptions;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO';
  END IF;

  SELECT points INTO v_saldo FROM profiles WHERE id = v_user FOR UPDATE;

  IF v_saldo IS NULL OR v_saldo < p_cost THEN
    RAISE EXCEPTION 'SALDO_INSUFICIENTE';
  END IF;

  UPDATE profiles SET points = points - p_cost WHERE id = v_user;

  INSERT INTO benefit_redemptions (user_id, benefit_label, points_spent)
  VALUES (v_user, p_label, p_cost)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
