import fetch from 'node-fetch';
import ICAL from 'ical.js';

const BOOKING_ICAL_URL = 'https://ical.booking.com/v1/export?t=8a15e6fd-c3d6-46f6-b322-e5899b43a5e0';

async function inspectBookingICal() {
  console.log('📥 Fetching iCal from Booking.com...');
  
  const response = await fetch(BOOKING_ICAL_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }
  
  const icalText = await response.text();
  console.log('\n=== RAW ICAL TEXT (first 3000 chars) ===');
  console.log(icalText.substring(0, 3000));
  console.log('\n=== FULL LENGTH:', icalText.length, 'chars ===\n');
  
  const jcalData = ICAL.parse(icalText);
  const comp = new ICAL.Component(jcalData);
  const events = comp.getAllSubcomponents('vevent');
  
  console.log(`📅 Found ${events.length} events\n`);
  
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const vevent = new ICAL.Event(event);
    
    console.log(`\n--- EVENT ${i + 1} ---`);
    console.log('UID:', vevent.uid);
    console.log('SUMMARY:', vevent.summary);
    console.log('DESCRIPTION:', vevent.description);
    console.log('DTSTART:', vevent.startDate ? vevent.startDate.toJSDate() : 'none');
    console.log('DTEND:', vevent.endDate ? vevent.endDate.toJSDate() : 'none');
    console.log('LOCATION:', vevent.location);
    console.log('STATUS:', vevent.status);
    console.log('TRANSP:', vevent.transp);
    
    // Show all properties
    console.log('\nALL PROPERTIES:');
    const props = event.getAllProperties();
    for (const prop of props) {
      console.log(`  ${prop.name}: ${prop.getFirstValue()}`);
    }
  }
}

inspectBookingICal().catch(console.error);