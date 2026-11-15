import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

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

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export interface ApartmentPriceOverride {
  id: string;
  apartmentId: string;
  startDate: string; // YYYY-MM-DD inclusive
  endDate: string;   // YYYY-MM-DD inclusive
  pricePerNight: number;
  createdAt?: any;
}

interface UseApartmentPriceOverridesResult {
  overrides: ApartmentPriceOverride[];
  loading: boolean;
  error: string | null;
  addOverride: (apartmentId: string, startDate: string, endDate: string, pricePerNight: number) => Promise<void>;
  removeOverride: (id: string) => Promise<void>;
}

export function useApartmentPriceOverrides(apartmentId?: string | null): UseApartmentPriceOverridesResult {
  const [overrides, setOverrides] = useState<ApartmentPriceOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const col = collection(db, 'apartmentPriceOverrides');
    const q = apartmentId ? query(col, where('apartmentId', '==', apartmentId)) : query(col);
    const unsub = onSnapshot(q, (snap) => {
      const data: ApartmentPriceOverride[] = [];
      snap.forEach((d) => {
        const v = d.data() as any;
        data.push({
          id: d.id,
          apartmentId: v.apartmentId || '',
          startDate: v.startDate || '',
          endDate: v.endDate || '',
          pricePerNight: Number(v.pricePerNight) || 0,
          createdAt: v.createdAt,
        });
      });
      data.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
      setOverrides(data);
      setLoading(false);
    }, (err) => {
      console.error('apartmentPriceOverrides listener error:', err);
      setError('فشل في تحميل فترات الأسعار');
      setLoading(false);
    });
    return () => unsub();
  }, [apartmentId]);

  const addOverride = useCallback(async (aptId: string, startDate: string, endDate: string, pricePerNight: number) => {
    if (!aptId || !startDate || !endDate) throw new Error('بيانات فترة السعر غير مكتملة');
    if (endDate < startDate) throw new Error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساوياً له');
    if (!Number.isFinite(pricePerNight) || pricePerNight <= 0) throw new Error('سعر الليلة يجب أن يكون رقماً أكبر من صفر');
    // Prevent overlap (per apartment) - check against current known overrides for same apartment
    const conflict = overrides.find(o => o.apartmentId === aptId && rangesOverlap(startDate, endDate, o.startDate, o.endDate));
    if (conflict) {
      throw new Error(`تعارض في الفترات: توجد فترة سعر أخرى (${conflict.startDate} إلى ${conflict.endDate}). لا يمكن حفظ فترات أسعار متداخلة.`);
    }
    await addDoc(collection(db, 'apartmentPriceOverrides'), {
      apartmentId: aptId,
      startDate,
      endDate,
      pricePerNight: Math.round(pricePerNight),
      createdAt: serverTimestamp(),
    });
  }, [overrides]);

  const removeOverride = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'apartmentPriceOverrides', id));
  }, []);

  return { overrides, loading, error, addOverride, removeOverride };
}

export function buildPriceMapForStay(
  checkIn: string,
  checkOut: string,
  basePrice: number,
  overrides: ApartmentPriceOverride[],
): { total: number; nights: number; nightly: { date: string; price: number; override: boolean }[] } {
  const nightly: { date: string; price: number; override: boolean }[] = [];
  if (!checkIn || !checkOut) return { total: 0, nights: 0, nightly };
  // nights are [checkIn, checkOut)
  const dates = generateDateRangeArray(checkIn, checkOut).slice(0, -1); // exclude checkout day
  // build quick lookup: for each override range map dates; non-overlapping by design
  const byDate = new Map<string, number>();
  overrides.forEach(o => {
    generateDateRangeArray(o.startDate, o.endDate).forEach(d => {
      if (!byDate.has(d)) byDate.set(d, o.pricePerNight);
    });
  });
  let total = 0;
  dates.forEach(d => {
    const p = byDate.has(d) ? (byDate.get(d) as number) : basePrice;
    nightly.push({ date: d, price: p, override: byDate.has(d) });
    total += p;
  });
  return { total, nights: nightly.length, nightly };
}
