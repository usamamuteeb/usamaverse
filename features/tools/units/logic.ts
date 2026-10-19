export interface UnitDef {
  id: string;
  label: string;
  symbol: string;
  /** Linear factor to the base unit, or custom functions for affine units. */
  factor?: number;
  toBase?: (v: number) => number;
  fromBase?: (v: number) => number;
}

export interface Quantity {
  base: string;
  units: UnitDef[];
  defaultFrom: string;
  defaultTo: string;
  minBase?: number;
  minBaseMessage?: string;
}

const lin = (id: string, label: string, symbol: string, factor: number): UnitDef => ({ id, label, symbol, factor });

export const QUANTITIES = {
  length: {
    base: 'm', defaultFrom: 'cm', defaultTo: 'in',
    units: [
      lin('um', 'Micrometre', 'µm', 1e-6), lin('mm', 'Millimetre', 'mm', 1e-3), lin('cm', 'Centimetre', 'cm', 1e-2), lin('m', 'Metre', 'm', 1),
      lin('km', 'Kilometre', 'km', 1e3), lin('in', 'Inch', 'in', 0.0254), lin('ft', 'Foot', 'ft', 0.3048), lin('yd', 'Yard', 'yd', 0.9144),
      lin('mi', 'Mile', 'mi', 1609.344), lin('nmi', 'Nautical mile', 'nmi', 1852),
    ],
  },
  mass: {
    base: 'kg', defaultFrom: 'kg', defaultTo: 'lb',
    units: [
      lin('mg', 'Milligram', 'mg', 1e-6), lin('g', 'Gram', 'g', 1e-3), lin('kg', 'Kilogram', 'kg', 1), lin('t', 'Tonne (metric)', 't', 1000),
      lin('oz', 'Ounce (avoirdupois)', 'oz', 0.028349523125), lin('lb', 'Pound', 'lb', 0.45359237), lin('st', 'Stone', 'st', 6.35029318),
      lin('ston', 'Short ton (US)', 'ton', 907.18474), lin('lton', 'Long ton (UK)', 'long ton', 1016.0469088),
    ],
  },
  temperature: {
    base: 'K', defaultFrom: 'C', defaultTo: 'F', minBase: 0, minBaseMessage: 'That is below absolute zero (0 K), which is not physically possible.',
    units: [
      { id: 'C', label: 'Celsius', symbol: '°C', toBase: (v) => v + 273.15, fromBase: (k) => k - 273.15 },
      { id: 'F', label: 'Fahrenheit', symbol: '°F', toBase: (v) => ((v - 32) * 5) / 9 + 273.15, fromBase: (k) => ((k - 273.15) * 9) / 5 + 32 },
      { id: 'K', label: 'Kelvin', symbol: 'K', toBase: (v) => v, fromBase: (k) => k },
      { id: 'R', label: 'Rankine', symbol: '°R', toBase: (v) => (v * 5) / 9, fromBase: (k) => (k * 9) / 5 },
    ],
  },
  area: {
    base: 'm2', defaultFrom: 'm2', defaultTo: 'ft2',
    units: [
      lin('mm2', 'Square millimetre', 'mm²', 1e-6), lin('cm2', 'Square centimetre', 'cm²', 1e-4), lin('m2', 'Square metre', 'm²', 1),
      lin('ha', 'Hectare', 'ha', 1e4), lin('km2', 'Square kilometre', 'km²', 1e6), lin('in2', 'Square inch', 'in²', 0.00064516),
      lin('ft2', 'Square foot', 'ft²', 0.09290304), lin('yd2', 'Square yard', 'yd²', 0.83612736), lin('ac', 'Acre', 'ac', 4046.8564224),
      lin('mi2', 'Square mile', 'mi²', 2589988.110336),
    ],
  },
  volume: {
    base: 'm3', defaultFrom: 'l', defaultTo: 'usgal',
    units: [
      lin('ml', 'Millilitre', 'mL', 1e-6), lin('cm3', 'Cubic centimetre', 'cm³', 1e-6), lin('l', 'Litre', 'L', 1e-3), lin('m3', 'Cubic metre', 'm³', 1),
      lin('ustsp', 'Teaspoon (US)', 'tsp', 4.92892159375e-6), lin('ustbsp', 'Tablespoon (US)', 'tbsp', 1.478676478125e-5),
      lin('usfloz', 'Fluid ounce (US)', 'US fl oz', 2.95735295625e-5), lin('uscup', 'Cup (US customary)', 'cup', 2.365882365e-4),
      lin('uspt', 'Pint (US liquid)', 'US pt', 4.73176473e-4), lin('usqt', 'Quart (US liquid)', 'US qt', 9.46352946e-4),
      lin('usgal', 'Gallon (US)', 'US gal', 3.785411784e-3), lin('ukfloz', 'Fluid ounce (imperial)', 'imp fl oz', 2.84130625e-5),
      lin('ukpt', 'Pint (imperial)', 'imp pt', 5.6826125e-4), lin('ukgal', 'Gallon (imperial)', 'imp gal', 4.54609e-3),
      lin('in3', 'Cubic inch', 'in³', 1.6387064e-5), lin('ft3', 'Cubic foot', 'ft³', 0.028316846592),
    ],
  },
  speed: {
    base: 'ms', defaultFrom: 'kmh', defaultTo: 'mph',
    units: [
      lin('ms', 'Metres per second', 'm/s', 1), lin('kmh', 'Kilometres per hour', 'km/h', 1 / 3.6), lin('mph', 'Miles per hour', 'mph', 0.44704),
      lin('fts', 'Feet per second', 'ft/s', 0.3048), lin('kn', 'Knot', 'kn', 1852 / 3600),
    ],
  },
  duration: {
    base: 's', defaultFrom: 'h', defaultTo: 'min',
    units: [
      lin('ns', 'Nanosecond', 'ns', 1e-9), lin('us', 'Microsecond', 'µs', 1e-6), lin('ms', 'Millisecond', 'ms', 1e-3), lin('s', 'Second', 's', 1),
      lin('min', 'Minute', 'min', 60), lin('h', 'Hour', 'h', 3600), lin('d', 'Day', 'd', 86400), lin('wk', 'Week', 'wk', 604800),
      lin('mo', 'Month (average Gregorian)', 'mo avg', 2629746), lin('yr', 'Year (average Gregorian)', 'yr avg', 31556952),
    ],
  },
  data: {
    base: 'B', defaultFrom: 'GB', defaultTo: 'GiB',
    units: [
      lin('bit', 'Bit', 'bit', 0.125), lin('B', 'Byte', 'B', 1),
      lin('kB', 'Kilobyte (1000)', 'kB', 1e3), lin('MB', 'Megabyte (1000²)', 'MB', 1e6), lin('GB', 'Gigabyte (1000³)', 'GB', 1e9),
      lin('TB', 'Terabyte (1000⁴)', 'TB', 1e12), lin('PB', 'Petabyte (1000⁵)', 'PB', 1e15),
      lin('KiB', 'Kibibyte (1024)', 'KiB', 1024), lin('MiB', 'Mebibyte (1024²)', 'MiB', 1024 ** 2), lin('GiB', 'Gibibyte (1024³)', 'GiB', 1024 ** 3),
      lin('TiB', 'Tebibyte (1024⁴)', 'TiB', 1024 ** 4), lin('PiB', 'Pebibyte (1024⁵)', 'PiB', 1024 ** 5),
      lin('Mbit', 'Megabit (1000²)', 'Mbit', 1e6 / 8), lin('Gbit', 'Gigabit (1000³)', 'Gbit', 1e9 / 8),
    ],
  },
  pressure: {
    base: 'Pa', defaultFrom: 'bar', defaultTo: 'psi',
    units: [
      lin('Pa', 'Pascal', 'Pa', 1), lin('hPa', 'Hectopascal', 'hPa', 100), lin('kPa', 'Kilopascal', 'kPa', 1e3), lin('MPa', 'Megapascal', 'MPa', 1e6),
      lin('mbar', 'Millibar', 'mbar', 100), lin('bar', 'Bar', 'bar', 1e5), lin('atm', 'Standard atmosphere', 'atm', 101325),
      lin('psi', 'Pound per square inch', 'psi', 6894.757293168361), lin('torr', 'Torr', 'Torr', 101325 / 760),
      lin('mmHg', 'Millimetre of mercury', 'mmHg', 133.322387415), lin('inHg', 'Inch of mercury', 'inHg', 3386.389),
    ],
  },
  energy: {
    base: 'J', defaultFrom: 'kWh', defaultTo: 'MJ',
    units: [
      lin('J', 'Joule', 'J', 1), lin('kJ', 'Kilojoule', 'kJ', 1e3), lin('MJ', 'Megajoule', 'MJ', 1e6), lin('Wh', 'Watt-hour', 'Wh', 3600),
      lin('kWh', 'Kilowatt-hour', 'kWh', 3.6e6), lin('cal', 'Calorie (thermochemical)', 'cal', 4.184), lin('kcal', 'Kilocalorie (food Calorie)', 'kcal', 4184),
      lin('BTU', 'British thermal unit (IT)', 'BTU', 1055.05585262), lin('eV', 'Electronvolt', 'eV', 1.602176634e-19),
      lin('ftlbf', 'Foot-pound force', 'ft·lbf', 1.3558179483314004), lin('erg', 'Erg', 'erg', 1e-7),
    ],
  },
  power: {
    base: 'W', defaultFrom: 'hp', defaultTo: 'kW',
    units: [
      lin('mW', 'Milliwatt', 'mW', 1e-3), lin('W', 'Watt', 'W', 1), lin('kW', 'Kilowatt', 'kW', 1e3), lin('MW', 'Megawatt', 'MW', 1e6),
      lin('hp', 'Horsepower (mechanical)', 'hp', 745.6998715822702), lin('PS', 'Metric horsepower', 'PS', 735.49875),
      lin('BTUh', 'BTU per hour', 'BTU/h', 0.29307107017222), lin('ftlbfs', 'Foot-pound force per second', 'ft·lbf/s', 1.3558179483314004),
      lin('kcalh', 'Kilocalorie per hour', 'kcal/h', 4184 / 3600),
    ],
  },
  force: {
    base: 'N', defaultFrom: 'N', defaultTo: 'lbf',
    units: [
      lin('N', 'Newton', 'N', 1), lin('kN', 'Kilonewton', 'kN', 1e3), lin('dyn', 'Dyne', 'dyn', 1e-5), lin('kgf', 'Kilogram-force', 'kgf', 9.80665),
      lin('lbf', 'Pound-force', 'lbf', 4.4482216152605), lin('ozf', 'Ounce-force', 'ozf', 0.27801385095378125), lin('pdl', 'Poundal', 'pdl', 0.138254954376),
    ],
  },
  angle: {
    base: 'deg', defaultFrom: 'deg', defaultTo: 'rad',
    units: [
      lin('deg', 'Degree', '°', 1), lin('rad', 'Radian', 'rad', 180 / Math.PI), lin('mrad', 'Milliradian', 'mrad', 0.18 / Math.PI),
      lin('grad', 'Gradian', 'gon', 0.9), lin('turn', 'Turn (revolution)', 'turn', 360), lin('arcmin', 'Arcminute', '′', 1 / 60), lin('arcsec', 'Arcsecond', '″', 1 / 3600),
    ],
  },
  frequency: {
    base: 'Hz', defaultFrom: 'rpm', defaultTo: 'Hz',
    units: [
      lin('mHz', 'Millihertz', 'mHz', 1e-3), lin('Hz', 'Hertz', 'Hz', 1), lin('kHz', 'Kilohertz', 'kHz', 1e3), lin('MHz', 'Megahertz', 'MHz', 1e6),
      lin('GHz', 'Gigahertz', 'GHz', 1e9), lin('rpm', 'Revolutions per minute', 'rpm', 1 / 60), lin('rads', 'Radians per second', 'rad/s', 1 / (2 * Math.PI)),
      lin('bpm', 'Beats per minute', 'bpm', 1 / 60),
    ],
  },
  fuel: {
    base: 'kmL', defaultFrom: 'L100', defaultTo: 'mpgus', minBase: 0, minBaseMessage: 'Fuel economy must be greater than zero.',
    units: [
      lin('kmL', 'Kilometres per litre', 'km/L', 1),
      {
        id: 'L100', label: 'Litres per 100 km', symbol: 'L/100 km',
        toBase: (v) => {
          if (v <= 0) throw new Error('L/100 km must be greater than zero.');
          return 100 / v;
        },
        fromBase: (b) => (b === 0 ? Infinity : 100 / b),
      },
      lin('mpgus', 'Miles per gallon (US)', 'mpg US', 1.609344 / 3.785411784),
      lin('mpguk', 'Miles per gallon (imperial)', 'mpg UK', 1.609344 / 4.54609),
      lin('miL', 'Miles per litre', 'mi/L', 1.609344),
    ],
  },
  typography: {
    base: 'px', defaultFrom: 'pt', defaultTo: 'px',
    units: [
      lin('px', 'CSS pixel', 'px', 1), lin('pt', 'Point (1/72 in)', 'pt', 96 / 72), lin('pc', 'Pica (12 pt)', 'pc', 16),
      lin('rem', 'rem (at 16px root)', 'rem', 16), lin('em', 'em (at 16px font size)', 'em', 16),
      lin('in', 'Inch', 'in', 96), lin('cm', 'Centimetre', 'cm', 96 / 2.54), lin('mm', 'Millimetre', 'mm', 96 / 25.4), lin('Q', 'Quarter-millimetre', 'Q', 96 / 101.6),
    ],
  },
  cooking: {
    base: 'ml', defaultFrom: 'uscup', defaultTo: 'ml',
    units: [
      lin('ml', 'Millilitre', 'mL', 1), lin('l', 'Litre', 'L', 1000),
      lin('ustsp', 'Teaspoon (US)', 'US tsp', 4.92892159375), lin('ustbsp', 'Tablespoon (US)', 'US tbsp', 14.78676478125),
      lin('usfloz', 'Fluid ounce (US)', 'US fl oz', 29.5735295625), lin('uscup', 'Cup (US customary)', 'US cup', 236.5882365),
      lin('uslegalcup', 'Cup (US legal, nutrition labels)', 'US legal cup', 240), lin('uspint', 'Pint (US)', 'US pt', 473.176473),
      lin('mtsp', 'Teaspoon (metric)', 'metric tsp', 5), lin('mtbsp', 'Tablespoon (UK/metric)', 'metric tbsp', 15), lin('autbsp', 'Tablespoon (Australia)', 'AU tbsp', 20),
      lin('mcup', 'Cup (metric: UK, AU, CA, NZ)', 'metric cup', 250), lin('jpcup', 'Cup (Japan)', 'JP cup', 200), lin('impcup', 'Cup (old imperial)', 'imp cup', 284.130625),
      lin('impfloz', 'Fluid ounce (imperial)', 'imp fl oz', 28.4130625), lin('imppint', 'Pint (imperial)', 'imp pt', 568.26125),
    ],
  },
} satisfies Record<string, Quantity>;

export type QuantityId = keyof typeof QUANTITIES;

export function toBase(q: Quantity, unitId: string, v: number): number {
  const u = q.units.find((x) => x.id === unitId);
  if (!u) throw new Error(`Unknown unit ${unitId}`);
  return u.toBase ? u.toBase(v) : v * u.factor!;
}

export function fromBase(q: Quantity, unitId: string, b: number): number {
  const u = q.units.find((x) => x.id === unitId);
  if (!u) throw new Error(`Unknown unit ${unitId}`);
  return u.fromBase ? u.fromBase(b) : b / u.factor!;
}

export function convert(q: Quantity, value: number, from: string, to: string): number {
  if (!Number.isFinite(value)) throw new Error('Enter a number.');
  const b = toBase(q, from, value);
  if (q.minBase !== undefined && b < q.minBase - 1e-9) throw new Error(q.minBaseMessage ?? 'Value is out of range.');
  return fromBase(q, to, b);
}
