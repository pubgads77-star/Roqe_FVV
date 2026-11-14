import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Building2,
  User,
  Phone,
  ShieldCheck,
  Eye,
  MapPin,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  X,
  ArrowRight,
  Building
} from 'lucide-react';
import { Booking, APARTMENTS, Apartment } from '../data/apartmentsData';
import { db, collection, query, where, orderBy, onSnapshot, getDocs } from '../lib/firebase';
import { LoadingScreen } from './LoadingScreen';

const ARABIC_DAYS_SHORT = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; light: string }> = {
  confirmed: { 
    bg: 'bg-emerald-500', 
    border: 'border-emerald-600', 
    text: 'text-white',
    light: 'bg-emerald-50 border-emerald-200 text-emerald-900'
  },
  pending: { 
    bg: 'bg-amber-500', 
    border: 'border-amber-600', 
    text: 'text-white',
    light: 'bg-amber-50 border-amber-200 text-amber-900'
  },
  completed: { 
    bg: 'bg-blue-500', 
    border: 'border-blue-600', 
    text: 'text-white',
    light: 'bg-blue-50 border-blue-200 text-blue-900'
  },
  cancelled: { 
    bg: 'bg-red-500', 
    border: 'border-red-600', 
    text: 'text-white',
    light: 'bg-red-50 border-red-200 text-red-900'
  },
};

interface AdminCalendarViewProps {
  onBack?: () => void;
}

interface BookingBlock {
  id: string;
  booking: Booking;
  startDay: number;
  endDay: number;
  row: number;
}

export const AdminCalendarView: React.FC<AdminCalendarViewProps> = ({ onBack }) => {
  const [selectedAptId, setSelectedAptId] = useState<string | null>(null);
  const [showAptSelector, setShowAptSelector] = useState(true);
  const [aptLoading, setAptLoading] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [monthView, setMonthView] = useState<number>(new Date().getMonth());
  const [yearView, setYearView] = useState<number>(new Date().getFullYear());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);

  const apt = APARTMENTS.find(a => a.id === selectedAptId);
  const currentYear = yearView;
  const currentMonth = monthView;

  const MIN_LOAD_MS = 3000;
  const [aptLoadStart, setAptLoadStart] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedAptId) {
      setBookings([]);
      setBookingsLoading(false);
      setAptLoading(false);
      setAptLoadStart(null);
      setIndexError(null);
      return;
    }

    setAptLoading(true);
    setAptLoadStart(Date.now());
    setBookingsLoading(true);
    setIndexError(null);

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
    }, (err: any) => {
      console.error('Calendar bookings error:', err);
      // Check if it's an index error
      if (err?.code === 'failed-precondition' || err?.message?.includes('index') || err?.message?.includes('Index')) {
        const indexUrl = `https://console.firebase.google.com/v1/r/project/roqi-apartments/firestore/indexes?create_composite=ClBwcm9qZWN0cy9yb3FpLWFwYXJ0bWVudHMvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2Jvb2tpbmdzL2luZGV4ZXMvXxABGg8KC2FwYXJ0bWVudElkEAEaDwoLY2hlY2tJbkRhdGUQARoMCghfX25hbWVfXxAB`;
        setIndexError(`يتطلب هذا الاستعلام فهرساً في Firestore. <a href="${indexUrl}" target="_blank" rel="noopener noreferrer" className="underline text-[#C6A16B] hover:text-[#570A1B]">اضغط هنا لإنشاء الفهرس</a>`);
      }
      setBookings([]);
      setBookingsLoading(false);
      setAptLoading(false);
    });

    return () => unsub();
  }, [selectedAptId, aptLoadStart]);

  const handleSelectApartment = (aptId: string) => {
    setSelectedAptId(aptId);
    setShowAptSelector(false);
    setAptLoading(true);
    setAptLoadStart(Date.now());
    setSelectedBooking(null);
  };

  const handleBackToAptSelector = () => {
    setSelectedAptId(null);
    setShowAptSelector(true);
    setSelectedBooking(null);
    setMonthView(new Date().getMonth());
    setYearView(new Date().getFullYear());
  };

  const handlePrevMonth = () => {
    setMonthView(prev => prev === 0 ? 11 : prev - 1);
    setYearView(prev => prev === 0 ? prev - 1 : prev);
  };

  const handleNextMonth = () => {
    setMonthView(prev => prev === 11 ? 0 : prev + 1);
    setYearView(prev => prev === 11 ? prev + 1 : prev);
  };

  const handleGoToToday = () => {
    const now = new Date();
    setMonthView(now.getMonth());
    setYearView(now.getFullYear());
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMonthView(parseInt(e.target.value, 10));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setYearView(parseInt(e.target.value, 10));
  };

  const handleCloseBookingModal = () => {
    setSelectedBooking(null);
  };

  const monthYearLabel = `${ARABIC_MONTHS[currentMonth]} ${currentYear}`;
  const isDataLoading = bookingsLoading;

  if (showAptSelector) {
    return (
      <div className="py-8 md:py-12 bg-[#F3E2CC] min-h-screen text-[#3A2522] direction rtl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="bg-[#570A1B] text-[#FFF9F1] p-6 sm:p-8 rounded-2xl border border-[#C6A16B] shadow-xl text-right">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#C6A16B] text-[#570A1B] flex items-center justify-center font-bold shadow shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              {onBack && (
                <button onClick={onBack} className="p-2 rounded-full hover:bg-[#FFF9F1]/20 text-[#FFF9F1] transition-colors" aria-label="العودة">
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
              )}
            </div>
            <h2 className="font-alexandria font-bold text-xl sm:text-2xl text-[#FFF9F1] mb-2">تقويم الحجوزات الشهري</h2>
            <p className="text-[#C6A16B]/90 text-sm">اختر الشقة لعرض تقويم الحجز والتوافر الشهري</p>
          </div>

          <div className="bg-[#FFF9F1] p-6 sm:p-8 rounded-2xl border border-[#C6A16B] shadow-lg space-y-5 text-right">
            <h3 className="font-alexandria font-bold text-base sm:text-lg text-[#570A1B] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#C6A16B]" /> اختيار الشقة
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {APARTMENTS.map((apt) => (
                <button
                  key={apt.id}
                  onClick={() => handleSelectApartment(apt.id)}
                  className="group relative flex flex-col items-center justify-center p-5 sm:p-8 rounded-2xl border-2 transition-all cursor-pointer hover:scale-[1.02] shadow-lg"
                  style={{ borderColor: '#C6A16B' }}
                >
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#570A1B] to-[#3a0511] text-[#C6A16B] flex items-center justify-center shadow-lg group-hover:shadow-[0_0_20px_rgba(198,161,107,0.4)] transition-all mb-3">
                    <Building2 className="w-7 h-7" />
                  </div>
                  <span className="font-alexandria font-bold text-lg text-[#570A1B] leading-tight">{apt.name}</span>
                  <span className="text-xs text-[#3A2522]/60 mt-1 font-medium">السعر: {apt.pricePerNight.toLocaleString('ar-SA')} ر.س/ليلة · السعة: {apt.capacity} شخص</span>
                  <span className="absolute bottom-3 left-3 right-3 text-center text-[10px] text-[#C6A16B]/80 font-medium">اضغط للعرض</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#F3E2CC]/60 p-5 rounded-2xl border border-[#C6A16B]/30 text-center">
            <p className="text-xs text-[#3A2522]/70">بعد اختيار الشقة، سيعرض التقويم حجوزات الضيوف من قاعدة البيانات مباشرة مع ألوان حسب الحالة.</p>
          </div>
        </div>
      </div>
    );
  }

  if (aptLoading || isDataLoading) {
    return (
      <LoadingScreen
        duration={MIN_LOAD_MS}
        onLoaded={() => {}}
      />
    );
  }

  const firstOfMonth = new Date(currentYear, currentMonth, 1);
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstCol = firstOfMonth.getDay();

  const gridDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < firstCol; i++) dates.push('');
    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(new Date(currentYear, currentMonth, day).toISOString().split('T')[0]);
    }
    while (dates.length % 7 !== 0) dates.push('');
    return dates;
  }, [currentYear, currentMonth, firstCol, daysInMonth]);

  const weeks = Math.ceil(gridDates.length / 7);

  const bookingBlocks = useMemo(() => {
    const blocks: BookingBlock[] = [];
    const rowTracker: Record<string, number> = {};

    bookings.forEach(booking => {
      if (booking.status === 'cancelled' || booking.status === 'completed') return;

      const checkIn = new Date(booking.checkInDate + 'T00:00:00');
      const checkOut = new Date(booking.checkOutDate + 'T00:00:00');
      const current = new Date(checkIn);

      while (current < checkOut) {
        const dateStr = current.toISOString().split('T')[0];
        const dayIndex = gridDates.indexOf(dateStr);
        if (dayIndex !== -1) {
          const week = Math.floor(dayIndex / 7);
          const col = dayIndex % 7;

          const key = `${booking.id}-${week}`;
          if (!rowTracker[key]) rowTracker[key] = 0;
          const row = rowTracker[key];
          rowTracker[key] = row + 1;

          if (!blocks.find(b => b.booking.id === booking.id && b.startDay === col && b.row === row)) {
            blocks.push({
              id: `${booking.id}-${week}-${row}`,
              booking,
              startDay: col,
              endDay: col,
              row,
            });
          }
        }
        current.setDate(current.getDate() + 1);
      }
    });

    return blocks;
  }, [bookings, gridDates]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  return (
    <div>
      <div className="py-4 sm:py-6 bg-[#F3E2CC] min-h-screen text-[#3A2522] direction rtl">
        <div className="max-w-full mx-auto px-2 sm:px-3 lg:px-4 space-y-3 sm:space-y-4">
        <div className="bg-[#570A1B] text-[#FFF9F1] p-3 sm:p-4 rounded-2xl border border-[#C6A16B] shadow-xl text-right">
          <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-2 sm:gap-3">
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3 w-full">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#C6A16B] text-[#570A1B] flex items-center justify-center font-bold shadow shrink-0">
                <Calendar className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </div>
              <div className="text-right">
                <h2 className="font-alexandria font-bold text-sm sm:text-base lg:text-lg leading-tight">
                  تقويم {apt?.name}
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

            <button
              onClick={handleBackToAptSelector}
              className="p-2 rounded-xl bg-[#FFF9F1]/10 hover:bg-[#FFF9F1]/20 text-[#FFF9F1] transition-colors shrink-0 flex items-center justify-center gap-1.5 text-xs font-medium"
              aria-label="اختيار شقة أخرى"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تغيير الشقة</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 w-full border-t sm:border-t-0 border-[#C6A16B]/30 sm:border-t-0 pt-2 sm:pt-2.5 mt-2 sm:mt-3 justify-center sm:justify-end flex-wrap">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-xl bg-[#FFF9F1] text-[#570A1B] hover:bg-[#C6A16B] hover:text-[#570A1B] transition-colors shadow-sm flex-shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 flex-wrap min-w-[180px]">
              <select
                value={String(currentMonth)}
                onChange={handleMonthChange}
                className="bg-[#FFF9F1] text-[#570A1B] border border-[#C6A16B]/40 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-sm font-alexandria font-bold focus:outline-none focus:ring-2 focus:ring-[#C6A16B] flex-shrink-0"
              >
                {ARABIC_MONTHS.map((m, i) => (
                  <option key={i} value={String(i)}>{m}</option>
                ))}
              </select>
              <select
                value={String(currentYear)}
                onChange={handleYearChange}
                className="bg-[#FFF9F1] text-[#570A1B] border border-[#C6A16B]/40 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-sm font-alexandria font-bold focus:outline-none focus:ring-2 focus:ring-[#C6A16B] flex-shrink-0 mt-1 sm:mt-0 sm:ml-1"
              >
                {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-xl bg-[#FFF9F1] text-[#570A1B] hover:bg-[#C6A16B] hover:text-[#570A1B] transition-colors shadow-sm flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleGoToToday}
              className="px-3 py-2 rounded-xl bg-[#C6A16B] hover:bg-[#b89158] text-[#570A1B] font-alexandria font-bold text-[10px] sm:text-xs transition-colors shadow-sm flex-shrink-0 whitespace-nowrap"
            >
              اليوم
            </button>
          </div>
        </div>

        {indexError && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4 text-right">
            <div className="flex items-center gap-2 text-red-800 mb-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="font-alexandria font-bold text-sm">يتطلب فهرس في Firestore</span>
            </div>
            <p className="text-sm text-red-700 mb-3">
              لعرض الحجوزات في التقويم، يلزم إنشاء فهرس مركب في Firestore.
            </p>
            <a
              href="https://console.firebase.google.com/v1/r/project/roqi-apartments/firestore/indexes?create_composite=ClBwcm9qZWN0cy9yb3FpLWFwYXJ0bWVudHMvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2Jvb2tpbmdzL2luZGV4ZXMvXxABGg8KC2FwYXJ0bWVudElkEAEaDwoLY2hlY2tJbkRhdGUQARoMCghfX25hbWVfXxAB"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-alexandria font-bold rounded-lg transition-colors"
            >
              <span>إنشاء الفهرس في Firebase Console</span>
              <ChevronLeft className="w-4 h-4" />
            </a>
            <p className="text-xs text-red-600 mt-2">
              بعد إنشاء الفهرس، سيستغرق بضع دقائق ليصبح نشطاً، ثم أعد تحميل الصفحة.
            </p>
          </div>
        )}

        <div className="bg-[#FFF9F1] rounded-2xl border border-[#C6A16B] shadow-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-[#C6A16B]/10">
            {ARABIC_DAYS_SHORT.map((day, i) => (
              <div key={i} className="h-14 sm:h-48 border-b border-[#C6A16B]/20 border-r border-[#C6A16B]/20 flex flex-col items-center justify-center p-1 text-right">
                <span className="font-alexandria font-bold text-[9px] sm:text-xs text-[#570A1B] uppercase tracking-wider mb-0.5">
                  {day}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-y divide-[#C6A16B]/20 divide-x divide-[#C6A16B]/20 min-h-[400px] sm:min-h-[500px] overflow-x-auto">
            {Array.from({ length: weeks }).map((_, weekIndex) => (
              <React.Fragment key={weekIndex}>
                {Array.from({ length: 7 }).map((_, colIndex) => {
                  const dayIndex = weekIndex * 7 + colIndex;
                  const dateStr = gridDates[dayIndex];
                  const isCurrentMonth = dateStr !== '';
                  const d = isCurrentMonth ? new Date(dateStr + 'T00:00:00') : null;
                  const isToday = dateStr === todayStr;

                  const dayBookings = bookingBlocks.filter(b => b.row === weekIndex && b.startDay === colIndex);

                  return (
                    <div
                      key={dayIndex}
                      className="border-r border-[#C6A16B]/20 p-1 sm:p-2 text-right relative bg-white/40 min-h-[80px] sm:min-h-[100px]"
                    >
                      {isCurrentMonth && (
                        <>
                          <div className="flex items-center justify-end mb-0.5 sm:mb-1">
                            <span className={`font-alexandria font-bold text-[10px] sm:text-xs ${isToday ? 'text-[#FFF9F1]' : 'text-[#3A2522]'}`}>
                              {d!.getDate()}
                            </span>
                            {isToday && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-[#570A1B]" />}
                          </div>
                          <div className="text-[8px] sm:text-[9px] text-[#3A2522]/60 mb-0.5">{ARABIC_MONTHS[currentMonth]}</div>

                          {dayBookings.map((block, idx) => (
                            <button
                              key={block.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedBooking(block.booking); }}
                              className={`rounded-[24px] sm:rounded-[28px] border-2 p-2 sm:p-3 mb-1 cursor-pointer shadow-sm transition-all border-white/60 ${idx === 0 ? '' : 'opacity-80'}`}
                              style={{
                                borderColor: STATUS_COLORS[block.booking.status]?.border || '#C6A16B',
                                backgroundColor: STATUS_COLORS[block.booking.status]?.bg?.replace('/90', '') || '#C6A16B',
                                gridColumn: `span ${Math.max(1, block.endDay - block.startDay + 1)}`,
                              }}
                            >
                              <span className={`text-[9px] sm:text-xs font-alexandria font-bold block ${STATUS_COLORS[block.booking.status]?.text || 'text-white'} truncate`}>
                                {block.booking.guestName}
                              </span>
                              <span className={`text-[8px] sm:text-[9px] opacity-90 block mt-0.5 ${STATUS_COLORS[block.booking.status]?.text || 'text-white'}`}>
                                {block.booking.pricePerNight.toLocaleString('ar-SA')} ر.س/ليلة
                              </span>
                            </button>
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

        <div className="bg-[#FFF9F1] p-3 rounded-xl border border-[#C6A16B]/30">
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] sm:text-xs">
            <span className="font-alexandria font-bold text-[#570A1B]">مفتاح الألوان:</span>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-medium whitespace-nowrap">مؤكد</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="font-medium whitespace-nowrap">معلق</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 border border-blue-300 text-blue-800">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span className="font-medium whitespace-nowrap">مكتمل</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 border border-red-300 text-red-800">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span className="font-medium whitespace-nowrap">ملغي</span>
            </div>
          </div>
        </div>

        <div className="bg-[#FFF9F1] p-4 rounded-xl border border-[#C6A16B]/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-white rounded-xl border border-[#C6A16B]/30">
              <div className="font-alexandria font-bold text-2xl text-[#570A1B]">{bookings.filter(b => b.status === 'confirmed').length}</div>
              <div className="text-[10px] text-[#3A2522]/70">مؤكد</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-[#C6A16B]/30">
              <div className="font-alexandria font-bold text-2xl text-amber-600">{bookings.filter(b => b.status === 'pending').length}</div>
              <div className="text-[10px] text-[#3A2522]/70">معلق</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-[#C6A16B]/30">
              <div className="font-alexandria font-bold text-2xl text-blue-600">{bookings.filter(b => b.status === 'completed').length}</div>
              <div className="text-[10px] text-[#3A2522]/70">مكتمل</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-[#C6A16B]/30">
              <div className="font-alexandria font-bold text-2xl text-[#C6A16B]">
                {bookings.filter(b => b.status === 'confirmed' || b.status === 'pending').reduce((sum, b) => sum + b.totalAmount, 0).toLocaleString('ar-SA')}
              </div>
              <div className="text-[10px] text-[#3A2522]/70">إيرادات متوقعة (ر.س)</div>
            </div>
</div>
      </div>
    </div>

    {selectedBooking && (
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-[#FFF9F1] border-2 border-[#C6A16B] rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl text-right">
          <div className="p-5 border-b border-[#C6A16B]/30 bg-[#570A1B]/5 sticky top-0 z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#570A1B] to-[#3a0511] text-[#C6A16B] flex items-center justify-center border border-[#C6A16B] shadow-md">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[#570A1B]">تفاصيل الحجز</h3>
                <span className="text-xs text-[#84394A] font-semibold">{selectedBooking.bookingNumber}</span>
              </div>
            </div>
            <button onClick={handleCloseBookingModal} className="p-2 rounded-full hover:bg-[#F3E2CC]/60 text-[#570A1B] transition-colors" aria-label="إغلاق">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-0.5">
                <span className="text-[9px] text-[#3A2522]/60 font-bold">اسم المستأجر</span>
                <span className="font-bold text-sm text-[#3A2522]">{selectedBooking.guestName}</span>
              </div>
              <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-0.5">
                <span className="text-[9px] text-[#3A2522]/60 font-bold">الشقة</span>
                <span className="font-bold text-sm text-[#570A1B]">{selectedBooking.apartmentName}</span>
              </div>
              <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-0.5">
                <span className="text-[9px] text-[#3A2522]/60 font-bold">تاريخ الوصول</span>
                <span className="font-mono text-sm text-[#570A1B]">{selectedBooking.checkInDate}</span>
                <span className="text-[9px] text-[#3A2522]/50 block">الساعة 4:00 عصراً</span>
              </div>
              <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-0.5">
                <span className="text-[9px] text-[#3A2522]/60 font-bold">تاريخ المغادرة</span>
                <span className="font-mono text-sm text-[#570A1B]">{selectedBooking.checkOutDate}</span>
                <span className="text-[9px] text-[#3A2522]/50 block">الساعة 1:00 ظهراً</span>
              </div>
              <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-0.5">
                <span className="text-[9px] text-[#3A2522]/60 font-bold">مدة الإقامة</span>
                <span className="font-bold text-sm text-[#3A2522]">{selectedBooking.nights} ليلة{selectedBooking.nights > 1 ? 'ات' : ''}</span>
              </div>
              <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-0.5">
                <span className="text-[9px] text-[#3A2522]/60 font-bold">عدد الضيوف</span>
                <span className="font-bold text-sm text-[#3A2522]">{selectedBooking.guestCount} شخص</span>
              </div>
              <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-0.5">
                <span className="text-[9px] text-[#3A2522]/60 font-bold">رقم الهوية</span>
                <span className="font-mono text-sm text-[#3A2522] dir-ltr">{selectedBooking.guestIdNumber}</span>
              </div>
              <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-0.5">
                <span className="text-[9px] text-[#3A2522]/60 font-bold">الجوال</span>
                <span className="font-mono text-sm text-[#3A2522]">{selectedBooking.guestPhone}</span>
              </div>
              <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-0.5">
                <span className="text-[9px] text-[#3A2522]/60 font-bold">سعر الليلة</span>
                <span className="font-bold text-sm text-[#570A1B]">{selectedBooking.pricePerNight.toLocaleString('ar-SA')} ر.س</span>
              </div>
              <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-0.5">
                <span className="text-[9px] text-[#3A2522]/60 font-bold">حالة الحجز</span>
                <span className={`px-2 py-1 rounded text-[10px] font-bold ${selectedBooking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : selectedBooking.status === 'pending' ? 'bg-amber-100 text-amber-800' : selectedBooking.status === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                  {selectedBooking.status === 'confirmed' ? '✓ مؤكد' : selectedBooking.status === 'pending' ? '⏳ انتظار التأكيد' : selectedBooking.status === 'completed' ? '✓ مكتمل' : '✗ ملغي'}
                </span>
              </div>
              <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-0.5">
                <span className="text-[9px] text-[#3A2522]/60 font-bold">حالة الدفع</span>
                <span className={`px-2 py-1 rounded text-[10px] font-bold ${selectedBooking.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {selectedBooking.paymentStatus === 'paid' ? '✓ مدفوع' : 'غير مدفوع'}
                </span>
              </div>
            </div>
            <div className="p-3 bg-[#F3E2CC]/40 rounded-xl border border-[#C6A16B]/20 space-y-0.5 col-span-2">
              <span className="text-[9px] text-[#3A2522]/60 font-bold">المبلغ الإجمالي</span>
              <span className="font-alexandria font-bold text-lg text-[#570A1B]">{selectedBooking.totalAmount.toLocaleString('ar-SA')} ر.س</span>
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
                  const url = `https://wa.me/${selectedBooking.guestPhone.replace(/\s/g, '').replace('+', '')}?text=${encodeURIComponent(`عزيزي ${selectedBooking.guestName}، نود إعلامك بتفاصيل حجزك رقم ${selectedBooking.bookingNumber} لشقة ${selectedBooking.apartmentName} من ${selectedBooking.checkInDate} إلى ${selectedBooking.checkOutDate}. للمزيد يرجى التواصل معنا.`)}`;
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
                onClick={handleCloseBookingModal}
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

export default AdminCalendarView;