<?php
// ============================================
// backend/health.php
// Diagnóstico del backend (no expone secretos)
// ============================================

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config.php';

if (function_exists('opcache_reset')) { @opcache_reset(); }

$checks = [
  'php_version'  => PHP_VERSION,
  'extensions'   => [
    'curl'     => extension_loaded('curl'),
    'openssl'  => extension_loaded('openssl'),
    'json'     => extension_loaded('json'),
  ],
  'config' => [
    'FIREBASE_PROJECT_ID'         => defined('FIREBASE_PROJECT_ID') ? FIREBASE_PROJECT_ID : null,
    'USERS_COLLECTION_PATH'       => defined('USERS_COLLECTION_PATH') ? USERS_COLLECTION_PATH : null,
    'MP_ACCESS_TOKEN_present'     => defined('MP_ACCESS_TOKEN') && strlen(MP_ACCESS_TOKEN) > 10,
    'SERVICE_ACCOUNT_JSON_exists' => is_file(SERVICE_ACCOUNT_JSON),
  ],
  'http' => [
    'can_https' => function_exists('curl_init'),
  ],
  'mp' => [
    'token_valid'   => false,
    'me_status'     => null,
    'token_src'     => null,
    'token_last8'   => null,
  ],
  'firestore' => [
    'service_account_valid' => false,
    'token_obtained'        => false,
  ]
];

// --- Detectar fuente real del token ---
try {
  $tokenSrc = getenv('MP_ACCESS_TOKEN') ? 'env' : 'fallback';
  $tokenVal = defined('MP_ACCESS_TOKEN') ? MP_ACCESS_TOKEN : '(undefined)';
  $checks['mp']['token_src']   = $tokenSrc;
  $checks['mp']['token_last8'] = strlen($tokenVal) > 8 ? substr($tokenVal, -8) : null;
} catch (Throwable $e) {
  $checks['mp']['token_src']   = 'error';
  $checks['mp']['token_last8'] = $e->getMessage();
}

// --- Helper HTTP simple ---
function http_get($url, $headers = [], &$httpCodeOut = 0) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT        => 15,
  ]);
  $res = curl_exec($ch);
  if ($res === false) {
    $err = curl_error($ch);
    $httpCodeOut = 0;
    return ['error' => $err];
  }
  $httpCodeOut = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  return $res;
}

// --- Probar token de Mercado Pago ---
try {
  if (defined('MP_ACCESS_TOKEN') && strlen(MP_ACCESS_TOKEN) > 10) {
    $code = 0;
    $res = http_get('https://api.mercadopago.com/users/me', [
      'Authorization: Bearer ' . MP_ACCESS_TOKEN
    ], $code);

    $checks['mp']['me_status'] = $code;
    if ($code >= 200 && $code < 300) {
      $checks['mp']['token_valid'] = true;
    }
  }
} catch (Throwable $e) {
  $checks['mp']['me_status'] = 'error: ' . $e->getMessage();
}

// --- Probar generación de token de Firestore ---
try {
  require_once __DIR__ . '/google_token.php';
  if (is_file(SERVICE_ACCOUNT_JSON)) {
    $token = get_google_access_token(SERVICE_ACCOUNT_JSON);
    $checks['firestore']['service_account_valid'] = true;
    $checks['firestore']['token_obtained']        = is_string($token) && strlen($token) > 20;
  }
} catch (Throwable $e) {
  $checks['firestore']['service_account_valid'] = false;
  $checks['firestore']['token_obtained']        = false;
}

// --- Salida final ---
echo json_encode([
  'ok'     => true,
  'now'    => date('c'),
  'checks' => $checks
], JSON_UNESCAPED_SLASHES);
