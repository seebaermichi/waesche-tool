<?php
declare(strict_types=1);

/**
 * Web Push ohne externe Bibliothek.
 *
 * Zwei Bausteine sind nötig:
 *  - VAPID: ein ES256-JWT, mit dem sich der Server beim Push-Dienst ausweist (RFC 8292).
 *  - Verschlüsselung des Payloads nach RFC 8291 im Schema "aes128gcm" (RFC 8188).
 *
 * Beides lässt sich mit den Bordmitteln von PHP 8 erledigen: openssl_pkey_derive für den
 * ECDH-Schlüsselaustausch, hash_hkdf für die Schlüsselableitung und openssl_encrypt für
 * AES-128-GCM.
 */

function b64u_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64u_decode(string $data): string
{
    $padded = strtr($data, '-_', '+/');
    $remainder = strlen($padded) % 4;
    if ($remainder !== 0) {
        $padded .= str_repeat('=', 4 - $remainder);
    }
    $decoded = base64_decode($padded, true);
    if ($decoded === false) {
        throw new RuntimeException('Ungültiges base64url');
    }
    return $decoded;
}

/**
 * Baut aus einem rohen P-256-Punkt (65 Byte, unkomprimiert) einen von OpenSSL lesbaren
 * öffentlichen Schlüssel. Der Präfix ist die feste SubjectPublicKeyInfo-Hülle für
 * id-ecPublicKey mit der Kurve prime256v1.
 */
function p256_public_key_from_point(string $point)
{
    if (strlen($point) !== 65 || $point[0] !== "\x04") {
        throw new RuntimeException('Unerwartetes Format des öffentlichen Schlüssels');
    }

    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $point;
    $pem = "-----BEGIN PUBLIC KEY-----\n"
        . chunk_split(base64_encode($der), 64, "\n")
        . "-----END PUBLIC KEY-----\n";

    $key = openssl_pkey_get_public($pem);
    if ($key === false) {
        throw new RuntimeException('Öffentlicher Schlüssel nicht lesbar: ' . openssl_error_string());
    }
    return $key;
}

/** Erzeugt ein flüchtiges P-256-Schlüsselpaar und gibt [Schlüssel, roher Punkt] zurück. */
function p256_generate(): array
{
    $key = openssl_pkey_new([
        'curve_name' => 'prime256v1',
        'private_key_type' => OPENSSL_KEYTYPE_EC,
    ]);
    if ($key === false) {
        throw new RuntimeException('Schlüsselerzeugung fehlgeschlagen: ' . openssl_error_string());
    }

    $details = openssl_pkey_get_details($key);
    $point = "\x04"
        . str_pad($details['ec']['x'], 32, "\x00", STR_PAD_LEFT)
        . str_pad($details['ec']['y'], 32, "\x00", STR_PAD_LEFT);

    return [$key, $point];
}

/**
 * ECDSA-Signaturen von OpenSSL kommen im DER-Format (SEQUENCE aus zwei INTEGERn).
 * JWS erwartet stattdessen die rohe Aneinanderreihung R || S mit je 32 Byte.
 */
function der_signature_to_raw(string $der): string
{
    $offset = 0;
    $readLength = static function (string $buffer, int &$offset): int {
        $first = ord($buffer[$offset++]);
        if ($first < 0x80) {
            return $first;
        }
        $bytes = $first & 0x7f;
        $length = 0;
        for ($i = 0; $i < $bytes; $i++) {
            $length = ($length << 8) | ord($buffer[$offset++]);
        }
        return $length;
    };

    if (ord($der[$offset++]) !== 0x30) {
        throw new RuntimeException('Signatur ist keine DER-SEQUENCE');
    }
    $readLength($der, $offset);

    $parts = [];
    for ($i = 0; $i < 2; $i++) {
        if (ord($der[$offset++]) !== 0x02) {
            throw new RuntimeException('Signatur enthält kein INTEGER');
        }
        $length = $readLength($der, $offset);
        $value = substr($der, $offset, $length);
        $offset += $length;
        // Führende Null-Bytes sind nur das DER-Vorzeichen und gehören nicht in die Rohform.
        $value = ltrim($value, "\x00");
        $parts[] = str_pad($value, 32, "\x00", STR_PAD_LEFT);
    }

    return $parts[0] . $parts[1];
}

/** Erzeugt das VAPID-JWT für die Zielorigin des Push-Endpoints. */
function vapid_authorization(string $endpoint, string $privatePem, string $publicKey, string $subject): string
{
    $parts = parse_url($endpoint);
    $audience = $parts['scheme'] . '://' . $parts['host'];

    $header = b64u_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256'], JSON_UNESCAPED_SLASHES));
    $payload = b64u_encode(json_encode([
        'aud' => $audience,
        'exp' => time() + 12 * 3600,
        'sub' => $subject,
    ], JSON_UNESCAPED_SLASHES));

    $key = openssl_pkey_get_private($privatePem);
    if ($key === false) {
        throw new RuntimeException('Privater VAPID-Schlüssel nicht lesbar: ' . openssl_error_string());
    }

    $signingInput = $header . '.' . $payload;
    if (!openssl_sign($signingInput, $der, $key, OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('Signieren fehlgeschlagen: ' . openssl_error_string());
    }

    $jwt = $signingInput . '.' . b64u_encode(der_signature_to_raw($der));

    return 'vapid t=' . $jwt . ', k=' . $publicKey;
}

/**
 * Verschlüsselt den Payload für genau diese Subscription (RFC 8291).
 *
 * Ergebnis: salt(16) | rs(4) | idlen(1) | ephemeraler Punkt(65) | Ciphertext+Tag
 */
function encrypt_payload(string $payload, string $p256dh, string $auth): string
{
    $uaPublicPoint = b64u_decode($p256dh);
    $authSecret = b64u_decode($auth);

    [$asPrivate, $asPublicPoint] = p256_generate();
    $uaPublicKey = p256_public_key_from_point($uaPublicPoint);

    // Ohne Längenangabe: Bei P-256 ist das gemeinsame Geheimnis ohnehin 32 Byte lang, und
    // der $key_length-Parameter gilt ab PHP 8.5 als veraltet.
    $sharedSecret = openssl_pkey_derive($uaPublicKey, $asPrivate);
    if ($sharedSecret === false) {
        throw new RuntimeException('ECDH fehlgeschlagen: ' . openssl_error_string());
    }

    // Erst aus dem gemeinsamen Geheimnis und dem auth-Secret das eigentliche IKM ableiten …
    $keyInfo = "WebPush: info\x00" . $uaPublicPoint . $asPublicPoint;
    $ikm = hash_hkdf('sha256', $sharedSecret, 32, $keyInfo, $authSecret);

    // … daraus dann Inhaltsschlüssel und Nonce.
    $salt = random_bytes(16);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\x00", $salt);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\x00", $salt);

    // 0x02 markiert den letzten (hier: einzigen) Record.
    $plaintext = $payload . "\x02";

    $ciphertext = openssl_encrypt(
        $plaintext,
        'aes-128-gcm',
        $cek,
        OPENSSL_RAW_DATA,
        $nonce,
        $tag,
        '',
        16
    );
    if ($ciphertext === false) {
        throw new RuntimeException('Verschlüsselung fehlgeschlagen: ' . openssl_error_string());
    }

    $recordSize = 4096;
    $header = $salt . pack('N', $recordSize) . chr(strlen($asPublicPoint)) . $asPublicPoint;

    return $header . $ciphertext . $tag;
}

/**
 * Verschickt eine Benachrichtigung.
 *
 * @param array $subscription ['endpoint' => string, 'keys' => ['p256dh' => string, 'auth' => string]]
 * @return array ['status' => int, 'error' => ?string]
 */
function send_push(array $subscription, array $notification, array $config): array
{
    try {
        $body = encrypt_payload(
            json_encode($notification, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $subscription['keys']['p256dh'],
            $subscription['keys']['auth']
        );

        $authorization = vapid_authorization(
            $subscription['endpoint'],
            $config['vapid_private_pem'],
            $config['vapid_public_key'],
            $config['vapid_subject']
        );
    } catch (Throwable $e) {
        return ['status' => 0, 'error' => $e->getMessage()];
    }

    $curl = curl_init($subscription['endpoint']);
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => [
            'Authorization: ' . $authorization,
            'Content-Type: application/octet-stream',
            'Content-Encoding: aes128gcm',
            'Content-Length: ' . strlen($body),
            'TTL: 3600',
            'Urgency: high',
        ],
    ]);

    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl) ?: null;
    unset($curl);

    if ($error === null && $status >= 400) {
        $error = 'HTTP ' . $status . ': ' . substr((string) $response, 0, 300);
    }

    return ['status' => $status, 'error' => $error];
}
