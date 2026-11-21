---
name: accessibilite-web
description: Rendre un site utilisable par tous : contraste, clavier, textes alternatifs, structure et zones cliquables, avec les seuils des règles WCAG 2.2 (source et date).
---

# Accessibilité web

Un site accessible sert aussi les personnes pressées, sur petit écran ou en plein soleil. À contrôler pour chaque page.

## Faits vérifiés

### Contraste du texte
- Fait : le texte courant demande un rapport de contraste d'au moins 4,5 pour 1 ; le grand texte (18 points ou plus, ou 14 points gras ou plus, soit environ 24 px ou 18,5 px gras) demande au moins 3 pour 1.
- Source : https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- Vérifié le : 2026-11-21
- Conséquence : mesurer le contraste de chaque couple texte et fond avec un outil, en clair comme en sombre, jamais à l'œil.

### Taille des zones cliquables ou touchables
- Fait : une zone cliquable ou touchable doit faire au moins 24 sur 24 pixels CSS (niveau AA de WCAG 2.2), sauf exceptions (espacement suffisant, équivalent, lien dans un texte, contrôle du système, cas essentiel).
- Source : https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Vérifié le : 2026-11-21
- Conséquence : viser plus grand pour les actions principales et sur mobile ; ne pas coller deux petits boutons.

## Méthode

1. **Clavier seul.** Parcours toute la page avec la touche Tab : chaque élément interactif est atteignable, dans un ordre logique, avec un focus bien visible. Aucun piège au clavier.
2. **Structure.** Un seul titre principal, des niveaux de titres qui se suivent, des listes de vraies listes, des boutons qui sont des boutons et des liens qui sont des liens.
3. **Images.** Un texte alternatif qui dit ce que l'image apporte ; vide si elle est purement décorative.
4. **Formulaires.** Chaque champ a une étiquette visible et associée ; les erreurs disent quoi corriger et où.
5. **Couleur.** Jamais la seule façon de porter une information (ajouter un mot, une icône).
6. **Zoom et petit écran.** La page reste utilisable à 200 % de zoom, sans défilement horizontal.
7. **Médias.** Sous-titres ou transcription pour la parole ; rien qui démarre seul avec du son.

## Pièges

- Supprimer le contour de focus sans le remplacer.
- Un clic qui ne marche qu'à la souris.
- S'en remettre à un outil automatique seul : il ne voit qu'une partie des défauts, il faut aussi essayer au clavier.

## Non vérifié

Les autres critères de WCAG 2.2 ne sont pas détaillés ici : les lire à la source avant d'affirmer qu'une page est conforme.
