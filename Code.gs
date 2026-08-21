/**
 * Opvolgtool — Google Apps Script backend
 * Spreadsheet-tabbladen: Leerlingen | Taken_Lijst | Registraties | Klassen | Instellingen
 *
 * Deployen als web-app:
 *  - Execute as: User accessing the web app  (nodig voor e-mailcheck docent)
 *  - Who has access: Anyone within the domain / Anyone
 *
 * URL's:
 *  - Docent:   .../exec?view=docent
 *  - Leerling: .../exec?id=A7X9A7X9
 */

// ---------------------------------------------------------------------------
// Instellingen
// ---------------------------------------------------------------------------

/** Pas dit aan naar het echte schoolaccount van de bevoegde leerkracht. */
const TOEGANG_EMAIL_DOCENT = 'jouw.email@school.be';

const TAB_LEERLINGEN = 'Leerlingen'; // kolommen: id | naam | klas | code | geschraptIn | klasSinds | verwijderdOp | opvolgingLeerlingOp | opvolgingOudersOp | opvolgingNablijfOp | opvolgingResetOp
const TAB_TAKEN = 'Taken_Lijst'; // kolommen: id | naam | type | deadline | klas
const TAB_REGISTRATIES = 'Registraties'; // kolommen: datumTijd | llnId | taakId | status | opmerking | klas
const TAB_KLASSEN = 'Klassen'; // kolommen: naam | vak
const TAB_INSTELLINGEN = 'Instellingen'; // kolommen: sleutel | waarde

const INST_OPVOLGING_AAN = 'opvolgingAan';
const INST_OPVOLGING_DREMPEL = 'opvolgingDrempel';
const INST_BERICHT_LEERLING = 'berichtLeerling';
const INST_BERICHT_OUDERS = 'berichtOuders';
const INST_BERICHT_NABLIJF = 'berichtNablijf';
const DEFAULT_OPVOLGING_AAN = true;
const DEFAULT_OPVOLGING_DREMPEL = 3;
const DREMPEL_MIN = 2;
const DREMPEL_MAX = 6;
const BERICHT_MAX = 4000;
const DEFAULT_BERICHT_LEERLING =
  'Hallo {voornaam},\n\n' +
  'Ik zie dat er meerdere opdrachten zijn die je nog in orde moet brengen:\n\n' +
  '{taken}\n\n' +
  'Omdat het intussen al {drempel} keer is dat een opdracht niet (of te laat) gemaakt werd, is het belangrijk dat we dit meteen rechttrekken.\n\n' +
  'Ik verwacht dan ook dat je deze lijst met opdrachten volledig afwerkt tegen de eerstvolgende les.\n\n' +
  'Om te vermijden dat we tijdens de les tijd verliezen aan de controle, vraag ik je om een duidelijke foto van al het gemaakte werk te uploaden in de uploadzone. Je doet dat in de uploadmap met als naam \'Opdrachten inhalen\'.\n\n' +
  'Ik reken erop dat dit tegen de volgende les volledig in orde is.\n\n' +
  'Met vriendelijke groeten';
const DEFAULT_BERICHT_OUDERS =
  'Beste ouders,\n\n' +
  'Via dit bericht wil ik u even op de hoogte brengen van de openstaande opdrachten van {voornaam}.\n\n' +
  'Hoewel ik {voornaam} hierover al persoonlijk heb aangesproken en er duidelijke afspraken zijn gemaakt, stelde ik vast dat de volgende opdrachten nog steeds niet zijn ingeleverd:\n\n' +
  '{taken}\n\n' +
  'Omdat we willen vermijden dat de achterstand groter wordt, vraag ik om dit samen met {voornaam} mee op te volgen en ervoor te zorgen dat deze opdrachten alsnog zo snel mogelijk afgewerkt worden. Zodra het werk klaar is, kan {voornaam} hiervan een duidelijke foto uploaden in de uploadmap \'Opdrachten inhalen\'.\n\n' +
  'U kunt de actuele status van alle taken, opdrachten en remediëringen overigens steeds zelf raadplegen via ons leerlingenvolgsysteem.\n\n' +
  'Alvast bedankt voor uw medewerking en ondersteuning thuis.\n\n' +
  'Met vriendelijke groeten,';
const DEFAULT_BERICHT_NABLIJF =
  'Onderwerp: Verplichte avondstudie openstaande opdrachten {voornaam}\n\n' +
  'Beste ouders,\n\n' +
  'Ondanks eerdere herinneringen en ons vorig contact over de openstaande schoolopdrachten, stelde ik vast dat {voornaam} de volgende taken nog steeds niet in orde heeft gebracht:\n\n' +
  '{taken}\n\n' +
  'Omdat het belangrijk is dat deze achterstand nu definitief wordt weggewerkt, is {voornaam} ingeschreven voor de avondstudie op {datum} van 16.00u tot 17.00u.\n\n' +
  'We verwachten dat {voornaam} daar aanwezig is, om onder toezicht aan deze opdrachten te werken en ze af te ronden. Gelieve ervoor te zorgen dat {voornaam} het nodige lesmateriaal meeneemt om zelfstandig aan de slag te kunnen.\n\n' +
  'Zodra alles is afgewerkt, kan het werk alsnog worden geüpload in de voorziene uploadmap \'Opdrachten inhalen\'. U kunt de opvolging hiervan blijven bekijken via het leerlingenvolgsysteem.\n\n' +
  'Bedankt voor uw medewerking.\n\n' +
  'Met vriendelijke groeten';
const OUD_BERICHT_LEERLING = [
  'Hallo {voornaam},\n\n' +
  'Je hebt nog taken die niet in orde zijn:\n' +
  '{taken}\n\n' +
  'Haal die in tegen de volgende les.\n\n' +
  'Dankjewel',
  'Hallo {voornaam},\n\n' +
  'Voor {klas} zijn er nog taken of afspraken die niet in orde zijn:\n\n' +
  '{taken}\n\n' +
  'Breng die tegen de volgende les in orde. Lukt dat niet of is iets onduidelijk, laat het me dan tijdig weten.\n\n' +
  'Dankjewel',
  'Hallo {voornaam},\n\n' +
  'Ik zie dat er meerdere taken zijn die je nog moet in orde brengen:\n\n' +
  '{taken}\n\n' +
  'Omdat het intussen al {drempel} keer is dat je met een opdracht niet in orde bent, is het belangrijk dat we dit meteen rechttrekken.\n\n' +
  'Ik verwacht dan ook dat je deze taken tegen de volgende les in orde brengt.\n\n' +
  'Heb je inhoudelijke vragen of loop je ergens vast? Spreek me dan vóór die tijd aan, zodat we samen kunnen kijken.\n\n' +
  'Met vriendelijke groeten',
  'Hallo {voornaam},\n\n' +
  'Ik zie dat er meerdere taken zijn die je nog moet in orde brengen:\n\n' +
  '{taken}\n\n' +
  'Omdat het intussen al {drempel} keer is dat je met een opdracht niet in orde bent, is het belangrijk dat we dit meteen rechttrekken.\n\n' +
  'Ik verwacht dan ook dat je deze taken tegen de volgende les in orde brengt.\n\n' +
  'Heb je inhoudelijke vragen of loop je ergens vast? Spreek me dan vóór die tijd aan, zodat we dit samen kunnen bekijken.\n\n' +
  'Met vriendelijke groeten'
];
const OUD_BERICHT_OUDERS = [
  'Beste ouder(s) van {naam},\n\n' +
  '{voornaam} heeft meerdere taken die niet in orde zijn:\n' +
  '{taken}\n\n' +
  'Ik heb {voornaam} gevraagd dit tegen de volgende les in te halen. Kan u dit thuis mee opvolgen?\n\n' +
  'Met vriendelijke groeten',
  'Beste ouder(s) van {naam},\n\n' +
  'Ik contacteer u over de opvolging van {voornaam} in {klas}. Er zijn al meermaals taken of afspraken niet in orde geweest. Op dit moment staan nog deze items open:\n\n' +
  '{taken}\n\n' +
  'Ik heb {voornaam} gevraagd om dit tegen de volgende les in te halen. Mag ik u vragen om dit thuis mee op te volgen?\n\n' +
  'Als er vragen zijn of omstandigheden waarvan ik best op de hoogte ben, hoor ik het graag.\n\n' +
  'Met vriendelijke groeten'
];
const OUD_BERICHT_NABLIJF = [
  'Beste ouder(s) van {naam},\n\n' +
  'De openstaande taken zijn nog niet in orde:\n' +
  '{taken}\n\n' +
  '{voornaam} wordt ingeschreven voor nablijfstudie om dit in te halen.\n\n' +
  'Met vriendelijke groeten',
  'Beste ouder(s) van {naam},\n\n' +
  'Ik contacteer u opnieuw over {voornaam} in {klas}. Ondanks de eerdere afspraak zijn de openstaande taken nog niet in orde:\n\n' +
  '{taken}\n\n' +
  '{voornaam} wordt daarom ingeschreven voor nablijfstudie, zodat dit werk daar kan worden ingehaald.\n\n' +
  'Hebt u vragen over deze stap, dan mag u me gerust contacteren.\n\n' +
  'Met vriendelijke groeten'
];

/**
 * Leeg laten als dit script aan de spreadsheet gekoppeld is (gebonden script).
 * Vul een ID in als het een standalone script is.
 */
const SPREADSHEET_ID = '';

const STATUS_IN_ORDE = 'In orde';
const STATUS_NIET_IN_ORDE = 'Niet in orde';
const STATUS_AFWEZIG = 'Afwezig';
const STATUS_TE_LAAT = 'Te laat';
const STATUS_TE_MAKEN = 'Te maken';
const TOEGESTANE_STATUSSEN = [STATUS_IN_ORDE, STATUS_NIET_IN_ORDE, STATUS_AFWEZIG, STATUS_TE_LAAT, STATUS_TE_MAKEN];
const TOEGESTANE_TAAKTYPES = [
  'Lesopdracht', 'Huistaak', 'Huiswerk', 'Bookwidgetsopdracht',
  'Schriftelijke voorbereiding', 'Remediëringstaak', 'Remediëringsopdracht',
  'Bijles', 'Toets verbeteren', 'Examen inkijken',
  'Niet-verplichte taak'
];

/** Letter-cijfer × 4 (8 tekens). Geen I/O/1/0, om verwarring te vermijden. */
const LEERLING_CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LEERLING_CODE_CIJFERS = '23456789';
const LEERLING_CODE_PAREN = 4;

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
 * @return {{leerlingen: Object[], taken: Object[], registraties: Object[], klassen: Object[], instellingen: Object, webAppUrl: string}}
 */
function getDocentData() {
  return metScriptLock_(function () {
    normaliseerLeerlingCodes_();
    synchroniseerKlassen_();
    zorgVoorOpvolgingKolommen_();
    return {
      leerlingen: leesLeerlingen_(),
      taken: leesTaken_().filter(function (taak) { return !isMateriaalTaak_(taak); }),
      registraties: leesRegistraties_(),
      klassen: leesKlassen_(),
      instellingen: leesInstellingen_(),
      webAppUrl: ScriptApp.getService().getUrl() || ''
    };
  });
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
      if (isMateriaalTaak_(taakById[reg.taakId])) return false;
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
        opmerking: reg.opmerking
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
 * @param {{llnId: string, taakId: string, status: string, opmerking?: string, klas?: string}} data
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

  return metScriptLock_(function () {
    normaliseerLeerlingCodes_();
    const leerlingen = leesLeerlingen_();
    const leerling = {
      id: volgendeId_(leerlingen, 'L'),
      naam: String(data.naam).trim(),
      klas: voegKlasToeAlsNieuw_(data.klas),
      code: uniekeLeerlingCode_(leerlingen),
      geschraptIn: [],
      klasSinds: '',
      verwijderdOp: '',
      opvolgingLeerlingOp: '',
      opvolgingOudersOp: '',
      opvolgingNablijfOp: '',
      opvolgingResetOp: ''
    };

    getSheet_(TAB_LEERLINGEN).appendRow([leerling.id, leerling.naam, leerling.klas, leerling.code, '', '', '', '', '', '', '']);

    return { ok: true, leerling: leerling };
  });
}

/**
 * Wijzigt de klas en/of naam van een bestaande leerling.
 * @param {{id: string, klas?: string, naam?: string, geschraptIn?: string[]|string, klasSinds?: string}} data
 * @return {{ok: boolean, leerling: Object}}
 */
function updateLeerling(data) {
  const id = String(data && data.id ? data.id : '').trim();
  const heeftNaam = data && data.naam !== undefined;
  const klas = data && data.klas !== undefined ? voegKlasToeAlsNieuw_(data.klas) : '';
  if (!id || (!heeftNaam && !klas)) {
    throw new Error('Id en klas of naam zijn verplicht.');
  }
  const naam = heeftNaam ? String(data.naam || '').trim() : '';
  if (heeftNaam && !naam) {
    throw new Error('Naam is verplicht.');
  }

  const sheet = getSheet_(TAB_LEERLINGEN);
  const rijen = sheet.getDataRange().getValues();
  for (let i = 1; i < rijen.length; i++) {
    if (String(rijen[i][0]).trim() !== id) continue;
    const leerling = leerlingVanRij_(rijen[i]);
    if (heeftNaam) {
      sheet.getRange(i + 1, 2).setValue(naam);
      leerling.naam = naam;
    }
    if (klas) {
      const vorigeKlas = String(rijen[i][2] || '').trim();
      const geschraptIn = normaliseerGeschraptIn_(data.geschraptIn);
      const klasSinds = String(data && data.klasSinds ? data.klasSinds : '').trim() || formatDatumTijd_(new Date());
      sheet.getRange(i + 1, 3).setValue(klas);
      sheet.getRange(i + 1, 5).setValue(geschraptIn.join(', '));
      sheet.getRange(i + 1, 6).setValue(klasSinds);
      if (vorigeKlas && vorigeKlas !== klas) {
        wijsOpenRegistratiesToeAanKlas_(id, vorigeKlas);
      }
      leerling.klas = klas;
      leerling.geschraptIn = geschraptIn;
      leerling.klasSinds = klasSinds;
    }
    return { ok: true, leerling: leerling };
  }
  throw new Error('Leerling niet gevonden.');
}

/**
 * Zet of wist een opvolgstap (leerling laten weten, ouders, nablijfstudie).
 * @param {{id: string, stap: string}} data stap: leerling | ouders | nablijf | reset
 * @return {{ok: boolean, leerling: Object}}
 */
function zetLeerlingOpvolging(data) {
  const id = String(data && data.id ? data.id : '').trim();
  const stap = String(data && data.stap ? data.stap : '').trim();
  if (!id) throw new Error('Id is verplicht.');
  if (stap !== 'reset' && stap !== 'leerling' && stap !== 'ouders' && stap !== 'nablijf') {
    throw new Error('Ongeldige opvolgstap.');
  }

  return metScriptLock_(function () {
    zorgVoorOpvolgingKolommen_();
    const sheet = getSheet_(TAB_LEERLINGEN);
    const rijen = sheet.getDataRange().getValues();
    for (let i = 1; i < rijen.length; i++) {
      if (String(rijen[i][0]).trim() !== id) continue;
      const leerling = leerlingVanRij_(rijen[i]);
      const gezet = {
        leerling: !!String(leerling.opvolgingLeerlingOp || '').trim(),
        ouders: !!String(leerling.opvolgingOudersOp || '').trim(),
        nablijf: !!String(leerling.opvolgingNablijfOp || '').trim()
      };
      const nu = formatDatumTijd_(new Date());
      if (stap === 'reset') {
        sheet.getRange(i + 1, 8, 1, 4).setValues([['', '', '', nu]]);
        leerling.opvolgingLeerlingOp = '';
        leerling.opvolgingOudersOp = '';
        leerling.opvolgingNablijfOp = '';
        leerling.opvolgingResetOp = nu;
      } else if (gezet[stap]) {
        if (stap === 'leerling') {
          sheet.getRange(i + 1, 8, 1, 3).setValues([['', '', '']]);
          leerling.opvolgingLeerlingOp = '';
          leerling.opvolgingOudersOp = '';
          leerling.opvolgingNablijfOp = '';
        } else if (stap === 'ouders') {
          sheet.getRange(i + 1, 9, 1, 2).setValues([['', '']]);
          leerling.opvolgingOudersOp = '';
          leerling.opvolgingNablijfOp = '';
        } else {
          sheet.getRange(i + 1, 10).setValue('');
          leerling.opvolgingNablijfOp = '';
        }
      } else {
        if (stap === 'ouders' && !gezet.leerling) {
          throw new Error('Eerst de leerling laten weten.');
        }
        if (stap === 'nablijf' && !gezet.ouders) {
          throw new Error('Eerst de ouders verwittigen.');
        }
        if (stap === 'leerling') {
          sheet.getRange(i + 1, 8).setValue(nu);
          leerling.opvolgingLeerlingOp = nu;
        } else if (stap === 'ouders') {
          sheet.getRange(i + 1, 9).setValue(nu);
          leerling.opvolgingOudersOp = nu;
        } else {
          sheet.getRange(i + 1, 10).setValue(nu);
          leerling.opvolgingNablijfOp = nu;
        }
      }
      return { ok: true, leerling: leerling };
    }
    throw new Error('Leerling niet gevonden.');
  });
}

/**
 * Bewaart docentinstellingen (opvolging aan/uit en drempel).
 * @param {{opvolgingAan?: boolean, opvolgingDrempel?: number}} data
 * @return {{ok: boolean, instellingen: Object}}
 */
function saveInstellingen(data) {
  return metScriptLock_(function () {
    const instellingen = normaliseerInstellingen_(data);
    const sheet = zorgVoorInstellingenTab_();
    zetInstellingRij_(sheet, INST_OPVOLGING_AAN, instellingen.opvolgingAan ? 'ja' : 'nee');
    zetInstellingRij_(sheet, INST_OPVOLGING_DREMPEL, instellingen.opvolgingDrempel);
    zetInstellingRij_(sheet, INST_BERICHT_LEERLING, instellingen.berichtLeerling);
    zetInstellingRij_(sheet, INST_BERICHT_OUDERS, instellingen.berichtOuders);
    zetInstellingRij_(sheet, INST_BERICHT_NABLIJF, instellingen.berichtNablijf);
    return { ok: true, instellingen: instellingen };
  });
}

/**
 * Voegt een taak toe aan tabblad Taken_Lijst.
 * Soort mag leeg blijven en later via updateTaak worden aangevuld.
 * @param {{naam: string, type?: string, deadline: string, klas?: string, klassen?: string[]}} data
 * @return {{ok: boolean, taak: Object, taken: Object[]}}
 */
function saveTaak(data) {
  if (!data || !String(data.naam || '').trim()) {
    throw new Error('Naam is verplicht.');
  }

  const type = normaliseerTaakType_(data.type);

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
 * Wijzigt naam, soort en/of datum van een bestaande taak.
 * Soort mag leeg zijn (later aanvullen).
 * @param {{id: string, naam?: string, type?: string, deadline?: string}} data
 * @return {{ok: boolean, taak: Object}}
 */
function updateTaak(data) {
  const id = String(data && data.id ? data.id : '').trim();
  if (!id) throw new Error('Id is verplicht.');

  const sheet = getSheet_(TAB_TAKEN);
  const rijen = sheet.getDataRange().getValues();
  for (let i = 1; i < rijen.length; i++) {
    if (String(rijen[i][0]).trim() !== id) continue;
    let naam = String(rijen[i][1] || '').trim();
    let type = String(rijen[i][2] || '').trim();
    let deadline = rijen[i][3];
    if (data.naam !== undefined) {
      naam = String(data.naam || '').trim();
      if (!naam) throw new Error('Naam is verplicht.');
      sheet.getRange(i + 1, 2).setValue(naam);
    }
    if (data.type !== undefined) {
      type = normaliseerTaakType_(data.type);
      sheet.getRange(i + 1, 3).setValue(type);
    }
    if (data.deadline !== undefined && String(data.deadline || '').trim()) {
      deadline = parseIsoDatum_(data.deadline);
      sheet.getRange(i + 1, 4).setValue(deadline);
    }
    return {
      ok: true,
      taak: {
        id: id,
        naam: naam,
        type: type,
        deadline: formatDatum_(deadline),
        klas: String(rijen[i][4] || '').trim()
      }
    };
  }
  throw new Error('Taak niet gevonden.');
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
 * Verwijdert alle leerlingen in de prullenbak, inclusief hun registraties.
 * @return {{ok: boolean, aantal: number}}
 */
function leegPrullenbak() {
  const weg = {};
  leesLeerlingen_().forEach(function (lln) {
    if (String(lln.verwijderdOp || '').trim()) weg[lln.id] = true;
  });
  const ids = Object.keys(weg);
  if (!ids.length) return { ok: true, aantal: 0 };

  vervangSheetZonderIds_(TAB_REGISTRATIES, 1, weg);
  vervangSheetZonderIds_(TAB_LEERLINGEN, 0, weg);
  return { ok: true, aantal: ids.length };
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

/**
 * Voegt een klas toe, altijd gekoppeld aan een vak.
 * Bestaande namen (hoofdletterongevoelig) blijven ongewijzigd; leeg vak wordt aangevuld.
 * @param {{naam: string, vak: string}|string} data
 * @return {{ok: boolean, klas: string, vak: string}}
 */
function saveKlas(data) {
  return metScriptLock_(function () {
    const naam = typeof data === 'string' ? data : (data && data.naam);
    const vak = typeof data === 'string' ? '' : (data && data.vak);
    const klas = normaliseerKlasnaam_(naam);
    const vakNaam = normaliseerVaknaam_(vak);
    if (!klas) throw new Error('Klasnaam is verplicht.');
    if (!vakNaam) throw new Error('Vak is verplicht.');
    voegKlasToeAlsNieuw_(klas, vakNaam);
    return { ok: true, klas: bestaandeKlasnaam_(klas) || klas, vak: vakNaam };
  });
}

/**
 * Verwijdert een klas, inclusief taken en registraties van die klas.
 * Weigert als er nog leerlingen (ook in de prullenbak) in die klas zitten.
 * @param {string} naam
 * @return {{ok: boolean, klas: string, taken: number}}
 */
function deleteKlas(naam) {
  return metScriptLock_(function () {
    const klas = bestaandeKlasnaam_(naam);
    if (!klas) throw new Error('Klas niet gevonden.');

    const bezet = [];
    leesLeerlingen_().forEach(function (lln) {
      if (String(lln.klas || '').trim() === klas) bezet.push(lln);
    });
    if (bezet.length) {
      throw new Error('Verplaats of verwijder eerst alle leerlingen van ' + klas + ' (ook in de prullenbak).');
    }

    const taakIds = {};
    let aantalTaken = 0;
    leesTaken_().forEach(function (taak) {
      if (String(taak.klas || '').trim() === klas) {
        taakIds[taak.id] = true;
        aantalTaken += 1;
      }
    });
    if (aantalTaken) vervangSheetZonderIds_(TAB_TAKEN, 0, taakIds);
    verwijderRegistratiesVoorKlas_(klas, taakIds);
    verwijderKlasUitGeschraptIn_(klas);
    verwijderKlasnaam_(klas);
    return { ok: true, klas: klas, taken: aantalTaken };
  });
}

// ---------------------------------------------------------------------------
// Sheet-helpers
// ---------------------------------------------------------------------------

function taakGeldtVoorKlas_(taak, klas) {
  if (!taak) return false;
  const taakKlas = String(taak.klas || '').trim();
  return !taakKlas || taakKlas === klas;
}

function isMateriaalTaak_(taak) {
  return String(taak && taak.type ? taak.type : '').trim() === 'Materiaal niet in orde';
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
  const bereik = sheet.getRange(2, 1, laatste - 1, 6);
  const rijen = bereik.getValues();
  let gewijzigd = false;
  for (let i = 0; i < rijen.length; i++) {
    if (String(rijen[i][1] || '').trim() !== llnId) continue;
    if (String(rijen[i][5] || '').trim()) continue;
    rijen[i][5] = klas;
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

function normaliseerKlasnaam_(naam) {
  return String(naam || '').trim().replace(/\s+/g, ' ').slice(0, 12);
}

function normaliseerVaknaam_(vak) {
  return String(vak || '').trim().replace(/\s+/g, ' ').slice(0, 32);
}

function klasNaamVan_(item) {
  if (!item) return '';
  if (typeof item === 'string') return normaliseerKlasnaam_(item);
  return normaliseerKlasnaam_(item.naam);
}

function normaliseerTaakType_(waarde) {
  const type = String(waarde || '').trim();
  if (!type) return '';
  if (TOEGESTANE_TAAKTYPES.indexOf(type) === -1) {
    throw new Error('Ongeldig taaktype.');
  }
  return type;
}

function zorgVoorKlassenTab_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(TAB_KLASSEN);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_KLASSEN, ss.getNumSheets());
    sheet.getRange(1, 1, 1, 2).setValues([['naam', 'vak']]);
    const namen = verzamelKlasnamenUitLeerlingen_();
    if (namen.length) {
      sheet.getRange(2, 1, namen.length, 2).setValues(namen.map(function (klas) { return [klas, '']; }));
    }
    return sheet;
  }
  if (String(sheet.getRange(1, 2).getValue() || '').trim().toLowerCase() !== 'vak') {
    sheet.getRange(1, 2).setValue('vak');
  }
  return sheet;
}

function zorgVoorOpvolgingKolommen_() {
  const sheet = getSheet_(TAB_LEERLINGEN);
  const last = Math.max(11, sheet.getLastColumn() || 1);
  const kop = sheet.getRange(1, 1, 1, last).getValues()[0];
  if (String(kop[7] || '').trim() === '') sheet.getRange(1, 8).setValue('opvolgingLeerlingOp');
  if (String(kop[8] || '').trim() === '') sheet.getRange(1, 9).setValue('opvolgingOudersOp');
  if (String(kop[9] || '').trim() === '') sheet.getRange(1, 10).setValue('opvolgingNablijfOp');
  if (String(kop[10] || '').trim() === '') sheet.getRange(1, 11).setValue('opvolgingResetOp');
}

function standaardInstellingen_() {
  return {
    opvolgingAan: DEFAULT_OPVOLGING_AAN,
    opvolgingDrempel: DEFAULT_OPVOLGING_DREMPEL,
    berichtLeerling: DEFAULT_BERICHT_LEERLING,
    berichtOuders: DEFAULT_BERICHT_OUDERS,
    berichtNablijf: DEFAULT_BERICHT_NABLIJF
  };
}

function isOudStandaardBericht_(waarde, oud) {
  const tekst = String(waarde == null ? '' : waarde).replace(/\r\n/g, '\n').trim();
  if (!tekst || oud == null || oud === '') return false;
  const lijst = Object.prototype.toString.call(oud) === '[object Array]' ? oud : [oud];
  for (let i = 0; i < lijst.length; i++) {
    if (tekst === String(lijst[i] || '').replace(/\r\n/g, '\n').trim()) return true;
  }
  return false;
}

function normaliseerBericht_(waarde, fallback, oud) {
  const tekst = String(waarde == null ? '' : waarde).replace(/\r\n/g, '\n');
  if (!tekst.trim() || isOudStandaardBericht_(tekst, oud)) return fallback;
  return tekst.length > BERICHT_MAX ? tekst.substring(0, BERICHT_MAX) : tekst;
}

function isJaNee_(waarde, fallback) {
  if (waarde === true || waarde === 1) return true;
  if (waarde === false || waarde === 0) return false;
  const s = String(waarde == null ? '' : waarde).trim().toLowerCase();
  if (!s) return fallback;
  if (s === 'ja' || s === 'true' || s === '1') return true;
  if (s === 'nee' || s === 'false' || s === '0') return false;
  return fallback;
}

function normaliseerInstellingen_(data) {
  const basis = standaardInstellingen_();
  const bron = data && typeof data === 'object' ? data : {};
  const drempel = parseInt(bron.opvolgingDrempel, 10);
  return {
    opvolgingAan: isJaNee_(bron.opvolgingAan, basis.opvolgingAan),
    opvolgingDrempel: (drempel >= DREMPEL_MIN && drempel <= DREMPEL_MAX)
      ? drempel
      : basis.opvolgingDrempel,
    berichtLeerling: normaliseerBericht_(bron.berichtLeerling, basis.berichtLeerling, OUD_BERICHT_LEERLING),
    berichtOuders: normaliseerBericht_(bron.berichtOuders, basis.berichtOuders, OUD_BERICHT_OUDERS),
    berichtNablijf: normaliseerBericht_(bron.berichtNablijf, basis.berichtNablijf, OUD_BERICHT_NABLIJF)
  };
}

function zorgVoorInstellingenTab_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(TAB_INSTELLINGEN);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_INSTELLINGEN, ss.getNumSheets());
    sheet.getRange(1, 1, 3, 2).setValues([
      ['sleutel', 'waarde'],
      [INST_OPVOLGING_AAN, DEFAULT_OPVOLGING_AAN ? 'ja' : 'nee'],
      [INST_OPVOLGING_DREMPEL, DEFAULT_OPVOLGING_DREMPEL]
    ]);
  } else if (String(sheet.getRange(1, 1).getValue() || '').trim() === '') {
    sheet.getRange(1, 1, 1, 2).setValues([['sleutel', 'waarde']]);
  }
  return sheet;
}

function leesInstellingen_() {
  const sheet = zorgVoorInstellingenTab_();
  const rijen = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < rijen.length; i++) {
    const sleutel = String(rijen[i][0] || '').trim();
    if (sleutel) map[sleutel] = rijen[i][1];
  }
  return normaliseerInstellingen_({
    opvolgingAan: map[INST_OPVOLGING_AAN],
    opvolgingDrempel: map[INST_OPVOLGING_DREMPEL],
    berichtLeerling: map[INST_BERICHT_LEERLING],
    berichtOuders: map[INST_BERICHT_OUDERS],
    berichtNablijf: map[INST_BERICHT_NABLIJF]
  });
}

function zetInstellingRij_(sheet, sleutel, waarde) {
  const last = Math.max(1, sheet.getLastRow());
  const rijen = sheet.getRange(1, 1, last, 1).getValues();
  for (let i = 1; i < rijen.length; i++) {
    if (String(rijen[i][0] || '').trim() === sleutel) {
      sheet.getRange(i + 1, 2).setValue(waarde);
      return;
    }
  }
  sheet.appendRow([sleutel, waarde]);
}

function verzamelKlasnamenUitLeerlingen_() {
  const set = {};
  leesLeerlingen_().forEach(function (lln) {
    const klas = normaliseerKlasnaam_(lln.klas);
    if (klas) set[klas] = true;
    const vorige = lln.geschraptIn || [];
    vorige.forEach(function (naam) {
      const item = normaliseerKlasnaam_(naam);
      if (item) set[item] = true;
    });
  });
  return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'nl'); });
}

function leesKlassen_() {
  zorgVoorKlassenTab_();
  const rijen = getSheet_(TAB_KLASSEN).getDataRange().getValues();
  const lijst = [];
  const gezien = {};
  for (let i = 1; i < rijen.length; i++) {
    const klas = normaliseerKlasnaam_(rijen[i][0]);
    if (!klas) continue;
    const sleutel = klas.toUpperCase();
    if (gezien[sleutel]) continue;
    gezien[sleutel] = true;
    lijst.push({ naam: klas, vak: normaliseerVaknaam_(rijen[i][1]) });
  }
  return lijst.sort(function (a, b) { return a.naam.localeCompare(b.naam, 'nl'); });
}

function schrijfKlassen_(klassen) {
  zorgVoorKlassenTab_();
  const uniek = [];
  const gezien = {};
  (klassen || []).forEach(function (item) {
    const klas = klasNaamVan_(item);
    if (!klas) return;
    const sleutel = klas.toUpperCase();
    if (gezien[sleutel]) return;
    gezien[sleutel] = true;
    const vak = typeof item === 'string' ? '' : normaliseerVaknaam_(item.vak);
    uniek.push({ naam: klas, vak: vak });
  });
  uniek.sort(function (a, b) { return a.naam.localeCompare(b.naam, 'nl'); });
  const sheet = getSheet_(TAB_KLASSEN);
  const laatste = Math.max(sheet.getLastRow(), 1);
  if (laatste > 1) sheet.getRange(2, 1, laatste - 1, 2).clearContent();
  if (uniek.length) {
    sheet.getRange(2, 1, uniek.length, 2).setValues(uniek.map(function (item) {
      return [item.naam, item.vak];
    }));
  }
  return uniek;
}

function synchroniseerKlassen_() {
  const lijst = leesKlassen_();
  const gezien = {};
  lijst.forEach(function (item) { gezien[item.naam.toUpperCase()] = true; });
  let extra = false;
  verzamelKlasnamenUitLeerlingen_().forEach(function (klas) {
    if (gezien[klas.toUpperCase()]) return;
    lijst.push({ naam: klas, vak: '' });
    gezien[klas.toUpperCase()] = true;
    extra = true;
  });
  if (extra) schrijfKlassen_(lijst);
}

function bestaandeKlasnaam_(naam) {
  const gezocht = normaliseerKlasnaam_(naam).toUpperCase();
  if (!gezocht) return '';
  const klassen = leesKlassen_();
  for (let i = 0; i < klassen.length; i++) {
    if (klassen[i].naam.toUpperCase() === gezocht) return klassen[i].naam;
  }
  const uitLeerlingen = verzamelKlasnamenUitLeerlingen_();
  for (let j = 0; j < uitLeerlingen.length; j++) {
    if (uitLeerlingen[j].toUpperCase() === gezocht) return uitLeerlingen[j];
  }
  return '';
}

function voegKlasToeAlsNieuw_(naam, vak) {
  const klas = normaliseerKlasnaam_(naam);
  if (!klas) return '';
  const vakNaam = normaliseerVaknaam_(vak);
  const lijst = leesKlassen_();
  for (let i = 0; i < lijst.length; i++) {
    if (lijst[i].naam.toUpperCase() === klas.toUpperCase()) {
      if (vakNaam && !lijst[i].vak) {
        lijst[i].vak = vakNaam;
        schrijfKlassen_(lijst);
      }
      return lijst[i].naam;
    }
  }
  const bestaand = bestaandeKlasnaam_(klas);
  lijst.push({ naam: bestaand || klas, vak: vakNaam });
  schrijfKlassen_(lijst);
  return bestaand || klas;
}

function verwijderKlasnaam_(naam) {
  const klas = bestaandeKlasnaam_(naam);
  if (!klas) return;
  schrijfKlassen_(leesKlassen_().filter(function (item) {
    return item.naam.toUpperCase() !== klas.toUpperCase();
  }));
}

function verwijderKlasUitGeschraptIn_(klas) {
  const doel = String(klas || '').trim();
  if (!doel) return;
  const sheet = getSheet_(TAB_LEERLINGEN);
  const bereik = sheet.getDataRange();
  const rijen = bereik.getValues();
  let gewijzigd = false;
  for (let i = 1; i < rijen.length; i++) {
    const lijst = parseLijst_(rijen[i][4]).filter(function (item) { return item !== doel; });
    const nieuw = lijst.join(', ');
    if (nieuw !== String(rijen[i][4] || '').trim()) {
      rijen[i][4] = nieuw;
      gewijzigd = true;
    }
  }
  if (gewijzigd) bereik.setValues(rijen);
}

function verwijderRegistratiesVoorKlas_(klas, taakIds) {
  const sheet = getSheet_(TAB_REGISTRATIES);
  const rijen = sheet.getDataRange().getValues();
  if (rijen.length < 2) return;
  const ids = taakIds || {};
  const over = [rijen[0]];
  for (let i = 1; i < rijen.length; i++) {
    const taakId = String(rijen[i][2] || '').trim();
    const regKlas = String(rijen[i][5] || '').trim();
    if (ids[taakId] || regKlas === klas) continue;
    over.push(rijen[i]);
  }
  if (over.length === rijen.length) return;
  const kolommen = rijen[0].length;
  sheet.getRange(1, 1, rijen.length, kolommen).clearContent();
  sheet.getRange(1, 1, over.length, over[0].length).setValues(over);
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
      klas: String(rij[5] || '').trim()
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
    verwijderdOp: formatDatumTijd_(rij[6]),
    opvolgingLeerlingOp: formatDatumTijd_(rij[7]),
    opvolgingOudersOp: formatDatumTijd_(rij[8]),
    opvolgingNablijfOp: formatDatumTijd_(rij[9]),
    opvolgingResetOp: formatDatumTijd_(rij[10])
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

function metScriptLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function leerlingCodeIsGeldig_(code) {
  const tekst = String(code || '').trim().toUpperCase();
  if (tekst.length !== LEERLING_CODE_PAREN * 2) return false;
  for (let i = 0; i < LEERLING_CODE_PAREN; i++) {
    if (LEERLING_CODE_LETTERS.indexOf(tekst.charAt(i * 2)) === -1) return false;
    if (LEERLING_CODE_CIJFERS.indexOf(tekst.charAt(i * 2 + 1)) === -1) return false;
  }
  return true;
}

function maakWillekeurigeLeerlingCode_() {
  let code = '';
  for (let i = 0; i < LEERLING_CODE_PAREN; i++) {
    code += LEERLING_CODE_LETTERS.charAt(Math.floor(Math.random() * LEERLING_CODE_LETTERS.length));
    code += LEERLING_CODE_CIJFERS.charAt(Math.floor(Math.random() * LEERLING_CODE_CIJFERS.length));
  }
  return code;
}

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

function uniekeLeerlingCode_(leerlingen) {
  const bestaande = {};
  leerlingen.forEach(function (lln) {
    const code = String(lln.code || '').trim().toUpperCase();
    if (code) bestaande[code] = true;
  });
  return uniekeLeerlingCodeVanSet_(bestaande);
}

/**
 * Zet korte of ongeldige codes om naar unieke 8-teken-codes.
 * Geldige unieke codes blijven staan. Dubbele geldige codes: de eerste blijft, de rest krijgt een nieuwe.
 */
function normaliseerLeerlingCodes_() {
  const sheet = getSheet_(TAB_LEERLINGEN);
  const bereik = sheet.getDataRange();
  const rijen = bereik.getValues();
  if (rijen.length < 2) return;

  const bestaande = {};
  const teVervangen = [];
  let gewijzigd = false;

  for (let i = 1; i < rijen.length; i++) {
    if (!rijen[i][0]) continue;
    const origineel = String(rijen[i][3] || '').trim();
    const code = origineel.toUpperCase();
    if (leerlingCodeIsGeldig_(code) && !bestaande[code]) {
      bestaande[code] = true;
      if (origineel !== code) {
        rijen[i][3] = code;
        gewijzigd = true;
      }
    } else {
      teVervangen.push(i);
    }
  }

  teVervangen.forEach(function (i) {
    rijen[i][3] = uniekeLeerlingCodeVanSet_(bestaande);
    gewijzigd = true;
  });

  if (gewijzigd) bereik.setValues(rijen);
}

function vervangSheetZonderIds_(sheetNaam, idKolom, idSet) {
  const sheet = getSheet_(sheetNaam);
  const rijen = sheet.getDataRange().getValues();
  if (rijen.length < 2) return;
  const over = [rijen[0]];
  for (let i = 1; i < rijen.length; i++) {
    const id = String(rijen[i][idKolom] || '').trim();
    if (!idSet[id]) over.push(rijen[i]);
  }
  if (over.length === rijen.length) return;
  const kolommen = rijen[0].length;
  sheet.getRange(1, 1, rijen.length, kolommen).clearContent();
  sheet.getRange(1, 1, over.length, over[0].length).setValues(over);
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
