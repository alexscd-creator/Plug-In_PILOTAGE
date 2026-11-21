---
name: accessibilite-ecrans
description: Rendre une application utilisable par tous : contraste, zones tactiles, textes agrandis, lecteurs d'écran, avec les seuils WCAG 2.2 (source et date).
---

# Accessibilité des écrans

À contrôler pour chaque écran d'une application, sur petit appareil comme sur grand.

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

1. **Texte agrandi.** Passe l'appareil en grande taille de texte : rien ne doit être coupé ni se chevaucher.
2. **Lecteur d'écran.** Chaque élément interactif a un nom clair (« Supprimer le message », pas « Bouton ») et l'ordre de lecture suit l'ordre visuel.
3. **Zones touchables** assez grandes et assez espacées.
4. **Couleur** jamais seule pour porter l'information (erreur, état) : ajouter un mot ou une icône.
5. **Mouvement.** Respecter le réglage « réduire les animations » de l'appareil ; rien de clignotant.
6. **Formulaires.** Étiquettes visibles, clavier adapté au champ, erreurs qui disent quoi corriger.
7. **Orientation et tailles d'écran.** L'écran reste utilisable en portrait comme en paysage.

## Pièges

- Une icône sans nom pour le lecteur d'écran.
- Un geste complexe sans alternative simple (un bouton).
- Tester seulement avec une bonne vue et un grand écran.

## Non vérifié

Les autres critères de WCAG 2.2 et les guides propres à chaque plateforme ne sont pas détaillés ici : les lire à la source avant d'affirmer qu'un écran est conforme.
