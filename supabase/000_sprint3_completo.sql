-- ═════════════════════════════════════════════════════════════════════════════
-- FordCare — TODAS as migrações da Sprint 3, na ordem correta.
--
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute uma vez.
-- É idempotente: rodar de novo não quebra nada.
--
-- Substitui os arquivos avulsos vin.sql, servico_fora_da_rede.sql e
-- benefit_redemptions.sql, que continuam aqui apenas como referência.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. VIN: o chassi como âncora do histórico ───────────────────────────────
ALTER TABLE vehicles     ADD COLUMN IF NOT EXISTS vin text;
ALTER TABLE maintenances ADD COLUMN IF NOT EXISTS vin text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vehicles_user_vin
  ON vehicles (user_id, vin) WHERE vin IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_maintenances_vin
  ON maintenances (vin) WHERE vin IS NOT NULL;

UPDATE maintenances m
   SET vin = v.vin
  FROM vehicles v
 WHERE m.vehicle_id = v.id AND v.vin IS NOT NULL AND m.vin IS NULL;

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vin_formato;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_vin_formato
  CHECK (vin IS NULL OR vin ~ '^[A-HJ-NPR-Z0-9]{17}$');

-- ── 2. Serviço fora da rede: o denominador do VIN Share ─────────────────────
ALTER TABLE maintenances
  ADD COLUMN IF NOT EXISTS in_network boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_maintenances_vin_rede
  ON maintenances (vin, in_network) WHERE vin IS NOT NULL;

-- ── 3. Resgate de benefícios: saldo separado de status ──────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lifetime_points integer NOT NULL DEFAULT 0;

UPDATE profiles
   SET lifetime_points = GREATEST(lifetime_points, COALESCE(points, 0))
 WHERE lifetime_points < COALESCE(points, 0);

CREATE TABLE IF NOT EXISTS benefit_redemptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  benefit_label text NOT NULL,
  points_spent  integer NOT NULL CHECK (points_spent > 0),
  status        text NOT NULL DEFAULT 'disponivel',
  redeemed_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE benefit_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_redemptions" ON benefit_redemptions;
CREATE POLICY "select_own_redemptions" ON benefit_redemptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_redemptions" ON benefit_redemptions;
CREATE POLICY "insert_own_redemptions" ON benefit_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION resgatar_beneficio(p_label text, p_cost integer)
RETURNS benefit_redemptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_saldo integer;
  v_row   benefit_redemptions;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'NAO_AUTENTICADO'; END IF;

  SELECT points INTO v_saldo FROM profiles WHERE id = v_user FOR UPDATE;
  IF v_saldo IS NULL OR v_saldo < p_cost THEN RAISE EXCEPTION 'SALDO_INSUFICIENTE'; END IF;

  UPDATE profiles SET points = points - p_cost WHERE id = v_user;

  INSERT INTO benefit_redemptions (user_id, benefit_label, points_spent)
  VALUES (v_user, p_label, p_cost)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ── 4. Trilha de auditoria (caso ainda não exista) ──────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  resource   text,
  status     text NOT NULL DEFAULT 'success',
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insert_own_logs" ON audit_logs;
CREATE POLICY "insert_own_logs" ON audit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── 5. Conferência: todas as colunas abaixo devem voltar com 1 ──────────────
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'vehicles' AND column_name = 'vin')             AS vehicles_vin,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'maintenances' AND column_name = 'vin')         AS maintenances_vin,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'maintenances' AND column_name = 'in_network')  AS maintenances_in_network,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'profiles' AND column_name = 'lifetime_points') AS profiles_lifetime,
  (SELECT count(*) FROM pg_proc WHERE proname = 'resgatar_beneficio')   AS rpc_resgate;
