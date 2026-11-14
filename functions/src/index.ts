import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Scheduled function that runs daily at 2:00 AM Saudi time
 * Checks for confirmed bookings where checkout date has passed
 * Updates status to "completed" and sends notification to guest
 */
export const autoCompleteBookings = functions.pubsub
  .schedule("0 2 * * *")
  .timeZone("Asia/Riyadh")
  .onRun(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log("?? [autoCompleteBookings] Starting daily check...");
    console.log("?? Today:", today.toISOString().split("T")[0]);

    try {
      const bookingsRef = db.collection("bookings");
      const snapshot = await bookingsRef
        .where("status", "==", "confirmed")
        .where("checkOutDate", "<=", today.toISOString().split("T")[0])
        .get();

      if (snapshot.empty) {
        console.log("? [autoCompleteBookings] No bookings to complete today");
        return null;
      }

      console.log(`?? [autoCompleteBookings] Found ${snapshot.size} booking(s) to complete`);
      const batch = db.batch();

      for (const doc of snapshot.docs) {
        const booking = doc.data() as any;
        const bookingId = doc.id;

        batch.update(doc.ref, {
          status: "completed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          completedBy: "auto_scheduler",
        });

        if (booking.guestClientId) {
          const notificationRef = db.collection("notifications").doc();
          batch.set(notificationRef, {
            clientId: booking.guestClientId,
            type: "booking_completed",
            title: "اكتملت إقامة الحجز - شكراً لاختياركم رُقِيّ",
            message: `عزيزي ${booking.guestName}، نود إعلامك بأن إقامتك في ${booking.apartmentName} (${booking.apartmentNumber}) قد اكتملت بنجاح.\nفترة الإقامة: ${booking.checkInDate} إلى ${booking.checkOutDate}\nرقم الحجز: ${booking.bookingNumber}`,
            bookingId: bookingId,
            bookingNumber: booking.bookingNumber,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      await batch.commit();
      console.log("? [autoCompleteBookings] All bookings completed and notifications sent");
      return null;
    } catch (error: unknown) {
      console.error("? [autoCompleteBookings] Error:", error);
      throw error;
    }
  });

export const manualCompleteBookings = functions.https.onRequest(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).send("Unauthorized");
    return;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookingsRef = db.collection("bookings");
    const snapshot = await bookingsRef
      .where("status", "==", "confirmed")
      .where("checkOutDate", "<=", today.toISOString().split("T")[0])
      .get();

    if (snapshot.empty) {
      res.json({ success: true, message: "No bookings to complete", completed: 0 });
      return;
    }

    const batch = db.batch();
    let completedCount = 0;

    for (const doc of snapshot.docs) {
      const booking = doc.data() as any;
      const bookingId = doc.id;

      batch.update(doc.ref, {
        status: "completed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedBy: "manual_trigger",
      });

      if (booking.guestClientId) {
        const notificationRef = db.collection("notifications").doc();
        batch.set(notificationRef, {
          clientId: booking.guestClientId,
          type: "booking_completed",
          title: "اكتملت إقامة الحجز - شكراً لاختياركم رُقِيّ",
          message: `عزيزي ${booking.guestName}، نود إعلامك بأن إقامتك في ${booking.apartmentName} (${booking.apartmentNumber}) قد اكتملت بنجاح.\nرقم الحجز: ${booking.bookingNumber}`,
          bookingId: bookingId,
          bookingNumber: booking.bookingNumber,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      completedCount++;
    }

    await batch.commit();
    res.json({ success: true, message: `Completed ${completedCount} booking(s)`, completed: completedCount });
  } catch (error: unknown) {
    console.error("Error in manualCompleteBookings:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
});
