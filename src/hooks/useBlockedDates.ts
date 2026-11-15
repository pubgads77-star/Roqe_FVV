import { useMemo } from 'react';
import { Booking } from '../data/apartmentsData';
import { ApartmentClosure } from './useApartmentClosures';

function generateDateRangeArray(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

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
  apartmentsBooked: number; // عدد الوحدات المحجوزة في هذا التاريخ
  apartmentsTotal: number; // إجمالي الوحدات
  apartmentsAvailable: number; // الوحدات المتاحة
}

interface UseBlockedDatesResult {
  blockedDates: Set<string>;
  blockedDateDetails: Map<string, BlockedDateInfo>;
  availableUnitsMap: Map<string, number>; // التاريخ -> الوحدات المتاحة
  totalUnits: number; // إجمالي الوحدات للشقة
  isDateBlocked: (dateStr: string) => boolean;
  isDateFullyBooked: (dateStr: string) => boolean;
  getAvailableUnits: (dateStr: string) => number;
  getBlockedInfo: (dateStr: string) => BlockedDateInfo | undefined;
  isDateRangeFullyBooked: (startDate: string, endDate: string, requestedUnits: number) => { 
    fullyBooked: boolean; 
    blockedDate?: string; 
    blockedInfo?: BlockedDateInfo;
    maxAvailableUnits?: number;
  };
  isDateRangeBlocked: (startDate: string, endDate: string) => { blocked: boolean; blockedDate?: string; blockedInfo?: BlockedDateInfo };
  getRangeAvailability: (startDate: string, endDate: string) => {
    minAvailableUnits: number;
    maxAvailableUnits: number;
    dates: Array<{ date: string; available: number; total: number }>;
  };
}

export function useBlockedDates(
  bookings: Booking[], 
  closures: ApartmentClosure[] = [],
  totalUnits: number = 2
): UseBlockedDatesResult {
  const { availableUnitsMap, blockedDateDetails } = useMemo(() => {
    const availableUnits = new Map<string, number>();
    const details = new Map<string, BlockedDateInfo>();

    // Initialize all dates with total units available
    // We'll process bookings and closures to reduce availability

    // 1) Process bookings - count apartmentsBooked per date
    const bookingsByDate = new Map<string, number>(); // date -> apartments booked
    
    bookings.forEach((booking) => {
      if (booking.status === 'cancelled' || booking.status === 'completed') return;

      const checkIn = new Date(booking.checkInDate);
      const checkOut = new Date(booking.checkOutDate);
      const current = new Date(checkIn);
      // Reservations imported from Booking.com block the entire unit (all units) for their dates
      const isImported = (booking as any).source === 'booking.com';
      const unitsBooked = isImported ? totalUnits : (booking.apartmentsCount || 1);

      while (current < checkOut) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const currentBooked = bookingsByDate.get(dateStr) || 0;
        bookingsByDate.set(dateStr, currentBooked + unitsBooked);
        
        // Store detailed info for this date
        if (!details.has(dateStr)) {
          details.set(dateStr, {
            date: dateStr,
            reason: 'booking',
            bookingId: booking.id,
            bookingNumber: booking.bookingNumber,
            guestName: booking.guestName,
            status: booking.status,
            apartmentsBooked: 0,
            apartmentsTotal: totalUnits,
            apartmentsAvailable: totalUnits
          });
        }
        
        // Update apartmentsBooked count
        const existingDetail = details.get(dateStr);
        if (existingDetail) {
          existingDetail.apartmentsBooked = (bookingsByDate.get(dateStr) || 0);
          existingDetail.apartmentsAvailable = Math.max(0, totalUnits - existingDetail.apartmentsBooked);
        }

        current.setDate(current.getDate() + 1);
      }
    });

    // 2) Process closures - mark as fully booked (0 available)
    closures.forEach((c) => {
      if (!c.startDate || !c.endDate) return;
      const dates = generateDateRangeArray(c.startDate, c.endDate);
      dates.forEach((dateStr) => {
        // Closures override - mark as fully booked (0 available)
        bookingsByDate.set(dateStr, totalUnits); // Fully booked
        details.set(dateStr, {
          date: dateStr,
          reason: 'closed',
          closureId: c.id,
          note: c.note,
          apartmentsBooked: totalUnits,
          apartmentsTotal: totalUnits,
          apartmentsAvailable: 0
        });
      });
    });

    // Build availableUnitsMap
    bookingsByDate.forEach((booked, dateStr) => {
      const available = Math.max(0, totalUnits - booked);
      availableUnits.set(dateStr, available);
    });

    return { availableUnitsMap: availableUnits, blockedDateDetails: details };
  }, [bookings, closures, totalUnits]);

  const blockedDates = new Set(availableUnitsMap.keys());

  const isDateBlocked = (dateStr: string): boolean => {
    const available = availableUnitsMap.get(dateStr);
    return available !== undefined && available < totalUnits;
  };

  const isDateFullyBooked = (dateStr: string): boolean => {
    const available = availableUnitsMap.get(dateStr);
    return available === 0;
  };

  const getAvailableUnits = (dateStr: string): number => {
    const available = availableUnitsMap.get(dateStr);
    if (available !== undefined) return available;
    return totalUnits; // Not in map = fully available
  };

  const getBlockedInfo = (dateStr: string): BlockedDateInfo | undefined => {
    return blockedDateDetails.get(dateStr);
  };

  const isDateRangeFullyBooked = (startDate: string, endDate: string, requestedUnits: number): { 
    fullyBooked: boolean; 
    blockedDate?: string; 
    blockedInfo?: BlockedDateInfo;
    maxAvailableUnits?: number;
  } => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    let maxAvailableUnits = totalUnits;

    while (current < end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const available = getAvailableUnits(dateStr);
      maxAvailableUnits = Math.min(maxAvailableUnits, available);
      
      if (available < requestedUnits) {
        return { 
          fullyBooked: true, 
          blockedDate: dateStr, 
          blockedInfo: getBlockedInfo(dateStr),
          maxAvailableUnits: available
        };
      }
      current.setDate(current.getDate() + 1);
    }

    return { 
      fullyBooked: false, 
      maxAvailableUnits 
    };
  };

  const isDateRangeBlocked = (startDate: string, endDate: string): { blocked: boolean; blockedDate?: string; blockedInfo?: BlockedDateInfo } => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    while (current < end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const available = getAvailableUnits(dateStr);
      if (available <= 0) {
        return { blocked: true, blockedDate: dateStr, blockedInfo: getBlockedInfo(dateStr) };
      }
      current.setDate(current.getDate() + 1);
    }
    return { blocked: false };
  };

  const getRangeAvailability = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    const dates: Array<{ date: string; available: number; total: number }> = [];
    let minAvailableUnits = totalUnits;

    while (current < end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const available = getAvailableUnits(dateStr);
      minAvailableUnits = Math.min(minAvailableUnits, available);
      
      dates.push({
        date: dateStr,
        available,
        total: totalUnits
      });
      
      current.setDate(current.getDate() + 1);
    }

    return {
      minAvailableUnits,
      maxAvailableUnits: totalUnits,
      dates
    };
  };

  return { 
    blockedDates, 
    blockedDateDetails, 
    availableUnitsMap,
    totalUnits,
    isDateBlocked, 
    isDateFullyBooked,
    getAvailableUnits, 
    getBlockedInfo, 
    isDateRangeFullyBooked,
    isDateRangeBlocked,
    getRangeAvailability
  };
}