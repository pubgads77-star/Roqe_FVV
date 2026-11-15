import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import fs from 'fs';

const SERVICE_ACCOUNT = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));

if (!getApps().length) {
  initializeApp({ credential: cert(SERVICE_ACCOUNT) });
}
const db = getFirestore();

async function deleteBookingClosures() {
  console.log('🗑️ Deleting Booking.com closures from apartmentClosures...');
  
  const snapshot = await db.collection('apartmentClosures')
    .where('source', '==', 'booking.com')
    .get();
  
  if (snapshot.empty) {
    console.log('ℹ️ No booking.com closures found');
    return;
  }
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`✅ Deleted ${snapshot.size} booking.com closures`);
}

deleteBookingClosures()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Failed:', err);
    process.exit(1);
  });