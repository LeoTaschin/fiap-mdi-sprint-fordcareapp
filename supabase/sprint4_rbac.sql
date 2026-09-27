-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 4 (Cybersecurity/DevSecOps) — Controle de acesso por perfil (RBAC)
--
-- Perfis do FordCare (equivalência com a rubrica Brigadista/Gestor/Administrador):
--   cliente  → dono do veículo (perfil operacional, só enxerga os próprios dados)
--   gestor   → gestor de pós-venda da concessionária (lê auditoria e indicadores)
--   admin    → administrador da plataforma (concede/revoga perfis)
--
-- A RLS "dono vê o que é seu" das Sprints 1–3 continua valendo. Esta migration
-- adiciona o papel como SEGUNDA dimensão de autorização, avaliada no servidor
-- (Postgres) — nunca no app, onde o usuário poderia alterar o valor.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('cliente', 'gestor', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       app_role NOT NULL DEFAULT 'cliente',
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Checagem de papel usada pelas policies. SECURITY DEFINER para ler user_roles
-- sem recursão de RLS; search_path fixo contra sequestro de função.
CREATE OR REPLACE FUNCTION tem_papel(p app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = p);
$$;
REVOKE EXECUTE ON FUNCTION tem_papel(app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION tem_papel(app_role) TO authenticated;

-- Policies restritas a 'authenticated': a anon key (pública) não casa com nenhuma
-- e recebe zero linhas.

-- Cada usuário lê o próprio papel (o app usa para montar o menu)
DROP POLICY IF EXISTS "select_own_role" ON user_roles;
CREATE POLICY "select_own_role" ON user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Só admin lê todos e concede/revoga papéis
DROP POLICY IF EXISTS "admin_manage_roles" ON user_roles;
CREATE POLICY "admin_manage_roles" ON user_roles
  FOR ALL TO authenticated USING (tem_papel('admin')) WITH CHECK (tem_papel('admin'));

-- Todo usuário novo nasce 'cliente' (menor privilégio por padrão)
CREATE OR REPLACE FUNCTION papel_padrao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'cliente')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_papel_padrao ON auth.users;
CREATE TRIGGER trg_papel_padrao AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION papel_padrao();

-- Auditoria: gestor e admin passam a LER a trilha (antes só service_role lia).
-- Cliente continua sem SELECT — não vê nem os próprios logs.
DROP POLICY IF EXISTS "gestor_admin_select_audit" ON audit_logs;
CREATE POLICY "gestor_admin_select_audit" ON audit_logs
  FOR SELECT TO authenticated USING (tem_papel('gestor') OR tem_papel('admin'));

-- Alteração crítica: toda mudança de papel vira evento na trilha de auditoria
CREATE OR REPLACE FUNCTION auditar_troca_papel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, resource, status, metadata)
  VALUES (auth.uid(), 'ROLE_CHANGE', NEW.user_id::text, 'success',
          jsonb_build_object('de', CASE WHEN TG_OP = 'UPDATE' THEN OLD.role::text END,
                             'para', NEW.role::text));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_auditar_troca_papel ON user_roles;
CREATE TRIGGER trg_auditar_troca_papel AFTER UPDATE OF role ON user_roles
  FOR EACH ROW WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION auditar_troca_papel();

-- Visão para o painel de segurança (consumida pelo gestor/admin)
CREATE OR REPLACE VIEW eventos_seguranca_hora
WITH (security_invoker = true) AS
SELECT date_trunc('hour', created_at) AS hora,
       action,
       status,
       count(*) AS total
  FROM audit_logs
 WHERE created_at > now() - interval '7 days'
 GROUP BY 1, 2, 3;
