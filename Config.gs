/**
 * Config.gs — Eenmalige setup per implementatie
 *
 * Vul dit bestand één keer in voordat je de tool in gebruik neemt.
 * Daarna hoef je het (bijna) nooit meer aan te raken.
 *
 * Alle andere bestanden (Code.gs, LeerlingCodes.gs) laat je staan —
 * tenzij je bewust iets aan de werking van de tool wilt wijzigen.
 *
 * ---------------------------------------------------------------------------
 * WAT HOORT HIER
 *   - Emailadressen van docenten met toegang tot het docentscherm
 *   - URL van de leerling-implementatie (publieke web-app)
 *   - Spreadsheet-ID (enkel bij standalone script, anders leeg laten)
 *
 * WAT HOORT NIET HIER
 *   - Tabbladnamen, statuswaarden, drempels → die zitten in Code.gs
 *   - Opvolgberichten → aanpasbaar via de instellingen in het docentscherm
 * ---------------------------------------------------------------------------
 */

/**
 * Google-accounts die het DOCENTSCHERM mogen openen en bewerken.
 * Dit is geen lijst van wie het leerlingscherm mag zien: dat kan iedereen
 * met de persoonlijke leerlinglink, zonder login.
 * Kleine/hoofdletters maakt niet uit.
 *
 * Eén adres:
 *   const TOEGANG_EMAIL_DOCENT = ['jij@school.be'];
 *
 * Meerdere adressen:
 *   const TOEGANG_EMAIL_DOCENT = [
 *     'jij@school.be',
 *     'collega@school.be'
 *   ];
 */
const TOEGANG_EMAIL_DOCENT = [
  'emailadres1@school.be',
  'emailadres2@school.be'
];

/**
 * URL van de LEERLING-implementatie (de web-app met "Uitvoeren als: Ik" en "Iedereen").
 * Vul dit in na het aanmaken van die implementatie.
 *
 * Waartoe dient dit?
 *   - De docent-URL toont links en iframes naar deze URL.
 *   - Docent-functies worden op déze URL geblokkeerd (extra beveiliging).
 *
 * Voorbeeld:
 *   const LEERLING_IMPLEMENTATIE_URL = 'https://script.google.com/macros/s/AKfy.../exec';
 *
 * Nog niet aangemaakt? Laat leeg:
 *   const LEERLING_IMPLEMENTATIE_URL = '';
 */
const LEERLING_IMPLEMENTATIE_URL = '';

/**
 * Spreadsheet-ID van de gekoppelde Google Sheet.
 * Laat leeg ('') als dit een GEBONDEN script is (aangemaakt vanuit de spreadsheet zelf).
 * Vul in als het een STANDALONE script is dat je apart hebt aangemaakt.
 *
 * Je vindt het ID in de URL van de spreadsheet:
 *   https://docs.google.com/spreadsheets/d/[DIT_IS_HET_ID]/edit
 */
const SPREADSHEET_ID = '';
