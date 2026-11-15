import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import ICAL from 'ical.js';
import fetch from 'node-fetch';
import fs from 'fs';

const SERVICE_ACCOUNT = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));
const BOOKING_ICAL_URL = process.env.BOOKING_ICAL_URL;

if (!BOOKING_ICAL_URL) {
  console.error('❌ BOOKING_ICAL_URL environment variable not set');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert(SERVICE_ACCOUNT) });
}
const db = getFirestore();

function parseDate(icalTime) {
  if (!icalTime) return null;
  const date = icalTime.toJSDate();
  return Timestamp.fromDate(date);
}

function formatDateForFirestore(date) {
  return date.toISOString().split('T')[0];
}

function calculateNights(checkIn, checkOut) {
  const diff = checkOut.getTime() - checkIn.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

async function syncFromBooking() {
  console.log('📥 Fetching iCal from Booking.com...');
  
  const response = await fetch(BOOKING_ICAL_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch iCal: ${response.status} ${response.statusText}`);
  }
  
  const icalText = await response.text();
  console.log('✅ iCal fetched, parsing...');
  
  const jcalData = ICAL.parse(icalText);
  const comp = new ICAL.Component(jcalData);
  const events = comp.getAllSubcomponents('vevent');
  
  console.log(`📅 Found ${events.length} events in iCal`);
  
  const batch = db.batch();
  let added = 0;
  let skipped = 0;
  
  for (const event of events) {
    const vevent = new ICAL.Event(event);
    
    const uid = vevent.uid;
    const summary = vevent.summary || 'CLOSED - Not available';
    const description = vevent.description || '';
    
    const startDate = parseDate(vevent.startDate);
    const endDate = parseDate(vevent.endDate);
    
    if (!startDate || !endDate) {
      console.log(`⚠️ Skipping event ${uid}: missing dates`);
      skipped++;
      continue;
    }
    
    const startStr = formatDateForFirestore(startDate.toDate());
    const endStr = formatDateForFirestore(endDate.toDate());
    const checkInDate = startDate.toDate();
    const checkOutDate = endDate.toDate();
    const nights = calculateNights(checkInDate, checkOutDate);
    
    // Use UID to create unique booking number
    const bookingUid = uid;
    const bookingNumber = `BK-${uid.substring(0, 8).toUpperCase()}`;
    
    // Check if already exists by bookingUid
    const existingQuery = await db.collection('bookings')
      .where('bookingUid', '==', bookingUid)
      .limit(1)
      .get();
    
    if (!existingQuery.empty) {
      skipped++;
      continue;
    }
    
    // Base price per night (can be dynamic later)
    const pricePerNight = 1450;
    const totalAmount = pricePerNight * nights;
    
    const docRef = db.collection('bookings').doc();
    
    batch.set(docRef, {
      bookingNumber,
      apartmentId: 'apt-01',
      apartmentName: 'رُقِيّ',
      guestName: 'حجز Booking.com',
      guestIdNumber: 'غير متوفر',
      guestPhone: 'من Booking.com',
      guestEmail: '',
      guestCount: 1,
      apartmentsCount: 1, // كل فترة مغلقة من بوكنج = وحدة واحدة محجوزة
      checkInDate: startStr,
      checkOutDate: endStr,
      nights,
      pricePerNight,
      subtotal: totalAmount,
      serviceFee: 0,
      deposit: 0,
      totalAmount,
      notes: `📌 مستورد من Booking.com - راجع Extranet للتفاصيل\nUID: ${uid}`,
      status: 'confirmed',
      paymentStatus: 'paid',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      source: 'booking.com',
      bookingUid
    });
    added++;
  }
  
  if (added > 0) {
    await batch.commit();
    console.log(`✅ Added ${added} new bookings from Booking.com`);
  } else {
    console.log('ℹ️ No new bookings to add');
  }
  console.log(`⏭️ Skipped ${skipped} existing/duplicate events`);
}

syncFromBooking()
  .then(() => {
    console.log('🎉 Sync completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  });