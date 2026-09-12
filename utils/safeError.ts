/**
 * safeError.ts
 * Mapeia erros internos para mensagens amigáveis e seguras.
 * Garante que stack traces, nomes de tabelas, políticas RLS
 * e detalhes de infraestrutura nunca cheguem ao usuário final.
 */

const ERROR_MAP: Array<{ match: string | RegExp; message: string }> = [
  // Auth
  { match: /invalid.login.credentials|invalid_credentials/i, message: 'E-mail ou senha incorretos. Tente novamente.' },
  { match: /already registered|already been registered|User already registered/i, message: 'Esse e-mail já está cadastrado. Que tal fazer login?' },
  { match: /email.*not.*confirmed|EMAIL_CONFIRMATION_REQUIRED/i, message: 'Confirme seu e-mail antes de entrar.' },
  { match: /password.*weak|Password should/i, message: 'Senha muito fraca. Use pelo menos 6 caracteres.' },
  { match: /rate.limit|too many requests/i, message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
  { match: /network|fetch|NetworkError|Failed to fetch/i, message: 'Sem conexão. Verifique sua internet e tente novamente.' },
  // Genérico de banco — precisa vir ANTES da regra de RLS, porque a mensagem
  // do Postgres para chave duplicada contém "violates" e seria capturada
  // pelo padrão mais amplo abaixo.
  { match: /duplicate key|unique constraint/i, message: 'Este registro já existe.' },
  { match: /foreign key/i, message: 'Operação inválida. Tente novamente.' },
  // Supabase / RLS — nunca expor ao usuário
  { match: /RLS|row.level.security|permission|policy|violates/i, message: 'Operação não permitida. Tente novamente.' },
];

export function safeErrorMessage(err: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');

  for (const { match, message } of ERROR_MAP) {
    if (typeof match === 'string' ? raw.includes(match) : match.test(raw)) {
      return message;
    }
  }

  return fallback;
}

/**
 * Registra o erro BRUTO no console — apenas em desenvolvimento.
 *
 * O usuário continua vendo só a mensagem sanitizada de `safeErrorMessage`.
 * Sem isso, uma falha de schema (coluna que não existe, RPC ausente) vira um
 * "tente novamente" genérico e o desenvolvedor fica sem pista nenhuma.
 */
export function logDevError(contexto: string, err: unknown): void {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) return;
  const detalhe =
    err && typeof err === 'object'
      ? JSON.stringify(err, Object.getOwnPropertyNames(err))
      : String(err);
  console.error(`[FordCare] ${contexto}:`, detalhe);
}
