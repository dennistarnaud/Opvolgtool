/**
 * Opvolgtool — Google Apps Script backend
 * Spreadsheet-tabbladen: Leerlingen | Taken_Lijst | Registraties
 *
 * Deployen als web-app:
 *  - Execute as: User accessing the web app  (nodig voor e-mailcheck docent)
 *  - Who has access: Anyone within the domain / Anyone
 *
 * URL's:
 *  - Docent:   .../exec?view=docent
 *  - Leerling: .../exec?id=A7X9
 */

// ---------------------------------------------------------------------------
// Instellingen
// ---------------------------------------------------------------------------

/** Pas dit aan naar het echte schoolaccount van de bevoegde leerkracht. */
const TOEGANG_EMAIL_DOCENT = 'jouw.email@school.be';

const TAB_LEERLINGEN = 'Leerlingen'; // kolommen: id | naam | klas | code | geschraptIn | klasSinds | verwijderdOp
const TAB_TAKEN = 'Taken_Lijst'; // kolommen: id | naam | type | deadline | klas
const TAB_REGISTRATIES = 'Registraties'; // kolommen: datumTijd | llnId | taakId | status | opmerking | uploadUrl | klas

/**
 * Leeg laten als dit script aan de spreadsheet gekoppeld is (gebonden script).
 * Vul een ID in als het een standalone script is.
 */
const SPREADSHEET_ID = '';

const STATUS_IN_ORDE = 'In orde';
const STATUS_NIET_IN_ORDE = 'Niet in orde';
const STATUS_AFWEZIG = 'Afwezig';
const STATUS_TE_MAKEN = 'Te maken';
const TOEGESTANE_STATUSSEN = [STATUS_IN_ORDE, STATUS_NIET_IN_ORDE, STATUS_AFWEZIG, STATUS_TE_MAKEN];

// ---------------------------------------------------------------------------
// Web-app entry
// ---------------------------------------------------------------------------

/**
 * Serveert de juiste HTML-pagina op basis van queryparameters.
 * @param {Object} e Event van de web-app (e.parameter.view / e.parameter.id)
 */
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const view = String(params.view || '').trim().toLowerCase();
  const geheimeCode = String(params.id || '').trim();

  if (view === 'docent') {
    return serveerDocentPagina_();
  }

  if (geheimeCode) {
    return serveerLeerlingPagina_(geheimeCode);
  }

  return htmlFout_(
    'Ontbrekende parameter',
    'Gebruik ?view=docent voor het leerkrachtenscherm of ?id=JOUWCODE voor het leerlingenscherm.'
  );
}

/**
 * Controleert het actieve Google-account en serveert docent.html.
 */
function serveerDocentPagina_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const toegestaan = TOEGANG_EMAIL_DOCENT.trim().toLowerCase();

  if (!email || email !== toegestaan) {
    return htmlFout_(
      'Geen toegang',
      'Dit scherm is alleen beschikbaar voor de bevoegde leerkracht.'
    );
  }

  return HtmlService.createHtmlOutputFromFile('docent')
    .setTitle('Opvolgtool — Docent')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Zoekt de leerling via Geheime_Code en serveert leerling.html met JSON-payload.
 */
function serveerLeerlingPagina_(code) {
  const leerling = zoekLeerlingOpCode_(code);
  if (!leerling) {
    return htmlFout_(
      'Ongeldige code',
      'Er is geen leerling gekoppeld aan deze link. Vraag een nieuwe code aan je leerkracht.'
    );
  }

  const payload = getLeerlingData(code);
  const template = HtmlService.createTemplateFromFile('leerling');
  template.leerlingJson = JSON.stringify(payload);

  return template.evaluate()
    .setTitle('Opvolging leerkansen')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------------------------------------------------------------------------
// Publieke API voor google.script.run
// ---------------------------------------------------------------------------

/**
 * Volledige dataset voor het docentenscherm.
 * @return {{leerlingen: Object[], taken: Object[], registraties: Object[]}}
 */
function getDocentData() {
  return {
    leerlingen: leesLeerlingen_(),
    taken: leesTaken_(),
    registraties: leesRegistraties_()
  };
}

/**
 * Leerling-specifieke data (zonder naam) voor het iframe.
 * @param {string} code Geheime_Code uit de URL
 * @return {Object}
 */
function getLeerlingData(code) {
  const leerling = zoekLeerlingOpCode_(code);
  if (!leerling) {
    throw new Error('Onbekende leerlingcode.');
  }

  const taken = leesTaken_();
  const taakById = {};
  taken.forEach(function (taak) {
    taakById[taak.id] = taak;
  });

  const klas = String(leerling.klas || '').trim();
  const registraties = leesRegistraties_()
    .filter(function (reg) {
      if (reg.llnId !== leerling.id) return false;
      if (!taakGeldtVoorKlas_(taakById[reg.taakId], klas)) return false;
      return registratieKlas_(reg, leerling) === klas;
    })
    .map(function (reg) {
      const taak = taakById[reg.taakId];
      return {
        datumTijd: reg.datumTijd,
        taakId: reg.taakId,
        taakNaam: (taak && taak.naam) ? taak.naam : reg.taakId,
        type: (taak && taak.type) ? taak.type : '',
        deadline: (taak && taak.deadline) ? taak.deadline : '',
        status: reg.status,
        opmerking: reg.opmerking,
        uploadUrl: reg.uploadUrl
      };
    })
    .sort(function (a, b) {
      return String(b.datumTijd).localeCompare(String(a.datumTijd));
    });

  return {
    code: leerling.code,
    llnId: leerling.id,
    klas: leerling.klas,
    registraties: registraties
  };
}

/**
 * Schrijft een nieuwe rij naar tabblad Registraties.
 * @param {{llnId: string, taakId: string, status: string, opmerking?: string, uploadUrl?: string, klas?: string}} data
 * @return {{ok: boolean, registratie: Object}}
 */
function saveRegistratie(data) {
  if (!data || !data.llnId || !data.taakId) {
    throw new Error('Ontbrekende velden: llnId en taakId zijn verplicht.');
  }

  const status = String(data.status == null ? '' : data.status).trim();
  if (status && TOEGESTANE_STATUSSEN.indexOf(status) === -1) {
    throw new Error('Ongeldige status. Gebruik: ' + TOEGESTANE_STATUSSEN.join(', ') + ' (of leeg).');
  }

  const klas = String(data.klas || '').trim();
  const sheet = getSheet_(TAB_REGISTRATIES);
  const nu = new Date();
  const rij = [
    nu,
    String(data.llnId).trim(),
    String(data.taakId).trim(),
    status,
    String(data.opmerking || ''),
    String(data.uploadUrl || ''),
    klas
  ];

  sheet.appendRow(rij);

  return {
    ok: true,
    registratie: {
      datumTijd: formatDatumTijd_(nu),
      llnId: rij[1],
      taakId: rij[2],
      status: rij[3],
      opmerking: rij[4],
      uploadUrl: rij[5],
      klas: klas
    }
  };
}

/**
 * Voegt een leerling toe aan tabblad Leerlingen.
 * @param {{naam: string, klas: string}} data
 * @return {{ok: boolean, leerling: Object}}
 */
function saveLeerling(data) {
  if (!data || !String(data.naam || '').trim() || !String(data.klas || '').trim()) {
    throw new Error('Naam en klas zijn verplicht.');
  }

  const leerlingen = leesLeerlingen_();
  const leerling = {
    id: volgendeId_(leerlingen, 'L'),
    naam: String(data.naam).trim(),
    klas: String(data.klas).trim(),
    code: uniekeLeerlingCode_(leerlingen),
    geschraptIn: [],
    klasSinds: '',
    verwijderdOp: ''
  };

  getSheet_(TAB_LEERLINGEN).appendRow([leerling.id, leerling.naam, leerling.klas, leerling.code, '', '', '']);

  return { ok: true, leerling: leerling };
}

/**
 * Wijzigt de klas van een bestaande leerling.
 * @param {{id: string, klas: string, geschraptIn?: string[]|string, klasSinds?: string}} data
 * @return {{ok: boolean, leerling: Object}}
 */
function updateLeerling(data) {
  const id = String(data && data.id ? data.id : '').trim();
  const klas = String(data && data.klas ? data.klas : '').trim();
  if (!id || !klas) {
    throw new Error('Id en klas zijn verplicht.');
  }

  const geschraptIn = normaliseerGeschraptIn_(data.geschraptIn);
  const klasSinds = String(data && data.klasSinds ? data.klasSinds : '').trim() || formatDatumTijd_(new Date());
  const sheet = getSheet_(TAB_LEERLINGEN);
  const rijen = sheet.getDataRange().getValues();
  for (let i = 1; i < rijen.length; i++) {
    if (String(rijen[i][0]).trim() !== id) continue;
    const vorigeKlas = String(rijen[i][2] || '').trim();
    sheet.getRange(i + 1, 3).setValue(klas);
    sheet.getRange(i + 1, 5).setValue(geschraptIn.join(', '));
    sheet.getRange(i + 1, 6).setValue(klasSinds);
    if (vorigeKlas && vorigeKlas !== klas) {
      wijsOpenRegistratiesToeAanKlas_(id, vorigeKlas);
    }
    const leerling = leerlingVanRij_(rijen[i]);
    leerling.klas = klas;
    leerling.geschraptIn = geschraptIn;
    leerling.klasSinds = klasSinds;
    return { ok: true, leerling: leerling };
  }
  throw new Error('Leerling niet gevonden.');
}

/**
 * Voegt een taak toe aan tabblad Taken_Lijst.
 * @param {{naam: string, type: string, deadline: string}} data
 * @return {{ok: boolean, taak: Object}}
 */
function saveTaak(data) {
  if (!data || !String(data.naam || '').trim() || !String(data.type || '').trim()) {
    throw new Error('Naam en type zijn verplicht.');
  }

  const toegestaneTypes = [
    'Lesopdracht', 'Huistaak', 'Huiswerk', 'Bookwidgetsopdracht',
    'Schriftelijke voorbereiding', 'Remediëringstaak', 'Remediëringsopdracht',
    'Bijles', 'Toets verbeteren', 'Examen inkijken',
    'Materiaal niet in orde', 'Niet-verplichte taak'
  ];
  const type = String(data.type).trim();
  if (toegestaneTypes.indexOf(type) === -1) {
    throw new Error('Ongeldig taaktype.');
  }

  let klassen = [];
  if (data.klassen && data.klassen.length) {
    data.klassen.forEach(function (klas) {
      const naam = String(klas || '').trim();
      if (naam && klassen.indexOf(naam) === -1) klassen.push(naam);
    });
  } else if (data.klas) {
    klassen = [String(data.klas).trim()];
  }
  if (!klassen.length) {
    throw new Error('Klas is verplicht.');
  }

  const bestaande = leesTaken_();
  const gemaakt = [];
  const deadline = parseIsoDatum_(data.deadline);
  klassen.forEach(function (klas) {
    const taak = {
      id: volgendeId_(bestaande.concat(gemaakt), 'T'),
      naam: String(data.naam).trim(),
      type: type,
      deadline: formatDatum_(deadline),
      klas: klas
    };
    gemaakt.push(taak);
  });

  const sheet = getSheet_(TAB_TAKEN);
  const start = sheet.getLastRow() + 1;
  const rijen = gemaakt.map(function (taak) {
    return [taak.id, taak.naam, taak.type, deadline, taak.klas];
  });
  sheet.getRange(start, 1, rijen.length, 5).setValues(rijen);

  return { ok: true, taken: gemaakt, taak: gemaakt[0] };
}

/**
 * Zet een leerling in de prullenbak. Registraties blijven bewaard.
 * @param {string} id
 * @return {{ok: boolean, leerling: Object}}
 */
function deleteLeerling(id) {
  return zetLeerlingVerwijderd_(id, formatDatumTijd_(new Date()));
}

/**
 * Zet een leerling uit de prullenbak terug in de klas, met voortgang.
 * @param {string} id
 * @return {{ok: boolean, leerling: Object}}
 */
function herstelLeerling(id) {
  return zetLeerlingVerwijderd_(id, '');
}

/**
 * Verwijdert een taak en bijhorende registraties.
 * @param {string} id
 * @return {{ok: boolean, id: string}}
 */
function deleteTaak(id) {
  const taakId = String(id || '').trim();
  if (!taakId) throw new Error('Ontbrekend taak-id.');
  if (!verwijderRijOpId_(TAB_TAKEN, taakId)) {
    throw new Error('Taak niet gevonden.');
  }
  verwijderRegistratiesOpKolom_(2, taakId);
  return { ok: true, id: taakId };
}

// ---------------------------------------------------------------------------
// Sheet-helpers
// ---------------------------------------------------------------------------

function taakGeldtVoorKlas_(taak, klas) {
  if (!taak) return false;
  const taakKlas = String(taak.klas || '').trim();
  return !taakKlas || taakKlas === klas;
}

/** Oude rijen zonder klas blijven bij de klas waar de leerling ze haalde. */
function registratieKlas_(reg, leerling) {
  const klas = String(reg && reg.klas ? reg.klas : '').trim();
  if (klas) return klas;
  const sinds = String(leerling && leerling.klasSinds ? leerling.klasSinds : '').trim();
  if (sinds && String(reg && reg.datumTijd ? reg.datumTijd : '') < sinds) {
    const vorige = (leerling && leerling.geschraptIn) ? leerling.geschraptIn : [];
    return vorige.length ? String(vorige[vorige.length - 1] || '').trim() : '';
  }
  return String(leerling && leerling.klas ? leerling.klas : '').trim();
}

function wijsOpenRegistratiesToeAanKlas_(llnId, klas) {
  const sheet = getSheet_(TAB_REGISTRATIES);
  const laatste = sheet.getLastRow();
  if (laatste < 2) return;
  const bereik = sheet.getRange(2, 1, laatste - 1, 7);
  const rijen = bereik.getValues();
  let gewijzigd = false;
  for (let i = 0; i < rijen.length; i++) {
    if (String(rijen[i][1] || '').trim() !== llnId) continue;
    if (String(rijen[i][6] || '').trim()) continue;
    rijen[i][6] = klas;
    gewijzigd = true;
  }
  if (gewijzigd) bereik.setValues(rijen);
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  const actief = SpreadsheetApp.getActiveSpreadsheet();
  if (!actief) {
    throw new Error('Geen spreadsheet gevonden. Koppel het script of vul SPREADSHEET_ID in.');
  }
  return actief;
}

function getSheet_(naam) {
  const sheet = getSpreadsheet_().getSheetByName(naam);
  if (!sheet) {
    throw new Error('Tabblad "' + naam + '" ontbreekt in de spreadsheet.');
  }
  return sheet;
}

function leesLeerlingen_() {
  const rijen = getSheet_(TAB_LEERLINGEN).getDataRange().getValues();
  const resultaat = [];
  for (let i = 1; i < rijen.length; i++) {
    const rij = rijen[i];
    if (!rij[0]) continue;
    resultaat.push(leerlingVanRij_(rij));
  }
  return resultaat;
}

function leesTaken_() {
  const rijen = getSheet_(TAB_TAKEN).getDataRange().getValues();
  const resultaat = [];
  for (let i = 1; i < rijen.length; i++) {
    const rij = rijen[i];
    if (!rij[0]) continue;
    resultaat.push({
      id: String(rij[0]).trim(),
      naam: String(rij[1] || '').trim(),
      type: String(rij[2] || '').trim(),
      deadline: formatDatum_(rij[3]),
      klas: String(rij[4] || '').trim()
    });
  }
  return resultaat;
}

function leesRegistraties_() {
  const rijen = getSheet_(TAB_REGISTRATIES).getDataRange().getValues();
  const resultaat = [];
  for (let i = 1; i < rijen.length; i++) {
    const rij = rijen[i];
    if (!rij[0] && !rij[1]) continue;
    resultaat.push({
      datumTijd: formatDatumTijd_(rij[0]),
      llnId: String(rij[1] || '').trim(),
      taakId: String(rij[2] || '').trim(),
      status: String(rij[3] || '').trim(),
      opmerking: String(rij[4] || '').trim(),
      uploadUrl: String(rij[5] || '').trim(),
      klas: String(rij[6] || '').trim()
    });
  }
  return resultaat;
}

function leerlingVanRij_(rij) {
  return {
    id: String(rij[0] || '').trim(),
    naam: String(rij[1] || '').trim(),
    klas: String(rij[2] || '').trim(),
    code: String(rij[3] || '').trim(),
    geschraptIn: parseLijst_(rij[4]),
    klasSinds: formatDatumTijd_(rij[5]),
    verwijderdOp: formatDatumTijd_(rij[6])
  };
}

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

function zetLeerlingVerwijderd_(id, verwijderdOp) {
  const llnId = String(id || '').trim();
  if (!llnId) throw new Error('Ontbrekend leerling-id.');
  const sheet = getSheet_(TAB_LEERLINGEN);
  const rijen = sheet.getDataRange().getValues();
  for (let i = 1; i < rijen.length; i++) {
    if (String(rijen[i][0]).trim() !== llnId) continue;
    sheet.getRange(i + 1, 7).setValue(verwijderdOp);
    const leerling = leerlingVanRij_(rijen[i]);
    leerling.verwijderdOp = verwijderdOp;
    return { ok: true, leerling: leerling };
  }
  throw new Error('Leerling niet gevonden.');
}

function formatDatumTijd_(waarde) {
  if (waarde instanceof Date && !isNaN(waarde.getTime())) {
    return Utilities.formatDate(waarde, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  return String(waarde || '');
}

function formatDatum_(waarde) {
  if (waarde instanceof Date && !isNaN(waarde.getTime())) {
    return Utilities.formatDate(waarde, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(waarde || '');
}

function parseIsoDatum_(waarde) {
  const m = String(waarde || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function parseLijst_(waarde) {
  return String(waarde || '').split(/[,;]/).map(function (item) {
    return String(item).trim();
  }).filter(Boolean);
}

function normaliseerGeschraptIn_(waarde) {
  if (!waarde) return [];
  if (Object.prototype.toString.call(waarde) === '[object Array]') {
    return waarde.map(function (item) { return String(item || '').trim(); }).filter(Boolean);
  }
  return parseLijst_(waarde);
}

function volgendeId_(lijst, prefix) {
  let max = 0;
  lijst.forEach(function (item) {
    const match = String(item.id || '').match(new RegExp('^' + prefix + '(\\d+)$', 'i'));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  return prefix + String(max + 1).padStart(3, '0');
}

function uniekeLeerlingCode_(leerlingen) {
  const bestaande = {};
  leerlingen.forEach(function (lln) {
    bestaande[String(lln.code || '').toUpperCase()] = true;
  });
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const cijfers = '23456789';
  for (let i = 0; i < 80; i++) {
    const code = letters.charAt(Math.floor(Math.random() * letters.length)) +
      cijfers.charAt(Math.floor(Math.random() * cijfers.length)) +
      letters.charAt(Math.floor(Math.random() * letters.length)) +
      cijfers.charAt(Math.floor(Math.random() * cijfers.length));
    if (!bestaande[code]) return code;
  }
  throw new Error('Kon geen unieke leerlingcode genereren.');
}

function verwijderRijOpId_(sheetNaam, id) {
  const sheet = getSheet_(sheetNaam);
  const rijen = sheet.getDataRange().getValues();
  const gezocht = String(id || '').trim();
  for (let i = 1; i < rijen.length; i++) {
    if (String(rijen[i][0]).trim() === gezocht) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function verwijderRegistratiesOpKolom_(kolomIndex, id) {
  const sheet = getSheet_(TAB_REGISTRATIES);
  const rijen = sheet.getDataRange().getValues();
  const gezocht = String(id || '').trim();
  for (let i = rijen.length - 1; i >= 1; i--) {
    if (String(rijen[i][kolomIndex] || '').trim() === gezocht) {
      sheet.deleteRow(i + 1);
    }
  }
}

function htmlFout_(titel, bericht) {
  const html =
    '<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + titel + '</title>' +
    '<style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;' +
    'display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}' +
    '.kaart{max-width:28rem;background:#fff;border:1px solid #e2e8f0;border-radius:1rem;' +
    'padding:1.5rem;box-shadow:0 10px 30px rgb(15 23 42 / 8%)}' +
    'h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:0;color:#475569;line-height:1.5}</style>' +
    '</head><body><div class="kaart"><h1>' + titel + '</h1><p>' + bericht + '</p></div></body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle(titel)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
