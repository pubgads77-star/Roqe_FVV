import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Building2, 
  Calendar as CalendarIcon, 
  User, 
  Users,
  Phone, 
  CheckCircle, 
  ArrowLeft, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  FileText,
  AlertCircle,
  Copy,
  Check,
  Lock,
  Wallet,
  Info,
  MessageSquare,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Loader2,
  X,
  Plus,
  Minus,
  Bell
} from 'lucide-react';
import { APARTMENTS, Booking, Apartment } from '../data/apartmentsData';
import { COUNTRY_DIALS } from '../data/countries';
import alrajhiQr from '../assets/images/alrajhi-qr.jpeg';
import { getOrCreateClientId } from '../lib/clientId';
import { 
  db, 
  doc, 
  setDoc, 
  serverTimestamp, 
  collection, 
  query, 
  onSnapshot,
  getDocs,
  where,
  getDoc,
} from '../lib/firebase';
import { useApartmentBookings, useBlockedDates, useApartmentClosures, useApartmentPriceOverrides, buildPriceMapForStay } from '../hooks';

interface BookingWizardProps {
  initialApartmentId?: string;
  onBookingComplete?: (booking: Booking) => void;
  onCancel: () => void;
}

export const BookingWizard: React.FC<BookingWizardProps> = ({
  initialApartmentId = 'apt-01',
  onBookingComplete,
  onCancel
}) => {
  // 4 Streamlined Steps:
  // 1: Apartment & Dates
  // 2: Guest Details & Contract Info
  // 3: Payment System (Al Rajhi Bank)
  // 4: Final Review & Confirmation
  const [step, setStep] = useState<number>(1);

  // Scroll to top whenever step changes so each step starts from the beginning
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [step]);
  const [selectedAptId, setSelectedAptId] = useState<string>(initialApartmentId);

  // Dates state - Dynamic defaults: tomorrow & day after tomorrow
  const getDefaultCheckIn = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };
  const getDefaultCheckOut = () => {
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    return dayAfterTomorrow.toISOString().split('T')[0];
  };
  const [checkIn, setCheckIn] = useState<string>(getDefaultCheckIn);
  const [checkOut, setCheckOut] = useState<string>(getDefaultCheckOut);

  // Guest details state
  const [guestName, setGuestName] = useState<string>('');
  const [guestIdNumber, setGuestIdNumber] = useState<string>('');
  const [phoneCountryCode, setPhoneCountryCode] = useState<string>('966');
  const [phoneLocal, setPhoneLocal] = useState<string>('');
  const [guestCount, setGuestCount] = useState<number>(1);
  const [apartmentsCount, setApartmentsCount] = useState<number>(1);
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(true);
  const [validationError, setValidationError] = useState<string>('');

  const normalizedPhoneLocal = phoneLocal.replace(/\D/g, '').replace(/^0+/, '');
  const fullGuestPhone = normalizedPhoneLocal ? `+${phoneCountryCode}${normalizedPhoneLocal}` : '';

  // Payment State (Al Rajhi Bank - Direct Transfer Only)
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [creatingBookingNow, setCreatingBookingNow] = useState(false);
  const [bookingFinalized, setBookingFinalized] = useState(false);
  const [showBookingCreatedToast, setShowBookingCreatedToast] = useState(false);
  const [finalizedBooking, setFinalizedBooking] = useState<Booking | null>(null);
  const [readyToFinalize, setReadyToFinalize] = useState(false);

  // Real-time apartment prices from Firestore
  const [firestoreApartments, setFirestoreApartments] = useState<Apartment[]>([]);
  const [apartmentsLoading, setApartmentsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'apartments'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('🔥 [BookingWizard] Apartments snapshot received:', snapshot.size, 'docs');
      snapshot.docChanges().forEach(change => {
        console.log('📝 [BookingWizard] Change:', change.type, change.doc.id, change.doc.data());
      });
      const apartmentsData: Apartment[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const staticApt = APARTMENTS.find(a => a.id === doc.id);
        
        // Normalize images array - fallback to static data if images array is missing
        const normalizedData = {
          ...data,
          id: doc.id,
          images: data.images?.length > 0 
            ? data.images 
            : staticApt?.images?.length > 0
              ? staticApt.images
              : data.mainImage 
                ? [{ url: data.mainImage, title: data.name || 'صورة الشقة', category: 'general' }]
                : [{ url: '/assets/aistudio/WhatsApp_Image_2026-11-09_at_11.50.27_AM_f8a97ec8.jpeg', title: 'صورة الشقة', category: 'general' }],
          // Normalize amenities array - fallback to static data if missing
          amenities: data.amenities?.length > 0
            ? data.amenities
            : staticApt?.amenities?.length > 0
              ? staticApt.amenities
              : [
                  { category: 'غرف النوم', items: ['غرفة ماستر مع دورة مياه خاصة', 'غرفة نوم إضافية (سريرين مفردة)', 'مراتب إضافية مع بطانيات ومخدات'] },
                  { category: 'الترفيه', items: ['شاشة ذكية 55 بوصة', 'إنترنت فائق السرعة', 'نظام صوتي مدمج'] },
                  { category: 'المطبخ', items: ['مطبخ مجهز بالكامل', 'ثلاجة، فرن، ميكروويف', 'غلاية، أواني طهي، أدوات طعام'] },
                  { category: 'الأمان والخدمات', items: ['دخول ذكي برمز مشفر', 'كاميرات مراقبة مشتركة', 'صيانة دورية 24/7', 'مواقف سيارات خاصة'] }
                ]
        };
        apartmentsData.push(normalizedData as Apartment);
      });
      setFirestoreApartments(apartmentsData);
      setApartmentsLoading(false);
    }, (err) => {
      if (err.name === 'AbortError' || err.code === 'aborted') return;
      console.error('Apartments listener error:', err);
      setApartmentsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const apartmentsSource = firestoreApartments.length > 0 ? firestoreApartments : APARTMENTS;

  const selectedApartment = useMemo(() => {
    const source = firestoreApartments.length > 0 ? firestoreApartments : APARTMENTS;
    return source.find(a => a.id === selectedAptId) || source[0];
  }, [selectedAptId, firestoreApartments]);

  // Real-time bookings for the selected apartment
  const { bookings: apartmentBookings, loading: bookingsLoading, error: bookingsError } = useApartmentBookings(selectedAptId);
  
  // Real-time admin closures and price overrides for selected apartment
  const { closures: apartmentClosures } = useApartmentClosures(selectedAptId);
  const { overrides: apartmentPriceOverrides } = useApartmentPriceOverrides(selectedAptId);

  // Compute blocked dates from real-time bookings + admin closures
  const { 
    isDateBlocked, 
    getBlockedInfo, 
    isDateRangeBlocked,
    blockedDateDetails 
  } = useBlockedDates(apartmentBookings, apartmentClosures);

  // Calculate nights - date-only comparison to avoid DST/timezone issues
  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 1;
    const start = new Date(checkIn + 'T00:00:00');
    const end = new Date(checkOut + 'T00:00:00');
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  }, [checkIn, checkOut]);

  // Pricing calculations: base price with per-night date-range overrides (if any)
  const basePricePerNight = selectedApartment.pricePerNight;
  const pricing = useMemo(
    () => buildPriceMapForStay(checkIn, checkOut, basePricePerNight, apartmentPriceOverrides),
    [checkIn, checkOut, basePricePerNight, apartmentPriceOverrides]
  );
  const totalAmount = pricing.total > 0 ? pricing.total : (nights * basePricePerNight);
  const pricePerNight = basePricePerNight;
  const effectiveAvgPricePerNight = nights > 0 ? Math.round(totalAmount / nights) : basePricePerNight;
  const hasCustomPricing = pricing.nightly.some(n => n.override);

  // DEBUG removed in production path
  // console.log('[BookingWizard] Pricing Debug:', { selectedAptId, selectedApartmentId: selectedApartment.id, selectedApartmentName: selectedApartment.name, pricePerNight, nights, totalAmount, firestoreLength: firestoreApartments.length, usingFirebase: firestoreApartments.length > 0 });

  // Dynamic 10+ Year Calendar State
  const today = useMemo(() => new Date(), []);
  const [calendarYear, setCalendarYear] = useState<number>(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(today.getMonth()); // 0-11
  const [calendarNotice, setCalendarNotice] = useState<{ message: string; type: 'blocked' | 'success' | 'info' } | null>(null);

  // 12-Year Window (Guarantees working smoothly for at least 10 years forward: 2024–2036+)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const baseYear = Math.min(currentYear, 2024);
    const years: number[] = [];
    for (let y = baseYear; y <= baseYear + 12; y++) {
      years.push(y);
    }
    return years;
  }, []);

  const ARABIC_MONTHS = [
    'يناير (1)', 'فبراير (2)', 'مارس (3)', 'أبريل (4)',
    'مايو (5)', 'يونيو (6)', 'يوليو (7)', 'أغسطس (8)',
    'سبتمبر (9)', 'أكتوبر (10)', 'نوفمبر (11)', 'ديسمبر (12)'
  ];

  const goToPrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(prev => prev - 1);
    } else {
      setCalendarMonth(prev => prev - 1);
    }
    setCalendarNotice(null);
  };

  const goToNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(prev => prev + 1);
    } else {
      setCalendarMonth(prev => prev + 1);
    }
    setCalendarNotice(null);
  };

  const goToToday = () => {
    const now = new Date();
    setCalendarYear(now.getFullYear());
    setCalendarMonth(now.getMonth());
    setCalendarNotice(null);
  };

  // Status check for Check-In input (Green if available, Red if booked or past)
  const checkInStatus = useMemo(() => {
    if (!checkIn) return { isSet: false, isBlocked: false, isPast: false, message: '' };
    const todayStr = new Date().toISOString().split('T')[0];
    if (checkIn < todayStr) {
      return {
        isSet: true,
        isBlocked: true,
        isPast: true,
        message: '⚠️ تاريخ الوصول في الماضي، يُرجى تحديد تاريخ قادم.'
      };
    }
    const blocked = isDateBlocked(checkIn);
    if (blocked) {
      const blockedInfo = getBlockedInfo(checkIn);
      const isClosed = blockedInfo?.reason === 'closed';
      return {
        isSet: true,
        isBlocked: true,
        isPast: false,
        blockReason: isClosed ? 'closed' : 'booking',
        message: isClosed
          ? `⛔ مغلق! تاريخ الوصول (${checkIn}) مغلق من الإدارة في ${selectedApartment.name} ولا يمكن حجزه.${blockedInfo?.note ? ' (' + blockedInfo.note + ')' : ''}`
          : `⛔ غير متاح! تاريخ الوصول (${checkIn}) محجوز مسبقاً في ${selectedApartment.name} (حجز: ${blockedInfo?.bookingNumber || 'غير معروف'}). يُرجى اختيار تاريخ متاح باللون الأخضر.`
      };
    }
    return {
      isSet: true,
      isBlocked: false,
      isPast: false,
      message: `✓ تاريخ الوصول (${checkIn}) متاح ومؤكد للحجز الفوري.`
    };
  }, [checkIn, selectedAptId, selectedApartment.name, isDateBlocked, getBlockedInfo]);

  // Status check for Check-Out input (Green if available, Red if invalid or blocked dates in range)
  const checkOutStatus = useMemo(() => {
    if (!checkOut) return { isSet: false, isBlocked: false, isInvalid: false, message: '' };
    if (!checkIn) return { isSet: true, isBlocked: false, isInvalid: false, message: 'يرجى تحديد تاريخ الوصول أولاً.' };
    
    if (checkOut <= checkIn) {
      return {
        isSet: true,
        isBlocked: true,
        isInvalid: true,
        message: '⚠️ تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول بيوم على الأقل.'
      };
    }

    // Check if any date in the entire range is blocked using real-time data
    const rangeCheck = isDateRangeBlocked(checkIn, checkOut);

    if (rangeCheck.blocked) {
      const isClosed = rangeCheck.blockedInfo?.reason === 'closed';
      return {
        isSet: true,
        isBlocked: true,
        isInvalid: false,
        blockReason: isClosed ? 'closed' : 'booking',
        message: isClosed
          ? `⛔ الفترة غير متاحة! يوم (${rangeCheck.blockedDate}) مغلق من الإدارة ولا يمكن حجزه.${rangeCheck.blockedInfo?.note ? ' (' + rangeCheck.blockedInfo.note + ')' : ''}`
          : `⛔ الفترة غير متاحة! يوم (${rangeCheck.blockedDate}) محجوز بالفعل (حجز: ${rangeCheck.blockedInfo?.bookingNumber || 'غير معروف'}). يُرجى اختيار فترة خالية باللون الأخضر.`
      };
    }

    return {
      isSet: true,
      isBlocked: false,
      isInvalid: false,
      message: `✓ مدة الإقامة (${nights} ليالٍ) متاحة بالكامل ومؤكدة.`
    };
  }, [checkIn, checkOut, nights, isDateRangeBlocked]);

  // Calendar days and weekday offset for accurate day alignment
  const calendarData = useMemo(() => {
    const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 = Sun ... 6 = Sat
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const pad = (n: number) => n < 10 ? `0${n}` : `${n}`;
    const monthFormatted = pad(calendarMonth + 1);
    const todayStr = new Date().toISOString().split('T')[0];

    const days: { 
      dateStr: string; 
      dayNum: number; 
      isBlocked: boolean; 
      blockReason?: 'booking' | 'closed';
      isPast: boolean;
    }[] = [];

    for (let d = 1; d <= totalDays; d++) {
      const dayFormatted = pad(d);
      const dateStr = `${calendarYear}-${monthFormatted}-${dayFormatted}`;
      const isBlocked = isDateBlocked(dateStr);
      const blockedInfo = isBlocked ? getBlockedInfo(dateStr) : undefined;
      const isPast = dateStr < todayStr;

      days.push({
        dateStr,
        dayNum: d,
        isBlocked,
        blockReason: blockedInfo?.reason,
        isPast
      });
    }

    return { firstDayOfWeek, days };
  }, [calendarYear, calendarMonth, isDateBlocked, getBlockedInfo]);

  const handleDateClick = (dateStr: string, isBlocked: boolean, isPast: boolean) => {
    if (isPast) {
      setCalendarNotice({
        type: 'blocked',
        message: `⚠️ هذا التاريخ من الماضي (${dateStr}) ولا يمكن اختياره للحجز.`
      });
      return;
    }

    if (isBlocked) {
      const blockedInfo = getBlockedInfo(dateStr);
      const isClosed = blockedInfo?.reason === 'closed';
      setCalendarNotice({
        type: 'blocked',
        message: isClosed
          ? `⛔ هذا اليوم (${dateStr}) مغلق من الإدارة في ${selectedApartment.name} ولا يمكن حجزه.${blockedInfo?.note ? ' (' + blockedInfo.note + ')' : ''} يُرجى اختيار موعد متاح.`
          : `⛔ هذا اليوم (${dateStr}) محجوز بالكامل في ${selectedApartment.name} (حجز: ${blockedInfo?.bookingNumber || 'غير معروف'}). تم تمييزه باللون الأحمر لتوضيح عدم توفره. يُرجى اختيار موعد متاح باللون الأخضر.`
      });
      return;
    }

    setValidationError('');

    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(dateStr);
      setCheckOut('');
      setCalendarNotice({
        type: 'success',
        message: `✓ تم تحديد تاريخ الوصول (${dateStr}). الآن انقر على تاريخ المغادرة.`
      });
    } else if (checkIn && !checkOut) {
      if (dateStr > checkIn) {
        // Check if any date in range is blocked using real-time data
        const rangeCheck = isDateRangeBlocked(checkIn, dateStr);

        if (rangeCheck.blocked) {
          const isClosed = rangeCheck.blockedInfo?.reason === 'closed';
          setValidationError(isClosed
            ? `الفترة المحددة تتضمن يوماً مغلقاً من الإدارة (${rangeCheck.blockedDate}). يرجى اختيار فترة متاحة.`
            : `الفترة المحددة تتضمن يوماً محجوزاً (${rangeCheck.blockedDate}). يرجى اختيار فترة متاحة باللون الأخضر.`);
          setCalendarNotice({
            type: 'blocked',
            message: isClosed
              ? `⛔ لا يمكن اختيار هذه الفترة لأن يوم (${rangeCheck.blockedDate}) مغلق من الإدارة ولا يمكن حجزه.${rangeCheck.blockedInfo?.note ? ' (' + rangeCheck.blockedInfo.note + ')' : ''}`
              : `⚠️ لا يمكن اختيار هذه الفترة لأن يوم (${rangeCheck.blockedDate}) محجوز مسبقاً (حجز: ${rangeCheck.blockedInfo?.bookingNumber || 'غير معروف'})! اختر تواريخ خالية باللون الأخضر.`
          });
          return;
        }

        setCheckOut(dateStr);
        setCalendarNotice({
          type: 'success',
          message: `✓ تم تأكيد فترة الإقامة بنجاح من ${checkIn} إلى ${dateStr} (${nights} ليالٍ).`
        });
      } else {
        setCheckIn(dateStr);
        setCheckOut('');
        setCalendarNotice({
          type: 'success',
          message: `✓ تم تحديث تاريخ الوصول إلى (${dateStr}). الآن انقر على تاريخ المغادرة.`
        });
      }
    }
  };

  const isDateSelected = (dateStr: string) => {
    if (dateStr === checkIn) return 'check-in';
    if (dateStr === checkOut) return 'check-out';
    if (checkIn && checkOut && dateStr > checkIn && dateStr < checkOut) return 'in-range';
    return 'none';
  };

  const handleCopyText = (text: string, fieldKey: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 3000);
    }
  };

  const generateWhatsAppMessage = (booking: Booking): string => {
    const formattedDate = (date: string) => {
      const d = new Date(date);
      return d.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    return `🏨 طلب حجز جديد - شقق رُقِيّ الفندقية

📋 رقم الحجز: ${booking.bookingNumber}
📅 تاريخ الطلب: ${new Date().toLocaleDateString('ar-SA')}

========================
🏠 تفاصيل الوحدة:
• عدد الشقق: ${booking.apartmentsCount || 1}
• الوصول: ${formattedDate(booking.checkInDate)} (4:00 مساءً)
• المغادرة: ${formattedDate(booking.checkOutDate)} (1:00 ظهراً)
• المدة: ${booking.nights} ليالٍ

========================
👤 بيانات المستأجر:
• الاسم: ${booking.guestName}
• الهوية: ${booking.guestIdNumber}
• الجوال: ${booking.guestPhone}
• عدد الضيوف: ${booking.guestCount}

========================
💰 الفاتورة المالية:
• الإيجار (${booking.nights} ليالٍ × ${booking.pricePerNight.toLocaleString('ar-SA')} ر.س): ${booking.totalAmount.toLocaleString('ar-SA')} ر.س
• المبلغ الإجمالي للتحويل: ${booking.totalAmount.toLocaleString('ar-SA')} ر.س

========================
🏦 بيانات التحويل (مصرف الراجحي):
• المستفيد: احمد سعد مطر العضياني الحارثي
• رقم الحساب: 077030010006083063875
• الآيبان: SA59 8000 0858 6080 1306 3875
• السويفت: RJHISARI

========================
📎 ملاحظات هامة:
• يرجى تحويل المبلغ الإجمالي: ${booking.totalAmount.toLocaleString('ar-SA')} ر.س
• احتفظ بإيصال التحويل وأرسله هنا
• سيتم تأكيد الحجز بعد التحقق من وصول المبلغ
• حالة الحجز الحالية: بانتظار تأكيد التحويل

========================
نظام حجوزات رُقِيّ الفندقية`;
  };

  const finalizeBookingNow = async (): Promise<Booking | null> => {
    const bookingNumber = `RQ-${Math.floor(10000 + Math.random() * 90000)}`;
    const clientId = getOrCreateClientId();
    const newBooking: Booking = {
      id: bookingNumber,
      bookingNumber,
      apartmentId: selectedApartment.id,
      apartmentName: selectedApartment.name,
      guestName,
      guestIdNumber,
      guestPhone: fullGuestPhone,
      guestEmail: '',
      guestCount,
      apartmentsCount,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      nights,
      pricePerNight: hasCustomPricing ? effectiveAvgPricePerNight : basePricePerNight,
      subtotal: totalAmount * apartmentsCount,
      serviceFee: 0,
      deposit: 0,
      totalAmount: totalAmount * apartmentsCount,
      notes: `[الدفع: تحويل بنكي - مصرف الراجحي السعودي] [عدد الشقق: ${apartmentsCount}]`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      guestClientId: clientId
    };

    await setDoc(doc(db, 'bookings', bookingNumber), {
      ...newBooking,
      createdAt: serverTimestamp()
    });
    return newBooking;
  };

  const handleNextStep = async () => {
    setValidationError('');
    const showValidationError = (message: string) => {
      setValidationError(message);
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    // Step 1 validation
    if (step === 1) {
      if (!checkIn || !checkOut) {
        showValidationError('يرجى تحديد كلٍ من تاريخ الوصول وتاريخ المغادرة.');
        return;
      }
      if (nights < 1) {
        showValidationError('تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول بيوم على الأقل.');
        return;
      }
      if (checkInStatus.isBlocked) {
        showValidationError(checkInStatus.blockReason === 'closed'
          ? 'تاريخ الوصول المحدد مغلق من الإدارة. يُرجى اختيار تاريخ متاح للمتابعة.'
          : 'تاريخ الوصول المحدد محجوز مسبقاً. يُرجى اختيار تاريخ متاح باللون الأخضر للمتابعة.');
        return;
      }
      if (checkOutStatus.isBlocked) {
        showValidationError(checkOutStatus.blockReason === 'closed'
          ? 'الفترة المختارة تحتوي على أيام مغلقة من الإدارة. يُرجى اختيار فترة متاحة للمتابعة.'
          : 'الفترة المختارة تحتوي على أيام محجوزة مسبقاً. يُرجى اختيار فترة متاحة للمتابعة.');
        return;
      }
      setStep(2);
      return;
    }

    // Step 2 validation + finalize flow
    if (step === 2) {
      if (bookingFinalized && finalizedBooking) {
        setStep(3);
        return;
      }
      if (!guestName.trim()) {
        showValidationError('يرجى كتابة الاسم الكامل للمستأجر.');
        return;
      }
      if (!guestIdNumber.trim() || guestIdNumber.length < 8) {
        showValidationError('يرجى كتابة رقم الهوية الوطنية بشكل صحيح لإصدار العقد الإلكتروني.');
        return;
      }
      if (!normalizedPhoneLocal || normalizedPhoneLocal.length < 6) {
        showValidationError('يرجى اختيار مفتاح الدولة وإدخال رقم الجوال الصحيح للتواصل وتأكيد الحجز.');
        return;
      }

      if (!readyToFinalize) {
        setReadyToFinalize(true);
        return;
      }

      // التحقق النهائي من التوفر محلياً (حجوزات + تواريخ محجوبة) قبل إنشاء الحجز
      setCreatingBookingNow(true);
      try {
        const bookingsSnapshot = await getDocs(query(
          collection(db, 'bookings'),
          where('apartmentId', '==', selectedApartment.id),
          where('status', 'in', ['confirmed', 'pending'])
        ));

        const hasLocalConflict = bookingsSnapshot.docs.some(docSnap => {
          const booking = docSnap.data() as { checkInDate: string; checkOutDate: string };
          return checkIn < booking.checkOutDate && booking.checkInDate < checkOut;
        });

        if (hasLocalConflict) {
          showValidationError('عذراً، الفترة التي اخترتها محجوزة حالياً. يرجى اختيار تواريخ أخرى.');
          return;
        }

        // Legacy blocked dates collection compatibility
        const blockedDoc = await getDoc(doc(db, 'blockedDates', selectedApartment.id));
        if (blockedDoc.exists()) {
          const blockedData = blockedDoc.data() as { blocked?: string[] };
          const blockedDates = blockedData.blocked || [];
          const isSelectedBlocked = blockedDates.some(date => date >= checkIn && date < checkOut);
          if (isSelectedBlocked) {
            showValidationError('عذراً، الفترة التي اخترتها محجوزة حالياً. يرجى اختيار تواريخ أخرى.');
            return;
          }
        }

        const createdBooking = await finalizeBookingNow();
        if (!createdBooking) {
          throw new Error('فشل إنشاء الحجز');
        }

        const nextBooking = {
          ...createdBooking,
          clientId: createdBooking.guestClientId || getOrCreateClientId()
        };
        setFinalizedBooking(nextBooking);
        setBookingFinalized(true);
        setStep(3);

        setShowBookingCreatedToast(true);

        setTimeout(() => {
          window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        }, 80);
      } catch (e: any) {
        console.error('Error creating booking:', e);
        showValidationError('حدث خطأ أثناء إتمام الحجز، يرجى المحاولة مرة أخرى.');
      } finally {
        setCreatingBookingNow(false);
      }
      return;
    }



    // Step 3: send WhatsApp message only (booking already created)
    if (step === 3) {
      const bookingToSend = finalizedBooking;
      if (!bookingToSend) {
        showValidationError('لم يتم العثور على بيانات الحجز. يرجى الرجوع وإتمام الحجز أولاً.');
        return;
      }
      const whatsappMessage = generateWhatsAppMessage(bookingToSend);
      const phoneNumber = '966595812059';
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(whatsappMessage)}`;
      window.open(whatsappUrl, '_blank');
      return;
    }

    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setValidationError('');
    if (step === 1) {
      onCancel();
    } else {
      if (step === 2) setReadyToFinalize(false);
      setStep(prev => prev - 1);
    }
  };

  const stepsList = [
    { num: 1, title: 'التواريخ', icon: <CalendarIcon className="w-4 h-4" /> },
    { num: 2, title: 'بيانات المستأجر', icon: <User className="w-4 h-4" /> },
    { num: 3, title: 'دفع مصرف الراجحي', icon: <Wallet className="w-4 h-4" /> },
  ];

  return (
    <div className="py-6 sm:py-10 md:py-14 bg-[#F3E2CC] min-h-screen text-[#3A2522]">
      {/* Booking creation loading overlay */}
      {creatingBookingNow && (
        <div className="fixed inset-0 z-[80] bg-[#241411]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFF9F1] border-2 border-[#C6A16B] rounded-3xl px-8 py-7 shadow-2xl text-center space-y-4 max-w-sm w-full">
            <div className="w-14 h-14 mx-auto rounded-full border-4 border-[#C6A16B]/40 border-t-[#570A1B] animate-spin"></div>
            <div className="font-alexandria font-bold text-lg text-[#570A1B]">جاري إنشاء الحجز...</div>
            <div className="text-xs text-[#3A2522]/70">يرجى الانتظار لحفظ بيانات الحجز بشكل آمن</div>
          </div>
        </div>
      )}

      {/* Booking created success toast */}
      {showBookingCreatedToast && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={() => setShowBookingCreatedToast(false)}>
          <div className="absolute inset-0 bg-black/10"></div>
          <button
            type="button"
            onClick={() => setShowBookingCreatedToast(false)}
            className="-translate-y-10 sm:-translate-y-14 relative bg-gradient-to-b from-[#FFF9F1] to-[#F3E2CC] border-2 border-emerald-500 rounded-3xl shadow-2xl px-6 py-5 sm:px-8 sm:py-6 max-w-md w-full text-center animate-in fade-in zoom-in-95 duration-300 focus:outline-none"
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-700" />
            </div>
            <div className="font-alexandria font-extrabold text-lg sm:text-xl text-[#570A1B] mb-1.5">تم إنشاء الحجز</div>
            <div className="text-sm sm:text-base font-semibold text-[#3A2522] leading-relaxed">تم إنشاء الحجز يرجى مواصلة العملية وسرعة السداد</div>
            {finalizedBooking?.bookingNumber && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#570A1B]/10 text-[#570A1B] text-xs font-bold">
                <span>رقم الحجز:</span>
                <span className="font-mono">{finalizedBooking.bookingNumber}</span>
              </div>
            )}
            <div className="mt-3 text-[11px] text-[#3A2522]/60">اضغط للإغلاق</div>
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        
        {/* Top Header Card */}
        <div className="bg-[#570A1B] text-[#FFF9F1] p-5 sm:p-7 rounded-3xl border border-[#C6A16B] shadow-xl text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#C6A16B_1px,transparent_1px)] [background-size:20px_20px]"></div>
          
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF9F1]/10 text-[#C6A16B] text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>نظام الحجز المباشر والتوثيق الفوري</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-alexandria font-bold text-[#FFF9F1]">
              حجز شقق رُقِيّ الفندقية
            </h1>
            <p className="text-xs sm:text-sm text-[#FFF9F1] font-semibold leading-relaxed max-w-xl mx-auto drop-shadow-xs">
              إجراءات حجز مبسطة ومرنة مع توثيق إلكتروني لعقد الإيجار ودفع آمن عبر مصرف الراجحي السعودي.
            </p>
          </div>
        </div>

        {/* Stepper Progress Bar (Ultra-Clean & Responsive for Mobile) */}
        <div className="bg-[#FFF9F1] p-3 sm:p-5 rounded-2xl border border-[#C6A16B]/60 shadow-md">
          {/* Mobile Step Indicator: Compact & Readable */}
          <div className="sm:hidden space-y-2">
            <div className="flex items-center justify-between text-xs font-alexandria">
              <span className="font-bold text-[#570A1B]">
                الخطوة {step} من {stepsList.length}: <span className="text-[#C6A16B]">{stepsList[step - 1]?.title}</span>
              </span>
              <span className="text-[11px] text-[#3A2522]/70 font-mono font-bold">
                %{Math.round((step / stepsList.length) * 100)}
              </span>
            </div>
            <div className="w-full bg-[#570A1B]/15 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-l from-[#C6A16B] to-[#570A1B] h-full rounded-full transition-all duration-300"
                style={{ width: `${(step / stepsList.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Desktop Stepper: Elegant Horizontal Pills */}
          <div className="hidden sm:grid grid-cols-3 gap-3 text-right">
            {stepsList.map(s => {
              const isActive = step === s.num;
              const isPassed = step > s.num;
              return (
                <div 
                  key={s.num}
                  className={`p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                    isActive 
                      ? 'bg-[#570A1B] text-[#FFF9F1] border-[#C6A16B] shadow-sm' 
                      : isPassed
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-[#F3E2CC]/40 text-[#3A2522]/60 border-[#C6A16B]/30'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                    isActive 
                      ? 'bg-[#C6A16B] text-[#570A1B]' 
                      : isPassed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/80 text-[#3A2522]'
                  }`}>
                    {isPassed ? <Check className="w-3.5 h-3.5" /> : s.num}
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] opacity-75 font-light">الخطوة {s.num}</div>
                    <div className="font-alexandria font-bold text-xs truncate">{s.title}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-800 flex items-center gap-3 text-xs sm:text-sm text-right animate-shake shadow-xs">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="font-medium">{validationError}</span>
          </div>
        )}

        {/* ========================================================
            STEP 1: APARTMENT SELECTION & STAY DATES
        ======================================================== */}
        {step === 1 && (
          <div className="space-y-6">
            
            {/* Dates & Calendar Selection (Mobile Optimized) */}
            <div className="bg-[#FFF9F1] p-5 sm:p-7 rounded-3xl border border-[#C6A16B] shadow-md space-y-5 text-right">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-[#C6A16B]" />
                  <h2 className="font-alexandria font-bold text-base sm:text-lg text-[#570A1B]">
                    1. حدد تواريخ الإقامة (الوصول والمغادرة)
                  </h2>
                </div>
                <span className="text-xs text-[#3A2522]/70 font-light">
                  الدخول 4:00 م · المغادرة 1:00 م
                </span>
              </div>

              {/* Check-In / Check-Out Inputs (Dynamic Green/Red Availability Feedback) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Check-in input box */}
                <div className={`p-4 rounded-2xl border-2 transition-all space-y-2 ${
                  checkInStatus.isBlocked
                    ? 'bg-red-50/80 border-red-500 shadow-xs'
                    : checkInStatus.isSet && !checkInStatus.isBlocked
                    ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
                    : 'bg-[#F3E2CC]/40 border-[#C6A16B]/60'
                }`}>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-alexandria font-bold text-[#570A1B]">
                      تاريخ الوصول (Check-in)
                    </label>
                    {checkInStatus.isSet && !checkInStatus.isBlocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>متاح للحجز</span>
                      </span>
                    )}
                    {checkInStatus.isBlocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded-full border border-red-300 animate-pulse">
                        <AlertCircle className="w-3 h-3 text-red-600" />
                        <span>محجوز بالفعل</span>
                      </span>
                    )}
                  </div>

                  <input
                    type="date"
                    value={checkIn}
                    onChange={e => {
                      setCheckIn(e.target.value);
                      setValidationError('');
                      setCalendarNotice(null);
                    }}
                    className={`w-full rounded-xl py-2.5 px-3.5 text-xs sm:text-sm font-bold focus:outline-none transition-all ${
                      checkInStatus.isBlocked
                        ? 'bg-white text-red-900 border-2 border-red-500 focus:ring-2 focus:ring-red-400'
                        : checkInStatus.isSet && !checkInStatus.isBlocked
                        ? 'bg-white text-emerald-900 border-2 border-emerald-500 focus:ring-2 focus:ring-emerald-400'
                        : 'bg-[#FFF9F1] text-[#241411] border border-[#C6A16B] focus:ring-2 focus:ring-[#570A1B]'
                    }`}
                  />

                  {/* Status explanation alert */}
                  {checkInStatus.isBlocked && (
                    <div className="p-2.5 rounded-xl bg-red-100 border border-red-300 text-red-900 text-[11px] font-medium flex items-start gap-2 text-right">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-red-950">التاريخ محجوز مسبقاً وغير متاح:</div>
                        <div>{checkInStatus.message}</div>
                      </div>
                    </div>
                  )}

                  {checkInStatus.isSet && !checkInStatus.isBlocked && (
                    <div className="p-2 rounded-xl bg-emerald-100/80 border border-emerald-300 text-emerald-900 text-[11px] font-medium flex items-center gap-2 text-right">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{checkInStatus.message}</span>
                    </div>
                  )}
                </div>

                {/* Check-out input box */}
                <div className={`p-4 rounded-2xl border-2 transition-all space-y-2 ${
                  checkOutStatus.isBlocked
                    ? 'bg-red-50/80 border-red-500 shadow-xs'
                    : checkOutStatus.isSet && !checkOutStatus.isBlocked
                    ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
                    : 'bg-[#F3E2CC]/40 border-[#C6A16B]/60'
                }`}>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-alexandria font-bold text-[#570A1B]">
                      تاريخ المغادرة (Check-out)
                    </label>
                    {checkOutStatus.isSet && !checkOutStatus.isBlocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>متاح ومؤكد</span>
                      </span>
                    )}
                    {checkOutStatus.isBlocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded-full border border-red-300 animate-pulse">
                        <AlertCircle className="w-3 h-3 text-red-600" />
                        <span>غير متاح / محجوز</span>
                      </span>
                    )}
                  </div>

                  <input
                    type="date"
                    value={checkOut}
                    onChange={e => {
                      setCheckOut(e.target.value);
                      setValidationError('');
                      setCalendarNotice(null);
                    }}
                    className={`w-full rounded-xl py-2.5 px-3.5 text-xs sm:text-sm font-bold focus:outline-none transition-all ${
                      checkOutStatus.isBlocked
                        ? 'bg-white text-red-900 border-2 border-red-500 focus:ring-2 focus:ring-red-400'
                        : checkOutStatus.isSet && !checkOutStatus.isBlocked
                        ? 'bg-white text-emerald-900 border-2 border-emerald-500 focus:ring-2 focus:ring-emerald-400'
                        : 'bg-[#FFF9F1] text-[#241411] border border-[#C6A16B] focus:ring-2 focus:ring-[#570A1B]'
                    }`}
                  />

                  {/* Status explanation alert */}
                  {checkOutStatus.isBlocked && (
                    <div className="p-2.5 rounded-xl bg-red-100 border border-red-300 text-red-900 text-[11px] font-medium flex items-start gap-2 text-right">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-red-950">الفترة تحتوي على حجز مسبق:</div>
                        <div>{checkOutStatus.message}</div>
                      </div>
                    </div>
                  )}

                  {checkOutStatus.isSet && !checkOutStatus.isBlocked && (
                    <div className="p-2 rounded-xl bg-emerald-100/80 border border-emerald-300 text-emerald-900 text-[11px] font-medium flex items-center gap-2 text-right">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{checkOutStatus.message}</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Guest Count Selector moved to Step 2 */}

              {/* Dynamic 10+ Year Interactive Calendar */}
              <div className="border-2 border-[#C6A16B]/50 rounded-3xl p-4 sm:p-6 bg-[#FFF9F1] shadow-sm space-y-4">
                
                {/* Calendar Navigation Header (Dynamic Months & 10+ Years) */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-[#C6A16B]/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-[#C6A16B]" />
                      <span className="font-alexandria font-bold text-xs sm:text-sm text-[#570A1B]">
                        تقويم التوفر لـلشقق
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={goToToday}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-[#570A1B]/10 hover:bg-[#570A1B] hover:text-[#FFF9F1] text-[#570A1B] font-bold transition-colors"
                    >
                      اليوم
                    </button>
                  </div>

                  {/* Month & Year Jump Controls - Mobile optimized */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 w-full sm:w-auto">
                    {/* Previous Month */}
                    <button
                      type="button"
                      onClick={goToPrevMonth}
                      className="p-2 sm:p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-[#F3E2CC] hover:bg-[#C6A16B] text-[#570A1B] transition-colors flex items-center justify-center gap-1 text-xs font-bold w-full sm:w-auto"
                      title="الشهر السابق"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <span className="hidden sm:inline">السابق</span>
                    </button>

                    {/* Month & Year Dropdowns - Side by side on mobile */}
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-stretch">
                      {/* Month Dropdown */}
                      <select
                        value={calendarMonth}
                        onChange={e => {
                          setCalendarMonth(parseInt(e.target.value, 10));
                          setCalendarNotice(null);
                        }}
                        className="bg-white border border-[#C6A16B] rounded-xl px-3 py-2 text-xs font-bold text-[#570A1B] focus:outline-none focus:ring-2 focus:ring-[#570A1B] w-full sm:flex-1"
                      >
                        {ARABIC_MONTHS.map((m, idx) => (
                          <option key={idx} value={idx}>{m}</option>
                        ))}
                      </select>

                      {/* Year Dropdown (10+ Years dynamic) */}
                      <select
                        value={calendarYear}
                        onChange={e => {
                          setCalendarYear(parseInt(e.target.value, 10));
                          setCalendarNotice(null);
                        }}
                        className="bg-white border border-[#C6A16B] rounded-xl px-3 py-2 text-xs font-bold text-[#570A1B] focus:outline-none focus:ring-2 focus:ring-[#570A1B] w-full sm:flex-1"
                      >
                        {availableYears.map(y => (
                          <option key={y} value={y}>{y} م</option>
                        ))}
                      </select>
                    </div>

                    {/* Next Month */}
                    <button
                      type="button"
                      onClick={goToNextMonth}
                      className="p-2 sm:p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-[#F3E2CC] hover:bg-[#C6A16B] text-[#570A1B] transition-colors flex items-center justify-center gap-1 text-xs font-bold w-full sm:w-auto"
                      title="الشهر التالي"
                    >
                      <span className="hidden sm:inline">التالي</span>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Loading & Error States for Real-time Bookings */}
                {bookingsLoading && (
                  <div className="flex items-center justify-center py-8 space-x-3">
                    <div className="w-8 h-8 border-3 border-[#C6A16B] border-t-[#570A1B] rounded-full animate-spin"></div>
                    <span className="font-alexandria text-sm text-[#570A1B]">جاري تحميل الحجوزات الحالية...</span>
                  </div>
                )}
                {bookingsError && !bookingsLoading && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs text-center flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{bookingsError}</span>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="text-xs underline hover:text-red-900"
                    >
                      أعد المحاولة
                    </button>
                  </div>
                )}

                {/* Calendar Notice Banner (Explains why a booked day is in red when clicked) */}
                {calendarNotice && (
                  <div className={`p-3 rounded-2xl flex items-center justify-between gap-2 text-xs font-bold text-right transition-all animate-fadeIn ${
                    calendarNotice.type === 'blocked'
                      ? 'bg-red-50 border-2 border-red-400 text-red-900'
                      : 'bg-emerald-50 border-2 border-emerald-400 text-emerald-900'
                  }`}>
                    <div className="flex items-center gap-2">
                      {calendarNotice.type === 'blocked' ? (
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <span>{calendarNotice.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalendarNotice(null)}
                      className="p-1 rounded-lg hover:bg-black/10 text-gray-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Days of Week Header */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs">
                  {['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((d, i) => (
                    <div key={i} className="font-alexandria font-bold text-[#570A1B] py-1 text-[11px] sm:text-xs bg-[#570A1B]/5 rounded-lg">
                      {d}
                    </div>
                  ))}

                  {/* Leading Empty Weekday Padding Slots */}
                  {Array.from({ length: calendarData.firstDayOfWeek }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-10 sm:h-12 rounded-xl bg-transparent pointer-events-none opacity-0"></div>
                  ))}

                  {/* Day Cells */}
                  {calendarData.days.map((day, idx) => {
                    const selState = isDateSelected(day.dateStr);
                    const isCheckIn = selState === 'check-in';
                    const isCheckOut = selState === 'check-out';
                    const isInRange = selState === 'in-range';

                    let cellStyle = 'bg-emerald-50/60 border border-emerald-200/80 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-400 font-bold';
                    const isClosedDay = day.isBlocked && day.blockReason === 'closed';
                    const isBookedDay = day.isBlocked && !isClosedDay;
                    
                    if (isClosedDay) {
                      cellStyle = 'bg-amber-50/90 border border-amber-400 text-amber-800 hover:bg-amber-100 font-bold';
                    } else if (isBookedDay) {
                      cellStyle = 'bg-red-50/90 border border-red-300 text-red-700 hover:bg-red-100 font-bold';
                    } else if (day.isPast) {
                      cellStyle = 'bg-gray-100/70 border border-gray-200 text-gray-400 cursor-not-allowed opacity-40';
                    } else if (isCheckIn || isCheckOut) {
                      cellStyle = 'bg-[#570A1B] text-[#FFF9F1] font-bold shadow-md ring-2 ring-[#C6A16B] border border-[#C6A16B]';
                    } else if (isInRange) {
                      cellStyle = 'bg-[#C6A16B]/30 border-y border-[#C6A16B]/60 text-[#570A1B] font-bold';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleDateClick(day.dateStr, day.isBlocked, day.isPast)}
                        className={`h-12 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer relative p-0.5 ${cellStyle}`}
                        title={
                          isClosedDay
                            ? `مغلق من الإدارة (${day.dateStr})`
                            : isBookedDay
                            ? `محجوز مسبقاً (${day.dateStr})`
                            : day.isPast 
                            ? `تاريخ سابق (${day.dateStr})` 
                            : `متاح للحجز (${day.dateStr})`
                        }
                      >
                        <span className="text-xs sm:text-sm font-mono font-bold leading-none">
                          {day.dayNum}
                        </span>

                        {/* Visual Indicators */}
                        {isClosedDay && !isCheckIn && !isCheckOut && (
                          <span className="text-[9px] font-alexandria font-bold text-amber-700 leading-none mt-1">
                            مغلق
                          </span>
                        )}
                        {isBookedDay && !isCheckIn && !isCheckOut && (
                          <span className="text-[9px] font-alexandria font-bold text-red-600 leading-none mt-1">
                            محجوز
                          </span>
                        )}

                        {!day.isBlocked && !day.isPast && !isCheckIn && !isCheckOut && !isInRange && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1"></span>
                        )}

                        {isCheckIn && (
                          <span className="text-[8px] font-alexandria font-bold text-[#C6A16B] leading-none mt-0.5">
                            وصول
                          </span>
                        )}

                        {isCheckOut && (
                          <span className="text-[8px] font-alexandria font-bold text-[#C6A16B] leading-none mt-0.5">
                            مغادرة
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Calendar Legend */}
                <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 sm:gap-3 pt-3 border-t border-[#C6A16B]/30 text-[11px] text-[#3A2522]">
                  <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 w-full sm:w-auto">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="font-bold text-emerald-900 whitespace-nowrap">أخضر = متاح للحجز</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-300 w-full sm:w-auto">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span>
                    <span className="font-bold text-amber-900 whitespace-nowrap">برتقالي = مغلق من الإدارة</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 w-full sm:w-auto">
                    <span className="w-3 h-3 rounded-full bg-red-500 shrink-0"></span>
                    <span className="font-bold text-red-900 whitespace-nowrap">أحمر = محجوز مسبقاً</span>
                  </div>
                </div>

              </div>

              {/* Live Cost Summary Bar */}
              <div className="bg-[#570A1B] text-[#FFF9F1] p-4 sm:p-5 rounded-2xl border border-[#C6A16B] flex flex-col sm:flex-row items-center justify-between gap-3 text-right">
                <div className="space-y-0.5">
                  <div className="text-xs text-[#C6A16B] font-semibold">ملخص الإقامة المبدئي ({nights} ليالٍ){hasCustomPricing ? ' · يشمل أسعاراً مخصصة' : ''}</div>
                  <div className="text-xs text-[#FFF9F1]/80">
                    من {checkIn} إلى {checkOut} · {selectedApartment.name}
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-[10px] text-[#C6A16B]">الإجمالي المقدر</span>
                  <div className="font-alexandria font-bold text-xl text-[#FFF9F1]">
                    {totalAmount.toLocaleString('ar-SA')} <span className="text-xs font-normal text-[#C6A16B]">ر.س</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ========================================================
            STEP 2: GUEST DETAILS & CONTRACT FORM
        ======================================================== */}
        {step === 2 && (
          <div className="bg-[#FFF9F1] p-5 sm:p-8 rounded-3xl border border-[#C6A16B] shadow-md space-y-6 text-right">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#570A1B]/10 text-[#570A1B] text-xs font-bold mb-2">
                <FileText className="w-3.5 h-3.5 text-[#C6A16B]" />
                <span>توثيق عقد الإيجار الإلكتروني</span>
              </div>
              <h2 className="font-alexandria font-bold text-lg sm:text-xl text-[#570A1B]">
                بيانات المستأجر الرسمية
              </h2>
              <p className="text-xs text-[#3A2522]/80 font-light mt-1">
                تُستخدم هذه البيانات لإصدار عقد الإيجار الإلكتروني المعتمد وتوليد رمز الدخول الذكي للشقة.
              </p>
            </div>

            <div className="space-y-4">
              {/* Full Name */}
              <div>
<label className="block text-xs font-alexandria font-bold text-[#570A1B] mb-1.5">
                  الاسم الثلاثي أو الكامل
</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    placeholder="مثال: محمد بن عبدالله القحطاني"
                    className="w-full bg-white text-[#241411] border border-[#C6A16B] rounded-xl py-3 px-4 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#570A1B]"
                  />
                  <User className="w-4 h-4 text-[#C6A16B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* National ID / Iqama */}
              <div>
                <label className="block text-xs font-alexandria font-bold text-[#570A1B] mb-1.5">
                  رقم الهوية الوطنية *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={guestIdNumber}
                    onChange={e => setGuestIdNumber(e.target.value)}
                    placeholder="10XXXXXXXX"
                    className="w-full bg-white text-[#241411] border border-[#C6A16B] rounded-xl py-3 px-4 text-xs sm:text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#570A1B]"
                    dir="ltr"
                  />
                  <ShieldCheck className="w-4 h-4 text-[#C6A16B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="block text-xs font-alexandria font-bold text-[#570A1B]">
                  رقم الجوال (مع مفتاح الدولة)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-2.5">
                  <div className="relative">
                    <select
                      value={phoneCountryCode}
                      onChange={e => setPhoneCountryCode(e.target.value)}
                      className="w-full h-[46px] bg-white text-[#241411] border border-[#C6A16B] rounded-xl py-2.5 pr-3 pl-9 text-[13px] sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#570A1B] appearance-none"
                      aria-label="مفتاح الدولة"
                    >
                      {COUNTRY_DIALS.map((c) => (
                        <option key={`${c.code}-${c.dial}`} value={c.dial}>
                          {c.flag} {c.nameAr} (+{c.dial})
                        </option>
                      ))}
                    </select>
                    <ChevronLeft className="w-4 h-4 text-[#C6A16B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  <div className="relative">
                    <input
                      type="tel"
                      inputMode="numeric"
                      required
                      value={phoneLocal}
                      onChange={e => setPhoneLocal(e.target.value.replace(/[^\d\s-]/g, ''))}
                      placeholder={phoneCountryCode === '966' ? '5XXXXXXXX' : 'رقم الجوال بدون 0'}
                      className="w-full h-[46px] bg-white text-[#241411] border border-[#C6A16B] rounded-xl py-2.5 px-4 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#570A1B]"
                      dir="ltr"
                    />
                    <Phone className="w-4 h-4 text-[#C6A16B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                  <span className="text-[10px] text-[#3A2522]/60">
                    اختر الدولة وأدخل الرقم بدون صفر البداية (مثال مصر: 1012345678).
                  </span>
                  <div className="inline-flex items-center gap-2 self-start sm:self-auto bg-[#F3E2CC]/40 border border-[#C6A16B]/40 rounded-lg px-2.5 py-1.5">
                    <span className="text-[10px] text-[#3A2522]/70">الرقم النهائي:</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-[#570A1B] tracking-wide" dir="ltr">
                      {fullGuestPhone || `+${phoneCountryCode}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Number of Apartments Selector */}
              <div className="bg-[#FFF9F1] p-2.5 rounded-lg border-2 border-[#C6A16B]/60 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-7 rounded-lg bg-[#570A1B]/10 text-[#570A1B] flex items-center justify-center shrink-0">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-alexandria font-bold text-xs text-[#570A1B]">عدد الشقق</div>
                      <div className="text-[9px] text-[#3A2522]/70">حد أقصى شقتين</div>
                    </div>
                  </div>
                  
                  {/* Increment/Decrement Controls */}
                  <div className="flex items-center gap-1 bg-white rounded-lg border border-[#C6A16B]/40 p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setApartmentsCount(prev => Math.max(1, prev - 1))}
                      disabled={apartmentsCount <= 1}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#570A1B] hover:bg-[#F3E2CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="تقليل عدد الشقق"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    
                    <div className="w-10 text-center">
                      <span className="font-alexandria font-extrabold text-base text-[#570A1B]">{apartmentsCount}</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setApartmentsCount(prev => Math.min(2, prev + 1))}
                      disabled={apartmentsCount >= 2}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#570A1B] hover:bg-[#F3E2CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="زيادة عدد الشقق"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Guest Count Selector - Interactive */}
              <div className="bg-[#FFF9F1] p-2.5 rounded-lg border-2 border-[#C6A16B]/60 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-7 rounded-lg bg-[#570A1B]/10 text-[#570A1B] flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-alexandria font-bold text-xs text-[#570A1B]">عدد النزلاء والضيوف</div>
                      <div className="text-[9px] text-[#3A2522]/70">السعة القصوى {selectedApartment.capacity} أشخاص</div>
                    </div>
                  </div>
                  
                  {/* Increment/Decrement Controls */}
                  <div className="flex items-center gap-1 bg-white rounded-lg border border-[#C6A16B]/40 p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={() => setGuestCount(prev => Math.max(1, prev - 1))}
                      disabled={guestCount <= 1}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#570A1B] hover:bg-[#F3E2CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="تقليل عدد الضيوف"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    
                    <div className="w-10 text-center">
                      <span className="font-alexandria font-extrabold text-base text-[#570A1B]">{guestCount}</span>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setGuestCount(prev => Math.min(selectedApartment.capacity, prev + 1))}
                      disabled={guestCount >= selectedApartment.capacity}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[#570A1B] hover:bg-[#F3E2CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="زيادة عدد الضيوف"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Finalize booking action (extra step) */}
              {readyToFinalize && !bookingFinalized && (
                <div className="mt-2 p-4 sm:p-5 rounded-2xl border-2 border-[#C6A16B] bg-gradient-to-b from-[#FFF9F1] to-[#F3E2CC]/60 shadow-inner text-center space-y-3">
                  <div className="text-xs sm:text-sm text-[#3A2522]/80 font-medium">تم التحقق من بيانات المستأجر. اضغط الزر أدناه لإتمام إنشاء الحجز والانتقال لخطوة الدفع.</div>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={creatingBookingNow}
                    className="mx-auto w-full sm:w-auto min-w-[220px] px-8 py-4 rounded-2xl bg-gradient-to-r from-[#570A1B] via-[#6d1024] to-[#84394A] hover:brightness-110 disabled:opacity-70 text-[#FFF9F1] font-alexandria font-extrabold text-base sm:text-lg shadow-xl shadow-[#570A1B]/20 border border-[#C6A16B]/70 flex items-center justify-center gap-2.5 transition-all"
                  >
                    {creatingBookingNow ? (
                      <>
                        <div className="w-5 h-5 border-2 border-[#FFF9F1]/40 border-t-[#FFF9F1] rounded-full animate-spin"></div>
                        <span>جاري إنشاء الحجز...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 text-[#C6A16B]" />
                        <span>إتمام الحجز</span>
                      </>
                    )}
                  </button>
                  <div className="text-[11px] text-[#3A2522]/60">سيتم إنشاء الحجز ثم فتح صفحة بيانات التحويل البنكي.</div>
                </div>
              )}
              {bookingFinalized && finalizedBooking && (
                <div className="mt-2 p-4 rounded-2xl border border-emerald-300 bg-emerald-50 text-center space-y-2">
                  <div className="font-alexandria font-bold text-emerald-900">تم إنشاء الحجز بنجاح</div>
                  <div className="text-xs text-emerald-800">رقم الحجز: <span className="font-mono font-bold">{finalizedBooking.bookingNumber}</span></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            STEP 3: AL RAJHI BANK TRANSFER (مصرف الراجحي السعودي) - FINAL STEP
        ======================================================== */}
        {step === 3 && (
          <div className="space-y-6 text-right">
            
            {/* Al Rajhi Bank Official Visual Banner */}
            <div className="bg-[#FFF9F1] rounded-3xl border-2 border-[#C6A16B] p-5 sm:p-6 shadow-xl space-y-5">
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#C6A16B]/30 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border border-[#C6A16B] shadow-sm shrink-0">
                    <img 
                      src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQD6wfih4p0m_gew67ZaSLn2N_nSyi4bDcvLywc_nvK7Q&s" 
                      alt="شعار مصرف الراجحي" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-[11px] font-bold text-[#C6A16B] tracking-wider uppercase">
                    بوابة الدفع الرسمية المعتمدة
                  </div>
                  <h2 className="font-alexandria font-bold text-lg sm:text-xl text-[#570A1B]">
                    مصرف الراجحي السعودي · Al Rajhi Bank
                  </h2>
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#183059]/10 text-[#183059] border border-[#183059]/30 text-xs font-bold">
                  <Lock className="w-3.5 h-3.5 text-[#183059]" />
                  <span>دفع آمن ومعتمد 100%</span>
                </div>
              </div>

              {/* Al Rajhi QR Code */}
              <div className="bg-white rounded-2xl border border-[#C6A16B]/40 p-3 sm:p-4 shadow-sm">
                <div className="text-center space-y-2">
                  <p className="font-alexandria font-bold text-xs sm:text-sm text-[#183059]">
                    امسح رمز QR للتحويل السريع عبر مصرف الراجحي
                  </p>
                  <div className="mx-auto w-full max-w-[220px] sm:max-w-[260px] aspect-square bg-white rounded-xl border border-[#183059]/15 p-2.5 sm:p-3">
                    <img
                      src={alrajhiQr}
                      alt="رمز QR للتحويل البنكي عبر مصرف الراجحي"
                      className="w-full h-full object-contain rounded-lg"
                      loading="eager"
                      decoding="async"
                    />
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-[#3A2522]/70 leading-relaxed">
                    يمكنك مسح الكود من تطبيق الراجحي لإتمام التحويل، ثم إرفاق الإيصال عبر واتساب.
                  </p>
                </div>
              </div>

              {/* Bank Account Details - Direct Transfer Only */}
              <div className="bg-[#183059]/5 p-4 rounded-2xl border border-[#183059]/25 space-y-3">
                <div className="flex items-center gap-2 text-[#183059] font-bold text-xs sm:text-sm">
                  <Info className="w-4 h-4 text-[#183059]" />
                  <span>بيانات الحساب البنكي للتحويل (مصرف الراجحي):</span>
                </div>

                {/* Beneficiary */}
                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#C6A16B]/40 text-xs sm:text-sm">
                  <span className="text-[#3A2522]/70">اسم المستفيد:</span>
                  <strong className="text-[#570A1B]">احمد سعد مطر العضياني الحارثي</strong>
                </div>

                {/* IBAN */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white p-3 rounded-xl border border-[#C6A16B]/40 text-xs sm:text-sm">
                  <span className="text-[#3A2522]/70 shrink-0">رقم الآيبان (IBAN):</span>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <span className="font-mono font-bold text-[#183059] break-all" dir="ltr">
                      SA59 8000 0858 6080 1306 3875
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText('SA5980000858608013063875', 'iban')}
                      className="p-1.5 rounded-lg bg-[#F3E2CC] hover:bg-[#ebd3b5] text-[#570A1B] text-xs flex items-center gap-1 transition-colors shrink-0"
                      title="نسخ الآيبان"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[10px] hidden sm:inline">نسخ</span>
                    </button>
                  </div>
                </div>

                {/* Account Number */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white p-3 rounded-xl border border-[#C6A16B]/40 text-xs sm:text-sm">
                  <span className="text-[#3A2522]/70 shrink-0">رقم الحساب بالراجحي:</span>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <span className="font-mono font-bold text-[#183059] break-all" dir="ltr">
                      077030010006083063875
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText('077030010006083063875', 'account')}
                      className="p-1.5 rounded-lg bg-[#F3E2CC] hover:bg-[#ebd3b5] text-[#570A1B] text-xs flex items-center gap-1 transition-colors shrink-0"
                      title="نسخ الحساب"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[10px] hidden sm:inline">نسخ</span>
                    </button>
                  </div>
                </div>

                {/* Bank & Branch */}
                <div className="flex items-center justify-between text-xs text-[#3A2522]/80 pt-1">
                  <span>المصرف: مصرف الراجحي</span>
                  <span>سويفت: RJHISARI</span>
                </div>
              </div>

              {/* Important Instructions */}
              <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800 text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>تعليمات هامة للتحويل:</span>
                </div>
                <ul className="text-xs sm:text-sm text-amber-900 space-y-1 font-light">
                  <li>• قم بتحويل المبلغ الإجمالي أدناه إلى الحساب المذكور</li>
                  <li>• احتفظ بإيصال التحويل (سكرين شوت أو PDF)</li>
                  <li>• تم إنشاء الحجز. اضغط زر "تواصل واتساب" أدناه لإرسال بيانات الحجز والإيصال للمالك</li>
                  <li>• سيتم تأكيد حجزك بعد تحقق المالك من وصول التحويل</li>
                </ul>
              </div>

            </div>

            {/* Financial Summary Box - Simplified */}
            <div className="bg-[#570A1B] text-[#FFF9F1] p-5 sm:p-6 rounded-3xl border border-[#C6A16B] shadow-lg space-y-3">
              <h3 className="font-alexandria font-bold text-sm text-[#C6A16B] border-b border-[#C6A16B]/30 pb-2">
                فاتورة الحجز المالية المعتمدة:
              </h3>
              
              <div className="space-y-2 text-xs sm:text-sm text-[#FFF9F1]/90">
                <div className="flex justify-between">
                  <span>
                    {hasCustomPricing
                      ? `إيجار ${selectedApartment.name} (${nights} ليالٍ · تسعير حسب التاريخ):`
                      : `إيجار ${selectedApartment.name} (${nights} ليالٍ × ${basePricePerNight.toLocaleString('ar-SA')} ر.س):`}
                  </span>
                  <span className="font-bold font-mono">{totalAmount.toLocaleString('ar-SA')} ر.س</span>
                </div>
                {hasCustomPricing && (
                  <div className="text-[11px] text-[#FFF9F1]/75 leading-relaxed">
                    تم تطبيق أسعار مخصصة على بعض الليالي ضمن الفترة المختارة. الإجمالي يحسب سعر كل ليلة على حدة.
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#C6A16B]/40 flex items-center justify-between text-base sm:text-lg font-bold">
                <span className="text-[#C6A16B]">المبلغ الإجمالي للتحويل:</span>
                <span className="font-alexandria font-extrabold text-xl sm:text-2xl text-[#FFF9F1]">
                  {totalAmount.toLocaleString('ar-SA')} <span className="text-xs font-normal text-[#C6A16B]">ريال سعودي</span>
                </span>
              </div>
            </div>

          </div>
        )}

        {/* Wizard Controls Footer (Responsive, Touch-Friendly, Floating/Sticky Friendly) */}
        <div className="flex items-center justify-between gap-3 pt-4">
          <button
            type="button"
            onClick={handlePrevStep}
            className="px-5 sm:px-6 py-3.5 rounded-xl bg-[#FFF9F1] hover:bg-white text-[#570A1B] border border-[#570A1B]/40 font-alexandria font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 text-[#570A1B]" />
            <span>{step === 1 ? 'إلغاء والعودة' : 'السابق'}</span>
          </button>

          {step === 3 ? (
            <button
              type="button"
              onClick={handleNextStep}
              disabled={!bookingFinalized || !finalizedBooking}
              className="flex-1 sm:flex-none px-6 sm:px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#183059] to-[#0d1f3a] hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed text-white font-alexandria font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-[#C6A16B]" />
              <span>تواصل واتساب لإرسال الإيصال</span>
              <ArrowLeft className="w-4 h-4 text-[#C6A16B]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNextStep}
              disabled={creatingBookingNow || (step === 2 && readyToFinalize && !bookingFinalized)}
              className="flex-1 sm:flex-none px-6 sm:px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#C6A16B] to-[#b38d55] hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed text-[#570A1B] font-alexandria font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
            >
              <span>
                {step === 2
                  ? (bookingFinalized ? 'الانتقال للدفع' : 'متابعة')
                  : 'متابعة الخطوة التالية'}
              </span>
              <ArrowLeft className="w-4 h-4 text-[#570A1B]" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};




