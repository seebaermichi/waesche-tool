<?php
declare(strict_types=1);

/**
 * Ablage der geplanten Timer. Es gibt genau einen Nutzer, deshalb reicht eine JSON-Datei –
 * geschrieben unter exklusivem Lock, damit sich Cronjob und App nicht in die Quere kommen.
 *
 * Format: { "<sha256(endpoint)>": { endpoint, keys, endsAt, programName, createdAt } }
 */

const TIMERS_FILE = __DIR__ . '/data/timers.json';

function timers_read(): array
{
    if (!is_file(TIMERS_FILE)) {
        return [];
    }
    $raw = file_get_contents(TIMERS_FILE);
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Liest, ruft $mutate auf und schreibt das Ergebnis zurück – alles unter einem Lock.
 * Gibt den Rückgabewert von $mutate durch.
 */
function timers_update(callable $mutate): mixed
{
    $dir = dirname(TIMERS_FILE);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }

    $handle = fopen(TIMERS_FILE, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Timer-Datei nicht beschreibbar');
    }

    try {
        if (!flock($handle, LOCK_EX)) {
            throw new RuntimeException('Timer-Datei konnte nicht gesperrt werden');
        }

        $raw = stream_get_contents($handle);
        $timers = $raw ? (json_decode($raw, true) ?: []) : [];

        $result = $mutate($timers);

        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($timers, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        fflush($handle);

        return $result;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function timer_key(string $endpoint): string
{
    return hash('sha256', $endpoint);
}
