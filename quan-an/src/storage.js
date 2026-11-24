export const KEY = 'lastResults';

const pickRestaurant = ({ id, name, type, distanceKm, lat, lon }) => ({ id, name, type, distanceKm, lat, lon });

/** Enregistre les derniers résultats (jamais le budget). Échoue en silence. */
export function saveLastResults(storage, results, radiusKm, date = new Date()) {
  try {
    const payload = { results: results.map(pickRestaurant), radiusKm, savedAt: date.toISOString() };
    storage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // stockage plein, bloqué ou absent : on continue sans
  }
}

/** Relit les derniers résultats, ou null. */
export function loadLastResults(storage) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data.results)) return null;
    const savedAt = new Date(data.savedAt);
    if (Number.isNaN(savedAt.getTime())) return null;
    return { results: data.results, radiusKm: data.radiusKm, savedAt };
  } catch {
    return null;
  }
}
