/** Adidas adult footwear chart, retrieved 2026-10-22. See source in tool UI. */
const cm = [22.1,22.5,22.9,23.3,23.8,24.2,24.6,25,25.5,25.9,26.3,26.7,27.1,27.6,28,28.4,28.8,29.3,29.7,30.1,30.5,31,31.4,31.8,32.6,33.5,34.3,35.2];
const uk = [3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12,12.5,13,13.5,14,14.5,15,16,17,18,19];
const eu = ['36','36⅔','37⅓','38','38⅔','39⅓','40','40⅔','41⅓','42','42⅔','43⅓','44','44⅔','45⅓','46','46⅔','47⅓','48','48⅔','49⅓','50','50⅔','51⅓','52⅔','53⅓','54⅔','55⅔'];
const usMen = [4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12,12.5,13,13.5,14,14.5,15,16,17,18,19,20];
const usWomen = [5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10,10.5,11,11.5,12,12.5,13,13.5,14,14.5,15,15.5];

export const SHOE_ROWS = cm.map((footCm, i) => ({ footCm, uk: uk[i], eu: eu[i], usMen: usMen[i], usWomen: usWomen[i] ?? null }));
export type ShoeUnit = 'footCm' | 'uk' | 'eu' | 'usMen' | 'usWomen';

export function findShoeSize(unit: ShoeUnit, value: string | number) {
  if (unit === 'eu') return SHOE_ROWS.find((r) => r.eu === String(value)) ?? null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const eligible = SHOE_ROWS.filter((r) => r[unit] !== null);
  if (unit === 'footCm') return eligible.find((r) => r.footCm >= numeric) ?? null;
  return eligible.find((r) => r[unit] === numeric) ?? null;
}
