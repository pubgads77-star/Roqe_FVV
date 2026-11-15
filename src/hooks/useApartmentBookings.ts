import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Booking } from '../data/apartmentsData';

interface UseApartmentBookingsResult {
  bookings: Booking[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApartmentBookings(apartmentId: string | null): UseApartmentBookingsResult {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(() => {
    if (!apartmentId) {
      setBookings([]);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    setError(null);

    // Real-time listener for bookings of this apartment
    const q = query(
      collection(db, 'bookings'),
      where('apartmentId', '==', apartmentId),
      where('status', 'in', ['confirmed', 'pending']), // Only active bookings block dates
      orderBy('checkInDate', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingsData: Booking[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        bookingsData.push({
          id: doc.id,
          bookingNumber: data.bookingNumber || doc.id,
          apartmentId: data.apartmentId || '',
          apartmentName: data.apartmentName || '',
          guestName: data.guestName || '',
          guestIdNumber: data.guestIdNumber || '',
          guestPhone: data.guestPhone || '',
          guestEmail: data.guestEmail || '',
          guestCount: data.guestCount || 1,
          checkInDate: data.checkInDate || '',
          checkOutDate: data.checkOutDate || '',
          nights: data.nights || 1,
          pricePerNight: data.pricePerNight || 0,
          subtotal: data.subtotal || 0,
          serviceFee: data.serviceFee || 0,
          deposit: data.deposit || 0,
          totalAmount: data.totalAmount || 0,
          notes: data.notes,
          status: data.status || 'pending',
          paymentStatus: data.paymentStatus === 'paid' ? 'paid' : 'unpaid',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
          guestClientId: data.guestClientId,
          source: data.source,
        } as Booking);
      });
      setBookings(bookingsData);
      setLoading(false);
    }, (err) => {
      console.error('Bookings listener error:', err);
      setError('فشل في تحميل الحجوزات');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [apartmentId]);

  useEffect(() => {
    const cleanup = fetchBookings();
    return cleanup;
  }, [fetchBookings]);

  const refetch = useCallback(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, loading, error, refetch };
}