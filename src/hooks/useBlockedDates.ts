import { useMemo } from 'react';
import { Booking } from '../data/apartmentsData';
import { ApartmentClosure, eachDateInRange } from './useApartmentClosures';

export type BlockReason = 'booking' | 'closed';

export interface BlockedDateInfo {
  date: string; // YYYY-MM-DD
  reason: BlockReason;
  bookingId?: string;
  bookingNumber?: string;
  guestName?: string;
  status?: 'confirmed' | 'pending';
  closureId?: string;
  note?: string;
}

interface UseBlockedDatesResult {
  blockedDates: Set<string>;
  blockedDateDetails: Map<string, BlockedDateInfo>;
  isDateBlocked: (dateStr: string) => boolean;
  getBlockedInfo: (dateStr: string) => BlockedDateInfo | undefined;
  isDateRangeBlocked: (startDate: string, endDate: string) => { blocked: boolean; blockedDate?: string; blockedInfo?: BlockedDateInfo };
}

export function useBlockedDates(bookings: Booking[], closures: ApartmentClosure[] = []): UseBlockedDatesResult {
  const { blockedDates, blockedDateDetails } = useMemo(() => {
    const dates = new Set<string>();
    const details = new Map<string, BlockedDateInfo>();

    // 1) Booking-based blocks (nights [checkIn, checkOut))
    bookings.forEach((booking) => {
      if (booking.status === 'cancelled' || booking.status === 'completed') return;

      const checkIn = new Date(booking.checkInDate);
      const checkOut = new Date(booking.checkOutDate);
      const current = new Date(checkIn);

      while (current < checkOut) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        dates.add(dateStr);
        if (!details.has(dateStr)) {
          details.set(dateStr, {
            date: dateStr,
            reason: 'booking',
            bookingId: booking.id,
            bookingNumber: booking.bookingNumber,
            guestName: booking.guestName,
            status: booking.status,
          });
        }
        current.setDate(current.getDate() + 1);
      }
    });

    // 2) Admin manual closures (inclusive ranges). Closures override display as "closed" when present.
    closures.forEach((c) => {
      if (!c.startDate || !c.endDate) return;
      eachDateInRange(c.startDate, c.endDate).forEach((dateStr) => {
        dates.add(dateStr);
        details.set(dateStr, {
          date: dateStr,
          reason: 'closed',
          closureId: c.id,
          note: c.note,
        });
      });
    });

    return { blockedDates: dates, blockedDateDetails: details };
  }, [bookings, closures]);

  const isDateBlocked = (dateStr: string): boolean => blockedDates.has(dateStr);
  const getBlockedInfo = (dateStr: string): BlockedDateInfo | undefined => blockedDateDetails.get(dateStr);

  const isDateRangeBlocked = (startDate: string, endDate: string): { blocked: boolean; blockedDate?: string; blockedInfo?: BlockedDateInfo } => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    while (current < end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      if (blockedDates.has(dateStr)) {
        return { blocked: true, blockedDate: dateStr, blockedInfo: blockedDateDetails.get(dateStr) };
      }
      current.setDate(current.getDate() + 1);
    }
    return { blocked: false };
  };

  return { blockedDates, blockedDateDetails, isDateBlocked, getBlockedInfo, isDateRangeBlocked };
}
