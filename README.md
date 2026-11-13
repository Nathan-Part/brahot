# Brahot

Compteur de brahot (bénédictions) quotidien, installable en PWA sur le téléphone.

- **+1 avec libellé** (suggestions automatiques à partir des libellés déjà utilisés)
- **Raccourcis préconfigurés** (Birkat Hamazone +4, Amida +19…), modifiables dans les Réglages
- **Objectif quotidien** (100 par défaut) avec anneau de progression
- **Jour suivant** : archive la journée dans l'historique et remet le compteur à zéro
- **Tzeit hakokhavim** : passage automatique au jour suivant à la tombée de la nuit
  (calcul astronomique local, hors-ligne — lieu au choix ou GPS, 8,5° ou 7,08°)
- **Date hébraïque** (qui change à tzeit hakokhavim)
- **Historique** avec moyenne, record et détail par braha
- Fonctionne **hors-ligne** ; données stockées sur le téléphone (export/import JSON dans les Réglages)

Aucune dépendance, aucun build : HTML + CSS + JS.

## Déploiement (GitHub Pages)

1. Pousser le repo sur GitHub (`git push`).
2. Sur GitHub : **Settings → Pages → Build and deployment → Source : Deploy from a branch**,
   branche `main`, dossier `/ (root)` → **Save**.
3. Après ~1 minute, le site est en ligne sur `https://<utilisateur>.github.io/brahot/`.

## Installer sur le téléphone

- **iPhone (Safari)** : ouvrir l'URL → bouton Partager → **Sur l'écran d'accueil**.
- **Android (Chrome)** : ouvrir l'URL → menu ⋮ → **Installer l'application**.

## Mises à jour

L'app se met à jour toute seule : la nouvelle version est téléchargée en arrière-plan
et s'affiche au lancement suivant. Pour forcer le rafraîchissement de tous les fichiers,
incrémenter `CACHE` dans `sw.js` (ex. `brahot-v2`).

## Développement local

```sh
python -m http.server 8000
# puis http://localhost:8000
```
