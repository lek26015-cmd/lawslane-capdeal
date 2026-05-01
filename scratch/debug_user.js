
require('dotenv').config();
const admin = require('firebase-admin');

async function debugUser() {
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
  const userId = 'wS9w7ysNYUajNsBYZ6C7n2Afe9H3';
  const userDoc = await db.collection('users').doc(userId).get();
  
  if (userDoc.exists) {
    console.log("User found in 'users' collection:");
    console.log(JSON.stringify(userDoc.data(), null, 2));
  } else {
    console.log("User NOT found in 'users' collection.");
  }
}

debugUser().catch(console.error);
