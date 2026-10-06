// hanseatic Toplader-Waschmaschine HTW510C (5 kg).
// Zeiten aus der Handbuch-Tabelle "Standardprogramme für Modell HTW510C" (Seite DE-14/15).
// Reihenfolge wie auf dem Programmwähler, damit die Liste der Bedienung am Gerät entspricht.
//
// Laut Handbuch sind alle Zeiten außer ECO 40–60 nur Richtwerte – die tatsächliche Dauer
// hängt von Wäschemenge, Wasser- und Umgebungstemperatur ab. Dafür gibt es das Feintuning.

export default {
  id: 'hanseatic-htw510c',
  brand: 'hanseatic',
  model: 'HTW510C',
  description: 'Toplader, 5 kg',
  source: 'Bedienungsanleitung, Tabelle „Standardprogramme für Modell HTW510C“, S. DE-14/15',

  programs: [
    { id: 'baumwolle', name: 'Baumwolle', minutes: 160 },
    { id: 'synthetik', name: 'Synthetik', minutes: 140 },
    { id: 'mix', name: 'Mix', minutes: 80 },
    { id: 'jeans', name: 'Jeans', minutes: 100 },
    { id: 'sportwaesche', name: 'Sportwäsche', minutes: 47 },
    { id: 'grad20', name: '20 °C', minutes: 61 },
    { id: 'babybekleidung', name: 'Babybekleidung', minutes: 121 },
    { id: 'trommelreinigung', name: 'Trommelreinigung', minutes: 78, wash: false },
    { id: 'schleudern', name: 'Schleudern', minutes: 12, wash: false },
    { id: 'spuelen', name: 'Spülen', minutes: 20, wash: false },
    { id: 'wolle', name: 'Wolle', minutes: 67 },
    { id: 'steam', name: 'Steam', minutes: 108 },
    { id: 'eco-5kg', name: 'ECO 40–60', note: '5 kg', minutes: 188 },
    { id: 'eco-2.5kg', name: 'ECO 40–60', note: 'bis 2,5 kg', minutes: 150 },
    { id: 'schnell45', name: 'Schnell 45′', minutes: 45 },
    { id: 'express15', name: 'Express 15′', minutes: 15 },
  ],

  // "Die Verzögerung kann 3, 6 oder 9 Stunden betragen." (Handbuch, Seite DE-23)
  // Die Maschine verschiebt den Start, nicht das Ende.
  delay: { mode: 'start', hours: [0, 3, 6, 9] },

  timingNote: 'Bei halber Beladung verkürzt die Mengenautomatik das Programm.',

  descale: {
    programId: 'trommelreinigung',
    temperature: '90 °C',
    afterwards: [
      'Waschmittelfach herausnehmen und in warmem Wasser reinigen.',
      'Gummidichtung an der oberen Öffnung trockenwischen.',
      'Deckel offen stehen lassen.',
    ],
  },
}
