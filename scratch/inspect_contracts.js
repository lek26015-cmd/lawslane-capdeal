
require('dotenv').config();
const admin = require('firebase-admin');

async function debugContracts() {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!privateKey) {
    console.error("Missing FIREBASE_PRIVATE_KEY in .env");
    return;
  }

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
  console.log("Checking 'contracts' collection...");
  const snap1 = await db.collection('contracts').orderBy('createdAt', 'desc').limit(10).get();
  console.log(`Found ${snap1.size} recent contracts.`);
  snap1.docs.forEach(doc => {
    const data = doc.data();
    console.log(`Contract ID: ${doc.id}, ownerId: ${data.ownerId}, userId: ${data.userId}, title: ${data.title}, createdAt: ${data.createdAt?.toDate?.() || data.createdAt}`);
  });

  console.log("\nChecking 'cap-deals' collection...");
  const snap2 = await db.collection('cap-deals').orderBy('createdAt', 'desc').limit(10).get();
  console.log(`Found ${snap2.size} recent deals.`);
  snap2.docs.forEach(doc => {
    const data = doc.data();
    console.log(`Deal ID: ${doc.id}, ownerId: ${data.ownerId}, userId: ${data.userId}, title: ${data.title}, createdAt: ${data.createdAt?.toDate?.() || data.createdAt}`);
  });
}

debugContracts().catch(console.error);
