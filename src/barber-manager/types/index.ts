// import * as functions from 'firebase-functions';
// import * as admin from 'firebase-admin';

// // 1. INICIALIZACIÓN CRÍTICA DEL ADMIN SDK
// admin.initializeApp(); 

// const db = admin.firestore();

// /**
//  * Función de backend llamada por el frontend (Login.tsx) para crear el documento 
//  * inicial del dueño en 'usuariosAuth' después de un registro exitoso.
//  */
// export const createInitialUserDoc = functions.https.onCall(async (data: any, context) => {

//     if (!context.auth) {
//         throw new functions.https.HttpsError('unauthenticated', 'La función debe ser llamada por un usuario autenticado.');
//     }
    
//     const { uid, email } = data as { uid: string, email: string };

//     if (!uid || !email) {
//         throw new functions.https.HttpsError('invalid-argument', 'UID y email son requeridos.');
//     }

//     const userDocRef = db.collection('usuariosAuth').doc(uid);
    
//     const vencidoAyer = new Date(Date.now() - 24 * 60 * 60 * 1000); 

//     const initialData = {
//         uid,
//         email: email.toLowerCase(),
//         activo: false, 
//         lastPaymentDate: admin.firestore.Timestamp.fromDate(vencidoAyer), 
//         fechaVencimiento: admin.firestore.Timestamp.fromDate(vencidoAyer), 
//         creadoEn: admin.firestore.FieldValue.serverTimestamp(),
//         origen: "signup-cloud-function"
//     };

//     try {
//         await userDocRef.set(initialData, { merge: true });

//         return { success: true, message: `Documento de dueño para ${email} creado correctamente.` };
//     } catch (error: any) {
//         console.error("Error Admin SDK al escribir en Firestore:", error.message);
//         throw new functions.https.HttpsError('internal', `Fallo en el servidor al crear el documento: ${error.message}`);
//     }
// });