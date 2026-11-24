const EARTH_RADIUS_KM = 6371;
const RADII = [1, 3, 5, 10];

const toRad = (deg) => (deg * Math.PI) / 180;

/** Distance haversine en km entre deux points {lat, lon}. */
export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Lien d'itinéraire Google Maps vers {lat, lon}. */
export function directionsUrl(dest) {
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lon}`;
}

/** Rayon suivant dans la suite 1, 3, 5, 10 ; null après 10. */
export function nextRadius(km) {
  const next = RADII.find((r) => r > km);
  return next ?? null;
}

export { RADII };
