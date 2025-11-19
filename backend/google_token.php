<?php
// ============================================
// backend/google_token.php
// Genera un Access Token OAuth2 para usar Firestore REST con Service Account.
// ============================================

/**
 * Genera un access_token usando JWT firmado con la private_key del Service Account.
 * @param string $saPath Ruta al JSON del Service Account.
 * @param string $scope  Scope(s) separados por espacio. Por defecto: datastore (Firestore).
 * @return string access_token
 * @throws Exception si falta el archivo, campos, o hay errores de red/openssl.
 */
function get_google_access_token(string $saPath, string $scope = 'https://www.googleapis.com/auth/datastore'): string {
  if (!is_file($saPath)) {
    throw new Exception("Service Account JSON no encontrado en: $saPath");
  }

  $json = file_get_contents($saPath);
  if ($json === false) {
    throw new Exception("No se pudo leer el Service Account JSON.");
  }

  $sa = json_decode($json, true);
  if (!is_array($sa)) {
    throw new Exception("Service Account JSON inválido.");
  }

  foreach (['client_email', 'private_key'] as $k) {
    if (empty($sa[$k])) {
      throw new Exception("Campo '$k' faltante en el Service Account JSON.");
    }
  }

  // JWT header & claim
  $header = ['alg' => 'RS256', 'typ' => 'JWT'];
  $now    = time();

  $claim = [
    'iss'   => $sa['client_email'],
    'scope' => $scope,                                    // varios scopes separados por espacio
    'aud'   => 'https://oauth2.googleapis.com/token',
    'iat'   => $now,
    'exp'   => $now + 3600,                               // 1 hora
  ];

  // Base64URL (sin padding)
  $base64UrlHeader = rtrim(strtr(base64_encode(json_encode($header, JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');
  $base64UrlClaim  = rtrim(strtr(base64_encode(json_encode($claim,  JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');
  $data            = $base64UrlHeader . '.' . $base64UrlClaim;

  // Firmar con la private_key
  $pkey = openssl_pkey_get_private($sa['private_key']);
  if ($pkey === false) {
    throw new Exception('No se pudo cargar la private_key del Service Account.');
  }
  $ok = openssl_sign($data, $signature, $pkey, OPENSSL_ALGO_SHA256);
  if (!$ok) {
    throw new Exception('Fallo al firmar el JWT con openssl.');
  }
  $jwt = $data . '.' . rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');

  // Intercambiar JWT por access_token
  $postFields = http_build_query([
    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    'assertion'  => $jwt,
  ]);

  $ch = curl_init('https://oauth2.googleapis.com/token');
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $postFields,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT        => 15,
  ]);

  $res  = curl_exec($ch);
  if ($res === false) {
    throw new Exception('Curl error token: ' . curl_error($ch));
  }
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  if ($code >= 300) {
    throw new Exception("OAuth token HTTP $code: $res");
  }

  $data = json_decode($res, true);
  if (!isset($data['access_token'])) {
    throw new Exception('La respuesta de Google no contiene access_token.');
  }

  return $data['access_token'];
}
