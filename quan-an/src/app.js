import { directionsUrl, nextRadius } from './geo.js';
import { parseBudget, orderPhrase } from './phrase.js';
import { fetchRestaurants } from './overpass.js';
import { saveLastResults, loadLastResults } from './storage.js';
import { formatKm, typeLabel, formatSavedDate } from './format.js';

const $ = (id) => document.getElementById(id);

// Accéder à window.localStorage peut lever une exception (navigation privée, cookies bloqués).
function storage() {
  try { return window.localStorage; } catch { return null; }
}

// État en mémoire uniquement : rien de cela n'est stocké (sauf lastResults, sans budget ni position).
const state = {
  position: null, // { lat, lon }
  budget: null,   // nombre de dongs de la recherche en cours
  radiusKm: null,
  lastAction: null, // pour « Réessayer »
};

const SCREENS = ['home', 'search', 'loading', 'results', 'error'];

function show(name) {
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  window.scrollTo(0, 0);
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of [].concat(children)) node.append(c);
  return node;
}

/* ---------- Géolocalisation ---------- */

const GEO_MESSAGES = {
  1: 'Tu as refusé l’accès à ta position. Autorise la localisation pour ce site dans les réglages du navigateur, puis réessaie.',
  2: 'Ta position est introuvable pour l’instant. Vérifie que le GPS est activé, puis réessaie.',
  3: 'La localisation a pris trop de temps. Mets-toi près d’une fenêtre ou dehors, puis réessaie.',
};

function locate() {
  state.lastAction = locate;
  if (!('geolocation' in navigator)) {
    showError('Position indisponible', 'Ce navigateur ne permet pas la localisation.');
    return;
  }
  show('home');
  $('home-status').textContent = 'Localisation en cours…';
  $('btn-locate').disabled = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      $('btn-locate').disabled = false;
      $('home-status').textContent = '';
      state.position = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      openSearch();
    },
    (err) => {
      $('btn-locate').disabled = false;
      $('home-status').textContent = '';
      showError('Position indisponible', GEO_MESSAGES[err.code] ?? GEO_MESSAGES[2]);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

/* ---------- Écran rayon + budget ---------- */

function openSearch() {
  // Budget vide à chaque ouverture, jamais mémorisé.
  state.budget = null;
  const input = $('budget');
  input.value = '';
  input.removeAttribute('aria-invalid');
  $('budget-error').textContent = '';
  show('search');
}

function onRadiusClick(km) {
  const budget = parseBudget($('budget').value);
  if (budget === null) {
    $('budget-error').textContent = 'Entre ton budget en dongs';
    $('budget').setAttribute('aria-invalid', 'true');
    $('budget').focus();
    return;
  }
  state.budget = budget;
  $('budget').blur();
  search(km);
}

/* ---------- Recherche ---------- */

async function search(km) {
  state.radiusKm = km;
  state.lastAction = () => search(km);
  $('loading-text').textContent = `Recherche dans ${km} km…`;
  show('loading');
  try {
    const { lat, lon } = state.position;
    const results = await fetchRestaurants(lat, lon, km);
    if (results.length > 0) saveLastResults(storage(), results, km);
    renderResults(results, km);
  } catch {
    showOverpassError();
  }
}

function renderCard(r) {
  const card = $('card-template').content.firstElementChild.cloneNode(true);
  card.querySelector('.card-name').textContent = r.name;
  card.querySelector('.card-distance').textContent = formatKm(r.distanceKm);
  card.querySelector('.card-type').textContent = typeLabel(r.type);
  card.querySelector('.card-route').href = directionsUrl(r);
  card.querySelector('.card-show').addEventListener('click', () => openShow(r.name));
  return card;
}

function renderList(list, results) {
  list.replaceChildren(...results.map(renderCard));
}

function renderResults(results, km) {
  const notice = $('results-notice');
  notice.replaceChildren();
  $('results-title').textContent =
    results.length > 0 ? `${results.length} lieu${results.length > 1 ? 'x' : ''} dans ${km} km` : 'Résultats';

  if (results.length === 0) {
    const next = nextRadius(km);
    const box = el('div', { className: 'empty' }, [el('p', { textContent: `Rien dans ${km} km` })]);
    if (next !== null) {
      const btn = el('button', { type: 'button', className: 'btn primary big', textContent: `Chercher dans ${next} km` });
      btn.addEventListener('click', () => search(next));
      box.append(btn);
    }
    notice.append(box);
  }
  renderList($('results-list'), results);
  show('results');
}

/* ---------- Erreurs ---------- */

function showError(title, text) {
  $('error-title').textContent = title;
  $('error-text').textContent = text;
  $('error-saved').replaceChildren();
  show('error');
}

function showOverpassError() {
  showError(
    'Serveurs indisponibles',
    'Les serveurs de cartes ne répondent pas pour l’instant. Vérifie ta connexion, puis réessaie.'
  );
  const saved = loadLastResults(storage());
  if (!saved || saved.results.length === 0) return;
  const list = el('ol', { className: 'cards' });
  renderList(list, saved.results);
  $('error-saved').append(
    el('div', { className: 'saved' }, [
      el('p', {
        className: 'notice',
        textContent: `Résultats enregistrés du ${formatSavedDate(saved.savedAt)} (rayon ${saved.radiusKm} km, distances depuis ta position d’alors)`,
      }),
      list,
    ])
  );
}

/* ---------- Plein écran « Montrer » ---------- */

let lastFocus = null;

function openShow(name) {
  lastFocus = document.activeElement;
  $('show-name').textContent = name;
  $('show-phrase').textContent = state.budget !== null ? orderPhrase(state.budget) : '';
  $('show').hidden = false;
  $('btn-close').focus();
}

function closeShow() {
  $('show').hidden = true;
  lastFocus?.focus?.();
}

/* ---------- Branchements ---------- */

$('btn-locate').addEventListener('click', locate);
$('btn-relocate').addEventListener('click', locate);
$('btn-new').addEventListener('click', openSearch);
$('btn-error-retry').addEventListener('click', () => (state.lastAction ?? locate)());
$('btn-close').addEventListener('click', closeShow);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('show').hidden) closeShow(); });
$('search-form').addEventListener('submit', (e) => { e.preventDefault(); $('budget').blur(); });
$('budget').addEventListener('input', () => {
  $('budget-error').textContent = '';
  $('budget').removeAttribute('aria-invalid');
});
for (const btn of document.querySelectorAll('.btn.radius')) {
  btn.addEventListener('click', () => onRadiusClick(Number(btn.value)));
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
