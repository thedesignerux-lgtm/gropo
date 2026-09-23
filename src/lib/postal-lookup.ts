// src/lib/postal-lookup.ts
// Auto-detect provincia y ciudad a partir de un código postal español.
// Todo local — sin llamadas a APIs externas.

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

/**
 * Capitales de provincia y ciudades principales por prefijo de CP.
 * Cubre las capitales (que suelen ser los primeros CPs del rango)
 * y ciudades frecuentes con sus prefijos de 3 dígitos.
 */
const CITY_MAP: Record<string, string> = {
  // Capitales de provincia — los 3 primeros dígitos del CP de la capital
  '010': 'Vitoria-Gasteiz', '020': 'Albacete', '030': 'Alicante',
  '040': 'Almería',  '050': 'Ávila',     '060': 'Badajoz',
  '070': 'Palma',    '080': 'Barcelona', '090': 'Burgos',
  '100': 'Cáceres',  '110': 'Cádiz',     '120': 'Castellón de la Plana',
  '130': 'Ciudad Real','140': 'Córdoba',  '150': 'A Coruña',
  '160': 'Cuenca',   '170': 'Girona',    '180': 'Granada',
  '190': 'Guadalajara','200': 'Donostia-San Sebastián',
  '210': 'Huelva',   '220': 'Huesca',    '230': 'Jaén',
  '240': 'León',     '250': 'Lleida',    '260': 'Logroño',
  '270': 'Lugo',     '280': 'Madrid',    '290': 'Málaga',
  '300': 'Murcia',   '310': 'Pamplona',  '320': 'Ourense',
  '330': 'Oviedo',   '340': 'Palencia',  '350': 'Las Palmas de Gran Canaria',
  '360': 'Pontevedra','370': 'Salamanca', '380': 'Santa Cruz de Tenerife',
  '390': 'Santander','400': 'Segovia',   '410': 'Sevilla',
  '420': 'Soria',    '430': 'Tarragona', '440': 'Teruel',
  '450': 'Toledo',   '460': 'Valencia',  '470': 'Valladolid',
  '480': 'Bilbao',   '490': 'Zamora',    '500': 'Zaragoza',
  '510': 'Ceuta',    '520': 'Melilla',

  // Ciudades principales con prefijos específicos
  '081': 'Barcelona', '082': 'Barcelona', '083': 'Badalona',
  '084': "L'Hospitalet de Llobregat", '085': 'Sabadell',
  '086': 'Terrassa',  '087': 'Rubí',
  '281': 'Madrid',    '282': 'Madrid',    '283': 'Madrid',
  '284': 'Alcalá de Henares', '285': 'Torrejón de Ardoz',
  '286': 'Alcobendas','287': 'Pozuelo de Alarcón',
  '288': 'Leganés',   '289': 'Getafe',
  '461': 'Valencia',  '462': 'Valencia',  '463': 'Valencia',
  '464': 'Paterna',
  '411': 'Sevilla',   '412': 'Sevilla',
  '291': 'Málaga',    '292': 'Málaga',
  '301': 'Murcia',    '302': 'Cartagena', '303': 'Cartagena',
  '031': 'Alicante',  '032': 'Elche',     '036': 'Benidorm',
  '351': 'Las Palmas de Gran Canaria',
  '381': 'Santa Cruz de Tenerife',
  '331': 'Gijón',     '332': 'Gijón',
  '481': 'Bilbao',    '482': 'Bilbao',
  '201': 'Donostia-San Sebastián',
  '471': 'Valladolid',
  '183': 'Granada',
  '501': 'Zaragoza',  '502': 'Zaragoza',
  '151': 'A Coruña',
  '362': 'Vigo',      '363': 'Vigo',
  '152': 'Santiago de Compostela',
  '472': 'Valladolid',
};

/** Devuelve la provincia para un CP español, o undefined. */
export function provinceFromPostalCode(cp: string): string | undefined {
  const digits = cp.replace(/\s/g, '');
  if (digits.length < 2) return undefined;
  return PREFIX_TO_PROVINCE[digits.slice(0, 2)];
}

/** Devuelve la ciudad probable para un CP español, o undefined. */
export function cityFromPostalCode(cp: string): string | undefined {
  const digits = cp.replace(/\s/g, '');
  if (digits.length < 3) return undefined;
  // Intentar con los 3 primeros dígitos
  const prefix3 = digits.slice(0, 3);
  if (CITY_MAP[prefix3]) return CITY_MAP[prefix3];
  // Fallback: capital de provincia (prefix + '0')
  const prefix2plus0 = digits.slice(0, 2) + '0';
  return CITY_MAP[prefix2plus0];
}
