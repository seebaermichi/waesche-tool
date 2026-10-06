<?php
// Vorlage für public/api/config.php – die echte Datei erzeugt `npm run vapid`.
// config.php gehört nicht ins Repository (steht in .gitignore), muss aber mit auf den Server.

return [
    // Privater VAPID-Schlüssel im PEM-Format (mehrzeilig).
    'vapid_private_pem' => <<<PEM
    -----BEGIN PRIVATE KEY-----
    ...
    -----END PRIVATE KEY-----
    PEM,

    // Öffentlicher VAPID-Schlüssel, base64url – derselbe Wert wie VITE_VAPID_PUBLIC_KEY in .env.
    'vapid_public_key' => '',

    // Kontaktadresse für den Push-Dienst, vorgeschrieben von RFC 8292.
    'vapid_subject' => 'mailto:info@example.de',

    // Gemeinsames Geheimnis für /api/timer.php und /api/cron.php – gleicher Wert wie
    // VITE_API_SECRET in .env.
    'secret' => '',
];
