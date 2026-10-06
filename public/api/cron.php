<?php
declare(strict_types=1);

/**
 * Wird vom Cronjob jede Minute aufgerufen und verschickt alle fälligen Benachrichtigungen:
 *
 *   https://waesche-tool.example.de/api/cron.php?key=SECRET
 *
 * Auf der Kommandozeile (`php public/api/cron.php`) ist kein Schlüssel nötig.
 * Mit `&test=1` geht sofort eine Testbenachrichtigung an alle bekannten Geräte raus.
 */

require __DIR__ . '/store.php';
require __DIR__ . '/push.php';

$config = require __DIR__ . '/config.php';

$isCli = PHP_SAPI === 'cli';

if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');

    if (!hash_equals($config['secret'], (string) ($_GET['key'] ?? ''))) {
        http_response_code(403);
        echo "Falsches Secret\n";
        exit;
    }
}

$test = isset($_GET['test']) || in_array('--test', $argv ?? [], true);
$nowMs = (int) round(microtime(true) * 1000);

// Fällige Einträge herausnehmen und dabei gleich aus der Datei entfernen: Der Versand darf
// nicht innerhalb des Locks passieren, sonst blockiert eine langsame Push-Antwort die App.
// Nur nachsehen, nichts verschicken und nichts löschen.
if (isset($_GET['debug']) || in_array('--debug', $argv ?? [], true)) {
    $timers = timers_read();
    printf("%d Eintrag/Einträge:\n", count($timers));
    foreach ($timers as $timer) {
        printf(
            "  %-24s fällig in %+d Sek.  Programm: %s\n",
            parse_url((string) $timer['endpoint'], PHP_URL_HOST) ?: '?',
            (int) (((int) $timer['endsAt'] - $nowMs) / 1000),
            $timer['programName'] ?: '–'
        );
    }
    exit;
}

if ($test) {
    // Testlauf: an alle bekannten Geräte schicken, aber nichts aus der Warteschlange
    // nehmen – ein laufender Timer soll seine echte Benachrichtigung noch bekommen.
    $targets = timers_read();
} else {
    $targets = timers_update(static function (array &$timers) use ($nowMs): array {
        $due = [];
        foreach ($timers as $key => $timer) {
            if ($nowMs >= (int) ($timer['endsAt'] ?? 0)) {
                $due[$key] = $timer;
                unset($timers[$key]);
                continue;
            }

            // Karteileichen: Einträge, die nie fällig wurden, nach 48 Stunden entsorgen.
            if ($nowMs - (int) ($timer['createdAt'] ?? 0) > 48 * 3600 * 1000) {
                unset($timers[$key]);
            }
        }
        return $due;
    });
}

$sent = 0;
$failed = [];
$details = [];

foreach ($targets as $key => $timer) {
    $program = $timer['programName'] ?? '';
    $hint = $timer['hint'] ?? '';
    $notification = $test
        ? ['title' => 'Test', 'body' => 'Die Benachrichtigungen funktionieren.']
        : [
            'title' => 'Wäsche ist fertig',
            'body' => ($program !== '' ? $program . ' ist durchgelaufen.' : 'Das Programm ist durchgelaufen.')
                . ($hint !== '' ? ' ' . $hint : ''),
        ];

    $result = send_push($timer, $notification, $config);

    $details[] = sprintf(
        '  %s → HTTP %d%s',
        parse_url((string) $timer['endpoint'], PHP_URL_HOST) ?: '?',
        $result['status'],
        $result['error'] === null ? '' : ' · ' . $result['error']
    );

    if ($result['error'] === null) {
        $sent++;
    } else {
        $failed[] = $result['error'];
        // 404/410: Die Subscription gilt nicht mehr – dann kann sie auch weg.
        if (in_array($result['status'], [404, 410], true)) {
            timers_update(static function (array &$timers) use ($key): void {
                unset($timers[$key]);
            });
        }
    }
}

// Beim Aufruf über HTTP nur etwas ausgeben, wenn es auch etwas zu berichten gibt: Der
// Cronjob-Dienst verschickt jede Ausgabe per E-Mail, und der Job läuft jede Minute.
if ($isCli || $test || $targets !== [] || $failed !== []) {
    printf("Ziele: %d, verschickt: %d, fehlgeschlagen: %d\n", count($targets), $sent, count($failed));
    foreach ($details as $line) {
        echo $line . "\n";
    }
}
