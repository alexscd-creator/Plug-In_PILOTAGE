# Recette de Pilotage 0.1.0

Scénarios à jouer par le propriétaire dans une vraie session de Claude Desktop, avec le plugin installé. Rien n'a été essayé en vrai avant cette recette : les tests automatiques simulent le moteur. Noter sous chaque scénario la date, qui, et « ok » ou ce qui a cloché.

Préparation : un dossier vide `essai-a` (sans `.pilotage`), un autre dossier `essai-b`, et un prénom dans `~/.claude/pilotage/config.json` (`{"prenom": "..."}`).

## A. Dossier sans projet

1. Ouvrir une session dans `essai-a`.
2. Vérifier : aucun panneau ne s'ouvre, et aucune section « Pilotage » n'apparaît dans les consignes de la conversation.
3. Taper `/projet` : le panneau s'ouvre sur l'écran « Aucun projet ici » avec le bouton « Démarrer un projet ».

Résultat : (à remplir)

## B. `/projet` puis `/pilotage:demarrer`

1. `/projet` puis `/pilotage:demarrer` dans `essai-a`.
2. Vérifier l'ordre : le **type de projet** est demandé en premier ; le libellé du **nom** suit le type (autre type, autre libellé) ; viennent les **réglages du type**, l'équipe, le **workflow proposé** (ajustable), les **pôles**, les **phases**, les **agents**.
3. Un récapitulatif est montré et une **confirmation** est demandée ; sans oui, rien n'est écrit.
4. Après le oui : `.pilotage/projet.json`, `plan.md`, `agents/<id>.md` et `equipe/<prénom>/portes.md` existent ; le script a dit ce qu'il a écrit. Relancer `/pilotage:demarrer` : refus d'écraser.
5. Lancer `node scripts/check-projet.mjs essai-a` : `projet ok`.

Résultat : (à remplir)

## C. Fermer puis rouvrir Claude Desktop

1. Fermer complètement Claude Desktop, le rouvrir, ouvrir une session dans `essai-a`.
2. Vérifier : le panneau se rouvre de lui-même avec le projet (nom, phases, chantiers).

Résultat : (à remplir)

## D. Un autre dossier

1. Ouvrir une session dans `essai-b`.
2. Vérifier : aucune trace du projet d'`essai-a` (ni panneau, ni agents suivis, ni consigne).

Résultat : (à remplir)

## E. Valider une phase avec une tâche ouverte

1. Dans `essai-a`, `/pilotage:phase porte <phase>` alors qu'une tâche est « a faire » ou « en cours ».
2. Vérifier : refus, avec la liste des tâches ouvertes.
3. Choisir pour chacune terminer, reporter ou abandonner ; refaire `/pilotage:phase porte <phase>` : confirmation demandée, puis la porte est validée et le panneau l'affiche.

Résultat : (à remplir)

## F. Revenir sur une phase terminée

1. Dans le panneau, onglet Phases, ouvrir une phase terminée.
2. Vérifier : ses tâches et ses fichiers sont visibles ; « Copier le chemin » met le chemin dans le presse-papiers.

Résultat : (à remplir)

## G. `/pilotage:chantier`

1. `/pilotage:chantier <nom>`. Vérifier le contrôle d'impact (l'agent `pilotage:chef-de-chantier`, ce préfixe se voit dans la conversation, et non celui de l'ancien plugin), le récapitulatif, la demande « Créer ce chantier ? » (sans oui, rien n'est écrit).
2. Après le oui : la carte **« Nouvelle session / Faire ici »** apparaît ; choisir « Nouvelle session ».
3. Dans la sous-session : la première commande est `/pilotage:chantier ouvrir <id>` ; le modèle lance `lier-session` avec `--session-id` (l'identifiant de la ligne « Identifiant de cette session » de la consigne) ; `equipe/<prénom>/sessions.json` contient cet identifiant ; le **bandeau** du chantier s'affiche.
4. Vérifier les **états en direct** dans le panneau (en travail, en attente, arrêté, prêt) pendant que des agents travaillent, et que la fiche `equipe/<prénom>/chantiers/<id>.md` est tenue à jour.

Résultat : (à remplir)

## H. Clore le chantier

1. `/pilotage:chantier clore <id>` : tâches ouvertes à régler, passation montrée, confirmation « Archiver ... ? ».
2. Vérifier : la fiche est dans `equipe/<prénom>/archive/` avec sa passation et l'état « termine » ; le panneau la liste parmi les archives. L'archivage de la sous-session est proposé, pas exécuté.

Résultat : (à remplir)

## I. Écran Agents

1. Ouvrir l'écran Agents.
2. Vérifier : une couleur par pôle ; l'état de chaque agent appelé dans la session ; les boutons de skill (« Copier le chemin ») ; la mention « skill non installé » pour un skill absent.

Résultat : (à remplir)

## J. Paramètres

1. Changer un réglage du type, puis le workflow (essayer « Charger mon workflow » avec et sans `~/.claude/pilotage/mon-workflow.json`), un pôle, le rôle d'un agent, le thème (clair, sombre, système).
2. Vérifier que `projet.json` est mis à jour (et `projet.json.bak` créé) et que le panneau suit.
3. Retirer le prénom de `config.json` : les Paramètres passent en **lecture seule**.

Résultat : (à remplir)

## K. Idée et retour dans la conversation

1. Écrire dans la conversation une idée (« et si on ajoutait ... ») puis un retour (« ce menu est confus »).
2. Vérifier : chacun est classé automatiquement, sans confirmation, avec une ligne pour le dire ; ils sont listés dans la page « Idées » (filtre idées/retours).
3. Demander d'en retirer un : il disparaît de la liste.

Résultat : (à remplir)

## L. L'ancien plugin Roblox

Les deux plugins cohabitent parce que leurs commandes diffèrent : `/pilotage` est celle de l'ancien plugin, `/projet` celle de ce plugin ; les commandes en markdown de ce plugin se tapent avec leur préfixe (`/pilotage:chantier`, `/pilotage:phase`, `/pilotage:demarrer`).

1. Avec les deux plugins installés, ouvrir une session dans un dossier sans la configuration de l'ancien plugin.
2. Vérifier : l'ancien plugin n'ouvre rien tout seul.
3. Taper `/pilotage` : c'est le panneau de l'ancien plugin qui s'ouvre ; taper `/projet` : c'est celui de ce plugin. Aucun des deux ne remplace l'autre.

Résultat : (à remplir)

## Points non vérifiés en vrai (à contrôler)

Tout ce qui suit n'est prouvé que par les types du moteur ou par des tests simulés.

**Moteur et commandes**
- `$.command.run` sur une commande de plugin en markdown, et son nom exact : `demarrer` ou `pilotage:demarrer` (le code essaie les deux).
- `$.prompt.submit` refuse un texte qui commence par « / » (dit par un agent, jamais essayé).
- `$.session.cwd()` rempli au démarrage (vérifié une fois en vrai par le spike du 2026-11-20) et activation automatique par dossier ; si le dossier est vide, le repli `/projet <chemin>` reste à prévoir.
- `$.session.id()` donne bien l'identifiant utilisé par le bandeau (lien session, chantier via `sessions.json`).
- `$.config.list` : la ligne du thème de l'application, suivie par le thème « système ».
- `$.clock.every` : le redessin périodique réel (toutes les 5 s) ; le test simulé ne le prouve pas ; le bouton ↻ reste en secours.
- `$.ui.ask` enchaîné depuis un `onPress` ou une commande.
- Ouverture d'un fichier par `Link file://` ou `start` : seul « Copier le chemin » (`$.ui.copy`) est garanti.

**Agents**
- `$.agent.register` avant que la session soit liée, et agents qui restent enregistrés (aucune API pour les désenregistrer : un agent désactivé reste appelable jusqu'au prochain démarrage).
- Les fichiers `.pilotage/agents/*.md` sont lus par le plugin, pas par le moteur ; `.claude/agents/` du projet n'est pas relu en cours de session (non prouvé).
- Les 13 skills du preset « Jeu Roblox » existent dans l'ancien plugin, pas dans Pilotage : ils s'affichent « skill non installé » (scénario I).

**Sous-sessions**
- Le flux de la carte `start_session` : « Nouvelle session / Faire ici », puis le second appel avec le `proposal_id` et un prompt commençant par `/pilotage:chantier ouvrir <id>`.
- `$.session.id()` rend bien, dans la sous-session, le même identifiant que celui que le panneau compare à `sessions.json` (la consigne le donne au modèle, qui le passe à `lier-session --session-id`).

**Suivi des appels d'agents (hooks `tool.call`)**
- Les hooks ne bloquent jamais un appel d'outil, même si le suivi échoue ; comportement du moteur si un hook `tool.call` rejette.
- Forme exacte du résultat de `next` ; présence systématique de `tool_use_id`.

**Écriture sur disque**
- Les écritures ne sont pas atomiques au niveau du système de fichiers (écriture puis remplacement) ; la transaction remet tout comme avant en cas d'échec, mais une coupure en plein milieu n'est pas testée.
- Verrous de fichiers Windows (Drive, antivirus, fichier ouvert dans un éditeur) pendant un archivage ou un remplacement : le retour en arrière n'a pas été essayé en vrai.

**Autres**
- `--confirme` est un drapeau passé par le modèle ; il ne prouve pas un vrai « oui » de l'utilisateur.
- Maquette : validation visuelle par le propriétaire jamais faite (captures Figma seulement) ; versions sombres de certains écrans non dessinées.

## Limites connues

**Pistes repoussées (docs/suivi.md)**
- Ajouter ou retirer un agent depuis l'interface.
- Changer le type du projet (migration de `reglagesDef` et `reglages`).
- Couleur d'accent du panneau.
- Modifier le nom et l'objectif du projet depuis l'interface.
- Charger le workflow idéal d'un type de projet (preset) depuis les Paramètres.
- Désenregistrer du moteur un agent désactivé.
- Restaurer `projet.json` depuis `projet.json.bak` : manuel pour l'instant.

**Lecture du plan et des fiches**
- Une copie de conflit de synchronisation (Dropbox, Syncthing) n'est pas toujours reconnue ; certains vrais fichiers sont pris à tort pour des copies (`Report (2024).md`).
- Doublons d'identifiant de tâche entre phases perdus à la réécriture ; tâches « Sans phase » repoussées en fin de fichier à la première réécriture ; un identifiant de phase avec `()` ou `|` n'est pas réversible.
- Une fiche de plus de 256 Ko est lue entièrement avant refus (pas de taille disponible) ; dossiers `lea` et `lea 2` fusionnés comme un même membre ; nombre de dossiers de membres non borné.
- Chemins UNC non pris en charge ; `projet.json` sensible à la casse.

**Chantiers et sessions**
- « Aller à la session » copie seulement le nom (aucune API pour reprendre une session).
- Le bandeau ne s'appuie que sur `sessions.json` ; en cas de conflit de lien, le premier membre par ordre alphabétique gagne.
- Un chantier « reporté » compte dans le total (100 % impossible) : choix de produit.
- `viderAgents` peut être écrasé par une écriture tardive ; le changement de projet peut attendre 2 s si l'état est gelé ; la consigne peut avoir jusqu'à 20 s de retard.
- `portes.md` à fins de ligne mixtes est normalisé en CRLF ; pas de verrou sur `plan.md` (une personne à la fois).

**Paramètres et projet**
- Champs inconnus imbriqués (dans un pôle ou un agent) perdus à l'écriture ; les clés inconnues de premier niveau sont conservées.
- Ids et valeurs de réglages sans plafond ; l'identifiant `constructor` mal traité dans les réglages (à passer à `Object.hasOwn`).
- Un nom de fichier de skill avec `_` ou `:` est refusé (faux « skill non installé »).
- La ligne « Application » du vocabulaire n'a pas d'écran propre dans la maquette.

**Interface**
- Onglets en glyphes (pas de SVG) : écart avec la maquette ; pastilles précomposées sur la surface (contraste hors carte).
- Pas de dates, pas de repli mobile dans la vue d'ensemble ; `register.tsx` fait environ 750 lignes et sera à scinder.
- Les chemins copiés sont relatifs au projet.

**Écriture des scripts**
- Une collision d'identifiant de note ne réessaie pas (code 4) ; l'échec d'un `rmSync` pendant un retour en arrière est avalé ; un fichier créé puis dont l'écriture échoue n'est pas enregistré dans la liste à nettoyer ; EACCES est dit « introuvable ».
- Une course entre le contrôle et l'écriture de `projet.json` donne le code 4 au lieu de 3 (sans écrasement).
- Un chemin Windows finissant par `\` entre guillemets peut être mal lu.

**Règles de contrôle (lint)**
- Le contrôle de `<plugin>` ne couvre pas tout `agents/` ; certaines règles exigent des mots larges (`confirme`, `absent`) ; l'apostrophe droite et l'apostrophe typographique ne sont pas distinguées.

## À décider

- **Licence** : aucune choisie ; à décider par le propriétaire avant diffusion du dépôt.
