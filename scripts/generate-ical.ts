import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccount = require('../serviceAccountKey.json');

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: 'roqi-apartments'
  });
}

const db = getFirestore();

const APARTMENTS = ['apt-01', 'apt-02'];

function formatICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function generateICS(bookings: any[], apartmentName: string, apartmentId: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Roqii//Booking Calendar//AR',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:حجوزات ${apartmentName}`,
    `X-WR-TIMEZONE:Asia/Riyadh`,
  ];

  bookings.forEach(b => {
    if (b.status !== 'confirmed' && b.status !== 'pending') return;
    
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.bookingNumber}@roqii`,
      `DTSTART;VALUE=DATE:${formatICSDate(b.checkInDate)}`,
      `DTEND;VALUE=DATE:${formatICSDate(b.checkOutDate)}`,
      `SUMMARY:محجوز - ${b.guestName} (${apartmentName})`,
      `STATUS:${b.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
      `DESCRIPTION:حجز رقم ${b.bookingNumber}\\nالضيف: ${b.guestName}\\nالجوال: ${b.guestPhone}\\nالمدة: ${b.nights} ليالٍ\\nالمبلغ: ${b.totalAmount.toLocaleString('ar-SA')} ر.س`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

async function generateAll() {
  console.log('🚀 Starting iCal generation...');

  const publicDir = path.join(__dirname, '../public/ical');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  for (const aptId of APARTMENTS) {
    try {
      console.log(`\n📅 Processing ${aptId}...`);

      const bookingsSnap = await db.collection('bookings')
        .where('apartmentId', '==', aptId)
        .where('status', 'in', ['confirmed', 'pending'])
        .get();

      const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const aptSnap = await db.collection('apartments').doc(aptId).get();
      const aptName = aptSnap.data()?.name || `شقة ${aptId}`;

      const ics = generateICS(bookings, aptName, aptId);
      const filePath = path.join(publicDir, `${aptId}.ics`);

      fs.writeFileSync(filePath, ics, 'utf8');
      console.log(`✅ Generated ${filePath} (${bookings.length} bookings)`);

    } catch (error) {
      console.error(`❌ Error generating iCal for ${aptId}:`, error);
    }
  }

  // Combined calendar.ics (all apartments) — this is the file Booking.com imports.
  try {
    const allSnap = await db.collection('bookings')
      .where('status', 'in', ['confirmed', 'pending'])
      .get();
    const allBookings = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const combinedICS = generateICS(allBookings, 'جميع الشقق', 'all');
    fs.writeFileSync(path.join(__dirname, '../public/calendar.ics'), combinedICS, 'utf8');
    console.log(`✅ Generated public/calendar.ics (${allBookings.length} bookings)`);
  } catch (error) {
    console.error('❌ Error generating combined calendar.ics:', error);
  }

  console.log('\n🎉 iCal generation complete!');
  process.exit(0);
}

generateAll().catch(console.error);