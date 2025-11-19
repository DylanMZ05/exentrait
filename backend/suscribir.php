<?php
// ============================================
// backend/suscribir.php
// Redirige (302) al Checkout de Suscripción de Mercado Pago
// Requiere: preapproval_plan_id válido en ENV o hardcodeado
// ============================================

require_once __DIR__ . '/config.php';

// ─────────────────────────────────────────────────────────────
// 1) ID del plan (preapproval_plan_id)
//    - Configurá en tu hosting: MP_PREAPPROVAL_PLAN_ID
//    - O hardcodeá abajo como fallback (no recomendado)
// ─────────────────────────────────────────────────────────────
$PLAN_ID = env('MP_PREAPPROVAL_PLAN_ID', '');
if (!$PLAN_ID) {
  // Fallback (opcional): poner tu plan acá si no usás ENV
  // $PLAN_ID = '2dd3a1baaa864491ad1028213f6d283c';
}

if (!$PLAN_ID) {
  // No tenemos plan configurado → error claro
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['error' => 'Falta MP_PREAPPROVAL_PLAN_ID en el entorno o en el archivo.']);
  exit;
}

// ─────────────────────────────────────────────────────────────
/** 2) Datos opcionales para tracking (no viajan a MP en esta URL):
 *  Los guardamos en cookies por si después tu front los quiere leer.
 *  - uid: tu ID de usuario (Firestore/Auth)
 *  - email: correo del usuario
 */
$uid   = isset($_GET['uid'])   ? trim($_GET['uid'])   : '';
$email = isset($_GET['email']) ? trim($_GET['email']) : '';

// Cookies (opcionales). Usamos flags seguros si hay HTTPS.
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['SERVER_PORT'] ?? null) == 443);
$cookieOpts = [
  'expires'  => time() + 3600,
  'path'     => '/',
  'secure'   => $isHttps,   // true si tu sitio es HTTPS
  'httponly' => true,
  'samesite' => 'Lax',
];
if ($uid)   setcookie('mp_uid',   $uid,   $cookieOpts);
if ($email) setcookie('mp_email', $email, $cookieOpts);

// ─────────────────────────────────────────────────────────────
// 3) URL de Checkout de Suscripción de Mercado Pago (AR)
//    *No* acepta amount/description aquí: eso lo define el plan.
// ─────────────────────────────────────────────────────────────
$checkoutUrl = 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=' . urlencode($PLAN_ID);

// Si querés intentar pasar un external_reference (no siempre lo toma en esta URL):
// $checkoutUrl .= '&external_reference=' . urlencode($uid);

// ─────────────────────────────────────────────────────────────
// 4) Redirección 302
// ─────────────────────────────────────────────────────────────
header('Location: ' . $checkoutUrl, true, 302);
exit;
