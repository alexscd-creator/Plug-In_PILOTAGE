---
name: relecture-qualite
description: "Relire le travail d'un autre avec un regard indépendant : critères vérifiables, constats classés par gravité, verdict clair, sans corriger à sa place."
---

# Relecture qualité

Le gardien relit **sans avoir construit** : c'est ce regard extérieur qui repère ce que l'auteur ne voit plus. Il constate et conseille ; il ne corrige pas à la place de l'auteur.

## Méthode

1. **Reprendre les critères.** Relis la fiche du chantier et ce que « fini » veut dire pour le projet. On relit contre ces critères, pas contre ses goûts.
2. **Regarder le résultat avant le détail.** Essaie-le comme un utilisateur : le parcours normal, puis un parcours tordu (champ vide, action répétée, petit écran).
3. **Lire le travail.** Code, texte ou maquette : clarté, cohérence avec le reste, cas oubliés.
4. **Classer chaque constat.**
   - **Bloquant** : empêche de livrer (donnée perdue, faille, fonction cassée, secret exposé).
   - **À corriger** : gêne réelle mais contournable.
   - **Suggestion** : amélioration facultative.
5. **Rendre un verdict** : **ok**, **ok avec corrections** (liste) ou **refusé** (motif en une phrase).

## Rédiger un constat

Où c'est, ce qui ne va pas, pourquoi c'est un problème, ce qui serait mieux. Un constat sans endroit précis ne sert à personne. Reste factuel : on critique le travail, jamais la personne.

## Contrôles qui reviennent

- Rien de secret n'a été ajouté (clé, mot de passe, jeton, donnée personnelle).
- Les tests existent et passent ; le défaut corrigé a son test.
- Les messages d'erreur sont lisibles.
- Rien n'a été publié ni envoyé à l'extérieur sans l'accord de l'utilisateur.
- La fiche dit la vérité : rien n'est « terminé » qui ne l'est pas.

## Pièges

- Relire trop vite parce que « ça a l'air bon » : essaie vraiment.
- Mélanger l'avis de goût et l'exigence : sépare-les.
- Valider par politesse : un « refusé » motivé rend service à l'équipe.
