# Opvolgtool

Een tool voor leerkrachten om bij te houden welke taken (leerkansen) leerlingen kregen en hoe die zijn afgerond. Leerlingen en ouders zien hun eigen overzicht via een persoonlijke link — zonder inloggen en zonder naam.

Alles wat je dagelijks doet, gebeurt in het **docentscherm** (een webpagina). De Google Sheet is alleen de opslag op de achtergrond. Daar typ je geen leerlingen, taken of statussen in.

---

## Inhoud

- [Wat doet de tool?](#wat-doet-de-tool)
- [Eerste keer opzetten](#eerste-keer-opzetten)
- [De twee implementaties](#de-twee-implementaties)
- [Beveiliging en privacy](#beveiliging-en-privacy)
- [Na elke codewijziging](#na-elke-codewijziging)
- [Dagelijks gebruik](#dagelijks-gebruik)

---

## Wat doet de tool?

**Als leerkracht** open je het docentscherm. Daar kies je een klas en zie je een kruistabel: leerlingen × taken. Je vult per cel in of iets in orde is, te laat, nog te maken, enzovoort. Via de leerlingfiche (klik op een naam) zie je hetzelfde overzicht als de leerling, plus de persoonlijke link.

**Als leerling of ouder** open je een unieke link (of een iframe in Smartschool). Je ziet alleen de taken en statussen van die ene leerling, zonder naam. Iedereen met die link kan de pagina bekijken — daarvoor hoef je niet in een e-maillijst te staan.

Data staat in een Google Sheet die aan het script hangt. De tool schrijft zelf in die Sheet. Jij werkt in de webpagina.

---

## Eerste keer opzetten

### 1. Google Sheet aanmaken (alleen de structuur)

Maak een nieuwe Google Sheet. Voeg vijf tabbladen toe met **exact** deze namen (hoofdlettergevoelig):

| Tabblad | Wat de tool erin bewaart |
|---|---|
| `Leerlingen` | Namen, klas, persoonlijke code, opvolging |
| `Taken_Lijst` | Taken (naam, soort, deadline, klas) |
| `Registraties` | Status per leerling per taak |
| `Klassen` | Klassen en vak |
| `Instellingen` | Drempel, berichten, periodes |

**Rij 1** van elk tabblad krijgt alleen koppen. De volgorde van de kolommen is verplicht (de code leest op positie, niet op de tekst van de kop). Typ daaronder **niets**. Geen leerlingen, geen taken, geen voorbeelden.

| Tabblad | Koppen in rij 1, van links naar rechts |
|---|---|
| `Leerlingen` | `id` · `naam` · `klas` · `code` · `geschraptIn` · `klasSinds` · `verwijderdOp` · `opvolgingLeerlingOp` · `opvolgingOudersOp` · `opvolgingNablijfOp` · `opvolgingResetOp` · `opvolgingGepauzeerd` · `opvolgingBlokkeerTaken` · `volgorde` |
| `Taken_Lijst` | `id` · `naam` · `type` · `deadline` · `klas` |
| `Registraties` | `datumTijd` · `llnId` · `taakId` · `status` · `opmerking` · `klas` |
| `Klassen` | `naam` · `vak` |
| `Instellingen` | `sleutel` · `waarde` |

Klaar. Vanaf hier vult de tool de rijen zelf. Leerlingen, taken en statussen voeg je later toe in het docentscherm.

Deel de Sheet **niet** via “iedereen met de link”. Alleen wie het script beheert (en eventueel een collega-beheerder) heeft de Sheet nodig.

---

### 2. Script koppelen

1. Open de Sheet → **Uitbreidingen → Apps Script**
2. Verwijder de lege `Code.gs` en plak de inhoud uit dit project
3. Voeg ook `Config.gs` en `LeerlingCodes.gs` toe (zelfde namen)
4. Maak deze HTML-bestanden aan. In de editor is de naam **zonder** `.html`. Plak de inhoud uit het gelijknamige bestand in dit project:
   `docent`, `docent-kern`, `docent-opvolging`, `docent-kruis`, `docent-ui`, `leerling`

---

### 3. Wie mag het docentscherm bewerken?

Dit is **alleen** voor het docentscherm: wie leerlingen, taken en statussen mag wijzigen.

Het leerlingscherm hangt hier niet van af. Iedereen met de persoonlijke leerlinglink kan dat overzicht zien, ook zonder dat hun e-mail hier staat en zonder Google-account.

Open `Config.gs` en zet de Google-accounts van de leerkrachten die mogen bewerken:

```javascript
const TOEGANG_EMAIL_DOCENT = [
  'jij@school.be',
  'collega@school.be'
];
```

Kleine en hoofdletters maken niet uit. Wie niet in deze lijst staat, krijgt het docentscherm niet te zien — ook niet via de docent-URL.

---

### 4. Twee web-apps publiceren

De tool heeft **twee** publicaties van dezelfde code nodig: één om te bewerken, één om (anoniem) te bekijken. Zie [De twee implementaties](#de-twee-implementaties).

---

### 5. Leerling-URL in Config.gs zetten

Na het aanmaken van de leerling-web-app (implementatie B) plak je die URL in `Config.gs`:

```javascript
const LEERLING_IMPLEMENTATIE_URL = 'https://script.google.com/macros/s/AKfy.../exec';
```

Publiceer daarna **beide** implementaties opnieuw als nieuwe versie. Zo weet de server welke URL de publieke leerlingpagina is, en blokkeert hij bewerk-functies op die URL.

`SPREADSHEET_ID` in `Config.gs` laat je leeg als het script aan de Sheet hangt (gebonden script). Alleen bij een losstaand script vul je het spreadsheet-ID in.

---

## De twee implementaties

Zelfde code, andere toegangsinstellingen.

| | Implementatie A — Docent | Implementatie B — Leerling |
|---|---|---|
| **Voor wie** | Leerkrachten die data mogen wijzigen | Leerlingen en ouders die alleen kijken |
| **Login** | Ja, school-Google-account | Nee |
| **Wie mag openen?** | Alleen adressen in `TOEGANG_EMAIL_DOCENT` | Iedereen met de juiste `?id=CODE`-link |

### Implementatie A — Docent

1. Apps Script → **Implementeren → Nieuwe implementatie** (of een bestaande bewerken)
2. Type: **Web-app**
3. Instellingen:
   - **Uitvoeren als:** Gebruiker die de web-app opent
   - **Wie heeft toegang:** Iedereen met een Google-account
4. Implementeren en de URL bewaren

*Uitvoeren als de bezoeker* is nodig zodat het script het echte schoolaccount ziet en kan toetsen aan de e-maillijst. *Iedereen met een Google-account* betekent niet dat iedereen mag bewerken: wie niet in de lijst staat, wordt alsnog geweigerd.

Docent-URL:

```
https://script.google.com/macros/s/.../exec
```

### Implementatie B — Leerling

1. **Implementeren → Nieuwe implementatie** (een tweede web-app, niet A overschrijven)
2. Type: **Web-app**
3. Instellingen:
   - **Uitvoeren als:** Ik (eigenaar van het script)
   - **Wie heeft toegang:** Iedereen
4. Implementeren en de URL in `Config.gs` zetten (stap 5 hierboven)

*Uitvoeren als ik* laat de pagina de Sheet lezen zonder dat de bezoeker Sheet-rechten heeft. *Iedereen* laat leerlingen en ouders toe zonder Google-account. De 8-tekens code in de URL is de enige sleutel.

Link per leerling (code staat in de leerlingfiche in het docentscherm):

```
https://script.google.com/macros/s/.../exec?id=AB2CD3EF
```

---

## Beveiliging en privacy

| Wie | Wat ze zien of mogen |
|---|---|
| Leerkracht in de e-maillijst | Docentscherm: alles bekijken en bewerken |
| Iemand met de docent-URL maar zonder adres in de lijst | Geen toegang tot het docentscherm |
| Iedereen met de juiste leerlinglink | Alleen dat ene taakoverzicht, zonder naam |
| Iemand met een foute of ontbrekende code | Foutpagina |

De e-maillijst regelt **bewerkingsrecht**, niet of het leerlingscherm bestaat. Dat scherm is bewust publiek via de link, zodat ouders geen schoolaccount nodig hebben.

De leerlingpagina toont geen naam. Deel de link alleen met de betrokken leerling of ouders. Wie de link heeft, kan meekijken.

Verdere aandachtspunten:

- Bewerk-functies controleren altijd het Google-account van de bezoeker
- Op de leerling-URL worden bewerk-functies altijd geblokkeerd
- Deel de Google Sheet zelf nooit via “iedereen met de link”
- Opmerkingen bij taken kunnen persoonsgegevens bevatten
- Registreer de tool in het verwerkingsregister van de school als dat bij jullie hoort

---

## Na elke codewijziging

Als je `Code.gs`, `Config.gs`, `LeerlingCodes.gs` of een van de HTML-bestanden aanpast:

1. **Implementeren → Implementaties beheren**
2. Potlood bij **elke** actieve web-app (A én B)
3. **Versie:** Nieuwe versie → opslaan

De `/exec`-URL blijft hetzelfde. Ververs daarna de pagina.

De **testimplementatie** (`/dev`) toont altijd de laatst *opgeslagen* code, maar alleen voor de eigenaar. Handig om het docentscherm te proberen. Het leerlingscherm test je op dezelfde test-URL met `?id=CODE` (of via het oog-icoon in de fiche). De gekopieerde leerlinglink en iframe blijven de live `/exec`-URL van implementatie B.

---

## Dagelijks gebruik

### Docentscherm

- Open de docent-URL en log in met een account uit de e-maillijst
- Maak een klas aan op de startpagina; daarna kies je die klas in de balk
- **Kruistabel:** status per leerling en taak (sneltoetsen, slepen, periodes filteren)
- **Leerlingfiche:** klik op een naam — zelfde overzicht als de leerling, plus code, link en iframe
- **Taken:** nieuwe taak onderaan de tabel of via het formulier; soort en datum kun je later nog zetten
- **Instellingen:** opvolgingsdrempel, berichten en periodes (trimesters)

### Leerlingscherm

- Unieke URL met `?id=CODE` — geen login
- Toont alleen taken met een echte status (leeg of gewist verschijnt niet)
- Filter op periode en soort via het filtericoon
- Geschikt als iframe in Smartschool of Google Sites:

```html
<iframe
  src="https://script.google.com/macros/s/.../exec?id=AB2CD3EF"
  width="100%"
  height="600"
  frameborder="0">
</iframe>
```

---

## Bestanden (voor wie de code nakijkt)

| Bestand | Rol |
|---|---|
| `Config.gs` | E-mails van bewerkers, leerling-URL, eventueel spreadsheet-ID |
| `Code.gs` | Server: lezen en schrijven in de Sheet |
| `LeerlingCodes.gs` | Formaat en generatie van de 8-tekens codes |
| `docent.html` | Docentscherm: markup en stijl |
| `docent-kern.html` | Data, GAS-koppeling, klassen |
| `docent-opvolging.html` | Opvolgingsladder en berichten |
| `docent-kruis.html` | Kruistabel, selectie, slepen |
| `docent-ui.html` | Lijsten, fiche, instellingen |
| `leerling.html` | Leerlingscherm (anoniem, via code) |
