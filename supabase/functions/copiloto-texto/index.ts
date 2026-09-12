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

const cabecalhos = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

/** Valida a entrada. Campo faltando ou com tipo errado derruba a requisição. */
function entradaValida(c: unknown): c is Entrada {
  if (typeof c !== 'object' || c === null) return false;
  const e = c as Record<string, unknown>;
  const a = e.alerta as Record<string, unknown> | undefined;
  return (
    typeof e.modelo === 'string' &&
    typeof e.ano === 'number' &&
    typeof e.kmAtual === 'number' &&
    (e.kmPorMes === null || typeof e.kmPorMes === 'number') &&
    typeof e.pendentes === 'number' &&
    typeof e.pontos === 'number' &&
    !!a &&
    typeof a.tipo === 'string' &&
    typeof a.diasVencido === 'number' &&
    typeof a.kmVencido === 'number'
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhos });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ erro: 'metodo' }), { status: 405, headers: cabecalhos });
  }

  const chave = Deno.env.get('ANTHROPIC_API_KEY');
  if (!chave) {
    // Sem chave configurada o app cai no texto determinístico, como em qualquer
    // outra falha. Melhor devolver 503 do que uma frase inventada.
    return new Response(JSON.stringify({ erro: 'indisponivel' }), { status: 503, headers: cabecalhos });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response(JSON.stringify({ erro: 'json' }), { status: 400, headers: cabecalhos });
  }

  if (!entradaValida(corpo)) {
    return new Response(JSON.stringify({ erro: 'entrada' }), { status: 400, headers: cabecalhos });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
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
    });

    if (!r.ok) {
      return new Response(JSON.stringify({ erro: 'upstream' }), { status: 502, headers: cabecalhos });
    }

    const dados = await r.json();
    const bruto = String(dados?.content?.[0]?.text ?? '').replace(/\s+/g, ' ').trim();
    const texto = cortarNoFimDaFrase(bruto, MAX_CARACTERES);

    if (!texto) {
      return new Response(JSON.stringify({ erro: 'formato' }), { status: 502, headers: cabecalhos });
    }

    return new Response(JSON.stringify({ texto }), { headers: cabecalhos });
  } catch {
    return new Response(JSON.stringify({ erro: 'falha' }), { status: 502, headers: cabecalhos });
  }
});
