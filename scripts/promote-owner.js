/**
 * One-time script: promote a user to OWNER role in Firestore.
 * Run with: node scripts/promote-owner.js <email>
 * Example:  node scripts/promote-owner.js contact.subhroy@gmail.com
 */
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(
  __dirname,
  '../openify-studio-firebase-adminsdk-fbsvc-8938483736.json'
));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function promoteToOwner(email) {
  if (!email) {
    console.error('Usage: node scripts/promote-owner.js <email>');
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  console.log(`Looking up user: ${normalizedEmail}`);

  // Firestore doc id = email (from createUser which uses email as the doc id)
  const docRef = db.collection('users').doc(normalizedEmail);
  const doc = await docRef.get();

  if (doc.exists) {
    const data = doc.data();
    console.log(`Found user doc: role=${data.role}`);
    await docRef.update({ role: 'OWNER', updatedAt: new Date().toISOString() });
    console.log(`✅ Promoted ${normalizedEmail} to OWNER.`);
    return;
  }

  // Try querying by email field as fallback
  const snap = await db.collection('users').where('username', '==', normalizedEmail).limit(1).get();
  if (!snap.empty) {
    const d = snap.docs[0];
    console.log(`Found user via query: id=${d.id}, role=${d.data().role}`);
    await d.ref.update({ role: 'OWNER', updatedAt: new Date().toISOString() });
    console.log(`✅ Promoted ${normalizedEmail} to OWNER.`);
    return;
  }

  console.error(`❌ User not found in Firestore: ${normalizedEmail}`);
  console.log('Listing all users:');
  const all = await db.collection('users').get();
  all.forEach((d) => {
    const data = d.data();
    console.log(`  id=${d.id}  username=${data.username}  role=${data.role}`);
  });
  process.exit(1);
}

promoteToOwner(process.argv[2])
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
