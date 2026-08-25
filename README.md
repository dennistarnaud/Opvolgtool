# Opvolgtool

Een Google Apps Script-tool voor leerkrachten om taakopvolging van leerlingen bij te houden. Leerlingen en ouders kunnen hun eigen overzicht bekijken via een persoonlijke link — zonder login.

---

## Inhoud

- [Overzicht](#overzicht)
- [Eerste keer opzetten](#eerste-keer-opzetten)
- [De twee implementaties](#de-twee-implementaties)
- [Beveiliging en privacy](#beveiliging-en-privacy)
- [Na elke codewijziging](#na-elke-codewijziging)
- [Gebruik](#gebruik)

---

## Overzicht

De tool bestaat uit drie bestanden:

| Bestand | Rol |
|---|---|
| `Code.gs` | Server-side logica: data lezen/schrijven vanuit Google Sheets |
| `docent.html` | Docentscherm: kruistabel, leerlingfiche, taken, opvolging |
| `leerling.html` | Leerlingscherm: persoonlijk taakenoverzicht (anoniem, via code) |

Data wordt opgeslagen in een **gebonden Google Sheet** met vijf vaste tabbladen.

---

## Eerste keer opzetten

### 1. Google Sheet aanmaken

Maak een nieuwe Google Sheet en maak de volgende tabbladen aan met **exact** deze namen (hoofdlettergevoelig):

#### Tab `Leerlingen`

| Kolom | Naam | Toelichting |
|---|---|---|
| A | `id` | Unieke ID (bv. L001), tool vult automatisch in |
| B | `naam` | Volledige naam van de leerling |
| C | `klas` | Klasnaam (bv. 3A) |
| D | `code` | 8-tekens persoonlijke code — tool genereert automatisch |
| E | `geschraptIn` | Vorige klassen (komma-gescheiden), tool beheert zelf |
| F | `klasSinds` | Datum van klaswijziging, tool beheert zelf |
| G | `verwijderdOp` | Leeg = actief; gevuld = in de prullenbak |
| H | `opvolgingLeerlingOp` | Datum stap 1 opvolging, tool beheert zelf |
| I | `opvolgingOudersOp` | Datum stap 2 opvolging, tool beheert zelf |
| J | `opvolgingNablijfOp` | Datum stap 3 opvolging, tool beheert zelf |
| K | `opvolgingResetOp` | Datum reset opvolging, tool beheert zelf |
| L | `opvolgingGepauzeerd` | Datum pauze-modus (stap 4), tool beheert zelf |
| M | `opvolgingBlokkeerTaken` | Komma-gescheiden taak-IDs die de pauze blokkeren, tool beheert zelf |

Start met **alleen de koprij**. Leerlingen voeg je toe via het docentscherm.

#### Tab `Taken_Lijst`

| Kolom | Naam | Toelichting |
|---|---|---|
| A | `id` | Unieke ID (bv. T001), tool vult automatisch in |
| B | `naam` | Naam van de taak |
| C | `type` | Soort taak (zie toegestane types hieronder) |
| D | `deadline` | Datum in formaat `yyyy-mm-dd` |
| E | `klas` | Lege cel = geldt voor alle klassen; anders alleen voor die klas |

**Toegestane taaktypes:**
Huistaak, Lesopdracht, Agenda, Boekbespreking, Schriftelijke voorbereiding, Groepswerk WO, Remediëringstaak, Remediëringsopdracht, Bijles, Toets verbeteren, Examen inkijken, Niet-verplichte taak

Start met **alleen de koprij**. Taken maak je via het docentscherm.

#### Tab `Registraties`

| Kolom | Naam | Toelichting |
|---|---|---|
| A | `datumTijd` | Tijdstip van registratie, tool vult in |
| B | `llnId` | ID van de leerling |
| C | `taakId` | ID van de taak |
| D | `status` | In orde / Niet in orde / Afwezig / Te laat / Te maken / (leeg) |
| E | `opmerking` | Vrije tekst |
| F | `klas` | Klas op moment van registratie |

Start **leeg** (alleen koprij). Statussen komen automatisch uit de kruistabel.

#### Tab `Klassen`

| Kolom | Naam |
|---|---|
| A | `naam` |
| B | `vak` |

Kan leeg starten — tool voegt klassen toe zodra je die aanmaakt.

#### Tab `Instellingen`

| Kolom | Naam |
|---|---|
| A | `sleutel` |
| B | `waarde` |

Kan leeg starten — tool beheert de instellingen zelf.

---

### 2. Script koppelen

1. Open de Google Sheet
2. Ga naar **Uitbreidingen → Apps Script**
3. Verwijder de lege `Code.gs` en plak de inhoud van `Code.gs` uit dit project
4. Maak twee HTML-bestanden aan: `docent` en `leerling`, en plak de inhoud van respectievelijk `docent.html` en `leerling.html`

---

### 3. E-mailadressen instellen

Bovenaan `Code.gs`, vul je eigen e-mailadres (en dat van collega's) in:

```javascript
const TOEGANG_EMAIL_DOCENT = [
  'jij@school.be',
  'collega@school.be'
];
```

Kleine en hoofdletters maken niet uit.

---

### 4. De twee implementaties aanmaken

Zie het volgende hoofdstuk voor de gedetailleerde uitleg en motivatie.

---

## De twee implementaties

De tool heeft **twee aparte web app-implementaties** nodig: één voor docenten en één voor leerlingen/ouders. Ze draaien dezelfde code, maar met andere instellingen voor toegang en uitvoering.

### Waarom twee?

| | Docent-implementatie | Leerling-implementatie |
|---|---|---|
| **Doel** | Beheer: leerlingen, taken, registraties | Leerling/ouder: eigen taakstatus bekijken |
| **Login vereist?** | Ja — Google-account van de leerkracht | Nee — anoniem via persoonlijke code |
| **Wie kan het openen?** | Alleen e-mailadressen in de lijst | Iedereen met de juiste code-URL |

Een leerling of ouder heeft geen Google-account nodig. Daarom moet de leerlingimplementatie anoniem toegankelijk zijn. De docentimplementatie vereist een ingelogd Google-account zodat de e-mailcheck correct werkt.

---

### Implementatie A — Docent

**Stap voor stap:**

1. Ga in Apps Script naar **Implementeren → Implementaties beheren**
2. Klik op het **potloodpictogram** of maak een nieuwe implementatie aan
3. Kies als type: **Web-app**
4. Stel in:
   - **Uitvoeren als:** Gebruiker die de web-app opent
   - **Wie heeft toegang:** Iedereen met een Google-account
5. Klik op **Implementeren** en kopieer de URL

**Waarom deze instellingen?**

- *Uitvoeren als: Gebruiker die de web-app opent* — hierdoor weet de server welke Google-account de pagina bezoekt. Zo kan `Session.getActiveUser().getEmail()` het echte e-mailadres teruggeven en controleren of die persoon in `TOEGANG_EMAIL_DOCENT` staat.
- *Iedereen met een Google-account* — elke leerkracht moet kunnen inloggen met hun schoolaccount, ook al is het geen persoonlijk Gmail-adres.

**URL:**
```
https://script.google.com/macros/s/.../exec
```

---

### Implementatie B — Leerling

**Stap voor stap:**

1. Ga in Apps Script naar **Implementeren → Nieuwe implementatie**
2. Kies als type: **Web-app**
3. Stel in:
   - **Uitvoeren als:** Ik (eigenaar van het script)
   - **Wie heeft toegang:** Iedereen
4. Klik op **Implementeren** en kopieer de URL

**Waarom deze instellingen?**

- *Uitvoeren als: Ik (eigenaar)* — de tool draait met de rechten van de eigenaar op de Google Sheet. Bezoekers hoeven zelf geen toegang te hebben tot de Sheet.
- *Iedereen* — leerlingen en ouders zonder Google-account kunnen de pagina toch openen. De enige "sleutel" is de 8-tekens code in de URL.

**URL-formaat per leerling:**
```
https://script.google.com/macros/s/.../exec?id=AB2CD3EF
```

De code per leerling vind je in het docentscherm (leerlingfiche).

---

### Stap 5 — Leerling-URL registreren in de code

Na het aanmaken van implementatie B, kopieer je de volledige URL en vul je die in bovenaan `Code.gs`:

```javascript
const LEERLING_IMPLEMENTATIE_URL = 'https://script.google.com/macros/s/AKfy.../exec';
```

Publiceer daarna **beide implementaties opnieuw** als nieuwe versie. Dit zorgt ervoor dat de server docent-functies blokkeert als ze via de leerling-URL worden aangeroepen.

---

## Beveiliging en privacy

### Wie heeft toegang tot wat?

| Wie | Toegang |
|---|---|
| Leerkracht (e-mail in lijst) | Volledig docentscherm via implementatie A |
| Willekeurig iemand op internet | Niets — alle docent-functies blokkeren onbevoegde aanroepen |
| Leerling/ouder met de juiste link | Alleen hun eigen taakstatus (geen naam zichtbaar) |
| Leerling/ouder met verkeerde/geen code | Niets — foutpagina |

### Hoe is de leerlingpagina beveiligd?

De leerlingpagina toont geen naam — alleen taken en statussen van één specifieke leerling. Toegang vereist de 8-tekens code in de URL. Die code is uniek per leerling en wordt automatisch gegenereerd door de tool.

Deel de link alleen met de betrokken leerling en/of ouders. Wie de link heeft, kan de pagina bekijken — de code is het enige "slot".

### Server-side bescherming

Elke functie die leerling- of schooldata raadpleegt of aanpast, controleert automatisch of de aanroeper bevoegd is:

- Alle docent-functies (`getDocentData`, `saveLeerling`, `deleteTaak`, …) controleren het e-mailadres
- Als de aanroep via de leerling-implementatie-URL binnenkomt, wordt ze altijd geblokkeerd — ook als de eigenaar de aanroeper is
- De leerlingfunctie (`getLeerlingData`) vereist een geldige code

### GDPR

- De leerlingpagina voldoet aan dataminimalisatie: geen naam, alleen taakinformatie
- Opmerkingen bij taken kunnen persoonsgegevens bevatten — gebruik ze bewust
- Zorg dat de Google Sheet zelf nooit gedeeld wordt via "iedereen met de link"
- Registreer de tool in het verwerkingsregister van de school als verwerking van leerlinggegevens

---

## Na elke codewijziging

Wanneer je `Code.gs`, `docent.html` of `leerling.html` aanpast:

1. Ga naar **Implementeren → Implementaties beheren**
2. Klik op het potloodpictogram bij **elke** actieve implementatie
3. Kies bij "Versie": **Nieuwe versie**
4. Klik op **Opslaan**

De `/exec`-URL blijft hetzelfde. Ververs de pagina in de browser om de nieuwe versie te laden.

> Let op: een "Testimplementatie" (`/dev`) laadt altijd de laatste opgeslagen code, maar is alleen zichtbaar voor de eigenaar. Gebruik die voor testen; de `/exec`-URL is voor echt gebruik.

---

## Gebruik

### Docentscherm

- Open de docent-URL en log in met je schoolaccount
- Selecteer een klas via het keuzemenu
- **Kruistabel:** klik op een cel om de status van een taak te registreren
- **Leerlingfiche:** klik op een naam voor details, opvolging en de persoonlijke leerlinglink
- **Taken tabblad:** voeg taken toe, stel type en deadline in
- **Instellingen:** pas de opvolgingsdrempel en standaardberichten aan

### Leerlingscherm

- Elke leerling heeft een unieke URL (`?id=CODE`)
- De pagina toont alle taken en hun status voor die leerling
- Geen login vereist — de link zelf is de toegangssleutel
- Geschikt voor insluiting via `<iframe>` in een schoolplatform (Smartschool, Google Sites, …)

```html
<iframe
  src="https://script.google.com/macros/s/.../exec?id=AB2CD3EF"
  width="100%"
  height="600"
  frameborder="0">
</iframe>
```
