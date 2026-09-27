/**
 * copiloto-texto — camada 3 do Copiloto FordCare.
 *
 * Recebe o vetor JÁ CALCULADO pelo app e devolve um parágrafo em pt-BR.
 * A função não decide nada: não escolhe serviço, não estima custo, não cria
 * número nenhum. Se ela cair, o app mostra o texto determinístico e o usuário
 * não percebe diferença.
 *
 * A chave da API vive em `supabase secrets` e nunca sai do servidor — variável
 * com prefixo EXPO_PUBLIC_ é embutida no APK e qualquer pessoa lê abrindo o
 * arquivo.
 *
 * Deploy:
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   supabase functions deploy copiloto-texto
 */

const MAX_CARACTERES = 240;
// ID datado, nao o alias: um alias invalido devolveria 400 e o app cairia no
// texto deterministico em silencio — a falha seria invisivel.
const MODELO = 'claude-haiku-4-5-20251001';

type Entrada = {
  modelo: string;
  ano: number;
  kmAtual: number;
  kmPorMes: number | null;
  alerta: { tipo: string; diasVencido: number; kmVencido: number };
  pendentes: number;
  pontos: number;
};

// ─── Sprint 4 (DevSecOps) — hardening da Edge Function ───────────────────────
// Achados que motivaram a mudança (revisão de código + scan):
//  1. CORS `*`: qualquer site podia chamar a função a partir de um navegador.
//  2. A função aceitava QUALQUER JWT válido, inclusive a anon key — que é
//     pública (vai dentro do APK). Resultado: qualquer pessoa conseguia gastar
//     créditos da API de IA sem estar logada (OWASP API2 / API6).
//  3. Sem limite por usuário: um único login podia disparar chamadas em loop
//     (OWASP API4 — consumo irrestrito de recursos).
//  4. Validação só de TIPO: `modelo`/`tipo` sem limite de tamanho e números sem
//     faixa abriam espaço para prompt injection e payloads gigantes.
// A assinatura do JWT continua sendo verificada pelo gateway do Supabase
// (`verify_jwt = true` em supabase/config.toml); aqui checamos o PAPEL.

const ORIGENS_PERMITIDAS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const LIMITE_POR_MINUTO = Number(Deno.env.get('RATE_LIMIT_PER_MIN') ?? '10');
const JANELA_MS = 60_000;
const janelas = new Map<string, { inicio: number; qtd: number }>();

function cabecalhosPara(req: Request): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  };
  // App nativo não envia Origin (CORS não se aplica). Para navegador, só a
  // allowlist configurada em ALLOWED_ORIGINS recebe o cabeçalho.
  const origem = req.headers.get('origin');
  if (origem && ORIGENS_PERMITIDAS.includes(origem)) {
    h['Access-Control-Allow-Origin'] = origem;
    h['Vary'] = 'Origin';
  }
  return h;
}

/** Devolve o `sub` do usuário logado, ou null se o token for anon/service/expirado. */
function usuarioDoToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  try {
    const b64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    const agora = Math.floor(Date.now() / 1000);
    if (payload.role !== 'authenticated') return null; // barra anon e service_role
    if (typeof payload.sub !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.sub)) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= agora) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/** Janela fixa por usuário (por instância). Devolve segundos de espera ou 0. */
function excedeuLimite(usuario: string): number {
  const agora = Date.now();
  const j = janelas.get(usuario);
  if (!j || agora - j.inicio >= JANELA_MS) {
    janelas.set(usuario, { inicio: agora, qtd: 1 });
    return 0;
  }
  j.qtd += 1;
  return j.qtd > LIMITE_POR_MINUTO ? Math.ceil((j.inicio + JANELA_MS - agora) / 1000) : 0;
}

/** Hash curto do usuário: permite correlacionar eventos sem gravar o UUID (LGPD). */
async function pseudonimo(usuario: string | null): Promise<string | null> {
  if (!usuario) return null;
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(usuario));
  return Array.from(new Uint8Array(d)).slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Log estruturado (JSON por linha) — vai para os Function Logs do Supabase. */
async function registrar(evento: string, status: number, inicio: number, usuario: string | null, motivo?: string) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    servico: 'copiloto-texto',
    nivel: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
    evento,
    status,
    usuario: await pseudonimo(usuario),
    motivo: motivo ?? null,
    latencia_ms: Date.now() - inicio,
  }));
}

const TEXTO_SEGURO = /^[\p{L}\p{N} .,()\/+-]{1,60}$/u;
const noIntervalo = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** Valida tipo, tamanho e faixa. Campo fora do contrato derruba a requisição. */
function entradaValida(c: unknown): c is Entrada {
  if (typeof c !== 'object' || c === null) return false;
  const e = c as Record<string, unknown>;
  const a = e.alerta as Record<string, unknown> | undefined;
  const anoMax = new Date().getFullYear() + 1;
  return (
    typeof e.modelo === 'string' && TEXTO_SEGURO.test(e.modelo) &&
    noIntervalo(e.ano, 1950, anoMax) &&
    noIntervalo(e.kmAtual, 0, 2_000_000) &&
    (e.kmPorMes === null || noIntervalo(e.kmPorMes, 0, 50_000)) &&
    noIntervalo(e.pendentes, 0, 50) &&
    noIntervalo(e.pontos, 0, 100_000) &&
    !!a &&
    typeof a.tipo === 'string' && TEXTO_SEGURO.test(a.tipo) &&
    noIntervalo(a.diasVencido, 0, 3650) &&
    noIntervalo(a.kmVencido, 0, 500_000)
  );
}

function montarPrompt(e: Entrada): string {
  const fatos = [
    `Veículo: ${e.modelo} ${e.ano}`,
    `Quilometragem atual: ${e.kmAtual} km`,
    e.kmPorMes != null ? `Ritmo de uso: ${e.kmPorMes} km por mês` : null,
    `Serviço pendente: ${e.alerta.tipo}`,
    e.alerta.diasVencido > 0 ? `Vencido há ${e.alerta.diasVencido} dias` : null,
    e.alerta.kmVencido > 0 ? `Vencido há ${e.alerta.kmVencido} km` : null,
    e.pendentes > 1 ? `Outros itens pendentes: ${e.pendentes - 1}` : null,
    `Pontos ao fazer na rede oficial: ${e.pontos}`,
  ].filter(Boolean).join('\n');

  return `Você escreve uma frase para o app FordCare, que acompanha a manutenção de veículos Ford.

Fatos calculados pelo aplicativo:
${fatos}

Escreva DUAS frases curtas em português do Brasil, explicando ao dono por que vale resolver isso agora e convidando a agendar na rede oficial Ford. Seja breve: o texto aparece num card estreito de celular.

Regras rígidas:
- Use APENAS os números listados acima. Não arredonde, não converta, não estime nenhum valor novo.
- Não invente preço, prazo de oficina, nome de peça ou risco mecânico específico.
- Não use markdown, listas, emoji ou aspas.
- Trate o leitor por "você". Tom direto e adulto, sem alarmismo e sem vender.
- Responda só com as duas frases, sem introdução.`;
}

/**
 * Devolve o maior trecho que cabe no limite terminando em frase completa.
 * Vazio quando nem a primeira frase cabe — aí o app fica com o texto local.
 */
function cortarNoFimDaFrase(texto: string, limite: number): string {
  if (!texto) return '';
  if (texto.length <= limite) return texto;

  const corte = texto.slice(0, limite);
  const fim = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('! '), corte.lastIndexOf('? '));
  if (fim > 0) return corte.slice(0, fim + 1);

  return corte.endsWith('.') ? corte : '';
}

Deno.serve(async (req: Request) => {
  const inicio = Date.now();
  const cabecalhos = cabecalhosPara(req);
  const responder = async (corpo: unknown, status: number, evento: string, usuario: string | null, motivo?: string, extra: Record<string, string> = {}) => {
    await registrar(evento, status, inicio, usuario, motivo);
    return new Response(JSON.stringify(corpo), { status, headers: { ...cabecalhos, ...extra } });
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhos });
  if (req.method !== 'POST') return responder({ erro: 'metodo' }, 405, 'metodo_invalido', null);

  // 1) Só usuário logado — a anon key (pública) não serve mais.
  const usuario = usuarioDoToken(req);
  if (!usuario) return responder({ erro: 'nao_autenticado' }, 401, 'auth_negada', null, 'token ausente, anon ou expirado');

  // 2) Limite por usuário.
  const espera = excedeuLimite(usuario);
  if (espera > 0) {
    return responder({ erro: 'limite' }, 429, 'rate_limit', usuario, `>${LIMITE_POR_MINUTO}/min`, { 'Retry-After': String(espera) });
  }

  const chave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!chave) {
    // Sem chave configurada o app cai no texto determinístico, como em qualquer
    // outra falha. Melhor devolver 503 do que uma frase inventada.
    return responder({ erro: 'indisponivel' }, 503, 'segredo_ausente', usuario);
  }

  // 3) Payload: tamanho máximo antes de parsear.
  const bruto = await req.text();
  if (bruto.length > 2_048) return responder({ erro: 'tamanho' }, 413, 'payload_grande', usuario);

  let corpo: unknown;
  try {
    corpo = JSON.parse(bruto);
  } catch {
    return responder({ erro: 'json' }, 400, 'json_invalido', usuario);
  }

  if (!entradaValida(corpo)) {
    return responder({ erro: 'entrada' }, 400, 'entrada_invalida', usuario);
  }

  try {
    // LLM_API_URL só existe para teste local com upstream simulado (definido pelo operador).
    const r = await fetch(Deno.env.get('LLM_API_URL') ?? 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': chave,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 300,
        messages: [{ role: 'user', content: montarPrompt(corpo) }],
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!r.ok) {
      return responder({ erro: 'upstream' }, 502, 'upstream_erro', usuario, `HTTP ${r.status}`);
    }

    const dados = await r.json();
    const saida = String(dados?.content?.[0]?.text ?? '').replace(/\s+/g, ' ').trim();
    const texto = cortarNoFimDaFrase(saida, MAX_CARACTERES);

    if (!texto) {
      return responder({ erro: 'formato' }, 502, 'formato_invalido', usuario);
    }

    return responder({ texto }, 200, 'texto_gerado', usuario);
  } catch {
    return responder({ erro: 'falha' }, 502, 'upstream_falha', usuario);
  }
});
