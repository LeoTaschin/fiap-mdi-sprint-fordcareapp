import { useEffect, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useAlerts } from '@/hooks/useAlerts';
import { gerarRecomendacoes } from '@/utils/copiloto';
import { garantirPermissao, sincronizarLembretes } from '@/services/notifications';

/**
 * Agenda lembretes locais para as manutenções que estão para vencer.
 *
 * É o "lead de serviço proativo" do desafio: em vez de esperar o cliente abrir o
 * app, o app procura o cliente no momento certo — calculado a partir do ritmo de
 * uso real do veículo.
 */
export function useProactiveReminders() {
  const { vehicle, maintenances } = useUser();
  const alerts = useAlerts();

  // Evita reagendar a cada render: só quando a situação real muda.
  const assinatura = vehicle
    ? `${vehicle.id}|${vehicle.currentKm}|${maintenances.length}|${alerts.map((a) => `${a.type}:${a.status}`).join(',')}`
    : '';
  const ultima = useRef<string>('');

  useEffect(() => {
    if (!vehicle || !assinatura || assinatura === ultima.current) return;
    ultima.current = assinatura;

    let cancelado = false;
    (async () => {
      const permitido = await garantirPermissao();
      if (!permitido || cancelado) return;
      const recs = gerarRecomendacoes(vehicle, maintenances, alerts);
      await sincronizarLembretes(recs);
    })();

    return () => { cancelado = true; };
  }, [assinatura]);
}
