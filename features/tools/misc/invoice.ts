/** Invoice maths in minor units (cents), so totals never drift by floating-point error. */

export interface InvoiceItem {
  description: string;
  qty: string;
  price: string;
  tax: string; // percent
}

export interface Party {
  name: string;
  address: string;
  email: string;
  phone: string;
  taxId: string;
}

export interface Invoice {
  from: Party;
  to: Party;
  number: string;
  issued: string;
  due: string;
  currency: string;
  discount: string; // percent of subtotal
  shipping: string;
  items: InvoiceItem[];
  notes: string;
  terms: string;
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'PKR', 'INR', 'AED', 'SAR', 'CAD', 'AUD', 'JPY', 'CNY', 'CHF', 'SEK', 'NZD', 'SGD', 'ZAR', 'TRY', 'BDT', 'NGN', 'BRL', 'MXN'];

export function minorDigits(currency: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Parses "1,234.50" or "1234,5" (one comma used as decimal mark) into a number; NaN if invalid. */
export function num(s: string): number {
  const t = s.trim().replace(/\s/g, '');
  if (!t) return 0;
  const norm = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) ? t.replace(/,/g, '') : /^\d+,\d{1,2}$/.test(t) ? t.replace(',', '.') : t;
  return /^[-+]?\d*\.?\d+$/.test(norm) ? Number(norm) : NaN;
}

export interface LineTotal {
  amount: number; // minor units, before discount and tax
  tax: number; // minor units
  error?: string;
}

export interface Totals {
  lines: LineTotal[];
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  shipping: number;
  total: number;
  digits: number;
  errors: string[];
}

export function computeTotals(inv: Invoice): Totals {
  const digits = minorDigits(inv.currency);
  const f = 10 ** digits;
  const errors: string[] = [];
  const disc = num(inv.discount);
  const discRate = Number.isFinite(disc) ? Math.min(Math.max(disc, 0), 100) / 100 : 0;
  if (!Number.isFinite(disc)) errors.push('The discount is not a number.');
  const lines: LineTotal[] = inv.items.map((it, i) => {
    const q = num(it.qty || '0');
    const p = num(it.price || '0');
    const t = num(it.tax || '0');
    if (![q, p, t].every(Number.isFinite)) {
      errors.push(`Line ${i + 1} has a value that is not a number.`);
      return { amount: 0, tax: 0, error: 'Not a number' };
    }
    const amount = Math.round(q * p * f);
    const tax = Math.round(amount * (1 - discRate) * (t / 100));
    return { amount, tax };
  });
  const subtotal = lines.reduce((n, l) => n + l.amount, 0);
  const discount = Math.round(subtotal * discRate);
  const tax = lines.reduce((n, l) => n + l.tax, 0);
  const ship = num(inv.shipping || '0');
  if (!Number.isFinite(ship)) errors.push('Shipping is not a number.');
  const shipping = Number.isFinite(ship) ? Math.round(ship * f) : 0;
  return { lines, subtotal, discount, taxable: subtotal - discount, tax, shipping, total: subtotal - discount + tax + shipping, digits, errors };
}

export function money(minor: number, currency: string, digits: number, display: 'symbol' | 'code' = 'symbol'): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: display, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / 10 ** digits);
  } catch {
    return `${(minor / 10 ** digits).toFixed(digits)} ${currency}`;
  }
}

export const emptyItem = (): InvoiceItem => ({ description: '', qty: '1', price: '', tax: '0' });

export function sampleInvoice(): Invoice {
  return {
    from: { name: 'Northwind Studio', address: '12 Canal Road\nLahore 54000, Pakistan', email: 'billing@northwind.example', phone: '+92 300 1234567', taxId: 'NTN 1234567-8' },
    to: { name: 'Lumen Health GmbH', address: 'Friedrichstraße 10\n10117 Berlin, Germany', email: 'accounts@lumen.example', phone: '', taxId: 'DE123456789' },
    number: 'INV-2026-0042',
    issued: new Date().toISOString().slice(0, 10),
    due: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
    currency: 'EUR',
    discount: '5',
    shipping: '',
    items: [
      { description: 'Website redesign — design system and 8 page templates', qty: '1', price: '3200', tax: '0' },
      { description: 'Frontend development (hours)', qty: '42', price: '65', tax: '0' },
      { description: 'Hosting setup and handover', qty: '1', price: '250', tax: '0' },
    ],
    notes: 'Thank you for your business!',
    terms: 'Payment within 14 days by bank transfer. IBAN: PK00 XXXX 0000 0000 0000 0000.',
  };
}
