<?php
declare(strict_types=1);

/**
 * Erzeugt einmalig das VAPID-Schlüsselpaar und das gemeinsame Geheimnis.
 *
 *   npm run vapid -- du@example.de
 *
 * Die Mailadresse ist die Kontaktadresse für die Push-Dienste von Apple, Google und Mozilla
 * (RFC 8292). Sie bleibt auf dem Server und wird nicht an Nutzer ausgeliefert.
 *
 * Schreibt public/api/config.php (nur wenn es die Datei noch nicht gibt) und gibt die
 * beiden Zeilen aus, die in die .env gehören.
 */

$email = $argv[1] ?? '';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Aufruf: npm run vapid -- du@example.de\n");
    exit(1);
}

$root = dirname(__DIR__);
$configFile = $root . '/public/api/config.php';

$key = openssl_pkey_new([
    'curve_name' => 'prime256v1',
    'private_key_type' => OPENSSL_KEYTYPE_EC,
]);
if ($key === false) {
    fwrite(STDERR, "Schlüsselerzeugung fehlgeschlagen: " . openssl_error_string() . "\n");
    exit(1);
}

openssl_pkey_export($key, $privatePem);
$details = openssl_pkey_get_details($key);

// Öffentlicher Schlüssel als unkomprimierter Punkt (0x04 || X || Y), base64url –
// genau das Format, das pushManager.subscribe() als applicationServerKey erwartet.
$point = "\x04"
    . str_pad($details['ec']['x'], 32, "\x00", STR_PAD_LEFT)
    . str_pad($details['ec']['y'], 32, "\x00", STR_PAD_LEFT);
$publicKey = rtrim(strtr(base64_encode($point), '+/', '-_'), '=');

$secret = bin2hex(random_bytes(16));

if (file_exists($configFile)) {
    fwrite(STDERR, "public/api/config.php existiert bereits – nichts überschrieben.\n");
    fwrite(STDERR, "Zum Neuerzeugen die Datei vorher löschen.\n\n");
    exit(1);
}

$config = "<?php\n"
    . "// Erzeugt von scripts/gen-vapid.php – nicht ins Repository geben.\n\n"
    . "return [\n"
    . "    'vapid_private_pem' => <<<'PEM'\n" . rtrim($privatePem) . "\n        PEM,\n\n"
    . "    'vapid_public_key' => '" . $publicKey . "',\n\n"
    . "    'vapid_subject' => 'mailto:" . $email . "',\n\n"
    . "    'secret' => '" . $secret . "',\n"
    . "];\n";

// Heredoc-Inhalt darf nicht eingerückt sein, wenn der Schlussmarker eingerückt ist – deshalb
// den Marker bündig setzen.
$config = str_replace("\n        PEM,", "\nPEM,", $config);

file_put_contents($configFile, $config);

echo "public/api/config.php geschrieben.\n\n";
echo "Diese beiden Zeilen in die .env eintragen:\n\n";
echo "VITE_VAPID_PUBLIC_KEY=" . $publicKey . "\n";
echo "VITE_API_SECRET=" . $secret . "\n";
