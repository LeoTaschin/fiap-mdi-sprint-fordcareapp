/**
 * Busca o texto redigido da camada 3 do Copiloto.
 *
 * Contrato de comportamento: este hook NUNCA falha para o usuário. O texto
 * determinístico entra como estado inicial e só é substituído se a resposta
 * passar por todas as validações. Erro, timeout, resposta malformada ou número
 * divergente mantêm o texto local, sem mensagem de erro na tela — a demo não
 * pode depender de rede.
 *
 * O cache em disco existe por causa da troca visível: sem ele, toda vez que a
 * Home montava o card mostrava o texto local e trocava um segundo depois. Com
 * o cache, isso acontece uma vez por estado do veículo; nas aberturas seguintes
 * o texto já chega pronto. De quebra, corta as chamadas de API pelo mesmo fator.
 */

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import { logDevError } from '@/utils/safeError';
import {
  validarTexto,
  numerosConferem,
  chaveDeCache,
  lerCache,
  TIMEOUT_MS,
  type EntradaCopilotoTexto,
} from '@/utils/copilotoTexto';

/**
 * Abre o erro do supabase-js e registra status + corpo, só em __DEV__.
 * Os códigos vêm da própria Edge Function: `indisponivel` (secret ausente),
 * `entrada` (payload fora do contrato), `upstream` (a API recusou) e
 * `formato` (texto vazio ou impossível de cortar).
 */
async function detalharFalha(e: unknown): Promise<void> {
  const contexto = (e as { context?: Response })?.context;
  if (contexto && typeof contexto.status === 'number') {
    let corpo = '';
    try {
      corpo = await contexto.clone().text();
    } catch {
      corpo = '(corpo ilegível)';
    }
    logDevError('useCopilotoTexto', `HTTP ${contexto.status} — ${corpo}`);
    return;
  }
  logDevError('useCopilotoTexto', e);
}

export function useCopilotoTexto(
  entrada: EntradaCopilotoTexto | null,
  textoDeterministico: string,
): string {
  const [texto, setTexto] = useState(textoDeterministico);

  // O texto local muda quando o usuário troca de veículo ou resolve um alerta.
  useEffect(() => setTexto(textoDeterministico), [textoDeterministico]);

  const chave = entrada ? chaveDeCache(entrada) : null;

  useEffect(() => {
    if (!entrada || !chave) return;

    let cancelado = false;
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), TIMEOUT_MS);

    (async () => {
      try {
        // 1) Disco primeiro. Cache quente = nenhuma troca visível e nenhuma chamada.
        const doCache = lerCache(await AsyncStorage.getItem(chave));
        if (doCache) {
          if (!cancelado) setTexto(doCache);
          return;
        }

        // 2) Só then vai à rede.
        const { data, error } = await supabase.functions.invoke('copiloto-texto', {
          body: entrada,
          signal: controle.signal,
        });
        if (error) throw error;

        const redigido = validarTexto(data);
        if (!redigido) return;
        if (!numerosConferem(redigido, entrada)) return;

        await AsyncStorage.setItem(
          chave,
          JSON.stringify({ texto: redigido, salvoEm: Date.now() }),
        );
        if (!cancelado) setTexto(redigido);
      } catch (e) {
        // Silencioso para o usuário, detalhado para quem está desenvolvendo.
        await detalharFalha(e);
      } finally {
        clearTimeout(relogio);
      }
    })();

    return () => {
      cancelado = true;
      clearTimeout(relogio);
      controle.abort();
    };
    // `chave` no lugar de `entrada`: o objeto é recriado a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, textoDeterministico]);

  return texto;
}
