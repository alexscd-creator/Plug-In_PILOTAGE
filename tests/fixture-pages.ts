import { CONFIG_LEA, PROJET } from './banc'

// Projet de test : 2 pôles (un avec couleur, un sans), 3 phases, états de tâche mélangés, phase en cours = « p2 ».
export const PROJET_PAGES = {
  ...PROJET,
  nom: 'Boutique test',
  but: 'Vendre des bols',
  poles: [{ id: 'code', titre: 'Technique', couleur: 'bleu' }, { id: 'art', titre: 'Création' }],
  phases: [
    { id: 'p1', titre: 'Cadrage', taches: [] },
    { id: 'p2', titre: 'Conception', taches: [] },
    { id: 'p3', titre: 'Production', taches: [] },
  ],
  agents: [
    { id: 'a1', titre: 'Alpha', pole: 'code', skills: [], pourquoi: '' },
    { id: 'a2', titre: 'Beta', pole: 'art', skills: [], pourquoi: '' },
    { id: 'a3', titre: 'Gamma', pole: 'art', skills: [], pourquoi: '' },
  ],
}

export const PLAN_PAGES = [
  '## Cadrage (p1)', '',
  '- [x] p1-1 | Écrire le but | pole: code | auteur: Léa',
  '- [-] p1-2 | Idée abandonnée', '',
  '## Conception (p2)', '',
  '- [x] p2-1 | Maquette | fichier: docs/maquette.md | auteur: Léa | pole: art',
  '- [~] p2-2 | Schéma | pole: code',
  '- [ ] p2-3 | Revue',
  '- [>] p2-4 | Reporté', '',
  '## Production (p3)', '',
  '- [ ] p3-1 | Construire', '',
  '## Divers', '',
  '- [ ] x-1 | Hors phase',
].join('\n')

export const dossierPages = (projet: object = PROJET_PAGES, plan: string = PLAN_PAGES) => ({
  'C:/Projet/.pilotage/projet.json': JSON.stringify(projet),
  'C:/Projet/.pilotage/plan.md': plan,
  'C:/Projet/.pilotage/equipe/lea/portes.md': 'porte: p1\n',
  'C:/Projet/.pilotage/equipe/sam/portes.md': 'porte: p1\n',
  [CONFIG_LEA]: '{"prenom":"lea"}',
})
