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
    const summary = vevent.summary || '';
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
    
    const docId = `booking_${uid.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const docRef = db.collection('apartmentClosures').doc(docId);
    
    const existing = await docRef.get();
    if (existing.exists) {
      skipped++;
      continue;
    }
    
    batch.set(docRef, {
      apartmentId: 'apt-01',
      startDate: startStr,
      endDate: endStr,
      note: `Booking.com: ${summary} - ${description}`.substring(0, 500),
      source: 'booking.com',
      bookingUid: uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    added++;
  }
  
  if (added > 0) {
    await batch.commit();
    console.log(`✅ Added ${added} new closures from Booking.com`);
  } else {
    console.log('ℹ️ No new closures to add');
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