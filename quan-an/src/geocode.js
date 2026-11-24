// Géocodage d'un lieu tapé (ville, quartier, adresse) via Nominatim (OpenStreetMap), sans clé.
// Politique d'usage Nominatim : une requête à la fois, jamais d'autocomplétion.
export const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
export const GEOCODE_TIMEOUT_MS = 10000;

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

export async function geocode(query, fetchFn = (...a) => fetch(...a), timeoutMs = GEOCODE_TIMEOUT_MS) {
  const q = String(query ?? '').trim();
  if (!q) throw new Error('empty_query');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(buildGeocodeUrl(q), { signal: controller.signal });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return parseGeocode(await res.json());
  } catch {
    throw new Error('geocode_unavailable');
  } finally {
    clearTimeout(timer);
  }
}
