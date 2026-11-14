import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import ics from 'ics';
const { createEvents } = ics;
import fs from 'fs';

const SERVICE_ACCOUNT = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));

if (!getApps().length) {
  initializeApp({ credential: cert(SERVICE_ACCOUNT) });
}
const db = getFirestore();

function formatDateForFirestore(date) {
  return date.toISOString().split('T')[0];
}

function toICSDate(date) {
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes()
  ];
}

async function generateICAL() {
  console.log('📤 Generating iCal from Firestore...');
  
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const bookingsSnap = await db.collection('bookings')
    .where('status', 'in', ['confirmed', 'pending'])
    .get();
  
  console.log(`📊 Found ${bookingsSnap.docs.length} bookings total`);
  
  const todayStr = formatDateForFirestore(startOfToday);
  const bookingsDocs = bookingsSnap.docs.filter(doc => {
    const data = doc.data();
    return data.checkOutDate >= todayStr;
  });
  
  console.log(`📅 ${bookingsDocs.length} bookings after date filter`);
  
  const closuresSnap = await db.collection('apartmentClosures')
    .where('apartmentId', '==', 'apt-01')
    .get();
  
  console.log(`🔒 Found ${closuresSnap.docs.length} closures total`);
  
  const closuresDocs = closuresSnap.docs.filter(doc => {
    const data = doc.data();
    return data.endDate >= todayStr;
  });
  
  console.log(`🔒 ${closuresDocs.length} closures after date filter`);
  
  const events = [];
  
  for (const doc of bookingsDocs) {
    const b = doc.data();
    if (!b.checkInDate || !b.checkOutDate) continue;
    
    const checkIn = new Date(b.checkInDate + 'T00:00:00');
    const checkOut = new Date(b.checkOutDate + 'T00:00:00');
    
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkOut <= startOfToday) continue;
    
    const bookingNumber = b.bookingNumber || doc.id;
    const guestName = b.guestName || 'ضيف';
    const guestPhone = b.guestPhone || '';
    const guestCount = b.guestCount || 1;
    const apartmentsCount = b.apartmentsCount || 1;
    const totalAmount = b.totalAmount || 0;
    const status = b.status || 'pending';
    
    events.push({
      start: toICSDate(checkIn),
      end: toICSDate(checkOut),
      title: `حجز: ${guestName}`,
      description: `حجز رقم: ${bookingNumber}\nالمستأجر: ${guestName}\nالجوال: ${guestPhone}\nعدد الضيوف: ${guestCount}\nعدد الشقق: ${apartmentsCount}\nالمبلغ: ${totalAmount.toLocaleString('ar-SA')} ر.س\nالحالة: ${status}`,
      uid: `booking-${bookingNumber}@roqii`,
      status: 'CONFIRMED',
      busyStatus: 'BUSY'
    });
  }
  
  for (const doc of closuresDocs) {
    const c = doc.data();
    if (!c.startDate || !c.endDate) continue;
    
    const start = new Date(c.startDate + 'T00:00:00');
    const end = new Date(c.endDate + 'T00:00:00');
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= startOfToday) continue;
    
    const note = c.note || 'إغلاق إداري';
    const source = c.source || 'نظام روقي';
    
    events.push({
      start: toICSDate(start),
      end: toICSDate(end),
      title: `مغلق: ${note}`,
      description: `نوع: إغلاق إداري\nملاحظة: ${note}\nالمصدر: ${source}`,
      uid: `closure-${doc.id}@roqii`,
      status: 'CONFIRMED',
      busyStatus: 'BUSY'
    });
  }
  
  if (events.length === 0) {
console.log('ℹ️ No events to generate');
  fs.writeFileSync('public/calendar.ics', '');
  return;
}

const { error, value } = createEvents(events);

if (error) {
  console.error('❌ Error creating events:', error);
  process.exit(1);
}

// Build iCal manually from events
const calendarLines = [
  'BEGIN:VCALENDAR',
  'PRODID:-//Roqii Apartments//Booking Sync//EN',
  'VERSION:2.0',
  'CALSCALE:GREGORIAN',
  'X-WR-CALNAME:Roqii Apartments Calendar',
  'X-WR-TIMEZONE:Asia/Riyadh'
];

value.forEach(eventStr => {
  calendarLines.push(eventStr);
});

calendarLines.push('END:VCALENDAR');

const calendar = calendarLines.join('\r\n');

fs.writeFileSync('public/calendar.ics', calendar);
console.log(`✅ Generated calendar.ics with ${events.length} events`);
console.log('📁 Saved to public/calendar.ics');
}

generateICAL()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Generation failed:', err);
    process.exit(1);
  });