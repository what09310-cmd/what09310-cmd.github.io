import { distanceKm } from './geo.js';

export const SERVERS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

export const TIMEOUT_MS = 15000;

const AMENITIES = ['restaurant', 'fast_food', 'food_court', 'cafe'];

/** Requête Overpass QL : lieux de restauration autour d'un point. */
export function buildQuery(lat, lon, radiusKm) {
  const meters = Math.round(radiusKm * 1000);
  return (
    '[out:json][timeout:25];' +
    `nwr["amenity"~"^(${AMENITIES.join('|')})$"](around:${meters},${lat},${lon});` +
    'out tags center 300;'
  );
}

/**
 * Transforme la réponse Overpass en Restaurant[] :
 * { id, name, type, distanceKm, lat, lon }, triés par distance, dans le rayon.
 */
export function parseElements(json, origin, radiusKm) {
  const elements = Array.isArray(json?.elements) ? json.elements : [];
  const out = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = (tags.name || tags['name:vi'] || '').trim();
    if (!name) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const d = distanceKm(origin, { lat, lon });
    if (d > radiusKm) continue;
    out.push({ id: `${el.type}/${el.id}`, name, type: tags.amenity ?? '', distanceKm: d, lat, lon });
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm);
}

async function tryServer(server, query, fetchFn, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${server}?data=${encodeURIComponent(query)}`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Interroge les serveurs dans l'ordre ; le premier qui répond OK gagne.
 * Rejette avec Error('overpass_unavailable') si tous échouent.
 */
export async function fetchRestaurants(
  lat,
  lon,
  radiusKm,
  fetchFn = (...args) => fetch(...args),
  servers = SERVERS,
  timeoutMs = TIMEOUT_MS
) {
  const query = buildQuery(lat, lon, radiusKm);
  for (const server of servers) {
    try {
      const json = await tryServer(server, query, fetchFn, timeoutMs);
      return parseElements(json, { lat, lon }, radiusKm);
    } catch {
      // échec réseau, HTTP non-OK, délai ou JSON illisible : serveur suivant
    }
  }
  throw new Error('overpass_unavailable');
}
