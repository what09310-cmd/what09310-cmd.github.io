const TYPES = {
  restaurant: 'Restaurant',
  fast_food: 'Restauration rapide',
  food_court: 'Aire de restauration',
  cafe: 'Café',
};

/** 1.234 → "1,2 km". */
export function formatKm(km) {
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export function typeLabel(type) {
  return TYPES[type] ?? type;
}

/** Date et heure courtes en français, ex. « 24/11/2026 09:05 ». */
export function formatSavedDate(date) {
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
