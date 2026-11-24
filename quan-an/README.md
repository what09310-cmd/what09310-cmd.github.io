# Quán ăn — restaurants près de moi

PWA gratuite pour trouver où manger au Vietnam sans parler vietnamien : GPS, rayon (1/3/5/10 km), budget en dongs, liste triée par distance, bouton « Montrer » qui affiche la commande en vietnamien en plein écran.

- Aucune dépendance, aucun serveur, aucune clé API. Données OpenStreetMap via Overpass, appelé depuis le navigateur.
- La position n’est envoyée qu’à Overpass et n’est jamais stockée. Le budget n’est jamais stocké.
- Seuls les derniers résultats (sans budget ni position) sont gardés dans `localStorage` (`lastResults`) pour le mode dégradé.

## Tests

```sh
npm test        # = node --test (Node 20+)
```

## Lancer en local

N’importe quel serveur statique, par exemple `python3 -m http.server 8000`, puis http://localhost:8000. Le GPS exige HTTPS en dehors de `localhost`.

## Mise en ligne

Site statique : publier le dossier tel quel (GitHub Pages depuis la branche principale, ou Cloudflare Pages sans commande de build, dossier de sortie `/`).

**Après chaque modification**, incrémenter `CACHE` dans `sw.js` (`quan-an-v1` → `quan-an-v2`), sinon les téléphones gardent l’ancienne version (cache-first).

## Test sur téléphone réel

1. Ouvrir l’URL HTTPS, « Me localiser », accepter le GPS.
2. Budget vide ou `abc` puis un rayon : « Entre ton budget en dongs », pas de recherche.
3. Budget `35.000`, rayon 3 km : liste en moins de 15 s en 4G.
4. « Montrer » : nom + « Cho tôi một đĩa cơm chiên, tôi có 35.000 đồng ».
5. Mode avion, recharger : l’appli s’ouvre ; une recherche affiche l’erreur et les résultats enregistrés.
