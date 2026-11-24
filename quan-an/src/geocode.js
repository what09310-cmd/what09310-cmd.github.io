// Trouver le lieu tapé (ville, quartier, adresse ou coordonnées), sans clé.
// 1. Coordonnées « lat, lon » : utilisées telles quelles, sans réseau.
// 2. Nominatim (OpenStreetMap).
// 3. Si Nominatim échoue ou ne trouve rien : Photon (komoot, données OpenStreetMap).
// Politique d'usage : une requête à la fois, jamais d'autocomplétion.
export const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const PHOTON = 'https://photon.komoot.io/api/';
export const GEOCODE_TIMEOUT_MS = 10000;

// Rectangle englobant le Vietnam : ouest, sud, est, nord.
const VN_BBOX = '102.1,8.2,109.6,23.4';

export function buildGeocodeUrl(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    countrycodes: 'vn',
    limit: '5',
    'accept-language': 'vi,fr',
  });
  return `${NOMINATIM}?${params}`;
}

export function buildPhotonUrl(query) {
  const params = new URLSearchParams({ q: query, limit: '5', bbox: VN_BBOX });
  return `${PHOTON}?${params}`;
}

/** Réponse Nominatim → [{ label, lat, lon }]. */
export function parseGeocode(json) {
  if (!Array.isArray(json)) return [];
  const out = [];
  for (const p of json) {
    const lat = Number.parseFloat(p?.lat);
    const lon = Number.parseFloat(p?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({ label: String(p.display_name ?? ''), lat, lon });
  }
  return out;
}

/** Réponse Photon (GeoJSON) → [{ label, lat, lon }], Vietnam seulement. */
export function parsePhoton(json) {
  const features = Array.isArray(json?.features) ? json.features : [];
  const out = [];
  for (const f of features) {
    const p = f?.properties ?? {};
    if (p.countrycode && p.countrycode !== 'VN') continue;
    const [lon, lat] = f?.geometry?.coordinates ?? [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const parts = [p.name, p.street, p.district, p.city, p.state].filter(Boolean);
    const label = [...new Set(parts)].join(', ');
    out.push({ label, lat, lon });
  }
  return out;
}

/** « 10.89, 106.39 » ou « 10.89 106.39 » → { label, lat, lon }, sinon null. */
export function parseCoordinates(text) {
  const m = String(text ?? '').trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { label: `${lat}, ${lon}`, lat, lon };
}

async function getJson(url, fetchFn, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function geocode(query, fetchFn = (...a) => fetch(...a), timeoutMs = GEOCODE_TIMEOUT_MS) {
  const q = String(query ?? '').trim();
  if (!q) throw new Error('empty_query');

  const coords = parseCoordinates(q);
  if (coords) return [coords];

  let anyAnswered = false;
  try {
    const places = parseGeocode(await getJson(buildGeocodeUrl(q), fetchFn, timeoutMs));
    anyAnswered = true;
    if (places.length > 0) return places;
  } catch {
    // Nominatim indisponible : on essaie Photon
  }
  try {
    const places = parsePhoton(await getJson(buildPhotonUrl(q), fetchFn, timeoutMs));
    return places;
  } catch {
    if (anyAnswered) return [];
    throw new Error('geocode_unavailable');
  }
}
