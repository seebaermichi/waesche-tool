<?php
declare(strict_types=1);

/**
 * Nimmt den geplanten Timer der App entgegen bzw. löscht ihn wieder.
 *
 * POST { action: "schedule", secret, subscription, endsAt, programName, hint? }
 * POST { action: "cancel",   secret, endpoint }
 */

require __DIR__ . '/store.php';

$config = require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function fail(int $status, string $message): never
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'Nur POST');
}

$input = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($input)) {
    fail(400, 'Kein gültiges JSON');
}

if (!hash_equals($config['secret'], (string) ($input['secret'] ?? ''))) {
    fail(403, 'Falsches Secret');
}

$action = (string) ($input['action'] ?? '');

if ($action === 'schedule') {
    $subscription = $input['subscription'] ?? null;
    $endpoint = is_array($subscription) ? (string) ($subscription['endpoint'] ?? '') : '';
    $p256dh = $subscription['keys']['p256dh'] ?? '';
    $auth = $subscription['keys']['auth'] ?? '';
    $endsAt = $input['endsAt'] ?? null;

    if ($endpoint === '' || !filter_var($endpoint, FILTER_VALIDATE_URL)) {
        fail(400, 'Endpoint fehlt oder ist ungültig');
    }
    if ($p256dh === '' || $auth === '') {
        fail(400, 'Subscription-Schlüssel fehlen');
    }
    if (!is_int($endsAt) && !is_float($endsAt)) {
        fail(400, 'endsAt fehlt');
    }

    $endsAt = (int) $endsAt;
    // Plausibilitätsgrenze: höchstens 24 Stunden in der Zukunft (längstes Programm plus
    // 9 Stunden Vorwahl sind gut 12 Stunden).
    if ($endsAt > (time() + 86400) * 1000) {
        fail(400, 'endsAt liegt zu weit in der Zukunft');
    }

    timers_update(static function (array &$timers) use ($endpoint, $p256dh, $auth, $endsAt, $input): void {
        $timers[timer_key($endpoint)] = [
            'endpoint' => $endpoint,
            'keys' => ['p256dh' => (string) $p256dh, 'auth' => (string) $auth],
            'endsAt' => $endsAt,
            'programName' => mb_substr(trim((string) ($input['programName'] ?? '')), 0, 60),
            'hint' => mb_substr(trim((string) ($input['hint'] ?? '')), 0, 120),
            'createdAt' => time() * 1000,
        ];
    });

    echo json_encode(['ok' => true, 'endsAt' => $endsAt]);
    exit;
}

if ($action === 'cancel') {
    $endpoint = (string) ($input['endpoint'] ?? '');
    if ($endpoint === '') {
        fail(400, 'Endpoint fehlt');
    }

    $removed = timers_update(static function (array &$timers) use ($endpoint): bool {
        $key = timer_key($endpoint);
        if (!isset($timers[$key])) {
            return false;
        }
        unset($timers[$key]);
        return true;
    });

    echo json_encode(['ok' => true, 'removed' => $removed]);
    exit;
}

fail(400, 'Unbekannte Aktion');
