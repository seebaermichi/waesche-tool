# Wäsche

**Deutsch** · [English](README.en.md)

Kleiner Timer für Waschmaschinen, die **keine Restlaufzeit anzeigen**. Die App rechnet aus
Programm und Zeitvorwahl aus, wann die Maschine fertig ist, und meldet sich am Ende per
Push-Benachrichtigung und Signalton. Nebenbei zählt sie die Waschgänge mit und erinnert ans
Entkalken.

Gedacht für das iPhone als Web-App: Seite aufrufen, **„Zum Home-Bildschirm“** hinzufügen, von
dort starten. Läuft genauso auf Android und am Desktop.

## Unterstützte Geräte

| Hersteller | Modell | Bauart |
|---|---|---|
| hanseatic | HTW510C | Toplader, 5 kg |

Deine Maschine fehlt? Ein neues Modell ist eine einzige Datei mit den Programmzeiten aus dem
Handbuch – siehe [CONTRIBUTING.md](CONTRIBUTING.md). Wer nicht programmiert, kann die Zeiten
auch einfach als [Issue „Neues Gerät“](../../issues/new?template=neues-geraet.yml) schicken.

## Bedienung

1. Einmalig über das **Zahnrad** oben rechts unter „Meine Waschmaschinen“ das eigene Modell
   wählen.
2. Programm im Dropdown wählen (Reihenfolge wie auf dem Programmwähler).
3. Zeitvorwahl wählen – angeboten werden genau die Stufen, die die Maschine kennt.
4. **Start** drücken. Die App zeigt die Endzeit und zählt herunter.
5. **Stopp** löscht den Timer und die geplante Benachrichtigung.

Die Zeiten stammen aus den Handbüchern und sind meist nur Richtwerte. Weicht die echte
Laufzeit ab, lässt sie sich über **anpassen** bzw. im Fertig-Zustand dauerhaft pro Programm
korrigieren.

### Mehrere Waschmaschinen

Zuhause und im Ferienhaus, oder alte und neue Maschine: Unter „Meine Waschmaschinen“ lassen
sich beliebig viele Maschinen anlegen und benennen. Jede hat ihren eigenen Wäschezähler,
ihr eigenes Entkalkungsdatum und eigene Zeitkorrekturen. Sobald es mehr als eine gibt,
erscheint oben auf dem Startbildschirm ein Schalter zum schnellen Wechseln. Ein laufender
Timer bleibt bei seiner Maschine und zählt dort mit.

## Entkalken

Bei hartem Wasser sollte eine Waschmaschine etwa alle drei Monate entkalkt werden. Die App
zählt dafür die Waschgänge mit und erinnert nach **40 Wäschen** (in den
Einstellungen unter „Entkalken → Anleitung“ einstellbar) – spätestens aber nach **3 Monaten**. Die Funktion erscheint nur bei
Geräten, deren Profil ein Reinigungsprogramm nennt.

- **Gezählt** wird ein Waschgang, sobald er fertig ist oder gestoppt wird, nachdem die Maschine
  schon lief. Wer während der Zeitvorwahl abbricht, hat nicht gewaschen. Reinigungs-, Schleuder-
  und Spülprogramme zählen nicht.
- **Erinnerung:** gelbe Karte auf dem Startbildschirm und im Fertig-Zustand; wird sie mit dem
  Waschgang fällig, steht der Hinweis auch in der Fertig-Mitteilung. „später“ blendet sie für
  5 Wäschen bzw. 7 Tage aus.
- **Entkalken:** Die Anleitung wählt das Reinigungsprogramm vor. Läuft es mit dem Schalter
  „Mit Entkalker“ durch, setzt die App den Zähler zurück. Wer anders entkalkt hat, tippt auf
  „Schon entkalkt“.
- **Stand korrigieren:** In der Anleitung (Einstellungen → Entkalken) lassen sich das Datum der letzten Entkalkung und die
  Zahl der Wäschen seitdem von Hand setzen – etwa beim ersten Einrichten.

## Was auf iOS funktioniert – und was nicht

| | |
|---|---|
| **Benachrichtigung** | Kommt auch bei gesperrtem Display und geschlossener App an. Setzt voraus: App ist zum Home-Bildschirm hinzugefügt (iOS 16.4+) und Mitteilungen sind erlaubt. |
| **Signalton** | Nur, solange die App offen und das Display an ist – iOS lässt keine Audiowiedergabe aus einer schlafenden Seite zu. Dafür gibt es den Schalter „Display anlassen“. **Der seitliche Stummschalter am iPhone legt Web-Audio komplett still**, unabhängig von der Lautstärke; das kann keine Webseite umgehen. Zum Prüfen gibt es in den Einstellungen „Signalton – testen“. |
| **Countdown** | Übersteht Neuladen und Schließen: Die Restzeit wird immer aus dem gespeicherten Endzeitpunkt neu berechnet, nie mitgezählt. |

## Selbst betreiben

Die App braucht einen Webspace mit **PHP 8**, **HTTPS** und einem **Cronjob**, der jede Minute
eine URL aufruft. Eine Datenbank ist nicht nötig, Composer auch nicht – typisches
Shared Hosting reicht.

### 1. Schlüssel erzeugen

```bash
npm install
npm run vapid -- du@example.de
```

Die Mailadresse ist die Kontaktadresse für die Push-Dienste (RFC 8292) und bleibt auf dem
Server. Das Skript schreibt `public/api/config.php` und gibt zwei Zeilen aus, die in eine neue
Datei `.env` gehören (Vorlage: `.env.example`):

```
VITE_VAPID_PUBLIC_KEY=…
VITE_API_SECRET=…
```

Beide Dateien stehen in `.gitignore`. `config.php` muss trotzdem mit auf den Server – der
Build kopiert sie automatisch nach `dist/api/`.

### 2. Bauen und hochladen

```bash
npm run build
```

`dist/` enthält dann genau diese Dateien:

```
index.html              JS und CSS sind eingebettet – keine externen Ressourcen
sw.js                   Service Worker (Benachrichtigung + Offline)
manifest.webmanifest
icon-180.png  icon-192.png  icon-512.png
api/config.php  api/push.php  api/store.php  api/timer.php  api/cron.php
.htaccess               Seite und Service Worker nicht ungeprüft cachen
api/data/.htaccess      sperrt die gespeicherten Timer für Fremdzugriffe
```

Den kompletten Inhalt von `dist/` per FTP ins Doc-Root einer (Sub-)Domain legen. Die
Dateinamen sind fest, ein Update ist also einfaches Drüberkopieren.

Zwei Fallstricke beim Hochladen:

- **Die beiden `.htaccess`-Dateien nicht vergessen** – viele FTP-Programme blenden Dateien
  aus, deren Name mit einem Punkt beginnt. (Auf nginx greift `.htaccess` nicht; dort
  `api/data/` per Server-Konfiguration sperren und den Cache-Header selbst setzen.)
- **`api/data/` muss für PHP beschreibbar sein.** Meldet `/api/timer.php` einen Fehler,
  hilft `chmod 777` auf dieses Verzeichnis.

### 3. Cronjob anlegen

Beim Hoster einen Cronjob anlegen (bei all-inkl z. B. im KAS unter *Tools → Cronjobs*), der
**jede Minute** diese URL aufruft:

```
https://deine-domain.example/api/cron.php?key=DEIN_SECRET
```

`DEIN_SECRET` ist der Wert aus `VITE_API_SECRET`. Der Job prüft, ob ein Timer abgelaufen ist,
und verschickt dann die Benachrichtigung. Erlaubt der Tarif nur größere Intervalle, kommt die
Benachrichtigung entsprechend später. Mit Shell-Zugang geht auch
`* * * * * php /pfad/zu/api/cron.php`.

### 4. Auf dem iPhone installieren

Seite in Safari öffnen → Teilen → **Zum Home-Bildschirm** → App von dort starten → beim ersten
**Start** Mitteilungen erlauben.

## Entwicklung

Zwei Terminals:

```bash
npm install
npm run dev        # Vite auf :5173
npm run dev:api    # PHP-Backend auf :8787 (Vite proxyt /api dorthin)
```

Vom iPhone im gleichen WLAN testen: `npm run dev -- --host` und die Netzwerk-Adresse öffnen.
Benachrichtigungen lassen sich so allerdings nicht testen – dafür braucht es HTTPS und die
Installation auf dem Home-Bildschirm, also eine echte Domain.

```bash
npm run check                      # Geräteprofile prüfen
php public/api/cron.php --test     # Testbenachrichtigung an alle bekannten Geräte
php public/api/cron.php --debug    # registrierte Geräte anzeigen, nichts verschicken
```

Beides geht auch über die URL: `…/api/cron.php?key=SECRET&test=1` bzw. `&debug=1`.

### Neue Version veröffentlichen

```bash
npm version minor        # bzw. patch / major – erhöht die Nummer, committet und taggt
git push --follow-tags
npm run build            # dann dist/ hochladen
```

Die Nummer aus `package.json` erscheint unten rechts in der App und landet beim Build auch in
`sw.js`. Dadurch erkennt der Browser jede neue Version, installiert den neuen Service Worker
und lädt die App einmal neu. Änderungen bitte in `CHANGELOG.md` festhalten.

### Drei Fallstricke, die uns Zeit gekostet haben

- **`renotify` in `showNotification`** lässt WebKit den Aufruf abbrechen – die Benachrichtigung
  erscheint dann gar nicht, obwohl der Push sauber zugestellt wurde. Die Option ist auf iOS
  ohnehin wirkungslos und darf nicht zurück in `sw.js`.
- **`AudioContext.resume()` ist asynchron.** Wer direkt danach Töne einplant, plant sie in die
  Vergangenheit der noch stehenden Audio-Uhr, und sie werden verschluckt. Deshalb wartet
  `useAlarm` das Aufwachen ab und gibt den Tönen einen kleinen Vorlauf.
- **Ohne `Cache-Control` cacht Safari die Seite tagelang** (Faustregel: 10 % der Zeit seit der
  letzten Änderung) und fragt den Server gar nicht erst. Nach einem Upload blieb so die alte
  Version stehen. Deshalb holt `sw.js` die Seite mit `cache: 'no-cache'`, und die
  `.htaccess` im Doc-Root setzt den Header zusätzlich.

## Sicherheit

Das Secret schützt `/api/timer.php` und `/api/cron.php` vor zufälligen Fremdaufrufen. Es steckt
im ausgelieferten `index.html` und ist damit für jeden lesbar, der die Seite öffnet – für ein
privates Tool reicht das, ein echter Schutz ist es nicht. Auch die Cron-URL enthält das Secret
und landet damit im Server-Logfile. Die App ist für einen Haushalt gedacht, nicht als
öffentlicher Dienst für viele Nutzer.

## Technik

Vue 3 + Tailwind CSS 4, gebaut mit Vite. `vite-plugin-singlefile` bettet JS und CSS in die
`index.html` ein, damit auf dem Server nur wenige feste Dateien liegen.

Das Push-Backend kommt ohne Composer und ohne externe Bibliothek aus: `api/push.php`
implementiert VAPID (ES256-JWT nach RFC 8292) und die Payload-Verschlüsselung nach RFC 8291
mit den OpenSSL- und HKDF-Funktionen von PHP 8. Die geplanten Timer liegen als JSON-Datei in
`api/data/` – für einen Haushalt braucht es keine Datenbank.

Die Geräte stehen als einfache Datendateien in `src/machines/` und werden beim Build
automatisch eingesammelt.

## Lizenz

[MIT](LICENSE). Marken- und Modellnamen gehören ihren jeweiligen Inhabern; das Projekt steht
in keiner Verbindung zu den Herstellern.

Das Zahnrad-Icon stammt aus [Font Awesome Free](https://fontawesome.com) (CC BY 4.0).
