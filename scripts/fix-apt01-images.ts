import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDzCDKimwd5FiXR4pydso6ikqLyYijD0kI",
  authDomain: "roqi-apartments.firebaseapp.com",
  databaseURL: "https://roqi-apartments-default-rtdb.firebaseio.com",
  projectId: "roqi-apartments",
  storageBucket: "roqi-apartments.firebasestorage.app",
  messagingSenderId: "1020177078202",
  appId: "1:1020177078202:web:2e04bad2dcc425cc1a6f83",
  measurementId: "G-7LG0T6YZGD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixApt01Images() {
  console.log('🔧 إصلاح صور الشقة 1...\n');

  const aptRef = doc(db, 'apartments', 'apt-01');
  const aptSnap = await getDoc(aptRef);
  
  if (!aptSnap.exists()) {
    console.log('❌ المستند غير موجود');
    return;
  }

  const data = aptSnap.data();
  const images = data.images || [];
  
  console.log(`📊 الصور الحالية: ${images.length}`);
  images.forEach((img: any, i: number) => {
    console.log(`  ${i + 1}. ${img.title} - ${img.url?.substring(0, 80)}...`);
  });

  // URLs الصحيحة (الموجودة في Supabase Storage)
  const validUrls = [
    'WhatsApp_Image_2026-11-09_at_11.49.48_AM_d509cd87.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__1__9efe1d40.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__2__c5b02101.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__3__cdd6399c.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__4__a725e912.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__5__44c569a2.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM_b108f2b3.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.50.27_AM_f8a97ec8.jpeg',
  ];

  // فلترة الصور - الاحتفاظ بالتي لها URLs صحيحة فقط
  const cleanImages = images.filter((img: any) => 
    validUrls.some(valid => img.url?.includes(valid))
  );

  console.log(`\n✅ الصور الصحيحة: ${cleanImages.length}`);
  console.log(`🗑️ سيتم حذف: ${images.length - cleanImages.length} صورة مكسورة`);

  // تحديث Firestore
  await updateDoc(doc(db, 'apartments', 'apt-01'), {
    images: cleanImages,
    updatedAt: serverTimestamp()
  });

  console.log('\n✅ تم الإصلاح بنجاح!');
  console.log(`📊 الصور النهائية: ${cleanImages.length}`);
}

fixApt01Images().catch(console.error);