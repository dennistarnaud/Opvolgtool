/**
 * LeerlingCodes.gs — Leerlingcode genereren, valideren en opzoeken
 *
 * Dit bestand beheert alles rondom de 8-tekens codes waarmee leerlingen
 * hun persoonlijk overzicht kunnen bekijken.
 *
 * Raak dit bestand alleen aan als je iets wilt veranderen aan het FORMAAT
 * of de GENERATIE van leerlingcodes. Voor UX/UI, taken, klassen, opvolging
 * enzovoort: zie Code.gs.
 *
 * ---------------------------------------------------------------------------
 * Codeformaat
 * ---------------------------------------------------------------------------
 *  - 8 tekens: 4 paren van letter + cijfer  →  bv. A2B7K9P3
 *  - Letters:  A–Z zonder I en O (verwarring met 1 en 0)
 *  - Cijfers:  2–9 (geen 0 of 1)
 *  - Hoofdlettergevoelig: altijd opgeslagen als hoofdletters
 *
 * Wijzig LEERLING_CODE_LETTERS, LEERLING_CODE_CIJFERS of LEERLING_CODE_PAREN
 * alleen als je het formaat voor NIEUWE leerlingen wilt aanpassen.
 * Codes die al in de sheet staan, worden nooit automatisch overschreven.
 * ---------------------------------------------------------------------------
 */

const LEERLING_CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LEERLING_CODE_CIJFERS = '23456789';
const LEERLING_CODE_PAREN = 4;

// ---------------------------------------------------------------------------
// Validatie
// ---------------------------------------------------------------------------

/**
 * Controleert of een code het verwachte formaat heeft.
 * Wordt alleen gebruikt bij het aanmaken van nieuwe codes en bij normalisatie
 * van lege codes. Bestaande codes in de sheet worden nooit op basis hiervan
 * vervangen.
 * @param {string} code
 * @return {boolean}
 */
function leerlingCodeIsGeldig_(code) {
  const tekst = String(code || '').trim().toUpperCase();
  if (tekst.length !== LEERLING_CODE_PAREN * 2) return false;
  for (let i = 0; i < LEERLING_CODE_PAREN; i++) {
    if (LEERLING_CODE_LETTERS.indexOf(tekst.charAt(i * 2)) === -1) return false;
    if (LEERLING_CODE_CIJFERS.indexOf(tekst.charAt(i * 2 + 1)) === -1) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Generatie
// ---------------------------------------------------------------------------

/**
 * Genereert een willekeurige code volgens het huidige formaat.
 * @return {string}
 */
function maakWillekeurigeLeerlingCode_() {
  let code = '';
  for (let i = 0; i < LEERLING_CODE_PAREN; i++) {
    code += LEERLING_CODE_LETTERS.charAt(Math.floor(Math.random() * LEERLING_CODE_LETTERS.length));
    code += LEERLING_CODE_CIJFERS.charAt(Math.floor(Math.random() * LEERLING_CODE_CIJFERS.length));
  }
  return code;
}

/**
 * Kiest een code die nog niet voorkomt in de opgegeven set.
 * @param {Object} bestaande  Map van bestaande codes (sleutel = code in hoofdletters).
 * @return {string}
 */
function uniekeLeerlingCodeVanSet_(bestaande) {
  for (let n = 0; n < 10000; n++) {
    const code = maakWillekeurigeLeerlingCode_();
    if (!bestaande[code]) {
      bestaande[code] = true;
      return code;
    }
  }
  throw new Error('Kon geen unieke leerlingcode genereren.');
}

/**
 * Genereert een nieuwe unieke code voor een leerling, rekening houdend met
 * alle bestaande codes in de opgegeven lijst.
 * @param {Object[]} leerlingen  Array van leerlingobjecten met een `code`-veld.
 * @return {string}
 */
function uniekeLeerlingCode_(leerlingen) {
  const bestaande = {};
  leerlingen.forEach(function (lln) {
    const code = String(lln.code || '').trim().toUpperCase();
    if (code) bestaande[code] = true;
  });
  return uniekeLeerlingCodeVanSet_(bestaande);
}

// ---------------------------------------------------------------------------
// Opzoeken
// ---------------------------------------------------------------------------

/**
 * Zoekt een actieve leerling op via zijn/haar code.
 * Leerlingen in de prullenbak worden overgeslagen.
 * @param {string} code
 * @return {Object|null}
 */
function zoekLeerlingOpCode_(code) {
  const gezocht = String(code || '').trim().toUpperCase();
  if (!gezocht) return null;
  const leerlingen = leesLeerlingen_();
  for (let i = 0; i < leerlingen.length; i++) {
    if (String(leerlingen[i].verwijderdOp || '').trim()) continue;
    if (String(leerlingen[i].code).trim().toUpperCase() === gezocht) {
      return leerlingen[i];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Onderhoud (alleen bij setup — vult lege codes in, vervangt nooit bestaande)
// ---------------------------------------------------------------------------

/**
 * Vult lege of ontbrekende codes in voor leerlingen die er nog geen hebben.
 * Codes die al in de sheet staan worden NOOIT gewijzigd, ongeacht het formaat.
 * Zo blijven ingesloten leerlinglinks altijd werken na codewijzigingen.
 */
function normaliseerLeerlingCodes_() {
  const sheet = getSheet_(TAB_LEERLINGEN);
  const bereik = sheet.getDataRange();
  const rijen = bereik.getValues();
  if (rijen.length < 2) return;

  // Verzamel alle bestaande codes (als reservering voor de generator).
  const bestaande = {};
  for (let i = 1; i < rijen.length; i++) {
    if (!rijen[i][0]) continue;
    const code = String(rijen[i][3] || '').trim().toUpperCase();
    if (code) bestaande[code] = true;
  }

  // Vul alleen lege codes in — bestaande codes blijven altijd onaangetast.
  let gewijzigd = false;
  for (let i = 1; i < rijen.length; i++) {
    if (!rijen[i][0]) continue;
    const code = String(rijen[i][3] || '').trim();
    if (!code) {
      rijen[i][3] = uniekeLeerlingCodeVanSet_(bestaande);
      gewijzigd = true;
    }
  }

  if (gewijzigd) bereik.setValues(rijen);
}
