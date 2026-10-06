# Mitmachen · Contributing

*English summary below.*

Am meisten hilft ein **neues Geräteprofil**: Programme und Laufzeiten einer weiteren
Waschmaschine. Dafür muss man kaum programmieren.

## Ohne Programmieren

Ein [Issue „Neues Gerät“](../../issues/new?template=neues-geraet.yml) anlegen und die
Programmtabelle aus dem Handbuch abtippen. Bitte **keine Handbuch-PDFs oder Scans
hochladen**: Die sind urheberrechtlich geschützt, die Laufzeiten selbst sind es nicht.

## Geräteprofil anlegen

1. Datei `src/machines/<marke>-<modell>.js` anlegen, alles kleingeschrieben, z. B.
   `bosch-wan28k40.js`. Am besten `hanseatic-htw510c.js` kopieren.
2. Felder ausfüllen (siehe unten).
3. `npm run check` – prüft alle Profile. `npm run dev` – Modell unten in der App wählen und
   ausprobieren.
4. Pull Request stellen. Die Liste „Unterstützte Geräte“ in beiden READMEs bitte ergänzen.

```js
export default {
  id: 'bosch-wan28k40',            // = Dateiname ohne .js
  brand: 'Bosch',
  model: 'WAN28K40',
  description: 'Frontlader, 8 kg', // Bauart, Fassungsvermögen
  source: 'Bedienungsanleitung, Programmtabelle S. 22',

  // Reihenfolge wie auf dem Programmwähler
  programs: [
    { id: 'baumwolle-40', name: 'Baumwolle', note: '40 °C', minutes: 155 },
    { id: 'schleudern', name: 'Schleudern', minutes: 15, wash: false },
    // …
  ],

  // Zeitvorwahl: genau die Stufen, die die Maschine kennt, in Stunden, beginnend mit 0
  //   mode 'start': Maschine startet nach X Std.        (z. B. "Startzeitvorwahl 3/6/9 h")
  //   mode 'end':   Maschine ist nach X Std. fertig     (z. B. "Fertig in 1–24 h")
  delay: { mode: 'end', hours: [0, 1, 2, 3, /* … */ 24] },

  // optional: Hinweis unter dem laufenden Timer
  timingNote: 'Die Mengenautomatik verkürzt das Programm bei wenig Wäsche.',

  // optional: ohne `descale` gibt es keine Entkalkungs-Erinnerung
  descale: {
    programId: 'trommelreinigung',  // muss in `programs` vorkommen
    temperature: '90 °C',
    afterwards: ['Türdichtung trockenwischen.', 'Tür offen stehen lassen.'],
  },
}
```

### Felder

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `id` | ja | Dateiname ohne `.js`. Nie mehr ändern – gespeicherte Einstellungen hängen daran. |
| `brand`, `model` | ja | Wie auf dem Typenschild. |
| `description` | ja | Bauart und Fassungsvermögen. |
| `source` | ja | Woher die Zeiten stammen (Handbuch + Seite, eigene Messung …). |
| `programs[].id` | ja | Eindeutig im Gerät, kleingeschrieben. Nie mehr ändern – das Feintuning hängt daran. |
| `programs[].name` | ja | Beschriftung wie am Gerät. |
| `programs[].note` | nein | Zusatz, wenn ein Programm mehrfach vorkommt (`'5 kg'`, `'40 °C'`). |
| `programs[].minutes` | ja | Laufzeit in Minuten, Standardeinstellung laut Handbuch. |
| `programs[].wash` | nein | `false` für Programme, die nicht als Waschgang zählen (Schleudern, Spülen, Pflege). |
| `delay.mode` | ja | `'start'` oder `'end'`, siehe oben. |
| `delay.hours` | ja | Aufsteigend, beginnt mit `0`. Bis 6 Stufen als Kacheln, mehr als Auswahlliste. |
| `timingNote` | nein | Kurzer Hinweis zur Genauigkeit der Zeiten. |
| `descale` | nein | Reinigungsprogramm für die Entkalkungs-Erinnerung. |

**Welche Zeit nehmen?** Die Handbücher geben meist die Laufzeit in der Standardeinstellung
an. Gibt es eine Tabelle für volle Beladung, die nehmen. Wer seine Maschine selbst gestoppt
hat, darf gern eigene Werte eintragen und das unter `source` vermerken.

## Code

Fehler und Verbesserungen gern als Issue oder Pull Request. Vor dem PR `npm run build`
laufen lassen. Kommentare und Oberfläche sind auf Deutsch.

---

## English summary

The most helpful contribution is a **new machine profile**. Copy
`src/machines/hanseatic-htw510c.js` to `src/machines/<brand>-<model>.js`, fill in the program
durations from the manual (in dial order), the delay steps (`mode: 'start'` delays the start,
`mode: 'end'` sets "done in X hours") and optionally a `descale` program. Run `npm run check`,
try it with `npm run dev`, and open a pull request. The field table above explains every field.

Can't code? Open a ["New machine" issue](../../issues/new?template=neues-geraet.yml) with the
program table. Please **don't upload manual PDFs or scans**, as they are copyrighted.

The UI is German only for now. If you'd like to add i18n, please open an issue first so we can
agree on the approach.
