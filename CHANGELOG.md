# Changelog

Versionsnummern nach [Semantic Versioning](https://semver.org/lang/de/). Die laufende Version
steht in der App unten rechts.

## 1.2.1 – 2026-10-06

- Schöneres Zahnrad-Icon für die Einstellungen (Font Awesome Free, CC BY 4.0).

## 1.2.0 – 2026-10-06

- **Einstellungen** hinter dem Zahnrad oben rechts: Waschmaschinen, Entkalken, Display
  anlassen, Signalton testen, Benachrichtigung, Version. Der Startbildschirm zeigt nur noch das
  Starten – und Hinweise zur Benachrichtigung nur, wenn etwas nicht stimmt.
- **Mehrere eigene Waschmaschinen** („Zuhause“, „Ferienhaus“ …), jede mit eigenem
  Wäschezähler, Entkalkungsdatum und eigenen Zeitkorrekturen. Ab zwei Maschinen gibt es oben
  einen Schnellwechsel. Der bisherige Stand wird in die erste Maschine übernommen.

## 1.1.0 – 2026-10-06

- **Mehrere Waschmaschinen:** Geräte stehen als Datendateien in `src/machines/` und lassen
  sich unten in der App unter „Waschmaschine“ wählen. Zeitvorwahl als Startzeit („in 3 Std.“)
  oder Endzeit („fertig in 3 Std.“). Zeitkorrekturen gelten pro Gerät; bestehende werden
  übernommen.
- **Versionsnummer** unten rechts in der App.
- **Updates kommen zuverlässig an:** Der Service Worker fragt die Seite immer beim Server nach,
  statt sie aus dem Browser-Cache zu nehmen, und lädt die App nach einem Update einmal neu.
  Neue `.htaccess` setzt `Cache-Control: no-cache` für HTML, JS und Manifest.
- Open Source unter MIT-Lizenz, `npm run check` prüft Geräteprofile.

## 1.0.0 – 2026-08-05

- Erste Version für die hanseatic HTW510C: Timer mit Startzeitvorwahl, Push-Benachrichtigung,
  Signalton, Feintuning der Laufzeiten, Entkalkungs-Erinnerung.
