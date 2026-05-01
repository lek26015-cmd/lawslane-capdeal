
require('dotenv').config();
const admin = require('firebase-admin');

async function debugContract() {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: "studio-3946808940-28553",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  }

  const db = admin.firestore();
  const contractId = '788b2dd8-efdd-438d-a012-ffbcf0574d6b';
  const doc = await db.collection('contracts').doc(contractId).get();
  
  if (doc.exists) {
    console.log("Contract found:");
    console.log(JSON.stringify(doc.data(), null, 2));
  } else {
    console.log("Contract NOT found.");
  }
}

debugContract().catch(console.error);
