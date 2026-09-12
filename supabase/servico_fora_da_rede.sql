-- ─────────────────────────────────────────────────────────────────────────────
-- Serviço fora da rede oficial
--
-- Parece contraintuitivo deixar o cliente registrar o que ele fez na oficina do
-- bairro. Mas é exatamente esse dado que a Ford não tem: sem ele o app só
-- enxerga o numerador (o que passou pela rede) e nunca o denominador (tudo que
-- o carro consumiu). Com ele, o VIN Share deixa de ser estimativa.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE maintenances
  ADD COLUMN IF NOT EXISTS in_network boolean NOT NULL DEFAULT true;

-- Serviços já registrados vieram todos de agendamento confirmado na rede.
UPDATE maintenances SET in_network = true WHERE in_network IS NULL;

-- Consulta do card de impacto: "X de Y serviços na rede oficial", por chassi.
CREATE INDEX IF NOT EXISTS idx_maintenances_vin_rede
  ON maintenances (vin, in_network)
  WHERE vin IS NOT NULL;
