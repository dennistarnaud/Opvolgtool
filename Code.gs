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

const TAB_LEERLINGEN = 'Leerlingen';
const TAB_TAKEN = 'Taken_Lijst';
const TAB_REGISTRATIES = 'Registraties';

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
    .setTitle('Opvolgtool — Leerling')
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
  const taakNaamById = {};
  taken.forEach(function (taak) {
    taakNaamById[taak.id] = taak.naam;
  });

  const registraties = leesRegistraties_()
    .filter(function (reg) {
      return reg.llnId === leerling.id;
    })
    .map(function (reg) {
      return {
        datumTijd: reg.datumTijd,
        taakId: reg.taakId,
        taakNaam: taakNaamById[reg.taakId] || reg.taakId,
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
 * @param {{llnId: string, taakId: string, status: string, opmerking?: string, uploadUrl?: string}} data
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

  const sheet = getSheet_(TAB_REGISTRATIES);
  const nu = new Date();
  const rij = [
    nu,
    String(data.llnId).trim(),
    String(data.taakId).trim(),
    status,
    String(data.opmerking || ''),
    String(data.uploadUrl || '')
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
      uploadUrl: rij[5]
    }
  };
}

// ---------------------------------------------------------------------------
// Sheet-helpers
// ---------------------------------------------------------------------------

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
    resultaat.push({
      id: String(rij[0]).trim(),
      naam: String(rij[1] || '').trim(),
      klas: String(rij[2] || '').trim(),
      code: String(rij[3] || '').trim()
    });
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
      deadline: formatDatum_(rij[3])
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
      uploadUrl: String(rij[5] || '').trim()
    });
  }
  return resultaat;
}

function zoekLeerlingOpCode_(code) {
  const gezocht = String(code || '').trim().toUpperCase();
  if (!gezocht) return null;
  const leerlingen = leesLeerlingen_();
  for (let i = 0; i < leerlingen.length; i++) {
    if (String(leerlingen[i].code).trim().toUpperCase() === gezocht) {
      return leerlingen[i];
    }
  }
  return null;
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
