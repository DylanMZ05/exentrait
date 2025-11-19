<?php
// ============================================
// backend/mp-webhook.php
// Webhook Mercado Pago (Checkout Pro - pago único)
// Actualiza Firestore: fechaVencimiento, activo, actualizadoEn, lastPaymentId
// Maneja idempotencia y logs extendidos
// ============================================
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/firestore.php';

// --------------------------------------------
// LOG SHORTCUT
// --------------------------------------------
function log_mp($msg) {
  @file_put_contents(__DIR__ . '/mp.log', date('c') . " | $msg" . PHP_EOL, FILE_APPEND);
}

function j($v) {
  return json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

// --------------------------------------------
// Valida firma MP (opcional)
// --------------------------------------------
function verify_signature_or_skip() {
  // Implementación futura si querés validar firma.
  return true;
}

// --------------------------------------------
// Extraer paymentId desde resource: ".../payments/12345"
// --------------------------------------------
function payment_id_from_resource($resourceUrl) {
  if (!$resourceUrl) return null;
  if (preg_match('~/(?:v1/)?payments/(\d+)~', $resourceUrl, $m)) {
    return $m[1];
  }
  return null;
}

// --------------------------------------------
// MP GET helper
// --------------------------------------------
function mp_get($path, &$codeOut = 0) {
  $ch = curl_init("https://api.mercadopago.com/$path");
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . MP_ACCESS_TOKEN],
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT        => 20,
  ]);

  $res = curl_exec($ch);
  if ($res === false) {
    $codeOut = 0;
    throw new Exception('Curl error MP GET: ' . curl_error($ch));
  }

  $codeOut = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $json = json_decode($res, true);
  return is_array($json) ? $json : [];
}

// --------------------------------------------
// Suma meses "humanos" (mantiene fin de mes)
// --------------------------------------------
function add_months(DateTime $base, int $months) {
  $d = clone $base;
  for ($i = 0; $i < $months; $i++) {
    $day  = (int)$d->format('d');
    $last = (int)$d->format('t');
    $d->modify('first day of next month');
    $newLast = (int)$d->format('t');

    if ($day === $last) {
      // si era fin de mes, caer al nuevo fin de mes
      $d->setDate((int)$d->format('Y'), (int)$d->format('m'), $newLast);
    } else {
      // si el día existe, usarlo; si no, caer al fin de mes
      $keepDay = min($day, $newLast);
      $d->setDate((int)$d->format('Y'), (int)$d->format('m'), $keepDay);
    }
  }
  return $d;
}

// --------------------------------------------
// GET → ping, no romper
// --------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  header('Content-Type: text/plain; charset=utf-8');
  echo "ok";
  exit;
}

// --------------------------------------------
// POST Webhook
// --------------------------------------------
header('Content-Type: text/plain; charset=utf-8');

try {
  // Leer raw
  $raw = file_get_contents('php://input');
  log_mp("RAW: " . substr($raw ?? '', 0, 1500));

  $json = json_decode($raw, true);
  if (!is_array($json)) {
    log_mp("INVALID_JSON");
    http_response_code(200);
    echo 'ok-invalid';
    return;
  }

  if (!verify_signature_or_skip()) {
    log_mp("INVALID_SIGNATURE");
    http_response_code(200);
    echo 'ok-invalid-signature';
    return;
  }

  // --------------------------------------------
  // Detectar paymentId
  // --------------------------------------------
  $type      = strtolower($json['type'] ?? $json['topic'] ?? $json['action'] ?? '');
  $dataId    = $json['data']['id'] ?? null;
  $idField   = $json['id'] ?? null;
  $resource  = $json['resource'] ?? null;

  $paymentId = null;

  if (is_numeric($dataId)) {
    $paymentId = (string)$dataId;
  } elseif (is_numeric($idField)) {
    $paymentId = (string)$idField;
  } elseif ($resource) {
    $paymentId = payment_id_from_resource($resource);
  }

  if (!$paymentId && strpos($type, 'payment') === false) {
    log_mp("NO-PAYMENT type=$type json=" . j($json));
    http_response_code(200);
    echo 'ok-non-payment';
    return;
  }

  if (!$paymentId) {
    log_mp("NO-PAYMENT-ID json=" . j($json));
    http_response_code(200);
    echo 'ok-no-id';
    return;
  }

  // --------------------------------------------
  // Obtener pago desde Mercado Pago
  // --------------------------------------------
  $code = 0;
  $payment = mp_get("v1/payments/$paymentId", $code);

  if (in_array($code, [401, 403, 404, 422], true)) {
    log_mp("PAYMENT-$paymentId IGNORE HTTP=$code");
    http_response_code(200);
    echo 'ok-ignore';
    return;
  }
  if ($code >= 300) {
    throw new Exception("MP GET payments/$paymentId HTTP $code");
  }

  $status = strtolower($payment['status'] ?? '');

  if ($status !== 'approved') {
    log_mp("PAYMENT-$paymentId status=$status skip");
    http_response_code(200);
    echo 'ok-skip-non-approved';
    return;
  }

  // --------------------------------------------
  // UID
  // --------------------------------------------
  $uid = $payment['metadata']['uid'] ?? $payment['external_reference'] ?? null;

  if (!$uid) {
    log_mp("PAYMENT-$paymentId NO-UID metadata=" . j($payment['metadata'] ?? []) . " extref=" . ($payment['external_reference'] ?? null));
    http_response_code(200);
    echo 'ok-no-uid';
    return;
  }

  // --------------------------------------------
  // Datos del pago
  // --------------------------------------------
  $amount = (float)($payment['transaction_amount'] ?? 0);
  $months = (int)($payment['metadata']['months'] ?? 1);
  if ($months < 1) $months = 1;

  $tz = new DateTimeZone('America/Argentina/Buenos_Aires');

  if (!empty($payment['date_approved'])) {
    $paidAt = new DateTime($payment['date_approved']);
  } elseif (!empty($payment['date_created'])) {
    $paidAt = new DateTime($payment['date_created']);
  } else {
    $paidAt = new DateTime('now', $tz);
  }

  $now = new DateTime('now', $tz);

  // --------------------------------------------
  // Obtener usuario desde Firestore
  // --------------------------------------------
  $userDoc = firestore_get_user($uid);
  $fields  = $userDoc['fields'] ?? [];

  // --------------------------------------------
  // Idempotencia
  // --------------------------------------------
  $lastPaymentId = $fields['lastPaymentId']['stringValue'] ?? null;

  if ($lastPaymentId && $lastPaymentId === (string)$paymentId) {
    log_mp("PAYMENT-$paymentId DUPLICATE uid=$uid");
    http_response_code(200);
    echo 'ok-duplicate';
    return;
  }

  // --------------------------------------------
  // Base de vencimiento
  // --------------------------------------------
  $base = clone $now;

  if (!empty($fields['fechaVencimiento']['timestampValue'])) {
    try {
      $actual = new DateTime($fields['fechaVencimiento']['timestampValue']);
      if ($actual > $base) {
        $base = $actual;
      }
    } catch (Throwable $e) {}
  }

  // --------------------------------------------
  // Calcular nuevo vencimiento
  // --------------------------------------------
  $nuevoVto = add_months($base, $months);

  // --------------------------------------------
  // Actualizar Firestore
  // --------------------------------------------
  firestore_update_user_fields($uid, [
    'fechaVencimiento'  => $nuevoVto,
    'activo'            => true,
    'actualizadoEn'     => $now,
    'lastPaymentId'     => (string)$paymentId,
    'lastPaymentAt'     => $paidAt,
    'lastPaymentAmount' => $amount,
    'lastPaymentStatus' => $status,
  ]);

  log_mp("OK uid=$uid payment=$paymentId amount=$amount months=$months nuevoVto=" . $nuevoVto->format('c'));

  http_response_code(200);
  echo 'ok';

} catch (Throwable $e) {
  log_mp("ERROR: " . $e->getMessage());
  http_response_code(200);
  echo 'ok-softfail';
}
