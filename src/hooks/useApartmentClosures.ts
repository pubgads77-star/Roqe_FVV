import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ApartmentClosure {
  id: string;
  apartmentId: string;
  startDate: string; // YYYY-MM-DD (inclusive)
  endDate: string;   // YYYY-MM-DD (inclusive)
  note?: string;
  createdAt?: any;
}

interface UseApartmentClosuresResult {
  closures: ApartmentClosure[];
  loading: boolean;
  error: string | null;
  addClosure: (apartmentId: string, startDate: string, endDate: string, note?: string) => Promise<void>;
  removeClosure: (id: string) => Promise<void>;
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function eachDateInRange(startDate: string, endDate: string): string[] {
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

export function useApartmentClosures(apartmentId?: string | null): UseApartmentClosuresResult {
  const [closures, setClosures] = useState<ApartmentClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const col = collection(db, 'apartmentClosures');
    const q = apartmentId ? query(col, where('apartmentId', '==', apartmentId)) : query(col);
    const unsub = onSnapshot(q, (snap) => {
      const data: ApartmentClosure[] = [];
      snap.forEach((d) => {
        const v = d.data() as any;
        data.push({
          id: d.id,
          apartmentId: v.apartmentId || '',
          startDate: v.startDate || '',
          endDate: v.endDate || '',
          note: v.note || '',
          createdAt: v.createdAt,
        });
      });
      data.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
      setClosures(data);
      setLoading(false);
    }, (err) => {
      console.error('apartmentClosures listener error:', err);
      setError('فشل في تحميل فترات الإغلاق');
      setLoading(false);
    });
    return () => unsub();
  }, [apartmentId]);

  const addClosure = useCallback(async (aptId: string, startDate: string, endDate: string, note?: string) => {
    if (!aptId || !startDate || !endDate) throw new Error('بيانات الإغلاق غير مكتملة');
    if (endDate < startDate) throw new Error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساوياً له');
    await addDoc(collection(db, 'apartmentClosures'), {
      apartmentId: aptId,
      startDate,
      endDate,
      note: note?.trim() || '',
      createdAt: serverTimestamp(),
    });
  }, []);

  const removeClosure = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'apartmentClosures', id));
  }, []);

  return { closures, loading, error, addClosure, removeClosure };
}
