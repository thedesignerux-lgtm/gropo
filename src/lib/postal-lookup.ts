// src/lib/postal-lookup.ts
// Auto-detect provincia y ciudad a partir de un código postal español.
//
// Provincia: mapa local estático (2 primeros dígitos → provincia). Instantáneo.
// Ciudad:    API pública Zippopotam.us (sin API key). Fallback a capital de provincia.

/** Mapa: 2 primeros dígitos del CP → nombre de provincia (coincide con PROVINCIAS_ES). */
const PREFIX_TO_PROVINCE: Record<string, string> = {
  '01': 'Álava',       '02': 'Albacete',    '03': 'Alicante',
  '04': 'Almería',     '05': 'Ávila',       '06': 'Badajoz',
  '07': 'Illes Balears','08': 'Barcelona',   '09': 'Burgos',
  '10': 'Cáceres',     '11': 'Cádiz',       '12': 'Castellón',
  '13': 'Ciudad Real', '14': 'Córdoba',     '15': 'A Coruña',
  '16': 'Cuenca',      '17': 'Girona',      '18': 'Granada',
  '19': 'Guadalajara', '20': 'Gipuzkoa',    '21': 'Huelva',
  '22': 'Huesca',      '23': 'Jaén',        '24': 'León',
  '25': 'Lleida',      '26': 'La Rioja',    '27': 'Lugo',
  '28': 'Madrid',      '29': 'Málaga',      '30': 'Murcia',
  '31': 'Navarra',     '32': 'Ourense',     '33': 'Asturias',
  '34': 'Palencia',    '35': 'Las Palmas',  '36': 'Pontevedra',
  '37': 'Salamanca',   '38': 'Santa Cruz de Tenerife',
  '39': 'Cantabria',   '40': 'Segovia',     '41': 'Sevilla',
  '42': 'Soria',       '43': 'Tarragona',   '44': 'Teruel',
  '45': 'Toledo',      '46': 'Valencia',    '47': 'Valladolid',
  '48': 'Bizkaia',     '49': 'Zamora',      '50': 'Zaragoza',
  '51': 'Ceuta',       '52': 'Melilla',
};

/** Devuelve la provincia para un CP español, o undefined. */
export function provinceFromPostalCode(cp: string): string | undefined {
  const digits = cp.replace(/\s/g, '');
  if (digits.length < 2) return undefined;
  return PREFIX_TO_PROVINCE[digits.slice(0, 2)];
}

/**
 * Busca la ciudad asociada a un CP español usando la API pública Zippopotam.us.
 * Devuelve el nombre de la ciudad o null si no se encuentra.
 * Nunca lanza; los errores de red se tratan como "no encontrado".
 */
export async function cityFromPostalCode(cp: string): Promise<string | null> {
  const digits = cp.replace(/\s/g, '');
  if (!/^\d{5}$/.test(digits)) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/es/${digits}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const place = data?.places?.[0]?.['place name'];
    return typeof place === 'string' ? place : null;
  } catch {
    return null;
  }
}
