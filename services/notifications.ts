import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Recomendacao } from '@/utils/copiloto';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Ids dos lembretes proativos que este app agendou — para poder recriá-los sem duplicar. */
const LEMBRETES_KEY = '@fordcare/lembretes_proativos_v1';
/** Marca que já pedimos permissão uma vez, para não incomodar a cada abertura. */
const PERMISSAO_PEDIDA_KEY = '@fordcare/permissao_notif_pedida_v1';

const suportaNotificacoes = Platform.OS !== 'web';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!suportaNotificacoes) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Retorna se podemos notificar. Só abre o diálogo de permissão na primeira vez —
 * nas aberturas seguintes apenas consulta, para não repetir o pedido.
 */
export async function garantirPermissao(): Promise<boolean> {
  if (!suportaNotificacoes) return false;

  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  if (status === 'denied') return false;

  const jaPedimos = await AsyncStorage.getItem(PERMISSAO_PEDIDA_KEY);
  if (jaPedimos) return false;

  await AsyncStorage.setItem(PERMISSAO_PEDIDA_KEY, '1');
  return requestNotificationPermission();
}

export async function agendarLembrete(title: string, body: string, date: Date): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: { date },
  });
}

export async function cancelarLembrete(id: string) {
  await Notifications.cancelScheduledNotificationAsync(id);
}

/**
 * Sincroniza os lembretes proativos de manutenção.
 *
 * Cancela apenas os lembretes que ESTE fluxo criou (guardados em AsyncStorage) e
 * reagenda a partir das recomendações atuais. Os lembretes de agendamento criados
 * em `agendamento/novo` não são tocados.
 */
export async function sincronizarLembretes(recs: Recomendacao[]): Promise<number> {
  if (!suportaNotificacoes) return 0;

  try {
    const raw = await AsyncStorage.getItem(LEMBRETES_KEY);
    const anteriores: string[] = raw ? JSON.parse(raw) : [];
    await Promise.all(
      anteriores.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})),
    );

    const agora = Date.now();
    const novos: string[] = [];

    for (const rec of recs) {
      // Data no passado significa que o lembrete já perdeu a validade.
      if (rec.dispararEm.getTime() <= agora) continue;
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: rec.titulo,
          body: rec.corpo,
          sound: true,
          data: { alertType: rec.alertType, origem: 'copiloto' },
        },
        trigger: { date: rec.dispararEm },
      });
      novos.push(id);
    }

    await AsyncStorage.setItem(LEMBRETES_KEY, JSON.stringify(novos));
    return novos.length;
  } catch {
    // Lembrete é conveniência: nunca deve derrubar o app.
    return 0;
  }
}
