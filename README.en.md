# Wäsche

[Deutsch](README.md) · **English**

A small timer for washing machines that **don't show the remaining time**. The app works out
from the program and the delay setting when the machine will be done, and alerts you with a
push notification and a sound. It also counts your washes and reminds you to descale.

Built as an iPhone web app: open the page, tap **"Add to Home Screen"**, launch it from there.
Works the same on Android and desktop.

> The user interface is currently **German only**. Translations are welcome, see below.

## Supported machines

| Brand | Model | Type |
|---|---|---|
| hanseatic | HTW510C | top loader, 5 kg |

Your machine is missing? A new model is a single data file with the program durations from the
manual, see [CONTRIBUTING.md](CONTRIBUTING.md). If you don't code, just send the durations as a
["New machine" issue](../../issues/new?template=neues-geraet.yml).

## How to use

1. Once: tap the **gear** at the top right and pick your model under "Meine Waschmaschinen".
2. Choose the program (same order as on the dial).
3. Choose the delay: the app offers exactly the steps your machine supports.
4. Press **Start**. The app shows the finish time and counts down.
5. **Stopp** clears the timer and the scheduled notification.

Durations come from the manuals and are usually estimates. If your machine takes longer or
shorter, adjust a program permanently via **anpassen** or on the "done" screen.

Several machines (home and holiday home, old and new) can be added and named in the settings.
Each keeps its own wash counter, descaling date and duration adjustments. With more than one, a
quick switch appears at the top of the main screen.

## Descaling

With hard water a washing machine should be descaled about every three months. The app counts
washes and reminds you after **40 washes** (configurable) or **3 months** at the latest. The
feature only appears for machines whose profile names a cleaning program.

## What works on iOS, and what doesn't

| | |
|---|---|
| **Notification** | Arrives with the screen locked and the app closed. Requires the app on the Home Screen (iOS 16.4+) and notifications allowed. |
| **Sound** | Only while the app is open and the screen is on, because iOS won't play audio from a sleeping page. Use the "Display anlassen" (keep screen on) switch. **The iPhone's mute switch silences Web Audio completely**, regardless of volume; no web page can get around it. |
| **Countdown** | Survives reloads and closing: remaining time is always recomputed from the stored end time. |

## Self-hosting

You need web space with **PHP 8**, **HTTPS** and a **cron job** that calls a URL every minute.
No database, no Composer; typical shared hosting is enough.

```bash
npm install
npm run vapid -- you@example.com   # writes public/api/config.php, prints two lines for .env
cp .env.example .env               # paste the two lines here
npm run build                      # upload the contents of dist/ to your web root
```

Then create a cron job calling `https://your-domain.example/api/cron.php?key=YOUR_SECRET` every
minute (`YOUR_SECRET` = `VITE_API_SECRET`). Watch out for the hidden `api/data/.htaccess` when
uploading via FTP, and make `api/data/` writable for PHP. More details are in the
[German README](README.md#selbst-betreiben).

## Development

```bash
npm run dev        # Vite on :5173
npm run dev:api    # PHP backend on :8787 (Vite proxies /api)
npm run check      # validate machine profiles
```

## Security

The shared secret only keeps random callers away from `/api/timer.php` and `/api/cron.php`. It
ships inside `index.html`, so anyone who opens the page can read it. The app is meant for one
household, not as a public multi-user service.

## Tech

Vue 3 + Tailwind CSS 4 + Vite, bundled into a single `index.html`. The push backend is
dependency-free PHP 8: VAPID (RFC 8292) and payload encryption (RFC 8291) implemented with
OpenSSL. Scheduled timers live in a JSON file. Machine profiles are plain data files in
`src/machines/`.

## Contributing

New machine profiles, fixes and translations are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Brand and model names belong to their respective owners; this project is not
affiliated with any manufacturer.
