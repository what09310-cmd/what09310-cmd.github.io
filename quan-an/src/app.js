import { directionsUrl, mapsUrl, nextRadius } from './geo.js';
import { parseBudget, orderPhrase } from './phrase.js';
import { fetchRestaurants } from './overpass.js';
import { geocode } from './geocode.js';
import { saveLastResults, loadLastResults } from './storage.js';
import { formatKm, typeLabel, formatSavedDate } from './format.js';

const $ = (id) => document.getElementById(id);

// Accéder à window.localStorage peut lever une exception (navigation privée, cookies bloqués).
function storage() {
  try { return window.localStorage; } catch { return null; }
}

// État en mémoire uniquement : rien de cela n'est stocké (sauf lastResults, sans budget ni position).
const state = {
  position: null, // { lat, lon } du lieu tapé
  placeLabel: '',
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

/* ---------- Lieu tapé (remplace le GPS) ---------- */

function openHome() {
  state.lastAction = null;
  $('place-choices').hidden = true;
  $('home-status').textContent = '';
  show('home');
  $('place').focus();
}

function setPlaceError(text) {
  $('place-error').textContent = text;
  if (text) $('place').setAttribute('aria-invalid', 'true');
  else $('place').removeAttribute('aria-invalid');
}

function choosePlace(place) {
  state.position = { lat: place.lat, lon: place.lon };
  state.placeLabel = place.label;
  openSearch();
}

async function findPlace() {
  const query = $('place').value.trim();
  $('place-choices').hidden = true;
  if (!query) {
    setPlaceError('Entre un lieu');
    $('place').focus();
    return;
  }
  setPlaceError('');
  $('place').blur();
  $('btn-place').disabled = true;
  $('home-status').textContent = 'Recherche du lieu…';
  try {
    const places = await geocode(query);
    $('home-status').textContent = '';
    if (places.length === 0) {
      setPlaceError('Lieu introuvable. Essaie avec le nom de la ville ou du quartier.');
    } else if (places.length === 1) {
      choosePlace(places[0]);
    } else {
      $('place-list').replaceChildren(
        ...places.map((p) => {
          const btn = el('button', { type: 'button', className: 'btn secondary', textContent: p.label, lang: 'vi' });
          btn.addEventListener('click', () => choosePlace(p));
          return el('li', {}, [btn]);
        })
      );
      $('place-choices').hidden = false;
    }
  } catch {
    $('home-status').textContent = '';
    setPlaceError('La recherche de lieux ne répond pas. Vérifie ta connexion, puis réessaie.');
  } finally {
    $('btn-place').disabled = false;
  }
}

/* ---------- Écran rayon + budget ---------- */

function openSearch() {
  // Budget vide à chaque ouverture, jamais mémorisé.
  state.budget = null;
  const input = $('budget');
  input.value = '';
  input.removeAttribute('aria-invalid');
  $('budget-error').textContent = '';
  $('place-label').textContent = state.placeLabel;
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
  card.querySelector('.card-map').href = mapsUrl(r);
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
        textContent: `Résultats enregistrés du ${formatSavedDate(saved.savedAt)} (rayon ${saved.radiusKm} km, distances depuis le lieu d’alors)`,
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

$('place-form').addEventListener('submit', (e) => { e.preventDefault(); findPlace(); });
$('place').addEventListener('input', () => setPlaceError(''));
$('btn-change-place').addEventListener('click', openHome);
$('btn-new').addEventListener('click', openSearch);
$('btn-error-retry').addEventListener('click', () => (state.lastAction ?? openHome)());
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
  // Quand une nouvelle version prend le relais, recharger une fois pour l'afficher tout de suite.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; window.location.reload(); }
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}));
}
