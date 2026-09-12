import { useMemo } from 'react';
import { useUser } from '@/contexts/UserContext';
import { computeAlerts } from '@/utils/alerts';

// Reexporta para não quebrar quem já importava daqui.
export { computeAlerts } from '@/utils/alerts';
export type { Alert, AlertStatus } from '@/utils/alerts';

export function useAlerts() {
  const { vehicle, maintenances } = useUser();
  return useMemo(() => computeAlerts(vehicle, maintenances), [vehicle, maintenances]);
}
