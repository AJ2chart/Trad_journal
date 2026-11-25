# Trad Journal

Journal de trading en application web installable (PWA) : fonctionne sur ordinateur et téléphone, hors ligne, avec les données stockées **localement** sur l'appareil (IndexedDB).

## Fonctionnalités

- **Saisie rapide** : une ligne = un trade (date, symbole, sens, quantité, entrée, sortie, stop, setup), validation avec Entrée. Sortie vide = trade ouvert.
- **Page détail** par trade : captures (cliquer, glisser ou coller avec Ctrl+V), raison d'entrée, gestion/sortie, notes, plan respecté, note d'exécution, émotions, erreurs, frais, valeur du point. Sauvegarde automatique.
- **Leçons** : créées depuis un trade (déjà liées) ou depuis la page Leçons, avec catégories et P&L cumulé des trades liés.
- **Statistiques** : P&L net, taux de réussite, profit factor, espérance, R moyen, ratio gain/perte moyen, drawdown max, séries, courbe du P&L cumulé, P&L par mois, détail par setup, erreur, symbole, émotion, respect du plan, jour, long/short. Filtres par période et par sens.
- **Sauvegarde** : export/import JSON (captures incluses) et export CSV.

## Calculs

- P&L = (sortie − entrée) × quantité × valeur du point × (1 si long, −1 si short) − frais
- R = P&L / risque initial, où risque = |entrée − stop| × quantité × valeur du point

## Développement

```bash
npm install
npm run dev      # serveur de dev
npm test         # tests des calculs
npm run build    # build de production dans dist/
```

Le build (`dist/`) est un site statique : il peut être hébergé n'importe où (GitHub Pages, Netlify, Vercel…) puis installé depuis le navigateur (« Ajouter à l'écran d'accueil »).
