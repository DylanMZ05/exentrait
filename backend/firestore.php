<?php
// ============================================
// backend/firestore.php
// Utilidades mínimas para Firestore (REST API)
// Requiere: config.php y google_token.php
// ============================================
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/google_token.php';

// --------------------------------------------
// LOG opcional para detectar errores de Firestore
// --------------------------------------------
function fs_log($msg) {
  @file_put_contents(__DIR__ . '/mp.log', date('c') . " | FIRESTORE: $msg" . PHP_EOL, FILE_APPEND);
}

/**
 * Serializa un valor PHP a un Firestore Value
 * https://cloud.google.com/firestore/docs/reference/rest/v1/Value
 *
 * Soporta:
 * - DateTime -> timestampValue (FORZADO)
 * - bool     -> booleanValue
 * - int      -> integerValue (string)
 * - float    -> doubleValue
 * - null     -> nullValue
 * - string   -> stringValue
 * - array indexado  -> arrayValue.values[...]
 * - array asociativo -> mapValue.fields.{...}
 */
function fs_serialize_value($v) {

  // 🔥 FORZAMOS timestampValue para DateTime (muy importante)
  if ($v instanceof DateTime) {
    return [
      'timestampValue' => $v->format('Y-m-d\TH:i:sP')
    ];
  }

  if (is_bool($v)) {
    return ['booleanValue' => $v];
  }
  if (is_int($v)) {
    return ['integerValue' => (string)$v];
  }
  if (is_float($v)) {
    return ['doubleValue' => $v];
  }
  if ($v === null) {
    return ['nullValue' => null];
  }

  if (is_array($v)) {
    $isAssoc = array_keys($v) !== range(0, count($v) - 1);
    if ($isAssoc) {
      $fields = [];
      foreach ($v as $k => $vv) {
        $fields[$k] = fs_serialize_value($vv);
      }
      return ['mapValue' => ['fields' => $fields]];
    } else {
      $values = [];
      foreach ($v as $vv) {
        $values[] = fs_serialize_value($vv);
      }
      return ['arrayValue' => ['values' => $values]];
    }
  }

  return ['stringValue' => (string)$v];
}

/**
 * Construye la URL REST del documento de usuario.
 */
function fs_user_doc_url($uid) {
  return FIRESTORE_BASE . '/' . USERS_COLLECTION_PATH . '/' . rawurlencode($uid);
}

/**
 * GET documento de usuario.
 * Devuelve el JSON decodificado de Firestore o [] si 404.
 * Lanza Exception si otros códigos.
 */
function firestore_get_user($uid) {
  $token = get_google_access_token(SERVICE_ACCOUNT_JSON);

  $ch = curl_init(fs_user_doc_url($uid));
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
      'Authorization: Bearer ' . $token,
      'Content-Type: application/json'
    ],
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT        => 15,
  ]);

  $res = curl_exec($ch);
  if ($res === false) {
    throw new Exception('Curl error Firestore GET: ' . curl_error($ch));
  }

  $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);

  if ($http === 404) return [];
  if ($http >= 300) {
    fs_log("GET ERROR HTTP=$http RES=$res");
    throw new Exception("Firestore GET HTTP $http: $res");
  }

  return json_decode($res, true);
}

/**
 * PATCH (update) campos en el documento de usuario.
 * $fieldsAssoc = ['campo' => valorPHP, ...]
 * Devuelve el documento actualizado.
 */
function firestore_update_user_fields($uid, array $fieldsAssoc) {
  if (empty($fieldsAssoc)) return [];

  $token = get_google_access_token(SERVICE_ACCOUNT_JSON);

  // updateMask
  $mask = [];
  foreach ($fieldsAssoc as $k => $_) {
    $mask[] = 'updateMask.fieldPaths=' . urlencode($k);
  }
  $maskQuery = implode('&', $mask);

  // body
  $body = ['fields' => []];

  foreach ($fieldsAssoc as $k => $v) {

    // 🔥 Forzar timestampValue si es DateTime (evita errores de tipo en Firestore)
    if ($v instanceof DateTime) {
      $body['fields'][$k] = [
        'timestampValue' => $v->format('Y-m-d\TH:i:sP')
      ];
    } else {
      $body['fields'][$k] = fs_serialize_value($v);
    }
  }

  $url = fs_user_doc_url($uid);
  if ($maskQuery) $url .= '?' . $maskQuery;

  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => 'PATCH',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
      'Authorization: Bearer ' . $token,
      'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS     => json_encode($body),
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT        => 15,
  ]);

  $res = curl_exec($ch);

  if ($res === false) {
    fs_log("PATCH CURL ERROR: " . curl_error($ch));
    throw new Exception('Curl error Firestore PATCH: ' . curl_error($ch));
  }

  $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);

  if ($http >= 300) {
    fs_log("PATCH ERROR HTTP=$http RES=$res BODY=" . json_encode($body));
    throw new Exception("Firestore PATCH HTTP $http: $res");
  }

  fs_log("PATCH OK uid=$uid http=$http");

  return json_decode($res, true);
}

/**
 * PUT (set) documento entero (merge=false).
 */
function firestore_set_user($uid, array $fieldsAssoc) {
  $token = get_google_access_token(SERVICE_ACCOUNT_JSON);

  $body = ['fields' => []];
  foreach ($fieldsAssoc as $k => $v) {

    if ($v instanceof DateTime) {
      $body['fields'][$k] = [
        'timestampValue' => $v->format('Y-m-d\TH:i:sP')
      ];
    } else {
      $body['fields'][$k] = fs_serialize_value($v);
    }
  }

  $ch = curl_init(fs_user_doc_url($uid));
  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => 'PATCH',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
      'Authorization: Bearer ' . $token,
      'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS     => json_encode($body),
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT        => 15,
  ]);

  $res = curl_exec($ch);
  if ($res === false) {
    fs_log("SET CURL ERROR: " . curl_error($ch));
    throw new Exception('Curl error Firestore SET: ' . curl_error($ch));
  }

  $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  if ($http >= 300) {
    fs_log("SET ERROR HTTP=$http RES=$res BODY=" . json_encode($body));
    throw new Exception("Firestore SET HTTP $http: $res");
  }

  fs_log("SET OK uid=$uid");

  return json_decode($res, true);
}
