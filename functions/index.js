/**
 * ARCHIVO: index.js
 * ----------------------------------------------------
 * Contiene todas las Cloud Functions para el proyecto.
 * ----------------------------------------------------
 */

// Importaciones necesarias para Firebase Functions y Admin SDK
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// ==========================================================
// 🛑 1. INICIALIZACIÓN CRÍTICA DEL ADMIN SDK
// Esto proporciona los permisos elevados necesarios para escribir en Firestore.
// Se inicializa sin argumentos para que use las credenciales de la Cuenta de Servicio
// de Google Cloud, que debe tener el rol de "Editor" o "Propietario".
// ==========================================================
admin.initializeApp(); 

const db = admin.firestore();

/**
 * ==========================================================
 * CLOUD FUNCTION: createInitialUserDoc
 * ----------------------------------------------------------
 * Propósito: Crear el documento inicial del dueño en la colección 'usuariosAuth'
 * después de que un nuevo usuario se registra vía Firebase Auth en el frontend.
 * Esto asegura que solo las cuentas con documentos creados correctamente puedan
 * acceder a la aplicación.
 * ==========================================================
 */
exports.createInitialUserDoc = functions.https.onCall(async (data, context) => {
    
    // 1. Verificación de seguridad: El usuario que llama debe estar autenticado.
    // Esto previene que usuarios no logueados llamen a la función.
    if (!context.auth) {
        console.warn("Llamada no autenticada a createInitialUserDoc.");
        throw new functions.https.HttpsError('unauthenticated', 'La función debe ser llamada por un usuario autenticado.');
    }
    
    // Obtener datos del request: UID (User ID) y email del usuario recién registrado.
    const { uid, email } = data;

    if (!uid || !email) {
        console.error("Faltan argumentos requeridos: UID o Email.");
        throw new functions.https.HttpsError('invalid-argument', 'UID y email son requeridos.');
    }

    const userDocRef = db.collection('usuariosAuth').doc(uid);
    
    // Configuramos la fecha de vencimiento inicial a ayer para forzar el pago/activación
    // en el flujo de chequeo de suscripción del frontend.
    const vencidoAyer = new Date(Date.now() - 24 * 60 * 60 * 1000); 

    const initialData = {
        uid,
        email: email.toLowerCase(),
        activo: false, // Inactivo por defecto, requiere pago.
        // Utiliza el SDK de Admin para los Timestamps y FieldValues
        lastPaymentDate: admin.firestore.Timestamp.fromDate(vencidoAyer), 
        fechaVencimiento: admin.firestore.Timestamp.fromDate(vencidoAyer), 
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
        origen: "signup-cloud-function"
    };

    try {
        // 2. Escribir el documento con permisos de Admin.
        // { merge: true } es opcional pero ayuda si el documento existiera por alguna razón.
        await userDocRef.set(initialData, { merge: true });
        
        console.log(`Documento inicial creado con éxito para UID: ${uid}`);

        return { success: true, message: `Documento de dueño para ${email} creado correctamente.` };
    } catch (error) {
        // 3. Manejo de errores: Capturamos el error (ej. PERMISSION_DENIED) y lo reportamos.
        console.error(`Error Admin SDK al escribir en Firestore para UID ${uid}:`, error);
        
        // Re-lanza un error HTTPS para que el frontend pueda manejarlo.
        // Esto es lo que se traduce en el 'FirebaseError: Internal' que ves en la consola del navegador.
        throw new functions.https.HttpsError('internal', `Fallo en el servidor al crear el documento: ${error.message}`);
    }
});