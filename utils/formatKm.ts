/**
 * Utilitários de formatação de quilometragem e datas para exibição no app.
 * Garante consistência visual em todas as telas do FordCare.
 */

/**
 * Formata um número de km para exibição em pt-BR.
 * Ex: 38540 → "38.540 km"
 *
 * @param km - Quilometragem numérica
 * @returns String formatada com separador de milhar e sufixo "km"
 */
export function formatKm(km: number): string {
  return `${km.toLocaleString('pt-BR')} km`;
}

/**
 * Formata uma data para exibição curta em pt-BR.
 * Ex: new Date('2024-03-15') → "15/03/2024"
 *
 * @param date - Objeto Date ou string ISO
 * @returns String no formato DD/MM/AAAA
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

/**
 * Formata uma data com hora para exibição em pt-BR.
 * Ex: → "15/03/2024 às 14:30"
 *
 * @param date - Objeto Date ou string ISO
 * @returns String no formato DD/MM/AAAA às HH:MM
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const datePart = d.toLocaleDateString('pt-BR');
  const timePart = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} às ${timePart}`;
}