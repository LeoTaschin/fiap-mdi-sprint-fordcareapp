-- ─────────────────────────────────────────────────────────────────────────────
-- Passaporte do Veículo — o VIN como âncora do histórico
--
-- Hoje o histórico é filho de `user_id`: vender o carro apaga tudo. É esse o
-- vazamento de VIN Share que o Passaporte fecha — o VIN continua sendo um Ford
-- no parque circulante, mas o novo dono entra sem histórico e sai da rede.
--
-- ESCOPO REDUZIDO (Sprint 3): adiciona o VIN e reancora as manutenções nele,
-- mantendo a RLS atual por user_id. O modelo completo (tabela `ownerships`,
-- RLS por posse e herança pseudonimizada) fica documentado para a Sprint 4.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. VIN nos veículos e nas manutenções
ALTER TABLE vehicles     ADD COLUMN IF NOT EXISTS vin text;
ALTER TABLE maintenances ADD COLUMN IF NOT EXISTS vin text;

-- 2. Um mesmo usuário não cadastra o mesmo chassi duas vezes.
--    (No modelo completo a unicidade passa a ser global, com a posse controlada
--     por `ownerships` — aqui seria cedo demais e quebraria a demo.)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_vehicles_user_vin
  ON vehicles (user_id, vin)
  WHERE vin IS NOT NULL;

-- 3. A consulta do passaporte é sempre por VIN
CREATE INDEX IF NOT EXISTS idx_maintenances_vin
  ON maintenances (vin)
  WHERE vin IS NOT NULL;

-- 4. Backfill: manutenções já registradas herdam o VIN do veículo a que pertencem
UPDATE maintenances m
   SET vin = v.vin
  FROM vehicles v
 WHERE m.vehicle_id = v.id
   AND v.vin IS NOT NULL
   AND m.vin IS NULL;

-- 5. Sanidade: 17 caracteres, sem I, O e Q (ISO 3779).
--    A validação forte acontece no app (utils/vin.ts); aqui é rede de proteção.
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vin_formato;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_vin_formato
  CHECK (vin IS NULL OR vin ~ '^[A-HJ-NPR-Z0-9]{17}$');
