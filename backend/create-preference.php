<?php
// ============================================
// backend/create-preference.php
// Crea una preferencia de pago (Checkout Pro, pago único)
// Payload mínimo para evitar bloqueos de "PolicyAgent"
// ============================================

require_once __DIR__ . '/config.php';

// ─────────────────────────────────────────────────────────────
// CORS básico (útil si llamás desde Electron o web)
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// ─────────────────────────────────────────────────────────────
// Helpers
function read_json_body() {
  $ctype = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
  $raw   = file_get_contents('php://input');
  if (stripos($ctype, 'application/json') !== false) {
    $data = json_decode($raw, true);
    if (is_array($data)) return $data;
  }
  // fallback a POST clásico
  return [
    'uid'         => $_POST['uid']         ?? null,
    'email'       => $_POST['email']       ?? null,
    'amount'      => $_POST['amount']      ?? null,
    'description' => $_POST['description'] ?? null,
  ];
}

function current_base_url() {
  $https  = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
         || (($_SERVER['SERVER_PORT'] ?? null) == 443);
  $scheme = $https ? 'https' : 'http';
  $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
  $dir    = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\');
  return $scheme . '://' . $host . $dir; // en tu caso: https://exentrait.com/api
}

// Logging simple
function mp_log($line) {
  @file_put_contents(__DIR__ . '/mp.log', date('c') . ' | ' . $line . PHP_EOL, FILE_APPEND);
}

// ─────────────────────────────────────────────────────────────
// Validación de entrada
$in          = read_json_body();
$uid         = isset($in['uid']) ? trim((string)$in['uid']) : '';
$email       = isset($in['email']) ? trim((string)$in['email']) : '';
$amount      = $in['amount'] ?? null;
$description = trim((string)($in['description'] ?? 'Exentra Gym - Cuota mensual'));

if (!$uid) {
  http_response_code(400);
  echo json_encode(['error' => 'uid requerido']);
  exit;
}
if (!is_numeric($amount)) {
  http_response_code(400);
  echo json_encode(['error' => 'amount numérico requerido']);
  exit;
}

$amount = (float)$amount;
if ($amount <= 0) {
  http_response_code(400);
  echo json_encode(['error' => 'amount debe ser > 0']);
  exit;
}
// Resguardo razonable
if ($amount > 2000000) {
  http_response_code(400);
  echo json_encode(['error' => 'amount fuera de rango']);
  exit;
}

// ─────────────────────────────────────────────────────────────
// URLs de retorno y webhook
$base = current_base_url(); // ej: https://exentrait.com/api

// Podés sobreescribir con ENV si querés:
$successUrl = env('MP_SUCCESS_URL', $base . '/success.html');
$failureUrl = env('MP_FAILURE_URL', $base . '/failure.html');
$pendingUrl = env('MP_PENDING_URL', $base . '/pending.html');

// Webhook REAL que tenés subido en el hosting
$notificationUrl = env(
  'MP_WEBHOOK_URL',
  'https://exentrait.com/api/mp-webhook.php'
);

// ─────────────────────────────────────────────────────────────
// Payload mínimo (evita disparar “PolicyAgent”):
// - Sin payer
// - Sin binary_mode
// - Sin statement_descriptor
$payload = [
  'items' => [[
    'title'       => $description ?: 'Exentra Gym - Cuota',
    'quantity'    => 1,
    'currency_id' => 'ARS',
    'unit_price'  => round($amount, 2),
  ]],

  // Para que el webhook pueda identificar el usuario
  'external_reference' => $uid,

  'back_urls' => [
    'success' => $successUrl,
    'failure' => $failureUrl,
    'pending' => $pendingUrl,
  ],
  'auto_return'      => 'approved',
  'notification_url' => $notificationUrl,

  // metadata útil: no molesta a PolicyAgent
  'metadata' => [
    'uid'    => $uid,
    'source' => 'exentra-electron',
    'months' => 1, // si después querés sumar más de un mes en el webhook
  ],
];

// ─────────────────────────────────────────────────────────────
// Llamada a MP
$ch = curl_init('https://api.mercadopago.com/checkout/preferences');
curl_setopt_array($ch, [
  CURLOPT_POST           => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER     => [
    'Authorization: Bearer ' . MP_ACCESS_TOKEN,
    'Content-Type: application/json',
  ],
  CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
  CURLOPT_CONNECTTIMEOUT => 10,
  CURLOPT_TIMEOUT        => 25,
]);

$res = curl_exec($ch);
if ($res === false) {
  $err = curl_error($ch);
  mp_log("PREF-ERR CURL: $err");
  http_response_code(500);
  echo json_encode(['error' => 'curl error: ' . $err]);
  exit;
}

$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$data = json_decode($res, true);

// Log útil para diagnósticos de políticas
if ($http >= 300) {
  mp_log("PREF-ERR HTTP=$http | RES=" . substr($res, 0, 800));
  http_response_code($http);
  // Pasamos el error tal cual para que lo veas en el front
  echo $res;
  exit;
}

if (!is_array($data) || empty($data['id'])) {
  mp_log('PREF-ERR sin id en respuesta: ' . substr($res, 0, 800));
  http_response_code(502);
  echo json_encode(['error' => 'Respuesta inválida de MP']);
  exit;
}

// ─────────────────────────────────────────────────────────────
// OK
mp_log('PREF-OK id=' . $data['id'] . ' uid=' . $uid . ' amount=' . $amount);

echo json_encode([
  'id'                 => $data['id'],
  'init_point'         => $data['init_point']         ?? null,
  'sandbox_init_point' => $data['sandbox_init_point'] ?? null,
  'external_reference' => $uid,
  'status'             => 'ok',
], JSON_UNESCAPED_SLASHES);
