import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, X, Eye, ChevronLeft, ChevronRight, Loader2, ShieldCheck, AlertCircle, ArrowRight, Building2 } from 'lucide-react';
import { Booking, APARTMENTS, Apartment } from '../data/apartmentsData';
import { db, collection, query, where, orderBy, onSnapshot } from '../lib/firebase';
import { LoadingScreen } from './LoadingScreen';

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

interface ApartmentCalendarProps {
  onBack?: () => void;
}

const ARABIC_DAYS_SHORT = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  confirmed: { bg: 'bg-emerald-600/90', border: 'border-emerald-500', text: 'text-white' },
  pending: { bg: 'bg-amber-600/90', border: 'border-amber-500', text: 'text-white' },
  completed: { bg: 'bg-blue-600/90', border: 'border-blue-500', text: 'text-white' },
  cancelled: { bg: 'bg-red-600/90', border: 'border-red-500', text: 'text-white' },
};

interface BookingBlock {
  id: string;
  booking: Booking;
  row: number;
  startCol: number;
  endCol: number;
  startDate: string;
  endDate: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  pricePerNight: number;
}

interface ClosureBlock {
  id: string;
  row: number;
  startCol: number;
  endCol: number;
  startDate: string;
  endDate: string;
  note?: string;
}

export const ApartmentCalendar: React.FC<ApartmentCalendarProps> = ({ onBack }) => {
  const [selectedAptId, setSelectedAptId] = useState<string | null>(null);
  const [aptLoading, setAptLoading] = useState(false);
  const [aptLoadStart, setAptLoadStart] = useState<number | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [closures, setClosures] = useState<{id: string; apartmentId: string; startDate: string; endDate: string; note?: string; createdAt?: any}[]>([]);
  const [closuresLoading, setClosuresLoading] = useState(false);
  const [monthView, setMonthView] = useState<number>(new Date().getMonth());
  const [yearView, setYearView] = useState<number>(new Date().getFullYear());

  const apt = APARTMENTS.find(a => a.id === selectedAptId);
  const year = yearView;
  const month = monthView;

  const MIN_LOAD_MS = 3000;

  useEffect(() => {
    if (!selectedAptId) {
      setBookings([]);
      setClosures([]);
      setBookingsLoading(false);
      setClosuresLoading(false);
      setAptLoading(false);
      setAptLoadStart(null);
      return;
    }

    setAptLoading(true);
    setAptLoadStart(Date.now());

    const q = query(
      collection(db, 'bookings'),
      where('apartmentId', '==', selectedAptId),
      orderBy('checkInDate', 'asc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data: Booking[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        data.push({
          id: doc.id,
          bookingNumber: d.bookingNumber || doc.id,
          apartmentId: d.apartmentId || '',
          apartmentName: d.apartmentName || '',
          guestName: d.guestName || '',
          guestIdNumber: d.guestIdNumber || '',
          guestPhone: d.guestPhone || '',
          guestEmail: d.guestEmail || '',
          guestCount: d.guestCount || 1,
          checkInDate: d.checkInDate || '',
          checkOutDate: d.checkOutDate || '',
          nights: d.nights || 1,
          pricePerNight: d.pricePerNight || 0,
          subtotal: d.subtotal || 0,
          serviceFee: d.serviceFee || 0,
          deposit: d.deposit || 0,
          totalAmount: d.totalAmount || 0,
          notes: d.notes,
          status: d.status || 'pending',
          paymentStatus: d.paymentStatus === 'paid' ? 'paid' : 'unpaid',
          createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt || new Date().toISOString(),
          updatedAt: d.updatedAt?.toDate?.()?.toISOString(),
          guestClientId: d.guestClientId,
        } as Booking);
      });
      setBookings(data);
      setBookingsLoading(false);

      const elapsed = Date.now() - (aptLoadStart || 0);
      const remaining = Math.max(0, MIN_LOAD_MS - elapsed);
      setTimeout(() => setAptLoading(false), remaining);
    }, (err) => {
      console.error('Calendar bookings error:', err);
      setBookings([]);
      setBookingsLoading(false);
      setAptLoading(false);
    });

    const cq = query(
      collection(db, 'apartmentClosures'),
      where('apartmentId', '==', selectedAptId)
    );
    const cunsub = onSnapshot(cq, (snap) => {
      const data: {id: string; apartmentId: string; startDate: string; endDate: string; note?: string; createdAt?: any}[] = [];
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
      setClosuresLoading(false);
    }, (err) => {
      console.error('Closures error:', err);
      setClosures([]);
      setClosuresLoading(false);
    });

    return () => { unsub(); cunsub(); };
  }, [selectedAptId, year, month, aptLoadStart]);

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstCol = firstOfMonth.getDay();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const gridDates: string[] = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < firstCol; i++) dates.push('');
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      dates.push(d.toISOString().split('T')[0]);
    }
    while (dates.length % 7 !== 0) dates.push('');
    return dates;
  }, [year, month, firstCol, daysInMonth]);

  const weeks = Math.ceil(gridDates.length / 7);

  const bookingBlocks: BookingBlock[] = useMemo(() => {
    const blocks: BookingBlock[] = [];
    const rowTracker: Record<string, number> = {};

    bookings.forEach(booking => {
      const checkIn = new Date(booking.checkInDate + 'T00:00:00');
      const checkOut = new Date(booking.checkOutDate + 'T00:00:00');
      const current = new Date(checkIn);

      const st = STATUS_COLORS[booking.status] || STATUS_COLORS.confirmed;

      while (current < checkOut) {
        const dateStr = current.toISOString().split('T')[0];
        const d = new Date(dateStr);
        if (d.getFullYear() !== year || d.getMonth() !== month) {
          current.setDate(current.getDate() + 1);
          continue;
        }

        const col = d.getDay();
        const dayIndex = gridDates.indexOf(dateStr);
        const week = Math.floor(dayIndex / 7);

        if (dayIndex === -1) {
          current.setDate(current.getDate() + 1);
          continue;
        }

        const key = `${booking.id}-${week}`;
        if (!rowTracker[key]) rowTracker[key] = 0;
        const row = rowTracker[key];
        rowTracker[key] = row + 1;

        if (!blocks.find(b => b.booking.id === booking.id && b.startCol === col && b.row === row && b.startDate === dateStr)) {
          blocks.push({
            id: `${booking.id}-${dateStr}-${week}-${row}`,
            booking,
            row,
            startCol: col,
            endCol: col,
            startDate: dateStr,
            endDate: dateStr,
            bgColor: st.bg,
            borderColor: st.border,
            textColor: st.text,
            pricePerNight: booking.pricePerNight,
          });
        }

        current.setDate(current.getDate() + 1);
      }
    });

    return blocks;
  }, [bookings, gridDates, year, month]);

  const closureBlocks: ClosureBlock[] = useMemo(() => {
    const blocks: ClosureBlock[] = [];
    const rowTracker: Record<string, number> = {};

    closures.forEach(c => {
      const dateList = generateDateRangeArray(c.startDate, c.endDate);
      dateList.forEach(dateStr => {
        const d = new Date(dateStr + 'T00:00:00');
        if (d.getFullYear() !== year || d.getMonth() !== month) return;

        const col = d.getDay();
        const dayIndex = gridDates.indexOf(dateStr);
        const week = Math.floor(dayIndex / 7);

        if (dayIndex === -1) return;

        const key = `${c.id}-${week}`;
        if (!rowTracker[key]) rowTracker[key] = 0;
        const row = rowTracker[key];
        rowTracker[key] = row + 1;

        blocks.push({
          id: `${c.id}-${dateStr}-${week}-${row}`,
          row,
          startCol: col,
          endCol: col,
          startDate: dateStr,
          endDate: dateStr,
          note: c.note,
        });
      });
    });

    return blocks;
  }, [closures, gridDates, year, month]);

  const handleSelectApartment = (id: string) => {
    setSelectedAptId(id);
    setMonthView(new Date().getMonth());
    setYearView(new Date().getFullYear());
  };

  const handlePrevWeek = () => {
    const d = new Date(yearView, monthView, 1);
    d.setDate(d.getDate() - 7);
    setMonthView(d.getMonth());
    setYearView(d.getFullYear());
  };

  const handleNextWeek = () => {
    const d = new Date(yearView, monthView, 1);
    d.setDate(d.getDate() + 7);
    setMonthView(d.getMonth());
    setYearView(d.getFullYear());
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMonthView(parseInt(e.target.value, 10));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setYearView(parseInt(e.target.value, 10));
  };

  const handleViewBooking = (booking: Booking) => {
    setSelectedBooking(booking);
  };

  const handleCloseBookingModal = () => {
    setSelectedBooking(null);
  };

  const isAptLoading = aptLoading || bookingsLoading || closuresLoading;
  const showLoading = selectedAptId && isAptLoading;

  if (showLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#570A1B]/95 backdrop-blur-md transition-opacity duration-500">
        <div className="w-16 h-16 rounded-full border-8 border-[#C6A16B]/30 border-t-[#C6A16B] animate-spin mb-4"></div>
        <p className="font-alexandria font-bold text-lg text-[#FFF9F1] tracking-wide">جاري جلب حجوزات الشقة...</p>
        <p className="text-xs text-[#C6A16B]/80 mt-2">يرجى الانتظار</p>
      </div>
    );
  }

  if (!selectedAptId) {
    return (
      <div className="py-8 md:py-12 bg-[#F3E2CC] min-h-screen text-[#3A2522] direction rtl">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="bg-[#570A1B] text-[#FFF9F1] p-6 sm:p-8 rounded-2xl border border-[#C6A16B] shadow-xl text-right">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#C6A16B] text-[#570A1B] flex items-center justify-center font-bold shadow shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 rounded-full hover:bg-[#FFF9F1]/20 text-[#FFF9F1] transition-colors"
                  aria-label="العودة"
                >
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
              )}
            </div>
            <h2 className="font-alexandria font-bold text-xl sm:text-2xl text-[#FFF9F1] mb-2">
              التقويم الشهري للحجوزات
            </h2>
            <p className="text-[#C6A16B]/90 text-sm">
              اختر الشقة لعرض تقويم الحجز والتوافر
            </p>
          </div>

          <div className="bg-[#FFF9F1] p-6 sm:p-8 rounded-2xl border border-[#C6A16B] shadow-lg space-y-5 text-right">
            <h3 className="font-alexandria font-bold text-base sm:text-lg text-[#570A1B]">
              اختيار الشقة
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {APARTMENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleSelectApartment(a.id)}
                  className="group relative flex flex-col items-center justify-center p-5 sm:p-8 rounded-2xl border-2 transition-all cursor-pointer hover:scale-[1.02]"
                  style={{ borderColor: '#C6A16B' }}
                >
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#570A1B] to-[#3a0511] text-[#C6A16B] flex items-center justify-center shadow-lg group-hover:shadow-[0_0_20px_rgba(198,161,107,0.4)] transition-all mb-3">
                    <Building2 className="w-7 h-7" />
                  </div>
                  <span className="font-alexandria font-bold text-lg text-[#570A1B] leading-tight">
                    {a.name}
                  </span>
                  <span className="text-xs text-[#3A2522]/60 mt-1 font-medium">
                    السعر: {a.pricePerNight.toLocaleString('ar-SA')} ر.س/ليلة · السعة: {a.capacity} شخص
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#F3E2CC]/60 p-5 rounded-2xl border border-[#C6A16B]/30 text-center">
            <p className="text-xs text-[#3A2522]/70">
              بعد اختيار الشقة، سيعرض التقويم حجوزات الضيوف من قاعدة البيانات مباشرة.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const monthYearLabel = `${ARABIC_MONTHS[month]} ${year}`;

  return (
    <div className="py-4 sm:py-6 bg-[#F3E2CC] min-h-screen text-[#3A2522] direction rtl">
      <div className="max-w-full mx-auto px-2 sm:px-3 lg:px-4 space-y-3 sm:space-y-4">

        {/* Header */}
        <div className="bg-[#570A1B] text-[#FFF9F1] p-3 sm:p-4 rounded-2xl border border-[#C6A16B] shadow-xl text-right">
          <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-2 sm:gap-3">
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3 w-full">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#C6A16B] text-[#570A1B] flex items-center justify-center font-bold shadow shrink-0">
                <Calendar className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </div>
              <div className="text-right">
                <h2 className="font-alexandria font-bold text-sm sm:text-base lg:text-lg leading-tight">
                  تقويم شقة {apt?.name}
                </h2>
                <p className="text-[9px] sm:text-xs text-[#C6A16B]/90 mt-0.5 leading-tight">
                  تقويم الحجوزات والتوافر · {monthYearLabel}
                </p>
              </div>
            </div>

            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 sm:p-2 rounded-full hover:bg-[#FFF9F1]/20 text-[#FFF9F1] transition-colors shrink-0"
                aria-label="العودة"
              >
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 rotate-180" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 w-full border-t sm:border-t-0 border-[#C6A16B]/30 sm:border-t-0 pt-2 sm:pt-2.5 mt-2 sm:mt-3 justify-center sm:justify-end flex-wrap">
            <button
              onClick={handlePrevWeek}
              className="p-2 rounded-xl bg-[#FFF9F1] text-[#570A1B] hover:bg-[#C6A16B] hover:text-[#570A1B] transition-colors shadow-sm flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 flex-wrap min-w-[180px]">
              <select
                value={String(month)}
                onChange={handleMonthChange}
                className="bg-[#FFF9F1] text-[#570A1B] border border-[#C6A16B]/40 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-sm font-alexandria font-bold focus:outline-none focus:ring-2 focus:ring-[#C6A16B] flex-shrink-0"
              >
                {ARABIC_MONTHS.map((m, i) => (
                  <option key={i} value={String(i)}>{m}</option>
                ))}
              </select>
              <select
                value={String(year)}
                onChange={handleYearChange}
                className="bg-[#FFF9F1] text-[#570A1B] border border-[#C6A16B]/40 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-sm font-alexandria font-bold focus:outline-none focus:ring-2 focus:ring-[#C6A16B] flex-shrink-0 mt-1 sm:mt-0 sm:ml-1"
              >
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
            <button
              onClick={handleNextWeek}
              className="p-2 rounded-xl bg-[#FFF9F1] text-[#570A1B] hover:bg-[#C6A16B] hover:text-[#570A1B] transition-colors shadow-sm flex-shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Calendar Table - Horizontal Booking Calendar */}
        <div className="bg-[#FFF9F1] rounded-2xl border border-[#C6A16B] shadow-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-[#C6A16B]/10">
            {ARABIC_DAYS_SHORT.map((day, i) => (
              <div key={i} className="h-20 sm:h-56 border-b border-[#C6A16B]/20 border-r border-[#C6A16B]/20 flex flex-col items-center justify-center p-1 text-right">
                <span className="font-alexandria font-bold text-[9px] sm:text-xs text-[#570A1B] uppercase tracking-wider mb-0.5">
                  {day}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-y divide-[#C6A16B]/20 divide-x divide-[#C6A16B]/20 min-h-[500px] sm:min-h-[600px] overflow-x-auto">
            {Array.from({ length: weeks }).map((_, weekIndex) => (
              <React.Fragment key={weekIndex}>
                {Array.from({ length: 7 }).map((_, colIndex) => {
                  const dayIndex = weekIndex * 7 + colIndex;
                  const dateStr = gridDates[dayIndex];
                  const isCurrentMonth = dateStr !== '';
                  const d = isCurrentMonth ? new Date(dateStr + 'T00:00:00') : null;
                  const isToday = dateStr === todayStr;

                  const dayBookings = bookingBlocks.filter(b => b.row === weekIndex && b.startCol === colIndex);
                  const dayClosures = closureBlocks.filter(b => b.row === weekIndex && b.startCol === colIndex);

                  return (
                    <div
                      key={dayIndex}
                      className="border-r border-[#C6A16B]/20 p-1 sm:p-2 text-right relative bg-white/40 min-h-[90px] sm:min-h-[110px]"
                    >
                      {isCurrentMonth && (
                        <>
                          <div className="flex items-center justify-end mb-0.5 sm:mb-1">
                            <span className={`font-alexandria font-bold text-[10px] sm:text-xs ${isToday ? 'text-[#FFF9F1]' : 'text-[#3A2522]'}`}>
                              {d!.getDate()}
                            </span>
                            {isToday && (
                              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-[#570A1B]" />
                            )}
                          </div>
                          <div className="text-[9px] sm:text-[10px] text-[#3A2522]/60 mb-1">
                            {ARABIC_MONTHS[month]}
                          </div>

                          {/* Price per night */}
                          <div className="text-[9px] sm:text-[10px] font-bold text-[#C6A16B] mb-1">
                            {(apt?.pricePerNight || 0).toLocaleString('ar-SA')} ر.س
                          </div>

                          {/* Booking blocks */}
                          {dayBookings.map(block => (
                            <div
                              key={block.id}
                              onClick={(e) => { e.stopPropagation(); handleViewBooking(block.booking); }}
                              className="relative rounded-[24px] sm:rounded-[28px] border-2 p-2 sm:p-3 mb-1 cursor-pointer shadow-sm transition-all border-white/60"
                              style={{
                                borderColor: block.borderColor,
                                backgroundColor: block.bgColor.replace('/90', '/100'),
                              }}
                            >
                              <span className={`text-[9px] sm:text-xs font-alexandria font-bold block ${block.textColor} truncate`}>
                                {block.booking.guestName}
                              </span>
                              <span className={`text-[8px] sm:text-[10px] opacity-90 block mt-0.5 ${block.textColor}`}>
                                {block.startDate} → {block.endDate}
                              </span>
                              <span className={`text-[8px] sm:text-[10px] opacity-80 block mt-0.5 ${block.textColor}`}>
                                {block.pricePerNight.toLocaleString('ar-SA')} ر.س/ليلة
                              </span>
                            </div>
                          ))}

                          {/* Closure blocks */}
                          {dayClosures.map(c => (
                            <div
                              key={c.id}
                              onClick={(e) => { e.stopPropagation(); alert(`تاريخ مغلق إدارياً${c.note ? `\n${c.note}` : ''}`); }}
                              className="rounded-[24px] sm:rounded-[28px] border-2 border-amber-600 bg-amber-600/100 p-2 sm:p-3 mb-1 cursor-pointer shadow-sm text-white"
                            >
                              <span className="text-[9px] sm:text-xs font-alexandria font-bold block text-white truncate">مغلق</span>
                              {c.note && <span className="text-[8px] sm:text-[10px] opacity-90 block mt-0.5 text-white">{c.note}</span>}
                            </div>
                          ))}

                        </>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Booking Details Modal */}
        {selectedBooking && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#FFF9F1] border-2 border-[#C6A16B] rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl text-right">
              <div className="p-5 sm:p-6 border-b border-[#C6A16B]/30 bg-[#570A1B]/5 sticky top-0 z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#570A1B] to-[#3a0511] text-[#C6A16B] flex items-center justify-center border border-[#C6A16B] shadow-md">
                    <Eye className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg sm:text-xl text-[#570A1B]">تفاصيل الحجز</h3>
                    <span className="text-xs text-[#84394A] font-semibold">{selectedBooking.bookingNumber}</span>
                  </div>
                </div>
                <button
                  onClick={handleCloseBookingModal}
                  className="p-2 rounded-full hover:bg-[#F3E2CC]/60 text-[#570A1B] transition-colors"
                  aria-label="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-1">
                    <span className="text-[10px] text-[#3A2522]/60 font-bold">اسم المستأجر</span>
                    <span className="font-alexandria font-bold text-sm text-[#3A2522]">{selectedBooking.guestName}</span>
                  </div>
                  <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-1">
                    <span className="text-[10px] text-[#3A2522]/60 font-bold">الشقة</span>
                    <span className="font-bold text-sm text-[#570A1B]">{selectedBooking.apartmentName}</span>
                  </div>
                  <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-1">
                    <span className="text-[10px] text-[#3A2522]/60 font-bold">تاريخ الوصول</span>
                    <span className="font-mono text-sm text-[#570A1B]">{selectedBooking.checkInDate}</span>
                    <span className="text-[10px] text-[#3A2522]/50 block">الساعة 4:00 عصراً</span>
                  </div>
                  <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-1">
                    <span className="text-[10px] text-[#3A2522]/60 font-bold">تاريخ المغادرة</span>
                    <span className="font-mono text-sm text-[#570A1B]">{selectedBooking.checkOutDate}</span>
                    <span className="text-[10px] text-[#3A2522]/50 block">الساعة 1:00 ظهراً</span>
                  </div>
                  <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-1">
                    <span className="text-[10px] text-[#3A2522]/60 font-bold">مدة الإقامة</span>
                    <span className="font-bold text-sm text-[#3A2522]">{selectedBooking.nights} ليلة{selectedBooking.nights > 1 ? 'ات' : ''}</span>
                  </div>
                  <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-1">
                    <span className="text-[10px] text-[#3A2522]/60 font-bold">عدد الضيوف</span>
                    <span className="font-bold text-sm text-[#3A2522]">{selectedBooking.guestCount} شخص</span>
                  </div>
                  <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-1">
                    <span className="text-[10px] text-[#3A2522]/60 font-bold">رقم الهوية</span>
                    <span className="font-mono text-sm text-[#3A2522] dir-ltr">{selectedBooking.guestIdNumber}</span>
                  </div>
                  <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-1">
                    <span className="text-[10px] text-[#3A2522]/60 font-bold">الجوال</span>
                    <span className="font-mono text-sm text-[#3A2522]">{selectedBooking.guestPhone}</span>
                  </div>
                  <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-1">
                    <span className="text-[10px] text-[#3A2522]/60 font-bold">سعر الليلة</span>
                    <span className="font-bold text-sm text-[#570A1B]">{selectedBooking.pricePerNight.toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-1">
                    <span className="text-[10px] text-[#3A2522]/60 font-bold">حالة الحجز</span>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                      selectedBooking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                      selectedBooking.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      selectedBooking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {selectedBooking.status === 'confirmed' ? '✓ مؤكد' : selectedBooking.status === 'pending' ? '⏳ انتظار التأكيد' : selectedBooking.status === 'completed' ? '✓ مكتمل' : '✗ ملغي'}
                    </span>
                  </div>
                  <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-1">
                    <span className="text-[10px] text-[#3A2522]/60 font-bold">حالة الدفع</span>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                      selectedBooking.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {selectedBooking.paymentStatus === 'paid' ? '✓ مدفوع' : 'غير مدفوع'}
                    </span>
                  </div>
                  <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-1">
                    <span className="text-[10px] text-[#3A2522]/60 font-bold">المبلغ الإجمالي</span>
                    <span className="font-alexandria font-bold text-lg text-[#570A1B]">{selectedBooking.totalAmount.toLocaleString('ar-SA')} ر.س</span>
                  </div>
                </div>

                {selectedBooking.notes && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="w-3 h-3" /> ملاحظات الضيف
                    </span>
                    <p className="text-sm text-[#3A2522]/80 leading-relaxed">{selectedBooking.notes}</p>
                  </div>
                )}

                <div className="pt-2 border-t border-[#C6A16B]/20 flex gap-3">
                  <button
                    onClick={() => {
                      const url = `https://wa.me/${selectedBooking.guestPhone.replace(/\s/g, '').replace('+', '')}?text=${encodeURIComponent(`عزيزي ${selectedBooking.guestName}، نود إعلامك بتفاصيل حجزك رقم ${selectedBooking.bookingNumber} لشقة ${selectedBooking.apartmentName} من ${selectedBooking.checkInDate} إلى ${selectedBooking.checkOutDate}. للمزيد يرجى التواصل معنا.`)}}`;
                      window.open(url, '_blank');
                    }}
                    className="flex-1 bg-[#25D366] hover:bg-[#20ba5a] text-white py-2.5 rounded-xl font-alexandria font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.65a11.86 11.86 0 0 0 5.77 1.47h.01c6.56 0 11.9-5.34 11.91-11.9 0-3.18-1.24-6.17-3.47-8.44ZM12.08 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.64-.23-.37a9.84 9.84 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 6.99c-.01 5.46-4.45 9.88-9.91 9.88Zm5.43-7.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z"/>
                    </svg>
                    <span>رسالة واتساب</span>
                  </button>
                  <button
                    onClick={() => handleCloseBookingModal()}
                    className="flex-1 bg-[#570A1B] hover:bg-[#84394A] text-[#FFF9F1] py-2.5 rounded-xl font-alexandria font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#C6A16B]" />
                    <span>إغلاق</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};