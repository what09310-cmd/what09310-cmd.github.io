/**
 * Convertit la saisie du budget en nombre entier de dongs.
 * Retire points et espaces (y compris insécables) avant conversion.
 * Renvoie null si vide, non numérique, nul ou négatif.
 */
export function parseBudget(input) {
  if (input === null || input === undefined) return null;
  const cleaned = String(input).replace(/[.\s  ]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** 20000 → "20.000" ; 1500000 → "1.500.000". */
export function formatDong(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Phrase de commande en vietnamien à montrer au personnel. */
export function orderPhrase(budget) {
  return `Cho tôi một đĩa cơm chiên, tôi có ${formatDong(budget)} đồng`;
}
