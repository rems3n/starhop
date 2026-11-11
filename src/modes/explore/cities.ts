/** Built-in places for the location dialog: a spread of latitudes, both hemispheres. Pure data + search. */
import type { Observer } from '@/types';

export interface City { name: string; country: string; lat: number; lon: number; tz: string }

const c = (name: string, country: string, lat: number, lon: number, tz: string): City => ({ name, country, lat, lon, tz });

export const CITIES: City[] = [
  // North America
  c('Brooklyn, NY', 'United States', 40.6782, -73.9442, 'America/New_York'),
  c('Boston', 'United States', 42.3601, -71.0589, 'America/New_York'),
  c('Washington, DC', 'United States', 38.9072, -77.0369, 'America/New_York'),
  c('Miami', 'United States', 25.7617, -80.1918, 'America/New_York'),
  c('Atlanta', 'United States', 33.749, -84.388, 'America/New_York'),
  c('Chicago', 'United States', 41.8781, -87.6298, 'America/Chicago'),
  c('Houston', 'United States', 29.7604, -95.3698, 'America/Chicago'),
  c('Denver', 'United States', 39.7392, -104.9903, 'America/Denver'),
  c('Phoenix', 'United States', 33.4484, -112.074, 'America/Phoenix'),
  c('Los Angeles', 'United States', 34.0522, -118.2437, 'America/Los_Angeles'),
  c('San Francisco', 'United States', 37.7749, -122.4194, 'America/Los_Angeles'),
  c('Seattle', 'United States', 47.6062, -122.3321, 'America/Los_Angeles'),
  c('Anchorage', 'United States', 61.2181, -149.9003, 'America/Anchorage'),
  c('Fairbanks', 'United States', 64.8378, -147.7164, 'America/Anchorage'),
  c('Honolulu', 'United States', 21.3069, -157.8583, 'Pacific/Honolulu'),
  c('Toronto', 'Canada', 43.6532, -79.3832, 'America/Toronto'),
  c('Montréal', 'Canada', 45.5017, -73.5673, 'America/Toronto'),
  c('Vancouver', 'Canada', 49.2827, -123.1207, 'America/Vancouver'),
  c('Yellowknife', 'Canada', 62.454, -114.3718, 'America/Edmonton'),
  c('Mexico City', 'Mexico', 19.4326, -99.1332, 'America/Mexico_City'),
  c('Havana', 'Cuba', 23.1136, -82.3666, 'America/Havana'),
  // South America
  c('Bogotá', 'Colombia', 4.711, -74.0721, 'America/Bogota'),
  c('Quito', 'Ecuador', -0.1807, -78.4678, 'America/Guayaquil'),
  c('Lima', 'Peru', -12.0464, -77.0428, 'America/Lima'),
  c('La Paz', 'Bolivia', -16.4897, -68.1193, 'America/La_Paz'),
  c('São Paulo', 'Brazil', -23.5505, -46.6333, 'America/Sao_Paulo'),
  c('Rio de Janeiro', 'Brazil', -22.9068, -43.1729, 'America/Sao_Paulo'),
  c('Santiago', 'Chile', -33.4489, -70.6693, 'America/Santiago'),
  c('San Pedro de Atacama', 'Chile', -22.9087, -68.1997, 'America/Santiago'),
  c('Buenos Aires', 'Argentina', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires'),
  c('Punta Arenas', 'Chile', -53.1638, -70.9171, 'America/Punta_Arenas'),
  c('Ushuaia', 'Argentina', -54.8019, -68.303, 'America/Argentina/Ushuaia'),
  // Europe
  c('Reykjavík', 'Iceland', 64.1466, -21.9426, 'Atlantic/Reykjavik'),
  c('Tromsø', 'Norway', 69.6492, 18.9553, 'Europe/Oslo'),
  c('Longyearbyen', 'Svalbard', 78.2232, 15.6267, 'Arctic/Longyearbyen'),
  c('Oslo', 'Norway', 59.9139, 10.7522, 'Europe/Oslo'),
  c('Stockholm', 'Sweden', 59.3293, 18.0686, 'Europe/Stockholm'),
  c('Helsinki', 'Finland', 60.1699, 24.9384, 'Europe/Helsinki'),
  c('Edinburgh', 'United Kingdom', 55.9533, -3.1883, 'Europe/London'),
  c('Dublin', 'Ireland', 53.3498, -6.2603, 'Europe/Dublin'),
  c('London', 'United Kingdom', 51.5074, -0.1278, 'Europe/London'),
  c('Amsterdam', 'Netherlands', 52.3676, 4.9041, 'Europe/Amsterdam'),
  c('Berlin', 'Germany', 52.52, 13.405, 'Europe/Berlin'),
  c('Paris', 'France', 48.8566, 2.3522, 'Europe/Paris'),
  c('Warsaw', 'Poland', 52.2297, 21.0122, 'Europe/Warsaw'),
  c('Vienna', 'Austria', 48.2082, 16.3738, 'Europe/Vienna'),
  c('Madrid', 'Spain', 40.4168, -3.7038, 'Europe/Madrid'),
  c('Lisbon', 'Portugal', 38.7223, -9.1393, 'Europe/Lisbon'),
  c('Rome', 'Italy', 41.9028, 12.4964, 'Europe/Rome'),
  c('Athens', 'Greece', 37.9838, 23.7275, 'Europe/Athens'),
  c('Istanbul', 'Türkiye', 41.0082, 28.9784, 'Europe/Istanbul'),
  c('Kyiv', 'Ukraine', 50.4501, 30.5234, 'Europe/Kyiv'),
  c('Moscow', 'Russia', 55.7558, 37.6173, 'Europe/Moscow'),
  c('La Palma', 'Canary Islands, Spain', 28.7134, -17.9058, 'Atlantic/Canary'),
  // Africa and the Middle East
  c('Casablanca', 'Morocco', 33.5731, -7.5898, 'Africa/Casablanca'),
  c('Cairo', 'Egypt', 30.0444, 31.2357, 'Africa/Cairo'),
  c('Dakar', 'Senegal', 14.7167, -17.4677, 'Africa/Dakar'),
  c('Lagos', 'Nigeria', 6.5244, 3.3792, 'Africa/Lagos'),
  c('Addis Ababa', 'Ethiopia', 9.03, 38.74, 'Africa/Addis_Ababa'),
  c('Nairobi', 'Kenya', -1.2921, 36.8219, 'Africa/Nairobi'),
  c('Windhoek', 'Namibia', -22.5609, 17.0658, 'Africa/Windhoek'),
  c('Johannesburg', 'South Africa', -26.2041, 28.0473, 'Africa/Johannesburg'),
  c('Cape Town', 'South Africa', -33.9249, 18.4241, 'Africa/Johannesburg'),
  c('Jerusalem', 'Israel', 31.7683, 35.2137, 'Asia/Jerusalem'),
  c('Dubai', 'United Arab Emirates', 25.2048, 55.2708, 'Asia/Dubai'),
  c('Tehran', 'Iran', 35.6892, 51.389, 'Asia/Tehran'),
  // Asia
  c('Karachi', 'Pakistan', 24.8607, 67.0011, 'Asia/Karachi'),
  c('Delhi', 'India', 28.6139, 77.209, 'Asia/Kolkata'),
  c('Mumbai', 'India', 19.076, 72.8777, 'Asia/Kolkata'),
  c('Kathmandu', 'Nepal', 27.7172, 85.324, 'Asia/Kathmandu'),
  c('Dhaka', 'Bangladesh', 23.8103, 90.4125, 'Asia/Dhaka'),
  c('Bangkok', 'Thailand', 13.7563, 100.5018, 'Asia/Bangkok'),
  c('Singapore', 'Singapore', 1.3521, 103.8198, 'Asia/Singapore'),
  c('Jakarta', 'Indonesia', -6.2088, 106.8456, 'Asia/Jakarta'),
  c('Manila', 'Philippines', 14.5995, 120.9842, 'Asia/Manila'),
  c('Hong Kong', 'China', 22.3193, 114.1694, 'Asia/Hong_Kong'),
  c('Beijing', 'China', 39.9042, 116.4074, 'Asia/Shanghai'),
  c('Shanghai', 'China', 31.2304, 121.4737, 'Asia/Shanghai'),
  c('Ulaanbaatar', 'Mongolia', 47.8864, 106.9057, 'Asia/Ulaanbaatar'),
  c('Seoul', 'South Korea', 37.5665, 126.978, 'Asia/Seoul'),
  c('Tokyo', 'Japan', 35.6762, 139.6503, 'Asia/Tokyo'),
  c('Sapporo', 'Japan', 43.0618, 141.3545, 'Asia/Tokyo'),
  // Oceania and Antarctica
  c('Darwin', 'Australia', -12.4634, 130.8456, 'Australia/Darwin'),
  c('Perth', 'Australia', -31.9505, 115.8605, 'Australia/Perth'),
  c('Alice Springs', 'Australia', -23.698, 133.8807, 'Australia/Darwin'),
  c('Sydney', 'Australia', -33.8688, 151.2093, 'Australia/Sydney'),
  c('Melbourne', 'Australia', -37.8136, 144.9631, 'Australia/Melbourne'),
  c('Hobart', 'Australia', -42.8821, 147.3272, 'Australia/Hobart'),
  c('Auckland', 'New Zealand', -36.8485, 174.7633, 'Pacific/Auckland'),
  c('Lake Tekapo', 'New Zealand', -44.0047, 170.4772, 'Pacific/Auckland'),
  c('Suva', 'Fiji', -18.1248, 178.4501, 'Pacific/Fiji'),
  c('McMurdo Station', 'Antarctica', -77.8419, 166.6863, 'Antarctica/McMurdo'),
];

/** Lower-case, accents removed: "Tromsø" → "tromso", "Reykjavík" → "reykjavik". */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/ł/gi, 'l')
    .toLowerCase()
    .trim();
}

/** Cities whose name or country matches; name-prefix matches first. Empty query = the whole list. */
export function searchCities(query: string, list: City[] = CITIES): City[] {
  const q = fold(query);
  if (!q) return list;
  const scored: { city: City; score: number }[] = [];
  for (const city of list) {
    const n = fold(city.name);
    const k = fold(city.country);
    const at = n.indexOf(q);
    const score = at === 0 ? 0 : at > 0 && /[\s,-]/.test(n[at - 1]) ? 1 : at > 0 ? 2 : k.startsWith(q) ? 3 : k.includes(q) ? 4 : -1;
    if (score >= 0) scored.push({ city, score });
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.city);
}

export function cityToObserver(city: City): Observer {
  return { name: city.name, lat: city.lat, lon: city.lon, tz: city.tz };
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/** "40.68° N, 73.94° W" */
export function formatLatLon(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
}

/** Validate manual entry. Returns an observer or a message saying what to fix. */
export function parseManualLocation(input: { name: string; lat: string; lon: string; tz: string }): { observer: Observer } | { error: string } {
  const lat = Number(input.lat.replace(',', '.'));
  const lon = Number(input.lon.replace(',', '.'));
  if (!input.lat.trim() || !isFinite(lat) || lat < -90 || lat > 90) return { error: 'Latitude must be a number from −90 (South Pole) to 90 (North Pole).' };
  if (!input.lon.trim() || !isFinite(lon) || lon < -180 || lon > 180) return { error: 'Longitude must be a number from −180 to 180. East is positive, west is negative.' };
  if (!isValidTimeZone(input.tz)) return { error: 'Time zone must be a name like "America/New_York" or "Europe/London".' };
  return { observer: { name: input.name.trim() || formatLatLon(lat, lon), lat, lon, tz: input.tz.trim() } };
}
