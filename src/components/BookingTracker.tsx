import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  FileText,
  Home,
  User,
  Calendar,
  MapPin,
  Phone,
  DollarSign,
  Loader2,
  Users,
  ShieldCheck
} from 'lucide-react';
import { db, doc, getDoc, onSnapshot } from '../lib/firebase';

interface BookingTrackerProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_CONFIG = {
  pending: { label: 'بانتظار التأكيد', icon: Clock, bgColor: 'bg-amber-100', textColor: 'text-amber-800', iconColor: 'text-amber-600', borderColor: 'border-amber-300' },
  confirmed: { label: 'تم التأكيد ✓', icon: CheckCircle, bgColor: 'bg-emerald-100', textColor: 'text-emerald-800', iconColor: 'text-emerald-600', borderColor: 'border-emerald-300' },
  completed: { label: 'مكتمل ✓', icon: CheckCircle, bgColor: 'bg-blue-100', textColor: 'text-blue-800', iconColor: 'text-blue-600', borderColor: 'border-blue-300' },
  cancelled: { label: 'ملغي ✗', icon: AlertCircle, bgColor: 'bg-red-100', textColor: 'text-red-800', iconColor: 'text-red-600', borderColor: 'border-red-300' }
} as const;

export const BookingTracker: React.FC<BookingTrackerProps> = ({ isOpen, onClose }) => {
  const [bookingNumber, setBookingNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveListener, setLiveListener] = useState<(() => void) | null>(null);

  const handleSearch = async () => {
    if (!bookingNumber.trim()) {
      setError('يرجى إدخال رقم الحجز');
      return;
    }

    setSearching(true);
    setError(null);
    setBooking(null);

    // Clean up previous listener
    if (liveListener) {
      liveListener();
      setLiveListener(null);
    }

    try {
      const normalizedBookingNumber = bookingNumber.trim().toUpperCase();
      
      // Search in bookings collection by bookingNumber (document ID)
      const bookingRef = doc(db, 'bookings', normalizedBookingNumber);
      const bookingSnap = await getDoc(bookingRef);
      
      if (!bookingSnap.exists()) {
        setError('لم يتم العثور على حجز بهذا الرقم');
        setSearching(false);
        return;
      }

      const bookingData = { id: bookingSnap.id, ...bookingSnap.data() };
      
      setBooking(bookingData);
      
      // Set up real-time listener for status changes
      const unsubscribe = onSnapshot(bookingRef, (snap) => {
        if (snap.exists()) {
          setBooking({ id: snap.id, ...snap.data() });
        }
      }, (err) => {
        // Ignore AbortError - it's normal when listener is cancelled
        if (err.name === 'AbortError' || err.code === 'aborted') {
          return;
        }
        console.error('Snapshot listener error:', err);
      });
      setLiveListener(unsubscribe);
      
    } catch (err) {
      console.error('Search error:', err);
      setError('حدث خطأ في البحث، يرجى المحاولة مرة أخرى');
    } finally {
      setSearching(false);
    }
  };

  // Cleanup on close
  const handleClose = () => {
    if (liveListener) {
      liveListener();
      setLiveListener(null);
    }
    setBooking(null);
    setBookingNumber('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const statusConfig = booking ? STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending : STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  // Helper to format Firestore Timestamp
  const formatDate = (date: any) => {
    if (!date) return '—';
    if (date.toDate) return date.toDate().toLocaleString('ar-SA');
    if (typeof date === 'string') return new Date(date).toLocaleString('ar-SA');
    return '—';
  };

  // Format checkout time properly
  const formatCheckoutTime = (dateStr: string) => {
    return `${dateStr} (1:00 ظهراً)`;
  };

  // Format checkin time properly
  const formatCheckinTime = (dateStr: string) => {
    return `${dateStr} (4:00 عصراً)`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md sm:max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#570A1B] to-[#731326] text-white p-5 sm:p-6 relative flex-shrink-0">
          <button
            onClick={handleClose}
            className="absolute top-3 left-3 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <h2 className="font-alexandria font-bold text-lg sm:text-xl">متابعة حالة الحجز</h2>
            <p className="text-white/80 text-xs sm:text-sm mt-1">أدخل رقم الحجز لعرض الحالة الحية</p>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto pr-2 flex-1">
          {!booking ? (
            // Search Form - Booking Number Only
            <div className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm text-center flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-alexandria font-bold text-[#570A1B] mb-2">
                  رقم الحجز
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#C6A16B] absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={bookingNumber}
                    onChange={e => setBookingNumber(e.target.value.toUpperCase())}
                    placeholder="مثال: RQ-12345"
                    className="w-full bg-[#FFF9F1] border border-[#C6A16B] rounded-xl py-3 pr-10 pl-4 text-base font-mono focus:outline-none focus:ring-2 focus:ring-[#570A1B]"
                    autoFocus
                    onKeyPress={e => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              </div>

              <button
                onClick={handleSearch}
                disabled={searching || !bookingNumber.trim()}
                className="w-full bg-gradient-to-r from-[#570A1B] to-[#731326] text-white py-3.5 rounded-xl font-alexandria font-bold text-sm hover:brightness-105 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searching ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>جاري البحث...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>عرض حالة الحجز</span>
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-[#3A2522]/60">
                الحالة تُحدث تلقائياً عند تغييرها من قبل الإدارة
              </p>
            </div>
          ) : (
            // Booking Details with Live Status
            <div className="space-y-5">
              {/* Live Status Banner */}
              <div className={`p-4 rounded-2xl ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor} border-2 shadow-lg animate-pulse-subtle flex-shrink-0`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center flex-shrink-0">
                      <StatusIcon className={`w-5 h-5 ${statusConfig.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-alexandria font-bold text-sm text-current/80">حالة الحجز الحالية</p>
                      <p className="font-alexandria font-extrabold text-base sm:text-lg text-current truncate">{statusConfig.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold bg-white/50 px-2.5 py-1 rounded-full flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                    <span>مباشر</span>
                  </div>
                </div>
              </div>

              {/* Booking Info Grid - Organized in logical groups */}
              <div className="space-y-4">
                {/* Group 1: Identity */}
                <div>
                  <h4 className="font-alexandria font-bold text-xs text-[#570A1B] mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C6A16B]" />
                    <span>الهوية والحجز</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <BookingInfoCard icon={FileText} label="رقم الحجز" value={booking.bookingNumber} mono />
                    <BookingInfoCard icon={User} label="الاسم" value={booking.guestName} />
                    <BookingInfoCard icon={Phone} label="الجوال" value={booking.guestPhone} mono dir="ltr" />
                    <BookingInfoCard icon={ShieldCheck} label="الهوية" value={booking.guestIdNumber} mono dir="ltr" />
                  </div>
                </div>

                {/* Group 2: Stay Details */}
                <div>
                  <h4 className="font-alexandria font-bold text-xs text-[#570A1B] mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#C6A16B]" />
                    <span>تفاصيل الإقامة</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <BookingInfoCard icon={MapPin} label="الشقة" value={booking.apartmentName} />
                    <BookingInfoCard icon={Calendar} label="الوصول" value={formatCheckinTime(booking.checkInDate)} />
                    <BookingInfoCard icon={Calendar} label="المغادرة" value={formatCheckoutTime(booking.checkOutDate)} />
                    <BookingInfoCard icon={Users} label="الضيوف" value={`${booking.guestCount} شخص`} />
                  </div>
                </div>

                {/* Group 3: Financial */}
                <div>
                  <h4 className="font-alexandria font-bold text-xs text-[#570A1B] mb-2 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-[#C6A16B]" />
                    <span>المالي</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <BookingInfoCard icon={DollarSign} label="المبلغ الإجمالي" value={`${booking.totalAmount.toLocaleString('ar-SA')} ر.س`} highlight />
                  </div>
                </div>
              </div>

              {/* Timeline - Improved */}
              <div className="border-t border-[#C6A16B]/30 pt-4 space-y-4">
                <h3 className="font-alexandria font-bold text-sm text-[#570A1B] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#C6A16B]" />
                  Timeline الحجز
                </h3>
                <div className="space-y-4">
                  <TimelineStep 
                    label="تم إنشاء الحجز" 
                    time={formatDate(booking.createdAt)}
                    completed={true}
                    current={booking.status === 'pending'}
                    icon={<FileText className="w-4 h-4" />}
                  />
                  <TimelineStep 
                    label="بانتظار مراجعة الإدارة" 
                    time="فور إنشاء الحجز"
                    completed={booking.status !== 'pending'}
                    current={booking.status === 'pending'}
                    icon={<Clock className="w-4 h-4" />}
                  />
                  <TimelineStep 
                    label="تم تأكيد الحجز" 
                    time={booking.status === 'confirmed' || booking.status === 'completed' ? 'عند المراجعة' : '—'}
                    completed={booking.status === 'confirmed' || booking.status === 'completed'}
                    current={booking.status === 'confirmed'}
                    icon={<CheckCircle className="w-4 h-4" />}
                  />
                  <TimelineStep 
                    label="الإقامة مكتملة" 
                    time={booking.status === 'completed' ? 'عند المغادرة' : '—'}
                    completed={booking.status === 'completed'}
                    current={false}
                    icon={<Home className="w-4 h-4" />}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 flex-shrink-0">
                <button
                  onClick={handleClose}
                  className="flex-1 bg-[#570A1B] hover:bg-[#84394A] text-white py-3 rounded-xl font-alexandria font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>إغلاق</span>
                </button>
                <button
                  onClick={() => {
                    const msg = `السلام عليكم، ${booking.status === 'pending' ? 'أود إرسال إيصال التحويل لحجز' : 'استفسار عن حجز'} رقم ${booking.bookingNumber}`;
                    window.open(`https://wa.me/966595812059?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                  className="flex-1 bg-[#25D366] hover:bg-[#20ba5a] text-white py-3 rounded-xl font-alexandria font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <span>{booking.status === 'pending' ? 'إرسال إيصال واتساب' : 'تواصل واتساب'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper Components
const BookingInfoCard: React.FC<{ icon: React.ElementType; label: string; value: string; mono?: boolean; highlight?: boolean; dir?: string }> = ({ 
  icon: Icon, label, value, mono, highlight, dir 
}) => (
  <div className={`p-3 rounded-xl bg-white border transition-all ${
    highlight 
      ? 'border-[#C6A16B] shadow-[0_0_0_1px_#C6A16B] bg-[#FFF9F1]/50' 
      : 'border-[#C6A16B]/40 hover:border-[#C6A16B]/60'
  }`}>
    <div className="flex items-center gap-2 mb-1.5">
      <Icon className="w-4 h-4 text-[#C6A16B] flex-shrink-0" />
      <span className="text-[10px] text-[#3A2522]/70 font-medium truncate">{label}</span>
    </div>
    <span className={`font-bold text-sm ${mono ? 'font-mono' : ''} ${highlight ? 'text-[#570A1B]' : 'text-[#3A2522]'} ${dir ? 'dir-ltr' : ''} block truncate`}>
      {value}
    </span>
  </div>
);

const TimelineStep: React.FC<{ 
  label: string; 
  time: string; 
  completed: boolean; 
  current: boolean; 
  icon: React.ReactNode;
}> = ({ label, time, completed, current, icon }) => (
  <div className="flex items-start gap-3 relative">
    <div className="relative z-10 flex-shrink-0 w-8">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 relative ${
        completed ? 'bg-emerald-500 border-emerald-500' : 
        current ? 'bg-amber-500 border-amber-500 animate-pulse' : 
        'bg-gray-100 border-gray-300'
      }`}>
        {completed ? (
          <CheckCircle className="w-5 h-5 text-white" />
        ) : current ? (
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
        ) : (
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
        )}
        {icon && !completed && !current && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            {icon}
          </div>
        )}
      </div>
      {!completed && (
        <div className="absolute left-3.5 top-8 bottom-0 w-0.5 border-l border-dashed border-gray-200" />
      )}
    </div>
    <div className="flex-1 min-w-0 pt-0.5">
      <p className={`font-alexandria font-bold text-sm ${completed ? 'text-emerald-700' : current ? 'text-amber-700' : 'text-gray-600'}`}>
        {label}
      </p>
      <p className="text-[11px] text-gray-400 mt-0.5">{time}</p>
    </div>
  </div>
);

// Add these animations to global CSS or use inline
const style = document.createElement('style');
style.textContent = `
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse-subtle { 0%, 100% { box-shadow: 0 0 0 0 currentColor; } 50% { box-shadow: 0 0 0 8px transparent; } }
  .animate-fade-in { animation: fade-in 0.2s ease-out; }
  .animate-slide-up { animation: slide-up 0.3s ease-out; }
  .animate-pulse-subtle { animation: pulse-subtle 2s infinite; }
`;
if (typeof document !== 'undefined' && !document.querySelector('#booking-tracker-styles')) {
  style.id = 'booking-tracker-styles';
  document.head.appendChild(style);
}