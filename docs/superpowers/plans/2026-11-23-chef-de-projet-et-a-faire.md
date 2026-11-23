# Chef de projet et page « À faire » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude tient le rôle de chef de projet dans chaque projet Pilotage (tri des idées et retours, rappel par un détecteur), et la page Idées devient « À faire » avec un bouton qui crée directement un chantier depuis une note.

**Architecture:** Logique pure dans `hooks/model/` (détecteur, chantier depuis une note, champ `lance` des notes), testée par `node --test` (`tests/*.spec.ts`) ; écriture côté hooks par `$.fs` avec les vrais sérialiseurs ; page dans `hooks/ui/idees.tsx`, testée par `claude plugin test .` ; consigne et skill en texte.

**Tech Stack:** TypeScript/TSX (mod API Claude Code), node --test, claude plugin test.

**Spec:** `docs/superpowers/specs/2026-11-23-chef-de-projet-et-a-faire-design.md` · Maquette : Figma `ygqY5yLfLsSIc8jTBkvqOL`, section « 09 À faire » (node 83:5904).

## Global Constraints

- Fiches, plan et portes : jamais écrits à la main par Claude ; côté panneau, seulement via les sérialiseurs du modèle (`serializeChantier` + `validerChantier`, `serializeNote` + `validerNote`), jamais d'écrasement d'une fiche existante.
- On n'écrit que chez soi : `.pilotage/equipe/<dossierDe(moi)>/…` ; bouton absent sans prénom connu ou sur la note d'un autre membre.
- `$.fs` ne supprime pas : une note lancée est marquée, pas supprimée.
- Consigne : la section complète reste ≤ `MAX_CONSIGNE` (6000) ; l'état ≤ `MAX_ETAT` (2500).
- Commits : `git -c user.name=studio -c user.email=studio@local`, fin de message `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ; version dans `.claude-plugin/plugin.json`.
- Vérification : `npm test`, `"$USERPROFILE/.local/bin/claude.exe" plugin test .`, `npm run lint`.

## Review Focus

1. Une note dont le titre donne un identifiant de chantier déjà pris : suffixe `-2`, `-3`, jamais d'écrasement.
2. Une note d'un autre membre : pas de bouton, aucune écriture dans son dossier.
3. Un message qui est une commande (`/…`) ou un message méta : pas de rappel du détecteur.
4. Une note `lance:` relue par une ancienne version du script `pilotage-note.mjs` (clé inconnue ignorée par `parseNote`).
5. Écriture de la fiche réussie mais marquage de la note en échec : la note reste dans « À faire », l'erreur est dite, la fiche existe (pas de doublon au second appui : collision → suffixe, accepté).

---

## Ruling (écart au design)

Le design prévoyait de marquer la note avec son champ `chantier`. Ce champ existe déjà et veut dire « note créée pendant ce chantier » : le réutiliser rangerait à tort ces notes dans « Déjà en chantier ». Nouveau champ `lance: <id du chantier>`.

### Task 1: Champ `lance` des notes

**Files:** Modify `hooks/model/notes.ts` · Test `tests/notes.spec.ts`

**Interfaces:** Produces `Note.lance: string` ('' = pas lancée) ; `parseNote` lit `lance:` (identifiant sûr, sinon erreur comme `chantier`) ; `serializeNote` l'écrit s'il n'est pas vide.

- [ ] Test : `serializeNote({…, lance: 'menu-clair'})` contient `lance: menu-clair` et `parseNote` le relit ; sans `lance`, le champ vaut `''` ; `lance: Pas Valide!` → erreur.
- [ ] Le voir échouer (`npm test`), implémenter, le voir passer ; ajouter `lance: ''` partout où une `Note` est construite (scripts compris : `grep -rn "chantier:" scripts hooks`).
- [ ] Commit.

### Task 2: Rôle et skill chef de projet

**Files:** Create `skills/chef-de-projet/SKILL.md` · Modify `hooks/model/consigne.ts` · Test `tests/consigne.spec.ts`

- [ ] Test : `partieFixe(projet)` commence (après `# Projet Pilotage`) par une ligne contenant « chef de projet » et nomme le skill `chef-de-projet` ; `construireConsigne` reste ≤ 6000 sur le plus gros projet de fixture.
- [ ] Ajouter à `ENTETE` : « Tu es le chef de projet Pilotage de ce projet : à chaque idée ou retour de l’utilisateur, trie-le (skill `chef-de-projet`) : petit correctif → propose de le faire ici ; idée ou tâche pour plus tard → note-la ; vrai travail → propose un chantier avec un nom, puis sa sous-session. » Raccourcir `CAPTURE` pour ne pas dépasser la limite.
- [ ] Écrire le skill : le tri (trois cas, exemples), les règles (sous-session, portes, accord avant écriture), le ton (une ligne), et les renvois aux skills `idees-et-feedback` et `chantier-pilotage`.
- [ ] Tests verts, commit.

### Task 3: Détecteur d'idées et de retours

**Files:** Create `hooks/model/detecteur.ts` · Modify `hooks/register.tsx` (hook `prompt.submit`) · Test `tests/detecteur.spec.ts`, `tests/consigne.test.tsx`

**Interfaces:** Produces `ressembleIdeeOuRetour(texte: string): boolean` et `RAPPEL_TRI: string`.

- [ ] Tests : vrai pour « et si on ajoutait… », « ce serait bien de… », « il faudrait », « j'aimerais », « ça ne marche pas », « bug », « retour : » ; faux pour « /projet », « ok », « Oui, créer », une question courte.
- [ ] Implémenter (expressions régulières sans accent ni casse ; jamais sur un texte commençant par `/`).
- [ ] Dans `prompt.submit` : si projet actif, message non méta et `ressembleIdeeOuRetour(e.text)`, ajouter `RAPPEL_TRI` au contexte (en plus de l'état). Test de banc : le contexte contient le rappel pour une idée, pas pour « /projet ».
- [ ] Commit.

### Task 4: Page « À faire »

**Files:** Modify `hooks/ui/nav.tsx` (titre `À faire`), `hooks/ui/idees.tsx`, `tests/idees.test.tsx`, `tests/kit.test.tsx`

- [ ] Tests : onglet « ✦  À faire » ; titre de page « À faire » ; les notes `lance === ''` listées, les autres dans « Déjà en chantier · n » ; filtres Tout / Idées / Retours avec leur compte.
- [ ] Implémenter selon la maquette (carte : bulle, titre, « Idée · auteur · jj/mm », texte, copier, bouton principal en bas à droite) ; garder les clés existantes de copie et de filtre.
- [ ] Commit.

### Task 5: « Lancer en chantier »

**Files:** Create `hooks/model/lancer-note.ts` · Modify `hooks/register.tsx`, `hooks/ui/idees.tsx` · Test `tests/lancer-note.spec.ts`, `tests/idees.test.tsx`

**Interfaces:** Produces `chantierDepuisNote(n: Note, idsPris: string[], phase: string, maintenantIso: string): Chantier` et `lancerNote(fs: FsEcriture, racine: string, moi: string, n: NoteLue, phase: string, maintenantIso: string): Promise<{ ok: true; id: string } | { ok: false; erreur: string }>`.

- [ ] Tests purs : id tiré du titre (minuscules, tirets, 60 max), `-2` si pris ; état `attente`, une tâche = titre de la note, passation = texte de la note (≤ 4000), `validerChantier` vide.
- [ ] `lancerNote` : liste `chantiers/` du membre, crée la fiche (jamais si le fichier existe), relit, puis réécrit la note avec `lance` ; refuse si la note n'est pas du membre.
- [ ] Bouton `lancer-<id note>` (libellé « ▶  Lancer en chantier ») seulement si `moi` connu et note du membre ; au succès : toast « Chantier créé : <titre> », rafraîchir ; à l'échec : bannière d'erreur.
- [ ] Test de banc : appui → fiche écrite dans `equipe/lea/chantiers/`, note réécrite avec `lance:`, note rangée dans « Déjà en chantier ».
- [ ] Commit.

### Task 6: Vérifier et publier

- [ ] `npm test`, `claude plugin test .`, `npm run lint` verts ; version 0.1.18 ; commit, `git push`, `claude plugin update pilotage`.
