import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import fs from 'fs';
import path from 'path';

// ===== Firebase Config =====
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
const storage = getStorage(app);
const BUCKET_FOLDER = 'apartment-images';
const PUBLIC_ASSETS_DIR = path.join(process.cwd(), 'public', 'assets', 'aistudio');

// ===== APARTMENT IMAGES MAP (from apartmentsData.ts) =====
const apartmentImages = {
  'apt-01': [
    'WhatsApp_Image_2026-11-09_at_11.50.27_AM_f8a97ec8.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.48_AM_d509cd87.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__4__a725e912.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__1__9efe1d40.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM_b108f2b3.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__2__c5b02101.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__5__44c569a2.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__3__cdd6399c.jpeg',
  ],
  'apt-02': [
    'WhatsApp_Image_2026-11-09_at_11.51.09_AM_eaad924e.jpeg',
    'WhatsApp_Image_2026-11_-09_at_11.51.09_AM_7914d2c9.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.48_AM_d509cd87.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__4__a725e912.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__1__9efe1d40.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM_b108f2b3.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__2__c5b02101.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__5__44c569a2.jpeg',
    'WhatsApp_Image_2026-11-09_at_11.49.49_AM__3__cdd6399c.jpeg',
  ],
};

async function uploadFile(apartmentId: string, fileName: string) {
  const filePath = path.join(PUBLIC_ASSETS_DIR, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  ملف غير موجود: ${fileName}`);
    return false;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  
  const storagePath = `${BUCKET_FOLDER}/${apartmentId}/${fileName}`;
  const storageRef = ref(storage, storagePath);
  
  try {
    await uploadBytes(storageRef, fileBuffer, {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000',
    });
    
    const url = await getDownloadURL(storageRef);
    console.log(`  ✅ تم رفع: ${storagePath}`);
    console.log(`     🔗 ${url}`);
    return true;
  } catch (error) {
    console.log(`  ❌ فشل رفع ${fileName}: ${error}`);
    return false;
  }
}

async function main() {
  console.log('🚀 بدء ترحيل الصور إلى Firebase Storage...\n');
  console.log(`📁 مجلد المصدر: ${PUBLIC_ASSETS_DIR}`);
  console.log(`☁️  Bucket: ${firebaseConfig.storageBucket}/${BUCKET_FOLDER}\n`);

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const [aptId, images] of Object.entries(apartmentImages)) {
    console.log(`📦 جاري رفع صور ${aptId} (${images.length} صورة)...`);
    
    for (const fileName of images) {
      const success = await uploadFile(aptId, fileName);
      if (success) totalSuccess++;
      else totalFailed++;
    }
    console.log(`   ✔️  اكتمل ${aptId}\n`);
  }

  console.log('🎉 انتهى الترحيل!');
  console.log(`   ✅ نجح: ${totalSuccess}`);
  console.log(`   ❌ فشل: ${totalFailed}`);
}

main().catch(console.error);