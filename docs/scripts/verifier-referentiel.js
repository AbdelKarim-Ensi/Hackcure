// Vérifie la cohérence des fichiers de référence du dossier docs/.
// Utilisation (depuis la racine du dépôt) : node docs/scripts/verifier-referentiel.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const lire = (nom) => JSON.parse(fs.readFileSync(path.join(dir, nom), 'utf8'));

const erreurs = [];
const infos = [];
const TYPES = ['hopital', 'banque_sang', 'centre_transfusion'];

const gouvernorats = lire('gouvernorats.json');
const referentiel = lire('referentiel-etablissements.json');
const ministere = lire('hopitaux-ministere.json');
const hopitaux = ministere.hopitaux;

// 1. Codes uniques, dans chaque fichier et entre les deux
const codesRef = new Set();
referentiel.forEach((x) => {
  if (codesRef.has(x.code)) erreurs.push('Code en double dans le référentiel : ' + x.code);
  codesRef.add(x.code);
});
const codesMin = new Set();
hopitaux.forEach((h) => {
  if (codesMin.has(h.code)) erreurs.push('Code en double dans la liste du ministère : ' + h.code);
  if (codesRef.has(h.code)) erreurs.push('Code présent dans les deux fichiers : ' + h.code);
  codesMin.add(h.code);
});

// 2. Gouvernorats et types
referentiel.concat(hopitaux).forEach((x) => {
  if (gouvernorats.indexOf(x.gouvernorat) < 0) erreurs.push('Gouvernorat inconnu pour ' + x.code + ' : ' + x.gouvernorat);
});
hopitaux.forEach((h) => {
  if (h.type !== 'hopital') erreurs.push('Type inattendu pour ' + h.code + ' : ' + h.type);
});
referentiel.forEach((x) => {
  if (TYPES.indexOf(x.type) < 0) erreurs.push('Type du référentiel hors enum du backend pour ' + x.code + ' : ' + x.type + ' (utilise la version v2 du fichier)');
});

// 3. Numéros : 8 chiffres
hopitaux.forEach((h) => {
  h.telephones.concat(h.fax, h.urgence).forEach((n) => {
    if (/^\d{8}$/.test(n) === false) erreurs.push('Numéro invalide pour ' + h.code + ' : ' + n);
  });
});

// 4. Liens vers les structures du CNTS
const parCode = {};
referentiel.forEach((x) => { parCode[x.code] = x; });
hopitaux.forEach((h) => {
  if (h.structureCode) {
    if (parCode[h.structureCode] === undefined) erreurs.push(h.code + ' renvoie vers une structure absente : ' + h.structureCode);
    if (h.lienBase !== 'numero' && h.lienBase !== 'ville') erreurs.push(h.code + ' : lienBase doit valoir numero ou ville');
  } else if (h.lienBase) {
    erreurs.push(h.code + ' : lienBase renseigné sans structureCode');
  }
});

// 5. Informations utiles
const liens = hopitaux.filter((h) => h.structureCode);
const parNumero = liens.filter((h) => h.lienBase === 'numero').length;
const deduits = hopitaux.filter((h) => h.gouvernoratDeduit).length;
const incomplets = hopitaux.filter((h) => h.remarques.some((r) => r.indexOf('incomplète') >= 0)).length;
const remplaces = referentiel.filter((x) => x.type === 'hopital' && x.structureCode && liens.some((h) => h.structureCode === x.structureCode)).length;

console.log('Référentiel : ' + referentiel.length + ' entrées');
console.log('Hôpitaux du ministère : ' + hopitaux.length + ' | gouvernorat déduit : ' + deduits + ' | entrées incomplètes : ' + incomplets);
console.log('Liens vers le CNTS : ' + liens.length + ' (par numéro : ' + parNumero + ', par ville : ' + (liens.length - parNumero) + ')');
if (remplaces > 0) infos.push(remplaces + ' hôpital(aux) déduit(s) du référentiel auront un équivalent officiel : à remplacer lors de la fusion.');
if (ministere.meta.complet === false) infos.push('Liste du ministère INCOMPLÈTE : ne pas supprimer les hôpitaux déduits avant de l\'avoir complétée.');
infos.forEach((i) => console.log('Info : ' + i));

if (erreurs.length > 0) {
  console.log('\nERREURS (' + erreurs.length + ') :');
  erreurs.forEach((e) => console.log(' - ' + e));
  process.exit(1);
}
console.log('\nOK : aucun problème détecté.');
