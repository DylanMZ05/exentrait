<?php
// ============================================
// backend/config.php
// Configuración general del backend Exentra Gym
// ============================================

// Zona horaria del servidor
date_default_timezone_set('America/Argentina/Buenos_Aires');

/**
 * Helper para leer variables de entorno con fallback
 */
function env($key, $default = null) {
  $v = getenv($key);
  return ($v !== false && $v !== null && $v !== '') ? $v : $default;
}

// ============================================
// Mercado Pago  (PRODUCCIÓN)
// ============================================
// ⚠️ Recomendado: NO hardcodear el token en repos públicos.
// En caso de emergencia, podés pegarlo acá directamente, como en este ejemplo.

define('MP_ACCESS_TOKEN', trim(env(
  'MP_ACCESS_TOKEN',
  // ← TOKEN DE PRODUCCIÓN (NO LA PUBLIC KEY)
  'APP_USR-4335702167016460-111307-6833e2b43c70ddaabd90516d9a4188b8-472435973'
)));
define('MP_WEBHOOK_SECRET', env('MP_WEBHOOK_SECRET', '9847c6a5b8802daf93287c310e2d1c6960a0f0c2767db2aafb77858271bbd90a')); // opcional para validar notificaciones

// ============================================
// Firebase / Firestore (REST API con Service Account)
// ============================================

define('FIREBASE_PROJECT_ID', env('FIREBASE_PROJECT_ID', 'exentra-gym'));
define(
  'FIRESTORE_BASE',
  'https://firestore.googleapis.com/v1/projects/' .
  FIREBASE_PROJECT_ID .
  '/databases/(default)/documents'
);

// Ruta local al Service Account JSON (NO subir a repos públicos)
define('SERVICE_ACCOUNT_JSON', __DIR__ . '/serviceAccountKey.json');

// Colección de usuarios en Firestore
define('USERS_COLLECTION_PATH', env('USERS_COLLECTION_PATH', 'usuariosAuth'));

// ============================================
// Encabezados comunes (CORS)
// ============================================
// Permite que la app Electron acceda a este backend sin bloqueo de origen

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Signature');

// Si es una pre-solicitud (OPTIONS), respondé inmediatamente
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}
