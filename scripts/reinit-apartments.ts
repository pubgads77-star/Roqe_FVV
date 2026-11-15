import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { APARTMENTS } from '../src/data/apartmentsData';

// Initialize Firebase Admin
// You need to set GOOGLE_APPLICATION_CREDENTIALS env var or provide service account key
const app = initializeApp({
  projectId: 'roqi-apartments',
});

const db = getFirestore(app);

async function deleteCollection(collectionPath: string, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.limit(batchSize).get();
  
  if (snapshot.empty) {
    console.log(`Collection ${collectionPath} is already empty`);
    return 0;
  }
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  
  console.log(`Deleted ${snapshot.size} documents from ${collectionPath}`);
  
  // Recursively delete if more documents exist
  const deleted = await deleteCollection(collectionPath, batchSize);
  return snapshot.size + deleted;
}

async function reinitializeApartments() {
  console.log('🔄 Starting apartments reinitialization...');
  
  // Step 1: Delete existing apartments collection
  console.log('\n📥 Deleting existing apartments collection...');
  const deletedCount = await deleteCollection('apartments');
  console.log(`✅ Deleted ${deletedCount} total documents`);
  
  // Step 2: Reinitialize with new data
  console.log('\n📤 Creating new apartments from source data...');
  const batch = db.batch();
  
  for (const apt of APARTMENTS) {
    const docRef = db.collection('apartments').doc(apt.id);
    batch.set(docRef, {
      name: apt.name,
      pricePerNight: apt.pricePerNight,
      depositAmount: apt.depositAmount,
      capacity: apt.capacity,
      area: apt.area,
      rooms: apt.rooms,
      bathrooms: apt.bathrooms,
      beds: apt.beds,
      mainImage: apt.mainImage,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`  ✓ Prepared: ${apt.name} (${apt.id})`);
  }
  
  await batch.commit();
  console.log(`\n✅ Successfully created ${APARTMENTS.length} apartment(s)`);
  
  // Verify
  const verifySnap = await db.collection('apartments').get();
  console.log(`\n🔍 Verification: ${verifySnap.size} document(s) in collection`);
  verifySnap.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${doc.id}: name="${data.name}", price=${data.pricePerNight}`);
  });
  
  console.log('\n🎉 Reinitialization complete!');
  process.exit(0);
}

reinitializeApartments().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});