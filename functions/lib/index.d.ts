import * as functions from "firebase-functions";
/**
 * Scheduled function that runs daily at 2:00 AM Saudi time
 * Checks for confirmed bookings where checkout date has passed
 * Updates status to "completed" and sends notification to guest
 */
export declare const autoCompleteBookings: functions.CloudFunction<unknown>;
export declare const manualCompleteBookings: functions.HttpsFunction;
//# sourceMappingURL=index.d.ts.map