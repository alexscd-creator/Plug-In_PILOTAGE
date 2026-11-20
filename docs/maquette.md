# Maquette du panneau Pilotage (v2)

La maquette fait foi pour le code du panneau (Task 11).

- Fichier Figma : https://www.figma.com/design/ygqY5yLfLsSIc8jTBkvqOL
- Page : **Pilotage v2** (id `43:2`). Les anciennes pages (« Écrans », « Composants », etc.) sont gardées telles quelles, comme archive.
- Lien direct vers un nœud : `https://www.figma.com/design/ygqY5yLfLsSIc8jTBkvqOL?node-id=47-320` (remplacer `:` par `-`).

## 1. Écrans et identifiants de nœud

Chaque écran existe en **Desktop clair** et **Desktop sombre** (cadre 1024 px) et en **Mobile** (390 px). Le contenu est le même dans les trois ; seuls la largeur et le mode de couleur changent.

| Section | Écran | Desktop clair | Desktop sombre | Mobile | Projet d'exemple |
|---|---|---|---|---|---|
| `43:3` 00 Système | Référence (jetons, pastilles, palette) | `56:5834` | `56:6009` | — | — |
| `43:3` 00 Système | Bibliothèque de composants | `45:2` | — | — | — |
| `43:3` 00 Système | Icônes (43 composants `Icône/*`) | `43:12` | — | — | — |
| `43:4` 01 | Vue d'ensemble | `47:320` | `47:652` | `47:716` (sombre : `47:1001`) | Site web |
| `43:5` 02 | Plan | `49:1204` | `49:1559` | `49:1652` | Site web |
| `43:6` 03 | Phases (frise + détail d'une phase terminée) | `50:1916` | `50:2238` | `50:2316` | Jeu Roblox |
| `43:7` 04 | Chantiers (en cours + archivés) | `51:2566` | `51:2865` | `51:2900` | Site web |
| `43:8` 05 | Chantier ouvert (détail) | `51:3195` | `51:3480` | `51:3530` | Site web |
| `43:9` 06 | Agents (grille) | `53:3862` | `53:4200` | `53:4239` | Jeu Roblox |
| `43:9` 06 | Détail d'agent | `53:4526` | — | `53:4741` | Jeu Roblox |
| `43:10` 07 | Paramètres (type Site web) | `54:4801` | `54:5851` | `54:6084` | Site web |
| `43:10` 07 | Paramètres (type Jeu Roblox) | `54:5303` | — | `54:6317` | Jeu Roblox |
| `43:11` 08 | Démarrage vide | `55:5682` | `55:5789` | `55:5819` | aucun |
| `43:11` 08 | Erreur de fichier de projet | `55:5741` | `55:5874` | `55:5892` | Site web |

Projets d'exemple : **Boutique de céramique** (type Site web) et **Obby des volcans** (type Jeu Roblox). Ils montrent que les libellés suivent le type de projet.

## 2. Mise en page

- **Colonne centrée** : largeur max **880 px**, centrée horizontalement. Desktop : cadre 1024 px, marges latérales 72 px, haut 32 px, bas 64 px.
- **Mobile (< 600 px)** : colonne fluide, gouttière **16 px**, haut 16 px. Écart entre sections 24 px au lieu de 32 px. Padding des cartes 16 px au lieu de 24 px.
- Règles de passage en mobile (appliquées dans la maquette) :
  - tout ce qui est côte à côte (grilles de 2 cartes, rangées « texte + bouton ») passe **en colonne**, enfants en pleine largeur ; les pastilles, chips et avatars gardent leur largeur naturelle ;
  - la **barre de navigation** reste sur une ligne et **défile horizontalement** (contenu coupé au bord) ;
  - la **frise des phases** défile horizontalement, avec l'aide « Faites glisser la frise pour voir toutes les phases. » (mobile seulement) ;
  - **Ligne de tâche** : variante `Taille=Compacte` (statut + bouton copier en haut, titre, chemin, responsable dessous) ;
  - **Ligne de fichier** : bouton « Copier le chemin » en `Forme=Icône seule` (nom accessible conservé).
- Ordre vertical de chaque page : Barre du haut → (Bandeau de chantier si on est dans un chantier) → Navigation → En-tête de page → contenu.
- **Barre du haut** : bulle 40 px (icône du type de projet, `accent/soft` + `accent/default`), surtitre « Pilotage · <Type> » (Overline, `text/muted`), nom du projet (Body/Strong). À droite : boutons icône « Rafraîchir » et « Paramètres » (38 px).
- **Navigation** : conteneur `bg/surface`, bordure `border/subtle`, rayon 16, padding 4, écart 4. Onglets dans cet ordre : Vue d'ensemble (icône `apercu`), Plan (`plan`), Phases (`phase`), Chantiers (`chantier`), Agents (`agent`), Idées (`idee`), Paramètres (`reglages`). Onglet actif : fond `accent/soft`, texte + icône `accent/default`. Inactif : sans fond, `text/secondary`.

## 3. Jetons de couleur (collection « Color », modes Light / Dark)

Toutes les couleurs passent par ces jetons. Le thème clair/sombre = changer de mode.

### Sémantiques (existants, repris tels quels)

| Jeton | Clair | Sombre |
|---|---|---|
| `color/bg/app` (fond de page) | `#f6f7fa` | `#0d0e12` |
| `color/bg/surface` (cartes) | `#ffffff` | `#13151b` |
| `color/bg/raised` (lignes, puces) | `#eceef5` | `#1a1d25` |
| `color/bg/hover` (survol, piste des barres) | `#d9dde8` | `#232733` |
| `color/border/subtle` | `#d9dde8` | `#2b303d` |
| `color/border/strong` | `#b3b9ca` | `#3e4454` |
| `color/text/primary` | `#13151b` | `#eceef5` |
| `color/text/secondary` | `#3e4454` | `#b3b9ca` |
| `color/text/muted` | `#5e6577` | `#858ca0` |
| `color/accent/default` | `#4f56e0` | `#8b93ff` |
| `color/accent/soft` | `#4f56e0` à 12 % | `#8b93ff` à 18 % |
| `color/accent/on-accent` | `#ffffff` | `#0d0e12` |
| `color/state/success`, `warning`, `danger` (+ `-soft`) | voir Figma | voir Figma |

### Pastilles d'état (nouveaux jetons)

Chaque `-soft` = même teinte à **12 %** (clair) / **18 %** (sombre). Fond de la pastille = `-soft`, icône et texte = jeton plein.

| État | Jeton | Clair | Sombre | Icône (`Icône/*`) | Libellé exact |
|---|---|---|---|---|---|
| En travail | `color/status/working` | `#1d64b8` | `#7cb6ff` | `play` (triangle) | « En travail » |
| En attente d'une réponse | `color/status/waiting` | `#8a5a00` | `#f2b84b` | `attente` (bulle « ? ») | « En attente d’une réponse » |
| Arrêté | `color/status/stopped` | `#4a5163` | `#b3b9ca` | `stop` (carré) | « Arrêté » |
| Prêt à reprendre | `color/status/ready` | `#4f56e0` | `#a5abff` | `reprendre` (flèche circulaire) | « Prêt à reprendre » |
| Bloqué | `color/status/blocked` | `#b42318` | `#ff8a80` | `bloque` (cercle barré) | « Bloqué » |
| Terminé | `color/status/done` | `#18794e` | `#5bd39a` | `termine` (cercle coché) | « Terminé » |

Jamais la couleur seule : toujours icône 14 px + libellé (Label 13 px). Pastille : padding 4 × 10, écart 6, rayon 999.

### Palette de pôles (nouveaux jetons)

Le nom d'un pôle est libre (défini au démarrage guidé, modifiable dans Paramètres) ; sa couleur est une des 6 teintes. Deux pôles d'un même projet n'ont jamais la même teinte. Contraste texte ≥ 4,5:1 sur la teinte douce, en clair et en sombre.

| Teinte | Jeton | Clair | Sombre | Exemple d'usage |
|---|---|---|---|---|
| Violet | `color/pole/violet` | `#6b46c1` | `#b69cff` | Stratégie / Gameplay |
| Bleu | `color/pole/bleu` | `#0f6aa6` | `#6cc0f5` | Technique / Code |
| Sarcelle | `color/pole/sarcelle` | `#0b6b64` | `#4fd1c5` | Qualité |
| Vert | `color/pole/vert` | `#376b1a` | `#9bd66f` | Contenu |
| Orange | `color/pole/orange` | `#a4480a` | `#ffa45c` | Marketing |
| Rose | `color/pole/rose` | `#b8326e` | `#ff8cc0` | Création / Graphisme |

`color/pole/<teinte>-soft` = même teinte à 12 % (clair) / 18 % (sombre).

### Règles de couleur des cartes (pôles et agents)

- La **bulle** (icône), l'**avatar**, la **chip de pôle** et la **barre de progression** d'un pôle ou d'un agent prennent la teinte du pôle (`pole/<teinte>` sur `pole/<teinte>-soft`).
- Le **fond de carte reste neutre** : `bg/surface` + bordure 1 px `border/subtle`. Jamais de grand aplat coloré.
- L'**état en direct** est donné par la pastille d'état, indépendante de la couleur du pôle.
- Agent désactivé : nom en `text/muted` et mention écrite « Désactivé · <rôle> ».

## 4. Espacements, rayons, typographie

- **Espacements** (collection « Spacing ») : `xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · `2xl` 32 · `3xl` 48 · `4xl` 64 px.
  - Entre sections de page : 32 (desktop) / 24 (mobile). Dans une section (titre → contenu, cartes entre elles) : 16. Intérieur de carte : 24 (desktop) / 16 (mobile). Grande carte projet : 32. Carte d'état vide : 64 × 48.
- **Rayons** (collection « Radius ») : `sm` 6 · `md` 10 (boutons, champs, lignes, bulles) · `lg` 16 (cartes) · `xl` 20 (carte d'état vide) · `full` 999 (pastilles, chips, barres, avatars).
- **Typographie** Inter (styles de texte existants) :

| Style | Taille / interligne | Graisse | Usage |
|---|---|---|---|
| Title/Screen | 28 / 34 | Bold | titre de page, nom du projet |
| Title/Section | 20 / 26 | Semi Bold | titres de section et de carte |
| Body/Regular | 15 / 22 | Regular | texte courant |
| Body/Strong | 15 / 22 | Semi Bold | noms (pôle, agent, chantier) |
| Label | 13 / 18 | Semi Bold | pastilles, chips, boutons, onglets, pourcentages |
| Caption | 12 / 16 | Regular | chemins de fichier, dates, aides |
| Overline | 11 / 14 | Semi Bold | surtitres, initiales d'avatar |

- **Icônes** : tracé type Lucide, trait 2 px, tailles 14 (pastilles, chips), 16 (lignes, onglets), 18 (statut de tâche), 20 (bulles, boutons icône), 24 à 32 (grandes bulles).

## 5. Composants (section 00 Système, bibliothèque `45:2`)

| Composant | Nœud | Variantes | Notes |
|---|---|---|---|
| Pastille d'état | `45:32` | `Statut` = En travail, En attente d'une réponse, Arrêté, Prêt à reprendre, Bloqué, Terminé | voir § 3 |
| Chip de pôle | `45:54` | `Couleur` = Violet, Bleu, Sarcelle, Vert, Orange, Rose | point 8 px + nom du pôle |
| Avatar | `45:72` | `Couleur` = Neutre + 6 teintes | 28 px, initiales ; Neutre = membre, teinte = agent |
| Barre de progression | `45:118` | `Valeur` = 0 à 100 par pas de 5 | 8 px, piste `bg/hover`, remplissage accent ou teinte du pôle ; toujours avec le % écrit |
| Bouton Copier le chemin | `45:131` | `Forme` = Libellé, Icône seule | « Copier le chemin » ; icône seule : nom accessible identique |
| Puce de skill | `45:135` | — | bouton « Voir le skill » (icône œil + nom du skill) |
| Ligne de fichier | `45:143` | — | icône fichier + chemin (Caption) + Copier le chemin ; clic sur la ligne = ouvrir |
| Onglet de navigation | `45:172` | `Etat` = Actif, Inactif | |
| Badge de porte | `45:194` | `Type` = Validée à deux, Forcée, Passée | libellés : « Porte validée à deux », « Porte forcée », « Porte passée (porte plus loin) » |
| Bannière | `45:221` | `Niveau` = Info, Avertissement, Erreur | couleurs `status/ready`, `status/waiting`, `status/blocked` ; bordure 1 px pleine teinte, fond `-soft` |
| Bouton icône v2 | `45:225` | — | 38 px, nom accessible obligatoire |
| Ligne de tâche | `46:231` | `Statut` = À faire, En cours, Terminé, Reporté, Abandonné × `Taille` = Large, Compacte | voir § 6 Plan |
| Carte de pôle | `46:359` | `Couleur` = 6 teintes | |
| Carte d’agent | `46:561` | `Couleur` = 6 teintes | |
| Bandeau de chantier | `46:565` | — | |
| Ligne de chantier | `46:669` | `Etat` = En cours, Archivé | |
| Étape de phase | `46:692` | `Etat` = Terminée, En cours, À venir | |
| Ligne d'agent sollicité | `51:3176` | — | bulle à la teinte du pôle de l'agent |
| Icônes | `43:12` | 43 composants `Icône/<nom>` | |

Composants repris de l'ancienne page « Composants » : **Bouton** (`5:13`, Principal / Secondaire / Discret), **Interrupteur** (`18:122`), **Puce de choix** (`18:129`), **Pastille bientôt** (`18:132`).

## 6. Règles par écran et textes à utiliser

### 01 Vue d'ensemble
- Carte projet (padding 32) : étiquette du type (« Site web », icône `globe` / « Jeu Roblox », icône `manette`), étiquette de phase « Phase 2 sur 4 : Conception » (`accent/soft`), nom du projet (Title/Screen), « Objectif : … », « Progression du projet » + « 40 % », barre, détail « 12 tâches terminées sur 30 · 3 chantiers en cours ».
- « Pôles du projet » + aide « Les pôles sont propres à ce projet : renommez-les, changez leur couleur ou ajoutez-en dans Paramètres. » Cartes de pôle en grille de 2 colonnes (écart 16) ; chaque carte : bulle teintée, nom, résumé (« 1 chantier en cours »), barre teintée + %, avatars et « Agents : … ».
- Carte « Plan » : bulle `plan` 48 px, « Plan », résumé, bouton principal **« Ouvrir le plan »** (ouvre la page Plan).
- « Chantiers en cours » + « État en direct de chaque sous-session. Rafraîchi automatiquement. » : Lignes de chantier `En cours` avec pastille d'état, barre à la teinte du pôle, « Aller à la session ».
- Pied : « Pour lancer un chantier : tapez /chantier suivi de son nom dans la conversation. »

### 02 Plan
- Titre « Plan », description « Le cahier des charges est le plan de travail : chaque point à faire est une tâche. Cliquez une ligne pour ouvrir son document. »
- Carte « États d’une tâche » (légende des 5 états, icône + libellé).
- Bannière Avertissement **« Tâches ouvertes : impossible de valider la porte »** + « Phase 2 « Conception » : 3 tâches ne sont ni terminées, ni reportées, ni abandonnées. Choisissez un état pour chacune avant de valider la porte. »
- Une carte par phase : nom (« Phase 2 · Conception »), étiquette d'état (Terminée / En cours / À venir), dates, barre + %, puis les Lignes de tâche.
- États de tâche (icône **et** libellé) : À faire = `a-faire` cercle vide, `text/muted` ; En cours = `en-cours` demi-disque, `status/working` ; Terminé = `termine`, `status/done`, titre en `text/secondary` ; Reporté = `reporte` horloge, `status/waiting` ; Abandonné = `abandonne` cercle croix, `status/stopped`, titre barré en `text/muted`.
- Ligne de tâche Large : colonne statut 112 px, titre (Body) + chemin (Caption, `text/muted`), responsable (avatar + nom), bouton copier icône seule. Séparateur bas 1 px `border/subtle`.
- Phase en cours : pied « Porte verrouillée : 3 tâches ouvertes. Chaque tâche doit être terminée, reportée ou abandonnée. » + bouton Secondaire « Valider la porte » désactivé (opacité 50 %).

### 03 Phases
- Frise (Étape de phase, colonnes de 128 px, liaisons de 2 px : `status/done` entre phases passées, `border/strong` ensuite). État écrit sous le nom : « Terminée », « En cours · 40 % », « À venir ». Phase sélectionnée : contour 2 px `accent/default`, rayon 10.
- Carte « Portes franchies » : Badge de porte + détail (« Découverte · 2026-09-14 · signée par alex et sam », etc.).
- Détail d'une phase terminée (carte à contour `accent/default`) : surtitre « Phase terminée sélectionnée », nom + « Terminée » + badge de porte, dates, bloc **Visa** (fond `status/waiting-soft` si forcée), « Tâches de la phase (fermées comprises) », « Fichiers de la phase » (Lignes de fichier).

### 04 Chantiers
- « En cours · N » + « Session ouverte. « Aller à la session » vous ramène dans la sous-session du chantier. »
- « Archivés · N » + « Session fermée. La trace reste : dates, tâches faites, passation, fichiers produits, agents intervenus. »
- Ligne de chantier Archivé : bulle `archive`, nom, « Du AAAA-MM-JJ au AAAA-MM-JJ », badge « Archivé », faits (« 8 tâches faites », « 3 fichiers produits », « Agents : … »), « Passation » + résumé, Lignes de fichier.

### 05 Chantier ouvert
- **Bandeau de chantier** juste sous la barre du haut, sur **toutes les pages** tant qu'on est dans le chantier : « Vous êtes dans le chantier : <nom> » + chip du pôle. Fond `accent/soft`, bordure `accent/default`.
- Titre = nom du chantier ; description « Pôle <pôle> · session <session> · ouvert le <date> ».
- Carte « Progression du chantier » (barre à la teinte du pôle, « mis à jour il y a 12 secondes »).
- « Agents sollicités » : Lignes d'agent sollicité (nom, ce qu'il fait, pastille d'état).
- « Tâches du chantier », « Fichiers du chantier ».

### 06 Agents
- Légende « Pôles : » + chips. Grille 2 colonnes de Cartes d’agent (nom, rôle, chip de pôle, pastille d'état, « Pourquoi spécialisé : … », puces de skill).
- Détail d'agent : lien « Tous les agents », carte identité (bulle 56 px), « Définition » (Rôle, Pôle, Pourquoi spécialisé, fiche `.claude/agents/<agent>.md`), « Skills » (nom, description, chemin, boutons **« Voir la fiche .md »** et **« Copier le chemin »**), « Outils autorisés », « Appels récents ».

### 07 Paramètres
Les réglages **suivent le type de projet** (preset). Ordre des cartes :
1. **Type de projet** (Puces de choix : Site web, Jeu Roblox, Application, Autre (vide), Preset d’alex). Changer de type adapte les cartes suivantes ; les fichiers restent en place.
2. **Projet** : champ « Nom du … » (libellé selon le type, voir § 7) + « Objectif ».
3. **Réglages propres au type** (contour `accent/default`, aide « Affichés parce que le type de projet est « <type> ». ») :
   - Site web : « Domaine », « Hébergement », « Paiement en ligne » (interrupteur).
   - Jeu Roblox : « Connexion à Roblox Studio » (pastille « Connecté » + bouton « Vérifier »), « Modération et charte joueur » (interrupteur), « Public visé ».
4. **Apparence** : Thème (Clair / Sombre / Système), Couleur d’accent (6 pastilles).
5. **Pôles** : liste (pastille de couleur, nom, « Couleur : <teinte> », boutons Renommer / Retirer) + « Ajouter un pôle ».
6. **Workflow** : une rangée par rôle (Conception, Design, Code… / Conception, 3D, Code, Visuels), outils en étiquettes (Claude, GitHub, Figma, Google Gemini, Blender, Mesh AI, Fichiers .md partagés (Vault), Roblox Studio), boutons Modifier / Ajouter un outil + **« Changer de workflow »**.
7. **Gestion des agents** : bulle teintée, nom, rôle, bouton Modifier, interrupteur actif / désactivé + « Ajouter un agent ».
8. **Équipe** : membres (avatar Neutre, prénom, rôle).
9. **Collaboration GitHub** + Pastille « bientôt » (carte `bg/raised`, texte en `text/secondary`).
10. **Réinitialiser l’affichage** (bouton Discret).

### 08 États vides et erreurs
- Démarrage vide : carte centrée, bulle `dossier` 64 px, **« Aucun projet ici »**, « Ce dossier n’a pas encore de projet Pilotage. Démarrez-en un : quelques questions, une à la fois (type de projet, nom, objectif, pôles). », bouton principal **« Démarrer un projet »** (= commande `/demarrer`), aide « Ce bouton lance la commande /demarrer dans la conversation. », types proposés.
- Erreur : Bannière Erreur « Fichier de projet illisible » + message qui nomme le fichier et la ligne ; carte « Que faire ? », Ligne de fichier `.pilotage/projet.json`, boutons « Réessayer » et « Ouvrir le fichier ».

## 7. Vocabulaire (le plugin est neutre)

Aucune mention de « studio » ni de « jeu » dans le panneau en dehors des projets de type jeu. Les libellés suivants dépendent du type de projet (preset) :

| Clé | Autre (vide) | Site web | Jeu Roblox | Application |
|---|---|---|---|---|
| `nom_projet` | Nom du projet | Nom du site | Nom du jeu | Nom de l’application |
| `type_libelle` | Projet | Site web | Jeu Roblox | Application |
| `type_icone` | `fichier` | `globe` | `manette` | `code` |
| `reglages_type_titre` | — (carte absente) | Réglages du site web | Réglages du jeu Roblox | Réglages de l’application |
| `reglages_type` | — | Domaine, Hébergement, Paiement en ligne | Connexion à Roblox Studio, Modération et charte joueur, Public visé | Plateformes, Publication |
| `poles_proposes` | (aucun) | Stratégie, Technique, Création, Qualité | Gameplay, Code, Graphisme, Qualité | Produit, Technique, Design, Qualité |

Termes communs à tous les types : projet, phase, porte, plan, tâche, chantier, session, pôle, agent, skill, workflow, équipe.
