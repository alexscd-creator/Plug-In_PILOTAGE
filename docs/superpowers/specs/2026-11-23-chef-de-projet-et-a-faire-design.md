# Chef de projet et liste « À faire » : design

Date : 2026-11-23 · Auteur : Alex (avec Claude) · Statut : à valider

## Pourquoi

Aujourd'hui, utiliser Pilotage demande de connaître ses commandes : une idée ou un retour donné dans la conversation n'est ni trié ni
transformé en chantier, et le skill « Idées et retours » ne s'est même pas déclenché pendant les tests. Alex veut que le plugin
fluidifie le travail de lui-même : il propose la bonne suite à chaque idée ou retour, fait respecter les règles (chantier en
sous-session, portes), et la page Idées devient la liste des petites choses à faire, qu'un bouton transforme en chantier.

## Objectifs

1. **Chef de projet** : dans toute conversation d'un projet Pilotage, Claude tient le rôle de chef de projet. À chaque idée ou retour,
   il trie et le dit en une ligne :
   - petit retour (quelques minutes, un fichier) : il propose de le corriger tout de suite, ici ;
   - idée ou tâche pour plus tard : il la note (page « À faire »), sans demander ;
   - vrai travail (plusieurs fichiers ou étapes) : il propose un chantier, avec un nom trouvé, puis la sous-session
     (carte « Nouvelle session / Faire ici »).
   Il rappelle les règles : un chantier se mène en sous-session ; une porte se valide quand ses tâches sont réglées ; rien ne s'écrit
   sans l'accord de l'utilisateur.
2. **Détecteur** : quand un message de l'utilisateur ressemble à une idée ou à un retour, le plugin ajoute au contexte de ce message
   un rappel court : « Ce message ressemble à une idée ou un retour : trie-le (skill chef de projet). » Il ne décide rien lui-même.
3. **Page « À faire »** (remplace « Idées ») : la liste des notes ouvertes (idées, retours, petites tâches) de toute l'équipe, avec le
   filtre Tout / Idées / Retours. Chaque note a un bouton **« Lancer en chantier »**.
4. **Lancer en chantier** (choix B d'Alex) : un appui crée la fiche du chantier tout de suite, depuis le panneau, sans passer par
   Claude ; la note quitte la liste « À faire ». Le panneau propose ensuite d'ouvrir la sous-session.

## Hors périmètre (non-objectifs)

- Pas de page « Chantier » nouvelle pour ce travail (la page « Chantier ouvert » existe déjà, faite dans le chantier en cours).
- Pas de carte « Chef de projet » visible dans le panneau (option 3, plus tard peut-être).
- Pas de modification du texte d'une note depuis le panneau : on la complète en discutant avec Claude (choix d'Alex).
- Pas de suppression de fichier depuis le panneau (`$.fs` ne sait pas supprimer).

## Approches considérées

| Approche | Pour | Contre | Choix |
| --- | --- | --- | --- |
| 1. Rôle + skill chef de projet seuls | presque gratuit, réutilise l'existant | dépend de Claude, peut rater le tri | — |
| 2. Rôle + skill + détecteur de tournures | se déclenche plus sûrement | faux positifs possibles, liste de tournures à entretenir | **retenu** |
| 3. Agent visible dans le panneau | se voit | pas plus fiable, plus long | plus tard |

Pour « Lancer en chantier » : A (le bouton passe par Claude : contrôle d'impact et confirmation) ou B (création directe).
**B retenu par Alex** : l'appui sur le bouton vaut confirmation ; le contrôle d'impact n'est pas fait à ce moment-là.

## Ce qui est décidé

### Chef de projet

- Nouveau skill `skills/chef-de-projet/SKILL.md` : le tri (trois cas ci-dessus, avec des exemples), les règles du processus, le ton
  (une ligne, pas de questionnaire), et ce qu'il ne fait jamais (écrire sans accord, lancer une sous-session sans la carte).
  Il s'appuie sur les skills existants : `idees-et-feedback` pour noter, `chantier-pilotage` pour créer un chantier.
- La consigne injectée par `prompt.compose` (`hooks/model/consigne.ts`) commence par le rôle : « Tu es le chef de projet Pilotage de
  ce projet », et nomme le skill `chef-de-projet`.
- Le détecteur vit dans un hook `prompt.submit` : une liste de tournures en français (« et si », « ce serait bien », « il faudrait »,
  « idée », « retour », « ça ne marche pas », « bug », « j'aimerais »…), sans appel au modèle. Il n'agit que dans un projet actif et
  pas sur une commande (`/…`). Il ajoute le rappel au contexte du message, une fois par message.

### Page « À faire »

- L'onglet « Idées » devient « À faire » (même page `idees`, même icône ✦).
- Liste : notes ouvertes, plus récentes d'abord ; chaque carte montre le type, l'auteur, la date, le titre et le début du texte, puis
  « Copier le chemin » et « Lancer en chantier ». Les notes déjà transformées sont dans une section repliée « Déjà en chantier · n ».
- « Lancer en chantier » n'apparaît que pour les notes du membre courant (on n'écrit que chez soi) et quand le prénom est connu.

### Lancer en chantier (création directe)

- Identifiant du chantier : tiré du titre de la note (`idDePole`-like : minuscules, tirets, 60 caractères), suffixe `-2`, `-3` en cas
  de collision. Titre = titre de la note ; tâches = une tâche « <titre de la note> » ; passation vide ; pôle et phase : la phase
  actuelle du membre, pas de pôle ; état `attente` ; le texte de la note recopié dans la fiche (section notes ou première tâche).
- La fiche est produite par les vrais sérialiseurs du modèle (`serializeChantier` + `validerChantier`), relue avant écriture, jamais
  d'écrasement d'une fiche existante : mêmes garanties que l'écriture d'état déjà faite côté hooks (`ecriture-chantier.ts`).
- La note n'est pas supprimée (impossible depuis le panneau) : son champ `chantier` reçoit l'identifiant du nouveau chantier ; la page
  la range alors dans « Déjà en chantier ». C'est ce qu'Alex appelle « la note disparaît » de la liste.
- Après la création : un toast « Chantier créé : <titre> », et le bouton « Ouvrir en sous-session » sur la carte du chantier (page
  Chantiers) prépare dans la zone de saisie la demande qui fait proposer la sous-session par Claude.

## Laissé au constructeur

- La liste exacte des tournures du détecteur et ses tests (vrais et faux positifs).
- Le libellé exact des boutons et des toasts, dans le ton du panneau (court, sans jargon).
- Où recopier le texte de la note dans la fiche (champ existant ou première tâche), tant que la fiche reste valide.

## Mes choix (à vérifier)

- Le détecteur sans appel au modèle (tournures seulement), pour qu'il ne coûte rien et reste prévisible.
- La note marquée et non supprimée, puisque le panneau ne peut pas supprimer de fichier.
- Le bouton réservé aux notes du membre courant.
