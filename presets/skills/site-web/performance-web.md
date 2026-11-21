---
name: performance-web
description: Garder un site rapide : mesurer d'abord, alléger les images et les scripts, éviter les blocages du chargement.
---

# Performance web

Un site lent perd des visiteurs, surtout sur mobile et connexion moyenne. Règle d'or : **mesurer avant d'optimiser**.

## Méthode

1. **Mesurer.** Passe la page dans l'outil de mesure du navigateur (onglet performance ou audit) sur une connexion et un processeur bridés. Note les chiffres avant de toucher à quoi que ce soit.
2. **Images.** Souvent le plus gros poids : bon format, dimensions adaptées à l'affichage (jamais une photo de 4000 px pour une vignette), compression, chargement différé pour ce qui est sous la ligne de flottaison.
3. **Scripts et styles.** Ne charge que ce qui sert à la page ; diffère ou charge en asynchrone ce qui n'est pas indispensable au premier affichage ; retire les dépendances inutilisées.
4. **Polices.** Peu de familles et de graisses ; un texte lisible dès le chargement (police de repli).
5. **Mise en cache.** Les fichiers qui changent peu se gardent en cache ; leurs noms changent quand leur contenu change.
6. **Stabilité de la page.** Réserve la place des images et des encarts pour que le contenu ne saute pas pendant le chargement.
7. **Remesurer** après chaque changement : garde ce qui améliore, retire le reste.

## Pièges

- Optimiser au hasard, sans chiffres.
- Ajouter une bibliothèque entière pour une petite fonction.
- Tester seulement sur sa machine rapide et sa connexion fibre.
- Charger des services tiers (traceurs, widgets) sans en mesurer le coût ni l'accord des visiteurs.
