import { distanceKm } from './geo.js';

// Ordre testé le 2026-11-24 depuis un vrai navigateur : openstreetmap.fr répondait en ~5 s,
// mail.ru en ~17 s (POST), les autres étaient saturés ou muets. On les garde tous en secours.
export const SERVERS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/** Délai global de la recherche. */
export const TIMEOUT_MS = 20000;
/** Si un serveur n'a pas répondu après ce délai, on lance aussi le suivant. */
export const HEDGE_MS = 3000;

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

/**
 * Interroge les serveurs de façon échelonnée : le premier tout de suite, le suivant
 * dès qu'un serveur échoue ou après hedgeMs sans réponse. La première réponse valide
 * gagne et annule les autres. Rejette avec Error('overpass_unavailable') si tous
 * échouent ou si timeoutMs est dépassé.
 */
export function fetchRestaurants(
  lat,
  lon,
  radiusKm,
  fetchFn = (...args) => fetch(...args),
  servers = SERVERS,
  { timeoutMs = TIMEOUT_MS, hedgeMs = HEDGE_MS } = {}
) {
  const query = buildQuery(lat, lon, radiusKm);
  const body = new URLSearchParams({ data: query }).toString();

  return new Promise((resolve, reject) => {
    const controllers = [];
    let next = 0;
    let failed = 0;
    let done = false;
    let hedgeTimer = null;

    const finish = (settle, value) => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      clearTimeout(hedgeTimer);
      for (const c of controllers) c.abort();
      settle(value);
    };
    const fail = () => finish(reject, new Error('overpass_unavailable'));
    const deadline = setTimeout(fail, timeoutMs);

    const launch = () => {
      if (done || next >= servers.length) return;
      const server = servers[next++];
      const controller = new AbortController();
      controllers.push(controller);
      clearTimeout(hedgeTimer);
      hedgeTimer = setTimeout(launch, hedgeMs);

      Promise.resolve()
        .then(() =>
          fetchFn(server, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body,
            signal: controller.signal,
          })
        )
        .then((res) => {
          if (!res.ok) throw new Error(`http_${res.status}`);
          return res.json();
        })
        .then((json) => {
          if (!json || !Array.isArray(json.elements)) throw new Error('bad_json');
          if (typeof json.remark === 'string' && /error/i.test(json.remark)) throw new Error('runtime_error');
          finish(resolve, parseElements(json, { lat, lon }, radiusKm));
        })
        .catch(() => {
          if (done) return;
          failed += 1;
          if (failed >= servers.length) fail();
          else launch();
        });
    };

    if (servers.length === 0) fail();
    else launch();
  });
}
