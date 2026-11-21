import assert from 'node:assert/strict'
import { test } from 'node:test'

import { creerSuivi, ecrireMonWorkflow, ecrireProjet, modifierProjet, questionChargement, texteMonWorkflow } from '../hooks/model/ecriture-projet.ts'
import type { FsProjet, Patch, Suivi } from '../hooks/model/ecriture-projet.ts'
import { parseProjet, serializeProjet } from '../hooks/model/projet.ts'
import type { Projet } from '../hooks/model/projet.ts'

const BRUT = {
  version: 1, nom: 'Boutique', but: 'Vendre', fini: 'En ligne', preset: 'site-web', equipe: ['Léa', 'Sam'],
  poles: [{ id: 'code', titre: 'Technique', couleur: 'bleu' }, { id: 'art', titre: 'Création', couleur: 'rose' }, { id: 'neutre', titre: 'Sans couleur' }],
  phases: [{ id: 'p1', titre: 'Cadrage', taches: ['a'] }],
  agents: [
    { id: 'a1', titre: 'Alpha', pole: 'code', skills: ['luau'], pourquoi: 'Code.', outils: ['Write'] },
    { id: 'a2', titre: 'Beta', pole: 'art', skills: [], pourquoi: '' },
  ],
  workflow: { outils: [{ role: 'Code', outil: 'Claude' }, { role: 'Design', outil: 'Figma' }] },
  vocabulaire: { type: 'Site web', nomDuProjet: 'Nom du site', leProjet: 'le site', unProjet: 'un site', objectif: 'Objectif', fini: 'Fini ?' },
  reglagesDef: [
    { id: 'domaine', libelle: 'Domaine', genre: 'texte' },
    { id: 'hebergement', libelle: 'Hébergement', genre: 'choix', options: ['à choisir', 'cloud'], defaut: 'à choisir' },
    { id: 'paiement', libelle: 'Paiement', genre: 'oui-non', defaut: false },
  ],
  reglages: { domaine: 'a.fr', hebergement: 'à choisir', paiement: false },
}
const base = (): Projet => {
  const r = parseProjet(JSON.stringify(BRUT))
  assert.ok(r.ok)
  return r.projet
}
const ok = (p: Projet, patch: Patch): Projet => {
  const r = modifierProjet(p, patch)
  assert.ok(r.ok, r.ok ? '' : r.erreurs.join(' | '))
  return r.projet
}
const refus = (p: Projet, patch: Patch, motif?: RegExp): string[] => {
  const r = modifierProjet(p, patch)
  assert.equal(r.ok, false, JSON.stringify(patch))
  const erreurs = r.ok ? [] : r.erreurs
  assert.ok(erreurs.length > 0)
  if (motif) assert.match(erreurs.join(' '), motif)
  return erreurs
}

test('modifierProjet ne modifie jamais son entrée et ne change que le champ visé', () => {
  const p = base()
  const avant = serializeProjet(p)
  const n = ok(p, { type: 'reglage', id: 'domaine', valeur: 'b.fr' })
  assert.equal(serializeProjet(p), avant)
  assert.equal(n.reglages.domaine, 'b.fr')
  assert.deepEqual({ ...n, reglages: p.reglages }, p)
})

test('réglages : texte, choix, oui-non valides ; hors type, mauvais genre, option inconnue, trop long refusés', () => {
  const p = base()
  assert.equal(ok(p, { type: 'reglage', id: 'hebergement', valeur: 'cloud' }).reglages.hebergement, 'cloud')
  assert.equal(ok(p, { type: 'reglage', id: 'paiement', valeur: true }).reglages.paiement, true)
  refus(p, { type: 'reglage', id: 'inconnu', valeur: 'x' }, /inconnu/)
  refus(p, { type: 'reglage', id: 'paiement', valeur: 'oui' }, /oui ou non/)
  refus(p, { type: 'reglage', id: 'domaine', valeur: true }, /texte/)
  refus(p, { type: 'reglage', id: 'hebergement', valeur: 'bateau' }, /options/)
  refus(p, { type: 'reglage', id: 'domaine', valeur: 'x'.repeat(501) }, /500/)
  refus(p, { type: 'reglage', id: '__proto__', valeur: 'x' })
})

test('workflow : ajouter, modifier, retirer ; le dernier outil ne se retire pas ; plafond de 30 ; indices et textes vides refusés', () => {
  const p = base()
  assert.deepEqual(ok(p, { type: 'workflowAjouter', role: '3D', outil: 'Blender' }).workflow.outils.at(-1), { role: '3D', outil: 'Blender' })
  assert.deepEqual(ok(p, { type: 'workflowModifier', index: 0, role: 'Code', outil: 'Cursor' }).workflow.outils[0], { role: 'Code', outil: 'Cursor' })
  const un = ok(p, { type: 'workflowRetirer', index: 0 })
  assert.deepEqual(un.workflow.outils, [{ role: 'Design', outil: 'Figma' }])
  refus(un, { type: 'workflowRetirer', index: 0 }, /vide|au moins/)
  refus(p, { type: 'workflowRetirer', index: 5 }, /n'existe pas|introuvable/)
  refus(p, { type: 'workflowModifier', index: -1, role: 'a', outil: 'b' })
  refus(p, { type: 'workflowAjouter', role: '  ', outil: 'b' })
  refus(p, { type: 'workflowAjouter', role: 'a', outil: 'x'.repeat(121) }, /120/)
  let q = p
  for (let i = 0; i < 28; i++) q = ok(q, { type: 'workflowAjouter', role: `r${i}`, outil: 'o' })
  assert.equal(q.workflow.outils.length, 30)
  refus(q, { type: 'workflowAjouter', role: 'r', outil: 'o' }, /30/)
})

test('agents : désactiver / réactiver, rôle, skills ; inconnu et plafonds refusés', () => {
  const p = base()
  assert.equal(p.agents[0]!.actif, undefined)
  const off = ok(p, { type: 'agentActiver', id: 'a1', actif: false })
  assert.equal(off.agents[0]!.actif, false)
  assert.equal(off.agents[1]!.actif, undefined)
  assert.equal(serializeProjet(ok(off, { type: 'agentActiver', id: 'a1', actif: true })), serializeProjet(p))
  assert.match(serializeProjet(off), /"actif": false/)
  assert.doesNotMatch(serializeProjet(p), /actif/)
  const r = ok(p, { type: 'agentRole', id: 'a2', titre: 'Bêta 2', pourquoi: 'Regarde.' })
  assert.equal(r.agents[1]!.titre, 'Bêta 2')
  assert.equal(r.agents[1]!.pole, 'art')
  assert.deepEqual(ok(p, { type: 'agentSkills', id: 'a1', skills: ['x', 'y'] }).agents[0]!.skills, ['x', 'y'])
  assert.deepEqual(ok(p, { type: 'agentSkills', id: 'a1', skills: ['x', 'y'] }).agents[0]!.outils, ['Write'], 'les outils ne bougent pas')
  refus(p, { type: 'agentActiver', id: 'zz', actif: false }, /zz/)
  refus(p, { type: 'agentRole', id: 'zz', titre: 'a', pourquoi: '' })
  refus(p, { type: 'agentRole', id: 'a1', titre: '', pourquoi: '' }, /titre/)
  refus(p, { type: 'agentRole', id: 'a1', titre: 'a', pourquoi: 'x'.repeat(501) }, /500/)
  refus(p, { type: 'agentSkills', id: 'a1', skills: Array.from({ length: 21 }, (_, i) => `s${i}`) }, /20/)
  refus(p, { type: 'agentSkills', id: 'a1', skills: ['x'.repeat(61)] }, /60/)
  refus(p, { type: 'agentActiver', id: 'a1', actif: 'non' as never })
})

test('pôles : renommer, couleur dans la palette, doublon de teinte refusé, ajouter, retirer', () => {
  const p = base()
  assert.equal(ok(p, { type: 'poleRenommer', id: 'code', titre: 'Code' }).poles[0]!.titre, 'Code')
  refus(p, { type: 'poleRenommer', id: 'code', titre: ' ' }, /titre/)
  refus(p, { type: 'poleRenommer', id: 'zz', titre: 'a' }, /zz/)
  refus(p, { type: 'poleRenommer', id: 'code', titre: 'x'.repeat(201) }, /200/)
  assert.equal(ok(p, { type: 'poleCouleur', id: 'code', couleur: 'vert' }).poles[0]!.couleur, 'vert')
  assert.equal(ok(p, { type: 'poleCouleur', id: 'neutre', couleur: 'orange' }).poles[2]!.couleur, 'orange')
  refus(p, { type: 'poleCouleur', id: 'code', couleur: 'rose' }, /rose/)
  refus(p, { type: 'poleCouleur', id: 'code', couleur: 'turquoise' }, /couleur/)
  refus(p, { type: 'poleCouleur', id: 'zz', couleur: 'vert' })
  const n = ok(p, { type: 'poleAjouter', id: 'son', titre: 'Son' })
  assert.equal(n.poles.at(-1)!.id, 'son')
  assert.ok(n.poles.at(-1)!.couleur && !['bleu', 'rose'].includes(n.poles.at(-1)!.couleur!), 'teinte libre prise automatiquement')
  assert.equal(ok(p, { type: 'poleAjouter', id: 'son', titre: 'Son', couleur: 'vert' }).poles.at(-1)!.couleur, 'vert')
  refus(p, { type: 'poleAjouter', id: 'code', titre: 'Doublon' }, /code/)
  refus(p, { type: 'poleAjouter', id: 'Mauvais Id', titre: 'x' }, /identifiant/)
  refus(p, { type: 'poleAjouter', id: 'son', titre: 'Son', couleur: 'bleu' }, /bleu/)
  refus(p, { type: 'poleAjouter', id: 'son', titre: '' }, /titre/)
  assert.equal(ok(p, { type: 'poleRetirer', id: 'neutre' }).poles.length, 2)
  refus(p, { type: 'poleRetirer', id: 'code' }, /Alpha|agent/)
  refus(p, { type: 'poleRetirer', id: 'zz' })
})

test('pôles : sans teinte libre, un pôle ajouté reste sans couleur', () => {
  let p = base()
  for (const [id, c] of [['v', 'violet'], ['s', 'sarcelle'], ['g', 'vert'], ['o', 'orange']] as const) p = ok(p, { type: 'poleAjouter', id, titre: id, couleur: c })
  const n = ok(p, { type: 'poleAjouter', id: 'dernier', titre: 'Dernier' })
  assert.equal(n.poles.at(-1)!.couleur, undefined)
})

// ---- Écrivain gardé ----
const ecrire = (fs: FsProjet, racine: string, affiche: Projet, patch: Patch, o: { moi: string; suivi?: Suivi } = { moi: 'Léa' }) => ecrireProjet(fs, racine, affiche, patch, o)
const RACINE = 'C:/Projet'
const CHEMIN = `${RACINE}/.pilotage/projet.json`
function disque(fichiers: Record<string, string>, panne: { ecrire?: (p: string) => boolean; lecture?: (n: number) => void } = {}) {
  const ecrits: string[] = []
  let lectures = 0
  const fs: FsProjet = {
    read: async p => {
      if (p === CHEMIN) panne.lecture?.(++lectures)
      if (!(p in fichiers)) throw new Error('absent')
      return fichiers[p]!
    },
    write: async (p, t) => {
      if (panne.ecrire?.(p)) throw new Error('écriture refusée')
      ecrits.push(p)
      fichiers[p] = t
    },
  }
  return { fs, fichiers, ecrits }
}
// Fichier écrit à la main (indentation différente) : le texte écrit est toujours celui de serializeProjet.
const surDisque = () => JSON.stringify(BRUT)
const patchDom: Patch = { type: 'reglage', id: 'domaine', valeur: 'b.fr' }

test('ecrireProjet : sauvegarde .bak d’abord (ancien texte), puis le fichier ; sortie = serializeProjet du résultat', async () => {
  const d = disque({ [CHEMIN]: surDisque() })
  const r = await ecrire(d.fs, RACINE, base(), patchDom)
  assert.deepEqual(r, { ok: true })
  assert.deepEqual(d.ecrits, [`${CHEMIN}.bak`, CHEMIN])
  assert.equal(d.fichiers[`${CHEMIN}.bak`], surDisque())
  assert.equal(d.fichiers[CHEMIN], serializeProjet(ok(base(), patchDom)))
  const relu = parseProjet(d.fichiers[CHEMIN]!)
  assert.ok(relu.ok && relu.projet.reglages.domaine === 'b.fr')
})

test('ecrireProjet : un patch invalide n’écrit rien (ni .bak)', async () => {
  const d = disque({ [CHEMIN]: surDisque() })
  const r = await ecrire(d.fs, RACINE, base(), { type: 'poleRetirer', id: 'code' })
  assert.equal(r.ok, false)
  assert.ok(!r.ok && r.erreurs.length > 0)
  assert.deepEqual(d.ecrits, [])
  assert.equal(d.fichiers[CHEMIN], surDisque())
})

test('ecrireProjet : le fichier a changé depuis l’affichage : refus en français, rien d’écrit', async () => {
  const autre = { ...BRUT, nom: 'Modifié par un associé' }
  const d = disque({ [CHEMIN]: JSON.stringify(autre) })
  const r = await ecrire(d.fs, RACINE, base(), patchDom)
  assert.equal(r.ok, false)
  assert.match(!r.ok ? r.erreurs.join(' ') : '', /changé/)
  assert.deepEqual(d.ecrits, [])
})

test('ecrireProjet : le fichier change entre la sauvegarde et l’écriture : refus, le fichier n’est pas écrasé', async () => {
  const d = disque({ [CHEMIN]: surDisque() }, { lecture: n => { if (n === 2) d.fichiers[CHEMIN] = JSON.stringify({ ...BRUT, but: 'Autre but' }) } })
  const r = await ecrire(d.fs, RACINE, base(), patchDom)
  assert.equal(r.ok, false)
  assert.match(!r.ok ? r.erreurs.join(' ') : '', /changé/)
  assert.ok(!d.ecrits.includes(CHEMIN))
  assert.match(d.fichiers[CHEMIN]!, /Autre but/)
})

test('ecrireProjet : échec de la sauvegarde : le fichier n’est pas touché ; échec de l’écriture : message, ancien contenu en .bak', async () => {
  const a = disque({ [CHEMIN]: surDisque() }, { ecrire: p => p.endsWith('.bak') })
  const ra = await ecrire(a.fs, RACINE, base(), patchDom)
  assert.equal(ra.ok, false)
  assert.deepEqual(a.ecrits, [])
  assert.equal(a.fichiers[CHEMIN], surDisque())
  const b = disque({ [CHEMIN]: surDisque() }, { ecrire: p => p === CHEMIN })
  const rb = await ecrire(b.fs, RACINE, base(), patchDom)
  assert.equal(rb.ok, false)
  assert.match(!rb.ok ? rb.erreurs.join(' ') : '', /projet\.json\.bak/)
  assert.match(!rb.ok ? rb.erreurs.join(' ') : '', /Pour restaurer : remplacez projet\.json par projet\.json\.bak\./)
  assert.equal(b.fichiers[CHEMIN], surDisque(), 'rien n’a changé')
  assert.equal(b.fichiers[`${CHEMIN}.bak`], surDisque())
})

test('ecrireProjet : fichier illisible, invalide ou racine vide : refus sans écriture ; rien n’est écrit ailleurs que .pilotage/projet.json(.bak)', async () => {
  for (const contenu of ['pas du json', '{"version":2}']) {
    const d = disque({ [CHEMIN]: contenu })
    const r = await ecrire(d.fs, RACINE, base(), patchDom)
    assert.equal(r.ok, false)
    assert.deepEqual(d.ecrits, [])
  }
  const sans = disque({})
  assert.equal((await ecrire(sans.fs, RACINE, base(), patchDom)).ok, false)
  assert.equal((await ecrire(sans.fs, '  ', base(), patchDom)).ok, false)
  assert.deepEqual(sans.ecrits, [])
  const d = disque({ [CHEMIN]: surDisque() })
  await ecrire(d.fs, `${RACINE.replace('/', '\\')}\\`, base(), patchDom)
  assert.ok(d.ecrits.every(p => p === CHEMIN || p === `${CHEMIN}.bak`))
})

test('ecrireProjet : un patch sans effet n’écrit rien', async () => {
  const d = disque({ [CHEMIN]: surDisque() })
  const r = await ecrire(d.fs, RACINE, base(), { type: 'reglage', id: 'domaine', valeur: 'a.fr' })
  assert.deepEqual(r, { ok: true })
  assert.deepEqual(d.ecrits, [])
})

// ---- mon-workflow.json ----
const HOME = 'C:/Users/Jo'
const MON = `${HOME}/.claude/pilotage/mon-workflow.json`
function disqueMon(fichiers: Record<string, string>, echec = false) {
  const ecrits: string[] = []
  return {
    ecrits,
    fichiers,
    fs: {
      exists: async (p: string) => p in fichiers,
      write: async (p: string, t: string) => { if (echec) throw new Error('refusé'); ecrits.push(p); fichiers[p] = t },
    },
  }
}

test('mon workflow : texte montré = texte écrit, créé sans question s’il n’existe pas', async () => {
  const w = base().workflow
  const d = disqueMon({})
  let questions = 0
  const r = await ecrireMonWorkflow(d.fs, HOME, w, async () => { questions++; return true })
  assert.deepEqual(r, { ok: true })
  assert.equal(questions, 0)
  assert.deepEqual(d.ecrits, [MON])
  assert.equal(d.fichiers[MON], texteMonWorkflow(w))
  assert.deepEqual(JSON.parse(d.fichiers[MON]!), { outils: w.outils })
})

test('mon workflow : s’il existe, confirmation ; refusée : rien n’est écrit ; acceptée : remplacé', async () => {
  const w = base().workflow
  const d = disqueMon({ [MON]: '{"outils":[]}' })
  const non = await ecrireMonWorkflow(d.fs, HOME, w, async () => false)
  assert.equal(non.ok, false)
  assert.deepEqual(d.ecrits, [])
  const oui = await ecrireMonWorkflow(d.fs, HOME, w, async () => true)
  assert.deepEqual(oui, { ok: true })
  assert.deepEqual(d.ecrits, [MON])
})

test('mon workflow : vide, sans dossier personnel, confirmation ou écriture qui échouent : refus, jamais de levée', async () => {
  const w = base().workflow
  assert.equal((await ecrireMonWorkflow(disqueMon({}).fs, HOME, { outils: [] }, async () => true)).ok, false)
  const sans = disqueMon({})
  assert.equal((await ecrireMonWorkflow(sans.fs, '', w, async () => true)).ok, false)
  assert.deepEqual(sans.ecrits, [])
  const e = disqueMon({}, true)
  assert.equal((await ecrireMonWorkflow(e.fs, HOME, w, async () => true)).ok, false)
  const c = disqueMon({ [MON]: 'x' })
  assert.equal((await ecrireMonWorkflow(c.fs, HOME, w, async () => { throw new Error('fermé') })).ok, false)
  assert.deepEqual(c.ecrits, [])
})

// ---- Fix round 1 ----
test('workflowRemplacer : remplace la liste ; vide refusé ; plafond de 30 ; textes vides refusés', () => {
  const p = base()
  assert.deepEqual(ok(p, { type: 'workflowRemplacer', outils: [{ role: 'A', outil: 'B' }] }).workflow.outils, [{ role: 'A', outil: 'B' }])
  refus(p, { type: 'workflowRemplacer', outils: [] }, /vide|au moins/)
  refus(p, { type: 'workflowRemplacer', outils: Array.from({ length: 31 }, (_, i) => ({ role: `r${i}`, outil: 'o' })) }, /30/)
  refus(p, { type: 'workflowRemplacer', outils: [{ role: ' ', outil: 'b' }] })
  refus(p, { type: 'workflowRemplacer', outils: 'x' as never })
  assert.match(questionChargement([{ role: 'Son', outil: 'Audacity' }, { role: 'Code', outil: 'Claude' }]), /Son : Audacity.*Code : Claude/)
})

const AVEC_INCONNUES = () => ({ ...BRUT, zeta: { a: [1, { b: null, c: 'x' }], z: 1 }, alpha: 'garde-moi', zeta2: [3, 2, 1] })

test('ecrire : une clé inconnue du fichier survit à une modification, dans son ordre, après les clés connues, valeurs intactes', async () => {
  const d = disque({ [CHEMIN]: JSON.stringify(AVEC_INCONNUES()) })
  const r = await ecrire(d.fs, RACINE, base(), patchDom)
  assert.deepEqual(r, { ok: true })
  const ecrit = JSON.parse(d.fichiers[CHEMIN]!)
  assert.deepEqual(ecrit.zeta, { a: [1, { b: null, c: 'x' }], z: 1 })
  assert.equal(ecrit.alpha, 'garde-moi')
  assert.deepEqual(ecrit.zeta2, [3, 2, 1])
  const cles = Object.keys(ecrit)
  assert.deepEqual(cles.slice(-3), ['zeta', 'alpha', 'zeta2'], 'ordre d’origine des clés inconnues, après les connues')
  assert.deepEqual(cles.slice(0, 3), ['version', 'nom', 'but'])
  assert.equal(ecrit.reglages.domaine, 'b.fr')
  assert.ok(parseProjet(d.fichiers[CHEMIN]!).ok, 'toujours lisible par parseProjet')
  assert.equal(d.fichiers[`${CHEMIN}.bak`], JSON.stringify(AVEC_INCONNUES()))
})

test('ecrire : une clé « __proto__ » inconnue reste une clé du fichier', async () => {
  const d = disque({ [CHEMIN]: JSON.stringify(BRUT).replace('{', '{"__proto__":{"x":1},') })
  await ecrire(d.fs, RACINE, base(), patchDom)
  assert.equal(Object.keys(JSON.parse(d.fichiers[CHEMIN]!)).includes('__proto__'), true)
})

test('ecrire : un patch sans effet n’écrit rien même avec des clés inconnues', async () => {
  const d = disque({ [CHEMIN]: JSON.stringify(AVEC_INCONNUES()) })
  const r = await ecrire(d.fs, RACINE, base(), { type: 'reglage', id: 'domaine', valeur: 'a.fr' })
  assert.deepEqual(r, { ok: true })
  assert.deepEqual(d.ecrits, [])
})

test('ecrire : .bak non réécrit s’il est déjà égal au disque ; sinon l’ancien .bak passe en .bak2 (échec de .bak2 : on continue)', async () => {
  const a = disque({ [CHEMIN]: surDisque(), [`${CHEMIN}.bak`]: surDisque() })
  await ecrire(a.fs, RACINE, base(), patchDom)
  assert.deepEqual(a.ecrits, [CHEMIN], '.bak identique au disque : pas réécrit')
  const AVANT = 'ancienne sauvegarde'
  const b = disque({ [CHEMIN]: surDisque(), [`${CHEMIN}.bak`]: AVANT })
  await ecrire(b.fs, RACINE, base(), patchDom)
  assert.deepEqual(b.ecrits, [`${CHEMIN}.bak2`, `${CHEMIN}.bak`, CHEMIN])
  assert.equal(b.fichiers[`${CHEMIN}.bak2`], AVANT)
  assert.equal(b.fichiers[`${CHEMIN}.bak`], surDisque())
  const c = disque({ [CHEMIN]: surDisque(), [`${CHEMIN}.bak`]: AVANT }, { ecrire: p => p.endsWith('.bak2') })
  const rc = await ecrire(c.fs, RACINE, base(), patchDom)
  assert.deepEqual(rc, { ok: true })
  assert.deepEqual(c.ecrits, [`${CHEMIN}.bak`, CHEMIN])
})

test('ecrire : sans membre connu (moi vide ou hors équipe) : refus, rien n’est écrit', async () => {
  for (const moi of ['', '  ', 'Inconnu']) {
    const d = disque({ [CHEMIN]: surDisque() })
    const r = await ecrire(d.fs, RACINE, base(), patchDom, { moi })
    assert.equal(r.ok, false)
    assert.match(!r.ok ? r.erreurs.join(' ') : '', /Indiquez votre prénom pour modifier les réglages/)
    assert.deepEqual(d.ecrits, [])
  }
  const d = disque({ [CHEMIN]: surDisque() })
  assert.deepEqual(await ecrire(d.fs, RACINE, base(), patchDom, { moi: 'lea' }), { ok: true }, 'même membre, autre écriture du prénom')
})

test('ecrire : appuis rapides avec le même affichage périmé : les suivants passent grâce au suivi ; un vrai changement extérieur reste refusé', async () => {
  const suivi = creerSuivi()
  const d = disque({ [CHEMIN]: surDisque() })
  const p0 = base()
  assert.deepEqual(await ecrire(d.fs, RACINE, p0, patchDom, { moi: 'Léa', suivi }), { ok: true })
  assert.deepEqual(await ecrire(d.fs, RACINE, p0, { type: 'reglage', id: 'paiement', valeur: true }, { moi: 'Léa', suivi }), { ok: true })
  assert.deepEqual(await ecrire(d.fs, RACINE, p0, { type: 'poleRenommer', id: 'code', titre: 'Code' }, { moi: 'Léa', suivi }), { ok: true })
  const fin = JSON.parse(d.fichiers[CHEMIN]!)
  assert.equal(fin.reglages.domaine, 'b.fr')
  assert.equal(fin.reglages.paiement, true)
  assert.equal(fin.poles[0].titre, 'Code')
  d.fichiers[CHEMIN] = JSON.stringify({ ...fin, nom: 'Associé' })
  const r4 = await ecrire(d.fs, RACINE, p0, { type: 'reglage', id: 'domaine', valeur: 'c.fr' }, { moi: 'Léa', suivi })
  assert.equal(r4.ok, false)
  assert.match(!r4.ok ? r4.erreurs.join(' ') : '', /changé/)
  assert.equal(JSON.parse(d.fichiers[CHEMIN]!).nom, 'Associé')
  const e = disque({ [CHEMIN]: surDisque() })
  await ecrire(e.fs, RACINE, p0, patchDom)
  assert.equal((await ecrire(e.fs, RACINE, p0, { type: 'reglage', id: 'paiement', valeur: true })).ok, false, 'sans suivi, comme avant')
})
