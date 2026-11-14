import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Calendar, 
  Users, 
  User,
  Phone,
  DollarSign, 
  CheckCircle, 
  Clock, 
  FileText, 
  Printer, 
  Settings, 
  Edit3, 
  Eye, 
  ArrowRight,
  ShieldCheck,
  Plus,
  Trash2,
  AlertCircle,
  BarChart2,
  TrendingUp,
  Download,
  RefreshCw,
  Bell,
  Award,
  Image,
  Upload,
  X,
  Loader2,
  Target,
  Zap
} from 'lucide-react';
import { Booking, Apartment, APARTMENTS, BLOCKED_DATES, SITE_INFO } from '../data/apartmentsData';
import { useApartmentClosures, useApartmentPriceOverrides } from '../hooks';
import { db, doc, updateDoc, collection, query, where, orderBy, addDoc, writeBatch, serverTimestamp, onSnapshot, setDoc, getDocs, arrayUnion, getDoc, deleteDoc } from '../lib/firebase';
import { uploadImage, deleteImage, listImages } from '../lib/supabase';
import { downloadContractPDF, openGuestWhatsAppChat } from '../lib/contractPdf';
import { LoadingScreen } from './LoadingScreen';

// Helper to handle Firestore Timestamp
const toDate = (date: any): Date => {
  if (!date) return new Date();
  if (date.toDate) return date.toDate();
  if (typeof date === 'string') return new Date(date);
  if (date instanceof Date) return date;
  return new Date();
};

interface AdminDashboardProps {
  onBackToSite: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBackToSite
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'apartments' | 'calendar-pricing' | 'calendar'>('overview');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Apartment editable prices and status state
  const [apartmentsList, setApartmentsList] = useState<Apartment[]>(APARTMENTS);
  const [editingAptId, setEditingAptId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(1450);

  // Calendar & pricing management (admin)
  const [calendarAptId, setCalendarAptId] = useState<string>('apt-01');
  const [closureStart, setClosureStart] = useState('');
  const [closureEnd, setClosureEnd] = useState('');
  const [closureNote, setClosureNote] = useState('');
  const [closureSaving, setClosureSaving] = useState(false);
  const [priceStart, setPriceStart] = useState('');
  const [priceEnd, setPriceEnd] = useState('');
  const [priceValue, setPriceValue] = useState<number>(0);
  const [priceSaving, setPriceSaving] = useState(false);
  const [calendarMsg, setCalendarMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { closures: managedClosures, loading: closuresLoading, addClosure, removeClosure } = useApartmentClosures(calendarAptId);
  const { overrides: managedPriceOverrides, loading: overridesLoading, addOverride, removeOverride } = useApartmentPriceOverrides(calendarAptId);

  const handleAddClosure = async () => {
    setCalendarMsg(null);
    if (!closureStart || !closureEnd) { setCalendarMsg({ type: 'error', text: 'يرجى تحديد تاريخ البداية والنهاية لفترة الإغلاق.' }); return; }
    if (closureEnd < closureStart) { setCalendarMsg({ type: 'error', text: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساوياً له.' }); return; }
    setClosureSaving(true);
    try {
      await addClosure(calendarAptId, closureStart, closureEnd, closureNote);
      setClosureStart(''); setClosureEnd(''); setClosureNote('');
      setCalendarMsg({ type: 'success', text: 'تم إغلاق الفترة بنجاح. ستظهر الأيام كـ "مغلق" (برتقالي) في تقويم الحجز.' });
    } catch (e: any) {
      setCalendarMsg({ type: 'error', text: e?.message || 'فشل في حفظ فترة الإغلاق.' });
    } finally { setClosureSaving(false); }
  };

  const handleAddPriceOverride = async () => {
    setCalendarMsg(null);
    if (!priceStart || !priceEnd) { setCalendarMsg({ type: 'error', text: 'يرجى تحديد تاريخ البداية والنهاية لفترة السعر.' }); return; }
    if (priceEnd < priceStart) { setCalendarMsg({ type: 'error', text: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساوياً له.' }); return; }
    if (!priceValue || priceValue <= 0) { setCalendarMsg({ type: 'error', text: 'يرجى إدخال سعر ليلة صحيح أكبر من صفر.' }); return; }
    setPriceSaving(true);
    try {
      await addOverride(calendarAptId, priceStart, priceEnd, Number(priceValue));
      setPriceStart(''); setPriceEnd(''); setPriceValue(0);
      setCalendarMsg({ type: 'success', text: 'تم حفظ فترة السعر بنجاح. سيُطبق السعر المحدد على ليالي هذه الفترة عند الحجز.' });
    } catch (e: any) {
      setCalendarMsg({ type: 'error', text: e?.message || 'فشل في حفظ فترة السعر.' });
    } finally { setPriceSaving(false); }
  };
  const [savingAptId, setSavingAptId] = useState<string | null>(null);

  // Delete booking modal state
  const [deleteBookingModal, setDeleteBookingModal] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);
  const [contractLoadingBooking, setContractLoadingBooking] = useState<Booking | null>(null);

  const handleContractClick = (booking: Booking) => {
    setContractLoadingBooking(booking);
  };

  const handleContractWhatsAppClick = (booking: Booking) => {
    openGuestWhatsAppChat(booking);
  };

  // Image Management Modal State
  const [imageModalAptId, setImageModalAptId] = useState<string | null>(null);
  const [aptImages, setAptImages] = useState<{ name: string; url: string; fullPath: string }[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingImage, setDeletingImage] = useState<string | null>(null);

  // Statistics calculation
  const totalBookingsCount = bookings.length;
  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;
  const cancelledCount = bookings.filter(b => b.status === 'cancelled').length;
  const totalRevenue = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + b.totalAmount, 0);
  const thisMonthRevenue = bookings
    .filter(b => {
      if (b.status !== 'confirmed' && b.status !== 'completed') return false;
      const bookingDate = toDate(b.createdAt);
      const now = new Date();
      return bookingDate.getMonth() === now.getMonth() && bookingDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, b) => sum + b.totalAmount, 0);

  // Initialize apartments collection on component mount
  useEffect(() => {
    initializeApartments();
  }, []);

  // Real-time bookings listener
  useEffect(() => {
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingsData: Booking[] = [];
      snapshot.forEach((doc) => {
        bookingsData.push({ id: doc.id, ...doc.data() } as Booking);
      });
      setBookings(bookingsData);
      setLoading(false);
    }, (err) => {
      // Ignore AbortError - it's normal when listener is cancelled
      if (err.name === 'AbortError' || err.code === 'aborted') return;
      console.error('Bookings listener error:', err);
    });
    return () => unsubscribe();
  }, []);

  // Real-time apartments listener for prices
  useEffect(() => {
    const q = query(collection(db, 'apartments'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('🔥 [AdminDashboard] Apartments snapshot received:', snapshot.size, 'docs');
      snapshot.docChanges().forEach(change => {
        console.log('📝 [AdminDashboard] Change:', change.type, change.doc.id, change.doc.data());
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
      setApartmentsList(apartmentsData);
    }, (err) => {
      if (err.name === 'AbortError' || err.code === 'aborted') return;
      console.error('Apartments listener error:', err);
    });
    return () => unsubscribe();
  }, []);

  // ============================================
  // AUTO-COMPLETE BOOKINGS (Free client-side solution)
  // ============================================
  const [autoCompleteLoading, setAutoCompleteLoading] = useState(false);
  const [autoCompleteResult, setAutoCompleteResult] = useState<string | null>(null);

  const autoCompleteBookings = async (showToast = true) => {
    setAutoCompleteLoading(true);
    setAutoCompleteResult(null);
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      console.log('🔄 [AutoComplete] Checking for bookings to complete...', todayStr);
      
      // Query confirmed bookings where checkout date <= today
      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef,
        where('status', '==', 'confirmed'),
        where('checkOutDate', '<=', todayStr)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        const msg = '✅ لا توجد حجوزات مكتملة اليوم';
        console.log(msg);
        if (showToast) setAutoCompleteResult(msg);
        return { completed: 0, message: msg };
      }
      
      console.log(`📋 [AutoComplete] Found ${snapshot.size} booking(s) to complete`);
      
      const batch = writeBatch(db);
      let completedCount = 0;
      
      for (const docSnap of snapshot.docs) {
        const booking = docSnap.data() as Booking;
        const bookingId = docSnap.id;
        
        console.log(`✅ [AutoComplete] Completing booking: ${booking.bookingNumber}`);
        
        // Update booking status to completed
        batch.update(docSnap.ref, {
          status: 'completed',
          updatedAt: serverTimestamp(),
          completedAt: serverTimestamp(),
          completedBy: 'auto_client_check'
        });
        
        // Create notification for guest if guestClientId exists
        if (booking.guestClientId) {
          try {
            const { createNotification } = await import('../lib/clientId');
            await createNotification(booking.guestClientId, {
              type: 'booking_completed',
              title: '✅ انتهت إقامتك - شكراً لاختيارك رُقِيّ',
              message: `عزيزي ${booking.guestName}،\n\nنود إعلامك بأن إقامتك في ${booking.apartmentName} قد اكتملت بنجاح.\n\n📅 فترة الإقامة: من ${booking.checkInDate} إلى ${booking.checkOutDate}\n\nنأمل أن تكون قد استمتعت بإقامتك في شقق رُقِيّ الفندقية.\nنرحب بكم دائماً في أي وقت.\n\n📋 رقم الحجز: ${booking.bookingNumber}`,
              bookingId: bookingId,
              bookingNumber: booking.bookingNumber
            });
          } catch (notifError) {
            console.error('Error creating completion notification:', notifError);
          }
        }
        
        completedCount++;
      }
      
      // Commit all updates
      await batch.commit();
      
      const msg = `✅ تم إكمال ${completedCount} حجز(ات) تلقائياً وإرسال الإشعارات`;
      console.log(msg);
      if (showToast) setAutoCompleteResult(msg);
      
      // Refresh bookings data
      // The onSnapshot listener will automatically update the UI
      
      return { completed: completedCount, message: msg };
      
    } catch (error) {
      const errMsg = '❌ خطأ في الإكمال التلقائي: ' + (error instanceof Error ? error.message : 'خطأ غير معروف');
      console.error('❌ [AutoComplete] Error:', error);
      if (showToast) setAutoCompleteResult(errMsg);
      return { completed: 0, message: errMsg };
    } finally {
      setAutoCompleteLoading(false);
    }
  };

  // Run auto-complete on mount
  useEffect(() => {
    autoCompleteBookings(true);
  }, []);

  // Periodic check every 6 hours (only when tab is active)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        autoCompleteBookings(false);
      }
    }, 6 * 60 * 60 * 1000); // 6 hours
    
    return () => clearInterval(interval);
  }, []);

  const handleUpdateBookingStatus = async (bookingId: string, status: Booking['status'], booking?: Booking) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { 
        status,
        updatedAt: serverTimestamp()
      });

      // Create notification for the guest based on status change
      if (booking?.guestClientId) {
        try {
          const { createNotification } = await import('../lib/clientId');
          
          let notificationConfig = null;
          
          if (status === 'confirmed') {
            notificationConfig = {
              type: 'booking_confirmed' as const,
              title: '✅ تم تأكيد حجزك!',
              message: `أهلاً ${booking.guestName}،\n\nتم تأكيد حجزك رقم ${booking.bookingNumber} للشقة ${booking.apartmentName}.\n\n📅 فترة الإقامة: من ${booking.checkInDate} إلى ${booking.checkOutDate}\n💰 المبلغ: ${booking.totalAmount.toLocaleString('ar-SA')} ر.س\n\nيرجى التواصل مع المالك عبر واتساب لاستلام العقد الإلكتروني.\n\n📋 رقم الحجز للنسخ: ${booking.bookingNumber}`,
            };
          } else if (status === 'cancelled') {
            notificationConfig = {
              type: 'booking_cancelled' as const,
              title: '❌ تم إلغاء حجزك',
              message: `عزيزي ${booking.guestName}،\n\nتم إلغاء حجزك رقم ${booking.bookingNumber} للشقة ${booking.apartmentName}.\n\n📅 فترة الإقامة الملغية: من ${booking.checkInDate} إلى ${booking.checkOutDate}\n💰 المبلغ: ${booking.totalAmount.toLocaleString('ar-SA')} ر.س\n\nللاستفسار عن سبب الإلغاء، يرجى التواصل مع المالك مباشرة.\n\n📋 رقم الحجز للنسخ: ${booking.bookingNumber}`,
            };
          } else if (status === 'completed') {
            notificationConfig = {
              type: 'booking_completed' as const,
              title: '✅ انتهت إقامتك - شكراً لاختيارك رُقِيّ',
              message: `عزيزي ${booking.guestName}،\n\nنود إعلامك بأن إقامتك في ${booking.apartmentName} قد اكتملت بنجاح.\n\n📅 فترة الإقامة: من ${booking.checkInDate} إلى ${booking.checkOutDate}\n\nنأمل أن تكون قد استمتعت بإقامتك في شقق رُقِيّ الفندقية.\nنرحب بكم دائماً في أي وقت.\n\n📋 رقم الحجز: ${booking.bookingNumber}`,
            };
          }
          
          if (notificationConfig) {
            await createNotification(booking.guestClientId, {
              ...notificationConfig,
              bookingId: booking.id,
              bookingNumber: booking.bookingNumber
            });
          }
        } catch (notifError) {
          console.error('Error creating status notification:', notifError);
        }
      }
    } catch (error) {
      console.error('Error updating booking status:', error);
      alert('حدث خطأ في تحديث حالة الحجز');
    }
  };

  const handleUpdatePaymentStatus = async (bookingId: string, paymentStatus: 'paid' | 'unpaid') => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        paymentStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('حدث خطأ في تحديث حالة الدفع');
    }
  };

  const handleStartEditApt = (apt: Apartment) => {
    setEditingAptId(apt.id);
    setTempPrice(apt.pricePerNight);
  };

  const handleSaveApt = async (id: string) => {
    setSavingAptId(id);
    try {
      console.log('💾 [AdminDashboard] Saving price for:', id, 'new price:', tempPrice);
      // Use setDoc with merge to create document if it doesn't exist
      await setDoc(doc(db, 'apartments', id), { 
        pricePerNight: tempPrice,
        updatedAt: serverTimestamp()
      }, { merge: true });
      console.log('✅ [AdminDashboard] Price saved successfully for:', id);
      setApartmentsList(prev =>
        prev.map(a => (a.id === id ? { ...a, pricePerNight: tempPrice } : a))
      );
      setEditingAptId(null);
    } catch (error) {
      console.error('Error saving apartment price:', error);
      alert('حدث خطأ في حفظ السعر');
    } finally {
      setSavingAptId(null);
    }
  };

  // ========== IMAGE MANAGEMENT FUNCTIONS (Supabase Storage) ==========
  const openImageModal = async (aptId: string) => {
    setImageModalAptId(aptId);
    setImagesLoading(true);
    try {
      const images = await listImages(aptId);
      setAptImages(images);
    } catch (error) {
      console.error('Error loading images:', error);
      alert('فشل تحميل الصور');
      setAptImages([]);
    } finally {
      setImagesLoading(false);
    }
  };

  const closeImageModal = () => {
    setImageModalAptId(null);
    setAptImages([]);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, aptId: string) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // Generate unique filename
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${timestamp}_${random}.${ext}`;
        
        // Upload to Supabase Storage via Edge Function
        const imageUrl = await uploadImage(file, aptId, fileName);
        
        // Also update Firestore with the new image
        try {
          const apartmentRef = doc(db, 'apartments', aptId);
          const newImage = {
            url: imageUrl,
            title: fileName,
            category: 'general'
          };
          await updateDoc(apartmentRef, {
            images: arrayUnion(newImage),
            updatedAt: serverTimestamp()
          });
        } catch (firestoreError) {
          console.error('Firestore update failed:', firestoreError);
          // Don't fail the upload if Firestore update fails
        }
      }
      // Refresh images list
      const images = await listImages(aptId);
      setAptImages(images);
      alert('تم رفع الصور بنجاح ✓');
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('فشل رفع الصور: ' + (error instanceof Error ? error.message : 'خطأ غير معروف'));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

const handleDeleteImage = async (aptId: string, fileName: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الصورة؟ لا يمكن التراجع.')) return;

    setDeletingImage(fileName);
    try {
      await deleteImage(aptId, fileName);
      
      // Also update Firestore to remove the image
      try {
        const apartmentRef = doc(db, 'apartments', aptId);
        const aptSnap = await getDoc(apartmentRef);
        if (aptSnap.exists()) {
          const currentImages = aptSnap.data().images || [];
          // Match by filename in URL
          const updatedImages = currentImages.filter(img => !img.url.includes(fileName));
          await updateDoc(apartmentRef, {
            images: updatedImages,
            updatedAt: serverTimestamp()
          });
        }
      } catch (firestoreError) {
        console.error('Firestore delete update failed:', firestoreError);
      }
      
      const images = await listImages(aptId);
      setAptImages(images);
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('فشل حذف الصورة');
    } finally {
      setDeletingImage(null);
    }
  };

  // Auto-initialize apartments collection on first admin login
  const initializeApartments = async () => {
    try {
      const apartmentsRef = collection(db, 'apartments');
      const snapshot = await getDocs(apartmentsRef);
      
      if (snapshot.empty) {
        // Initialize with default data from APARTMENTS constant
        const batch = writeBatch(db);
        APARTMENTS.forEach(apt => {
          const docRef = doc(db, 'apartments', apt.id);
          batch.set(docRef, {
            name: apt.name,
            pricePerNight: apt.pricePerNight,
            depositAmount: apt.depositAmount,
            capacity: apt.capacity,
            area: apt.area,
            rooms: apt.rooms,
            bathrooms: apt.bathrooms,
            beds: apt.beds,
            mainImage: apt.mainImage,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        });
        await batch.commit();
        console.log('Apartments collection initialized');
      }
    } catch (error) {
      console.error('Error initializing apartments:', error);
    }
  };

  const handleViewBookingDetails = (booking: Booking) => {
    const details = [
      `📋 تفاصيل الحجز: ${booking.bookingNumber}`,
      `👤 المستأجر: ${booking.guestName}`,
      `🆔 الهوية: ${booking.guestIdNumber}`,
      `📱 الجوال: ${booking.guestPhone}`,
      `🏠 الشقة: ${booking.apartmentName}`,
      `📅 الوصول: ${booking.checkInDate} (4:00 مساءً)`,
      `📅 المغادرة: ${booking.checkOutDate} (1:00 ظهراً)`,
      `🌙 المدة: ${booking.nights} ليالٍ`,
      `👥 عدد الضيوف: ${booking.guestCount}`,
      `💰 المبلغ الإجمالي: ${booking.totalAmount.toLocaleString('ar-SA')} ر.س`,
      `📊 الحالة: ${booking.status === 'confirmed' ? '✓ مؤكد' : booking.status === 'pending' ? '⏳ انتظار التأكيد' : booking.status === 'completed' ? '✓ مكتمل' : '✗ ملغي'}`,
      `🕐 تاريخ الحجز: ${toDate(booking.createdAt).toLocaleDateString('ar-SA')}`,
      `💳 الدفع: تحويل بنكي - مصرف الراجحي`
    ].join('\n');
    
    alert(details);
  };

  // Delete booking with notification to guest
  const handleDeleteBooking = async (booking: Booking) => {
    setDeleteBookingModal({ open: true, booking });
  };

  const confirmDeleteBooking = async () => {
    if (!deleteBookingModal.booking) return;
    
    const booking = deleteBookingModal.booking;
    setDeletingBookingId(booking.id);
    
    try {
      // 1. DELETE the booking from Firestore (permanent removal)
      await deleteDoc(doc(db, 'bookings', booking.id));

      // 2. Create notification for the guest about deletion
      let notified = false;
      if (booking.guestClientId) {
        await addDoc(collection(db, 'notifications'), {
          clientId: booking.guestClientId,
          type: 'booking_deleted',
          title: 'تم حذف حجزك',
          message: `عزيزي ${booking.guestName}،\n\nتم حذف حجزك رقم ${booking.bookingNumber} للشقة ${booking.apartmentName} من قبل الإدارة.\n\nفترة الإقامة: من ${booking.checkInDate} إلى ${booking.checkOutDate}\nالمبلغ: ${booking.totalAmount.toLocaleString('ar-SA')} ر.س\n\nلأي استفسار، يرجى التواصل معنا عبر واتساب.\n\n📋 رقم الحجز: ${booking.bookingNumber}`,
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          read: false,
          createdAt: serverTimestamp()
        });
        notified = true;
      }

      // 3. Close modal and show success
      setDeleteBookingModal({ open: false, booking: null });
      alert(notified
        ? 'تم حذف الحجز وإرسال إشعار للضيف بنجاح ✓'
        : 'تم حذف الحجز بنجاح (لم يتم إرسال إشعار لأن معرف جهاز الضيف غير متوفر لهذا الحجز)');
      
    } catch (error) {
      console.error('Error deleting booking:', error);
      alert('حدث خطأ في حذف الحجز، يرجى المحاولة مرة أخرى');
    } finally {
      setDeletingBookingId(null);
    }
  };

const handleExportBookings = () => {
    const csvContent = [
      ['رقم الحجز', 'اسم المستأجر', 'عدد الشقق', 'الوصول', 'المغادرة', 'ليالي', 'المبلغ', 'الحالة', 'تاريخ الإنشاء'].join(','),
      ...bookings.map(b => [
        b.bookingNumber,
        b.guestName,
        b.apartmentsCount === 2 ? '2' : '1',
        b.checkInDate,
        b.checkOutDate,
        b.nights.toString(),
        b.totalAmount.toString(),
        b.status === 'confirmed' ? 'مؤكد' : b.status === 'pending' ? 'بانتظار التأكيد' : b.status === 'completed' ? 'مكتمل' : 'ملغي',
        new Date(toDate(b.createdAt)).toLocaleDateString('ar-SA')
      ].join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `حجوزات_رُقِيّ_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="py-20 bg-[#F3E2CC] min-h-screen text-[#3A2522] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#C6A16B] border-t-[#570A1B] rounded-full animate-spin mx-auto"></div>
          <p className="font-alexandria text-lg text-[#570A1B]">جاري تحميل البيانات الحية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 md:py-12 bg-[#F3E2CC] min-h-screen text-[#3A2522]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Admin Header Bar */}
        <div className="bg-[#570A1B] text-[#FFF9F1] p-4 sm:p-6 rounded-2xl border border-[#C6A16B] shadow-xl flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#C6A16B] text-[#570A1B] flex items-center justify-center font-bold shadow shrink-0">
              <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] sm:text-xs text-[#C6A16B] font-semibold">بوابة الإدارة المعتمدة</span>
              <h1 className="font-alexandria font-bold text-lg sm:text-2xl text-[#FFF9F1] leading-snug">
                لوحة التحكم الإدارية · رُقِيّ VIP
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full">
            <button
              onClick={() => autoCompleteBookings(true)}
              disabled={autoCompleteLoading}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-alexandria font-bold text-[11px] sm:text-sm py-2.5 px-3 sm:px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {autoCompleteLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>جاري الفحص...</span></>) : (<><CheckCircle className="w-4 h-4" /><span>إكمال تلقائي</span></>)}
            </button>
            <button
              onClick={handleExportBookings}
              className="bg-[#C6A16B] hover:bg-[#b89158] text-[#570A1B] font-alexandria font-bold text-[11px] sm:text-sm py-2.5 px-3 sm:px-4 rounded-xl transition-colors flex items-center justify-center gap-1.5 sm:gap-2 shadow"
            >
              <Download className="w-4 h-4" />
              <span>تصدير CSV</span>
            </button>
            <button
              onClick={onBackToSite}
              className="col-span-2 sm:col-span-1 bg-[#FFF9F1] hover:bg-white text-[#570A1B] font-alexandria font-bold text-[11px] sm:text-sm py-2.5 px-3 sm:px-4 rounded-xl border border-[#C6A16B] transition-colors flex items-center justify-center gap-1.5 sm:gap-2 shadow"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة للموقع</span>
            </button>
          </div>
          {autoCompleteResult && (
            <span className="text-xs text-emerald-300 font-medium animate-pulse">{autoCompleteResult}</span>
          )}
        </div>

        {/* Tab Controls Bar */}
        <div className="flex items-center gap-2 border-b border-[#C6A16B]/40 pb-3 overflow-x-auto overflow-y-hidden -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [-ms-overflow-style:none]">
          {[
            { id: 'overview', label: 'نظرة عامة والتقارير', icon: BarChart2 },
            { id: 'bookings', label: `إدارة الحجوزات (${bookings.length})`, icon: FileText },
            { id: 'apartments', label: 'إدارة وتعديل الشقق', icon: Building2 },
            { id: 'calendar-pricing', label: 'إدارة التقويم والأسعار', icon: Calendar },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl font-alexandria text-xs sm:text-sm transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-[#570A1B] text-[#FFF9F1] font-bold shadow-md border border-[#C6A16B]'
                  : 'bg-[#FFF9F1] text-[#3A2522] hover:bg-white border border-[#C6A16B]/40'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW & KPIS - SUPER PROFESSIONAL */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            
            {/* KPI Cards Strip - Enhanced */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              <div className="bg-[#FFF9F1] p-5 rounded-2xl border border-[#C6A16B] shadow-md text-right space-y-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#570A1B] to-[#C6A16B]"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#3A2522]/70">إجمالي الحجوزات</span>
                  <div className="w-9 h-9 rounded-lg bg-[#570A1B]/10 text-[#570A1B] flex items-center justify-center">
                    <Target className="w-5 h-5 text-[#570A1B]" />
                  </div>
                </div>
                <div className="font-alexandria font-extrabold text-3xl text-[#570A1B]">
                  {totalBookingsCount}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-medium">
                  <TrendingUp className="w-3 h-3" />
                  <span>{confirmedCount} مؤكد · {pendingCount} معلق</span>
                </div>
              </div>

              <div className="bg-[#FFF9F1] p-5 rounded-2xl border border-[#C6A16B] shadow-md text-right space-y-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-700"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#3A2522]/70">طلبات معلقة للمراجعة</span>
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <div className="font-alexandria font-extrabold text-3xl text-amber-800">
                  {pendingCount}
                </div>
                <div className="text-[11px] text-[#3A2522]/70">
                  تحتاج إجراء فوري · متوسط الانتظار: {pendingCount > 0 ? '< 2 ساعة' : 'لا يوجد'}
                </div>
              </div>

              <div className="bg-[#FFF9F1] p-5 rounded-2xl border border-[#C6A16B] shadow-md text-right space-y-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-700"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#3A2522]/70">إيرادات هذا الشهر</span>
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div className="font-alexandria font-extrabold text-3xl text-emerald-800">
                  {thisMonthRevenue.toLocaleString('ar-SA')}{' '}
                  <span className="text-xs font-normal">ر.س</span>
                </div>
                <div className="text-[11px] text-gray-500">
                  من إجمالي {totalRevenue.toLocaleString('ar-SA')} ر.س
                </div>
              </div>

              <div className="bg-[#FFF9F1] p-5 rounded-2xl border border-[#C6A16B] shadow-md text-right space-y-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#570A1B] to-[#C6A16B]"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#3A2522]/70">معدل التحويل</span>
                  <div className="w-9 h-9 rounded-lg bg-[#C6A16B]/10 text-[#C6A16B] flex items-center justify-center">
                    <Award className="w-5 h-5 text-[#C6A16B]" />
                  </div>
                </div>
                <div className="font-alexandria font-extrabold text-3xl text-[#C6A16B]">
                  {totalBookingsCount > 0 ? Math.round((confirmedCount / totalBookingsCount) * 100) : 0}%
                </div>
                <div className="text-[11px] text-emerald-700 font-medium">
                  {confirmedCount} من {totalBookingsCount} تم تأكيدها
                </div>
              </div>

            </div>

            {/* Revenue & Status Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Trend Card */}
              <div className="bg-[#FFF9F1] p-6 rounded-2xl border border-[#C6A16B] shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-alexandria font-bold text-base text-[#570A1B] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#C6A16B]" />
                    تحليل الإيرادات
                  </h3>
                  <span className="text-xs text-[#3A2522]/60 bg-[#F3E2CC] px-2 py-1 rounded-full">شهري</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#C6A16B]/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-alexandria font-bold text-sm text-[#570A1B]">حجوزات مؤكدة</p>
                        <p className="text-[10px] text-[#3A2522]/60">{confirmedCount} حجز</p>
                      </div>
                    </div>
                    <span className="font-alexandria font-extrabold text-lg text-emerald-700">
                      {bookings.filter(b => b.status === 'confirmed').reduce((s, b) => s + b.totalAmount, 0).toLocaleString('ar-SA')} ر.س
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#C6A16B]/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-alexandria font-bold text-sm text-[#570A1B]">بانتظار التأكيد</p>
                        <p className="text-[10px] text-[#3A2522]/60">{pendingCount} حجز</p>
                      </div>
                    </div>
                    <span className="font-alexandria font-extrabold text-lg text-amber-700">
                      {bookings.filter(b => b.status === 'pending').reduce((s, b) => s + b.totalAmount, 0).toLocaleString('ar-SA')} ر.س
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#C6A16B]/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-alexandria font-bold text-sm text-[#570A1B]">ملغية / مكتملة</p>
                        <p className="text-[10px] text-[#3A2522]/60">{cancelledCount + completedCount} حجز</p>
                      </div>
                    </div>
                    <span className="font-alexandria font-extrabold text-lg text-gray-700">
                      {bookings.filter(b => b.status === 'cancelled' || b.status === 'completed').reduce((s, b) => s + b.totalAmount, 0).toLocaleString('ar-SA')} ر.س
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Alerts */}
              <div className="bg-[#FFF9F1] p-6 rounded-2xl border border-[#C6A16B] shadow-lg space-y-4">
                <h3 className="font-alexandria font-bold text-base text-[#570A1B] flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#C6A16B]" />
                  تنبيهات وإجراءات سريعة
                </h3>
                <div className="space-y-3">
                  {pendingCount > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="flex-1 text-right">
                        <p className="font-alexandria font-bold text-sm text-amber-800">{pendingCount} حجز بانتظار المراجعة</p>
                        <p className="text-[11px] text-amber-700/80">اضغط للانتقال لصفحة الحجوزات واتخاذ إجراء</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('bookings')}
                        className="px-3 py-1.5 bg-amber-600 text-white text-xs font-alexandria rounded-lg hover:bg-amber-700 transition-colors"
                      >
                        مراجعة الآن
                      </button>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="font-alexandria font-bold text-sm text-emerald-800">نظام الحجز يعمل بشكل طبيعي</p>
                      <p className="text-[11px] text-emerald-700/80">جميع الحجوزات الجديدة تظهر فوراً في الوقت الفعلي</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F3E2CC] border border-[#C6A16B]/30 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#570A1B]/10 text-[#570A1B] flex items-center justify-center shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="font-alexandria font-bold text-sm text-[#570A1B]">تصدير تقرير شامل</p>
                      <p className="text-[11px] text-[#3A2522]/60">تحميل جميع الحجوزات بصيغة CSV للتحليل</p>
                    </div>
                    <button
                      onClick={handleExportBookings}
                      className="px-3 py-1.5 bg-[#570A1B] text-white text-xs font-alexandria rounded-lg hover:bg-[#84394A] transition-colors"
                    >
                      تحميل CSV
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Bookings - Enhanced */}
            <div className="bg-[#FFF9F1] p-6 rounded-2xl border border-[#C6A16B] shadow-lg">
              <div className="flex items-center justify-between border-b border-[#C6A16B]/30 pb-3 mb-4">
                <h3 className="font-alexandria font-bold text-base text-[#570A1B] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#C6A16B]" />
                  أحدث الحجوزات المستلمة
                </h3>
                <button
                  onClick={() => setActiveTab('bookings')}
                  className="text-xs text-[#570A1B] underline hover:text-[#84394A] font-medium"
                >
                  عرض الكل ({totalBookingsCount})
                </button>
              </div>

{bookings.length === 0 ? (
                <div className="text-center py-12 text-[#3A2522]/60">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-[#C6A16B]/50" />
                  <p className="font-alexandria text-sm">لا توجد حجوزات بعد</p>
                  <p className="text-[11px] mt-1">ستظهر الحجوزات الجديدة هنا فوراً</p>
                </div>
              ) : (
                <>
                  {bookings.slice(0, 5).map(b => (
                    <div key={b.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-alexandria font-bold text-sm text-[#570A1B]">
                          {b.guestName} · {b.apartmentName}
                        </div>
                        <div className="text-[#3A2522]/70 mt-0.5 flex flex-wrap gap-4">
                          <span>رقم الحجز: <span className="font-mono">{b.bookingNumber}</span></span>
                          <span>المدة: {b.nights} ليالٍ ({b.checkInDate} → {b.checkOutDate})</span>
                          <span>المبلغ: <span className="font-bold">{b.totalAmount.toLocaleString('ar-SA')} ر.س</span></span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 justify-end">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                          b.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          b.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {b.status === 'confirmed' ? '✓ مؤكد' : b.status === 'pending' ? '⏳ معلق' : b.status === 'completed' ? '✓ مكتمل' : '✗ ملغي'}
                        </span>
                      </div>
                    </div>
                  ))}
</>
              )}

            </div>
          </div>
        )}

        {/* TAB 2: BOOKINGS MANAGEMENT */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <div className="text-right">
              <h2 className="font-alexandria font-bold text-xl text-[#570A1B]">
                إدارة الحجوزات
              </h2>
              <p className="text-xs text-[#3A2522]/80 mt-1">
                استعراض كافة الحجوزات، تغيير الحالة، ومتابعة التفاصيل والإجراءات.
              </p>
            </div>
            <div className="bg-[#FFF9F1] rounded-2xl border border-[#C6A16B] shadow-xl overflow-hidden">
              {/* Mobile Card View */}
              <div className="lg:hidden divide-y divide-[#C6A16B]/20">
                {bookings.length === 0 ? (
                  <div className="text-center py-12 text-[#3A2522]/60">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-[#C6A16B]/50" />
                    <p className="font-alexandria text-sm">لا توجد حجوزات بعد</p>
                    <p className="text-[11px] mt-1">ستظهر الحجوزات الجديدة هنا فوراً</p>
                  </div>
                ) : (
                  bookings.map(b => (
                  <div key={b.id} className="p-4 space-y-3 bg-white/50 hover:bg-[#F3E2CC]/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-mono font-bold text-[#570A1B] pt-0.5">{b.bookingNumber}</span>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-semibold ${
                          b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                          b.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          b.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {b.status === 'confirmed' ? '✓ مؤكد' : b.status === 'pending' ? '⏳ انتظار التأكيد' : b.status === 'completed' ? '✓ مكتمل' : '✗ ملغي'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleContractWhatsAppClick(b)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white shadow-sm border border-[#1da851] transition-colors"
                          title="إرسال عقد الإيجار عبر واتساب"
                          aria-label="إرسال عقد الإيجار عبر واتساب"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                            <path d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.65a11.86 11.86 0 0 0 5.77 1.47h.01c6.56 0 11.9-5.34 11.91-11.9 0-3.18-1.24-6.17-3.47-8.44ZM12.08 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.64-.23-.37a9.84 9.84 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 6.99c-.01 5.46-4.45 9.88-9.91 9.88Zm5.43-7.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z"/>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-[#3A2522]">
                      <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-[#C6A16B] shrink-0" /><span className="font-bold">{b.guestName}</span></div>
                      <div className="flex items-center gap-2 text-[#3A2522]/60"><Phone className="w-3.5 h-3.5 text-[#C6A16B] shrink-0" /><span className="font-mono">{b.guestPhone}</span></div>
                      <div className="flex items-center gap-2 text-[#3A2522]/60"><ShieldCheck className="w-3.5 h-3.5 text-[#C6A16B] shrink-0" /><span className="font-mono dir-ltr">{b.guestIdNumber}</span></div>
                      <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-[#C6A16B] shrink-0" /><span>{b.apartmentsCount === 2 ? 'شقتان' : 'شقة واحدة'}</span></div>
                      <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-[#C6A16B] shrink-0" /><span className="font-mono">{b.checkInDate}</span> إلى <span className="font-mono">{b.checkOutDate}</span><span className="text-[#3A2522]/50">({b.nights} ليالٍ)</span></div>
                      <div className="flex items-center gap-2"><DollarSign className="w-3.5 h-3.5 text-[#C6A16B] shrink-0" /><span className="font-bold text-[#570A1B]">{b.totalAmount.toLocaleString('ar-SA')} ر.س</span></div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-alexandria font-bold text-[#570A1B]/70">حالة الحجز</label>
                        <select
                          value={b.status}
                          onChange={e => handleUpdateBookingStatus(b.id, e.target.value as any, b)}
                          className={`w-full text-xs rounded-lg p-2 border font-semibold ${
                            b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            b.status === 'pending' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            b.status === 'completed' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                            'bg-red-100 text-red-800 border-red-300'
                          }`}
                        >
                          <option value="confirmed">✓ مؤكد</option>
                          <option value="pending">⏳ انتظار التأكيد</option>
                          <option value="completed">✓ مكتمل</option>
                          <option value="cancelled">✗ ملغي</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-alexandria font-bold text-[#570A1B]/70">حالة الدفع</label>
                        <select
                          value={b.paymentStatus === 'paid' ? 'paid' : 'unpaid'}
                          onChange={e => handleUpdatePaymentStatus(b.id, e.target.value as 'paid' | 'unpaid')}
                          className={`w-full text-xs rounded-lg p-2 border font-semibold ${
                            b.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}
                        >
                          <option value="unpaid">غير مدفوع</option>
                          <option value="paid">مدفوع</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-[#C6A16B]/20">
                      <button onClick={() => handleViewBookingDetails(b)} className="flex-1 bg-[#570A1B] hover:bg-[#84394A] text-[#FFF9F1] py-2 rounded-lg font-alexandria text-[11px] font-semibold transition-colors inline-flex items-center justify-center gap-1.5 shadow">
                        <Eye className="w-3.5 h-3.5 text-[#C6A16B]" /><span>عرض التفاصيل</span>
                      </button>
                      {b.status === 'confirmed' && (
                        <button onClick={() => handleContractClick(b)} className="flex-1 bg-gradient-to-r from-[#C6A16B] to-[#b38d55] hover:from-[#b38d55] hover:to-[#a07c4a] text-[#570A1B] py-2 rounded-lg font-alexandria text-[11px] font-semibold transition-colors inline-flex items-center justify-center gap-1.5 shadow">
                          <FileText className="w-3.5 h-3.5" /><span>عقد الإيجار</span>
                        </button>
                      )}
                      <button onClick={() => handleDeleteBooking(b)} disabled={deletingBookingId === b.id} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-alexandria text-[11px] font-semibold transition-colors inline-flex items-center justify-center gap-1.5 shadow disabled:opacity-50 disabled:cursor-not-allowed">
                        {deletingBookingId === b.id ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>جاري الحذف...</span></>) : (<><Trash2 className="w-3.5 h-3.5" /><span>حذف</span></>)}
                      </button>
                    </div>
</div>
                  )))
                }
              </div>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                {bookings.length === 0 ? (
                  <div className="text-center py-12 text-[#3A2522]/60">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-[#C6A16B]/50" />
                    <p className="font-alexandria text-sm">لا توجد حجوزات بعد</p>
                    <p className="text-[11px] mt-1">ستظهر الحجوزات الجديدة هنا فوراً</p>
                  </div>
                ) : (
                  <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-[#570A1B] text-[#FFF9F1] font-alexandria">
                      <th className="p-3.5">رقم الحجز</th>
                      <th className="p-3.5">اسم المستأجر</th>
                      <th className="p-3.5">عدد الشقق</th>
                      <th className="p-3.5">فترة الإقامة</th>
                      <th className="p-3.5">المبلغ</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#C6A16B]/30">
                    {bookings.map(b => (
                      <tr key={b.id} className="hover:bg-[#F3E2CC]/40 transition-colors">
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-[#570A1B]">{b.bookingNumber}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-[#3A2522]">{b.guestName}</div>
                          <div className="text-[10px] text-[#3A2522]/60 font-mono">{b.guestPhone}</div>
                          <div className="text-[10px] text-[#3A2522]/50 font-mono dir-ltr">{b.guestIdNumber}</div>
                        </td>
                        <td className="p-3.5 font-medium">
                          {b.apartmentsCount === 2 ? '2' : '1'}
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono">{b.checkInDate}</span> إلى <span className="font-mono">{b.checkOutDate}</span>
                          <span className="block text-[10px] text-gray-500">({b.nights} ليالٍ)</span>
                        </td>
                        <td className="p-3.5 font-bold text-[#570A1B]">
                          {b.totalAmount.toLocaleString('ar-SA')} ر.س
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-col gap-1.5 min-w-[160px]">
                            <select
                              value={b.status}
                              onChange={e => handleUpdateBookingStatus(b.id, e.target.value as any, b)}
                              className={`w-full text-xs rounded-lg p-1.5 border font-semibold ${
                                b.status === 'confirmed'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : b.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : b.status === 'completed'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : 'bg-red-100 text-red-800 border-red-300'
                              }`}
                            >
                              <option value="confirmed">✓ مؤكد</option>
                              <option value="pending">⏳ انتظار التأكيد</option>
                              <option value="completed">✓ مكتمل</option>
                              <option value="cancelled">✗ ملغي</option>
                            </select>
                            <select
                              value={b.paymentStatus === 'paid' ? 'paid' : 'unpaid'}
                              onChange={e => handleUpdatePaymentStatus(b.id, e.target.value as 'paid' | 'unpaid')}
                              className={`w-full text-xs rounded-lg p-1.5 border font-semibold ${
                                b.paymentStatus === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}
                              title="حالة الدفع"
                            >
                              <option value="unpaid">غير مدفوع</option>
                              <option value="paid">مدفوع</option>
                            </select>
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleViewBookingDetails(b)}
                              className="bg-[#570A1B] hover:bg-[#84394A] text-[#FFF9F1] px-3 py-1.5 rounded-lg font-alexandria text-[11px] font-semibold transition-colors inline-flex items-center gap-1.5 shadow"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#C6A16B]" />
                              <span>عرض التفاصيل</span>
                            </button>
                            {b.status === 'confirmed' && (
                              <button
                                onClick={() => handleContractClick(b)}
                                className="bg-gradient-to-r from-[#C6A16B] to-[#b38d55] hover:from-[#b38d55] hover:to-[#a07c4a] text-[#570A1B] px-3 py-1.5 rounded-lg font-alexandria text-[11px] font-semibold transition-colors inline-flex items-center gap-1.5 shadow"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>عقد الإيجار</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteBooking(b)}
                              disabled={deletingBookingId === b.id}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-alexandria text-[11px] font-semibold transition-colors inline-flex items-center gap-1.5 shadow disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {deletingBookingId === b.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>جاري الحذف...</span>
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>حذف</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
</tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: APARTMENTS MANAGEMENT - SAVES TO FIRESTORE */}
                {/* TAB 4: CALENDAR & PRICING MANAGEMENT */}
        {activeTab === 'calendar-pricing' && (
          <div className="space-y-6 text-right">
            <div>
              <h2 className="font-alexandria font-bold text-xl text-[#570A1B]">إدارة التقويم والأسعار</h2>
              <p className="text-xs text-[#3A2522]/80 mt-1">إغلاق/فتح التواريخ لفترات محددة وتحديد أسعار مخصصة حسب التاريخ. التحديثات تظهر فوراً في تقويم الحجز.</p>
            </div>

            {calendarMsg && (
              <div className={`p-3 rounded-xl border text-sm font-medium ${calendarMsg.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
                {calendarMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#FFF9F1] p-5 rounded-2xl border border-[#C6A16B] shadow-lg space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center"><Calendar className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-alexandria font-bold text-base text-[#570A1B]">إغلاق / فتح التواريخ</h3>
                    <p className="text-[11px] text-[#3A2522]/70">حدد فترة لإغلاق الشقة (لن تكون قابلة للحجز).</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#570A1B] mb-1">من تاريخ</label>
                    <input type="date" value={closureStart} onChange={e=>setClosureStart(e.target.value)} className="w-full bg-white border border-[#C6A16B] rounded-xl p-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#570A1B] mb-1">إلى تاريخ</label>
                    <input type="date" value={closureEnd} onChange={e=>setClosureEnd(e.target.value)} className="w-full bg-white border border-[#C6A16B] rounded-xl p-2.5 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#570A1B] mb-1">ملاحظة (اختياري)</label>
                  <input type="text" value={closureNote} onChange={e=>setClosureNote(e.target.value)} placeholder="مثال: صيانة، استخدام خاص..." className="w-full bg-white border border-[#C6A16B] rounded-xl p-2.5 text-sm" />
                </div>
                <button type="button" onClick={handleAddClosure} disabled={closureSaving} className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white py-2.5 rounded-xl font-alexandria font-bold text-sm flex items-center justify-center gap-2">
                  {closureSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}<span>إغلاق الفترة</span>
                </button>
                <div className="border-t border-[#C6A16B]/30 pt-3 space-y-2">
                  <div className="text-xs font-bold text-[#570A1B]">فترات الإغلاق الحالية</div>
                  {closuresLoading ? (
                    <div className="text-xs text-[#3A2522]/70">جاري التحميل...</div>
                  ) : managedClosures.length === 0 ? (
                    <div className="text-xs text-[#3A2522]/60 bg-[#F3E2CC]/40 p-3 rounded-xl border border-[#C6A16B]/20">لا توجد فترات إغلاق لهذه الشقة.</div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {managedClosures.map(c => (
                        <div key={c.id} className="flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
                          <div className="min-w-0">
                            <div className="font-bold text-amber-900 font-mono">{c.startDate} → {c.endDate}</div>
                            {c.note ? <div className="text-amber-800/80 mt-0.5 truncate">{c.note}</div> : null}
                          </div>
                          <button type="button" onClick={() => removeClosure(c.id).then(()=>setCalendarMsg({type:'success',text:'تم فتح الفترة بنجاح.'})).catch((e:any)=>setCalendarMsg({type:'error',text:e?.message||'فشل في إزالة الإغلاق.'}))} className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold">فتح (إزالة)</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#FFF9F1] p-5 rounded-2xl border border-[#C6A16B] shadow-lg space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center"><DollarSign className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-alexandria font-bold text-base text-[#570A1B]">أسعار حسب الفترة</h3>
                    <p className="text-[11px] text-[#3A2522]/70">سعر ليلة مخصص لفترة (يستبدل السعر الأساسي لتلك الليالي).</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#570A1B] mb-1">من تاريخ</label>
                    <input type="date" value={priceStart} onChange={e=>setPriceStart(e.target.value)} className="w-full bg-white border border-[#C6A16B] rounded-xl p-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#570A1B] mb-1">إلى تاريخ</label>
                    <input type="date" value={priceEnd} onChange={e=>setPriceEnd(e.target.value)} className="w-full bg-white border border-[#C6A16B] rounded-xl p-2.5 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#570A1B] mb-1">سعر الليلة (ر.س)</label>
                  <input type="number" min={1} value={priceValue || ''} onChange={e=>setPriceValue(Number(e.target.value))} placeholder="مثال: 1200" className="w-full bg-white border border-[#C6A16B] rounded-xl p-2.5 text-sm font-bold" />
                </div>
                <div className="text-[11px] text-[#3A2522]/70 bg-[#F3E2CC]/40 p-2.5 rounded-xl border border-[#C6A16B]/20">لا يُسمح بتعارض فترات الأسعار لنفس الشقة. لتغيير فترة متداخلة احذف الفترة الحالية أولاً.</div>
                <button type="button" onClick={handleAddPriceOverride} disabled={priceSaving} className="w-full bg-[#570A1B] hover:bg-[#84394A] disabled:opacity-60 text-white py-2.5 rounded-xl font-alexandria font-bold text-sm flex items-center justify-center gap-2">
                  {priceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}<span>حفظ فترة السعر</span>
                </button>
                <div className="border-t border-[#C6A16B]/30 pt-3 space-y-2">
                  <div className="text-xs font-bold text-[#570A1B]">فترات الأسعار المخصصة</div>
                  {overridesLoading ? (
                    <div className="text-xs text-[#3A2522]/70">جاري التحميل...</div>
                  ) : managedPriceOverrides.length === 0 ? (
                    <div className="text-xs text-[#3A2522]/60 bg-[#F3E2CC]/40 p-3 rounded-xl border border-[#C6A16B]/20">لا توجد أسعار مخصصة لهذه الشقة (يُستخدم السعر الأساسي).</div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {managedPriceOverrides.map(o => (
                        <div key={o.id} className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs">
                          <div className="min-w-0">
                            <div className="font-bold text-emerald-900 font-mono">{o.startDate} → {o.endDate}</div>
                            <div className="text-emerald-800 mt-0.5 font-bold">{Number(o.pricePerNight).toLocaleString('ar-SA')} ر.س / ليلة</div>
                          </div>
                          <button type="button" onClick={() => removeOverride(o.id).then(()=>setCalendarMsg({type:'success',text:'تم حذف فترة السعر بنجاح.'})).catch((e:any)=>setCalendarMsg({type:'error',text:e?.message||'فشل في حذف فترة السعر.'}))} className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100 font-bold">حذف</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'apartments' && (
          <div className="space-y-6">
            <div className="text-right">
              <h2 className="font-alexandria font-bold text-xl text-[#570A1B]">
                إدارة بيانات وأسعار شقق رُقِيّ
              </h2>
              <p className="text-xs text-[#3A2522]/80 mt-1">
                تعديل سعر الإيجار اليومي - يتم الحفظ مباشرة في Firebase ويظهر للجميع فوراً.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {apartmentsList.map(apt => (
                <div
                  key={apt.id}
                  className="bg-[#FFF9F1] p-6 rounded-2xl border border-[#C6A16B] shadow-lg text-right space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[#C6A16B]/30 pb-3">
                    <div>
                      <h3 className="font-alexandria font-bold text-lg text-[#570A1B]">
                        {apt.name}
                      </h3>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-md font-semibold">
                      نشطة بالموقع
                    </span>
                  </div>

                  <div className="aspect-[16/9] rounded-xl overflow-hidden border border-[#C6A16B]/40">
                    <img
                      src={apt.mainImage}
                      alt={apt.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {editingAptId === apt.id ? (
                    <div className="p-4 bg-[#F3E2CC]/60 rounded-xl space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-[#570A1B] mb-1">
                          سعر الليلة الواحدة (ريال سعودي)
                        </label>
                        <input
                          type="number"
                          value={tempPrice}
                          onChange={e => setTempPrice(Number(e.target.value))}
                          className="w-full bg-white border border-[#C6A16B] rounded-lg p-2 text-sm font-bold"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveApt(apt.id)}
                          disabled={savingAptId === apt.id}
                          className="flex-1 bg-[#570A1B] text-white py-2 rounded-lg font-alexandria text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingAptId === apt.id ? 'جاري الحفظ...' : 'حفظ التعديل'}
                        </button>
                        <button
                          onClick={() => setEditingAptId(null)}
                          className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-xs"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#F3E2CC]/40 p-3.5 rounded-xl border border-[#C6A16B]/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs text-[#3A2522]/70 block">سعر الإيجار لليلة:</span>
                          <span className="font-alexandria font-bold text-lg text-[#570A1B]">
                            {apt.pricePerNight.toLocaleString('ar-SA')} ر.س
                          </span>
                        </div>
                        <button
                          onClick={() => handleStartEditApt(apt)}
                          className="px-3 py-1.5 rounded-lg bg-[#570A1B] text-[#FFF9F1] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#84394A] shrink-0"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#C6A16B]" />
                          <span>تعديل السعر</span>
                        </button>
                      </div>
                      <button
                        onClick={() => openImageModal(apt.id)}
                        className="w-full px-3 py-1.5 rounded-lg bg-[#FFF9F1] text-[#570A1B] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#F3E2CC] border border-[#C6A16B]/40 transition-colors"
                      >
                        <Image className="w-3.5 h-3.5 text-[#C6A16B]" />
                        <span>إدارة الصور</span>
                      </button>
                    </div>
                  )}

                  <div className="text-xs text-[#3A2522]/80 space-y-1">
                    <div>المساحة: <strong>{apt.area} م²</strong> · الغرف: <strong>{apt.rooms} غرف</strong></div>
                    <div>الحمامات: <strong>{apt.bathrooms}</strong> · السعة: <strong>{apt.capacity} أشخاص</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* IMAGE MANAGEMENT MODAL */}
        {imageModalAptId && (
          <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#FFF9F1] border-2 border-[#C6A16B] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#C6A16B]/30 bg-[#570A1B]/5 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#570A1B] to-[#3a0511] text-[#C6A16B] flex items-center justify-center border border-[#C6A16B] shadow-md">
                    <Image className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg sm:text-xl text-[#570A1B]">
                      إدارة صور الشقة
                    </h3>
                    <span className="text-xs text-[#84394A] font-semibold">
                      {apartmentsList.find(a => a.id === imageModalAptId)?.name || 'الشقة'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={closeImageModal}
                  className="p-2 rounded-full hover:bg-[#F3E2CC]/60 text-[#570A1B] transition-colors"
                  aria-label="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Upload Area */}
              <div className="p-4 sm:p-5 border-b border-[#C6A16B]/30 bg-[#F3E2CC]/30">
                <label className="flex flex-col items-center justify-center gap-3 p-4 sm:p-6 border-2 border-dashed border-[#C6A16B]/50 rounded-2xl cursor-pointer bg-white/50 hover:border-[#C6A16B] hover:bg-[#F3E2CC]/50 transition-all">
                  <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-[#C6A16B]" />
                  <div className="text-center">
                    <p className="font-alexandria font-bold text-sm sm:text-base text-[#570A1B]">
                      أضف صوراً جديدة
                    </p>
                    <p className="text-xs sm:text-sm text-[#3A2522]/70 mt-1">
                      اسحب الصور أو اضغط للاختيار · صيغ: JPG, PNG, WebP · حد أقصى: 5 ميجا لكل صورة
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleImageUpload(e, imageModalAptId!)}
                    disabled={uploading}
                    className="hidden"
                    id={`upload-${imageModalAptId}`}
                  />
                </label>
                {uploading && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#570A1B]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#C6A16B]" />
                    <span>جاري رفع الصور...</span>
                  </div>
                )}
              </div>

              {/* Images Grid */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                {imagesLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="w-10 h-10 border-4 border-[#C6A16B] border-t-[#570A1B] rounded-full animate-spin"></div>
                  </div>
                ) : aptImages.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center">
                      <Image className="w-10 h-10 text-white" />
                    </div>
                    <div className="space-y-2 text-right">
                      <h4 className="font-alexandria font-bold text-lg text-[#570A1B]">لا توجد صور بعد</h4>
                      <p className="text-sm text-[#3A2522]/70 leading-relaxed">
                        اضغط على "أضف صوراً جديدة" أعلاه للبدء
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {aptImages.map((img) => (
                      <div
                        key={img.name}
                        className="relative group bg-white rounded-xl overflow-hidden border border-[#C6A16B]/30 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-square relative overflow-hidden">
                          <img
                            src={img.url}
                            alt={img.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                          {deletingImage === img.name && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
                              <Loader2 className="w-6 h-6 text-white animate-spin" />
                            </div>
                          )}
                        </div>
                        {/* Delete Button - Always visible on mobile, hover on desktop */}
                        <div className="absolute top-2 right-2 z-10">
                          <button
                            onClick={() => handleDeleteImage(imageModalAptId!, img.name)}
                            disabled={deletingImage === img.name}
                            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg transition-colors disabled:opacity-50"
                            title="حذف الصورة"
                            aria-label="حذف الصورة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Image info */}
                        <div className="p-2 bg-white/95 backdrop-blur-sm">
                          <p className="text-[10px] text-[#3A2522]/70 truncate font-mono" title={img.name}>
                            {img.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="p-4 sm:p-5 border-t border-[#C6A16B]/30 bg-[#F3E2CC]/30">
                <button
                  onClick={closeImageModal}
                  className="w-full bg-[#570A1B] hover:bg-[#84394A] text-[#FFF9F1] py-3 px-4 rounded-xl font-alexandria font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <X className="w-4 h-4" />
                  <span>إغلاق</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE BOOKING CONFIRMATION MODAL */}
        {deleteBookingModal.open && deleteBookingModal.booking && (
          <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#FFF9F1] border-2 border-[#C6A16B] rounded-3xl max-w-md w-full shadow-2xl">
              <div className="p-5 sm:p-6 border-b border-[#C6A16B]/30 bg-red-50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center border border-red-300 shadow-md">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg sm:text-xl text-red-900">
                      تأكيد حذف الحجز
                    </h3>
                    <span className="text-xs text-red-700 font-semibold">
                      لا يمكن التراجع عن هذا الإجراء - سيتم حذف الحجز نهائياً
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <div className="bg-white/80 p-4 rounded-xl border border-[#C6A16B]/30 space-y-2 text-right">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#3A2522]/70">رقم الحجز:</span>
                    <span className="font-mono font-bold text-[#570A1B]">{deleteBookingModal.booking.bookingNumber}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#3A2522]/70">اسم المستأجر:</span>
                    <span className="font-bold text-[#3A2522]">{deleteBookingModal.booking.guestName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#3A2522]/70">الشقة:</span>
                    <span className="font-medium text-[#570A1B]">{deleteBookingModal.booking.apartmentName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#3A2522]/70">فترة الإقامة:</span>
                    <span className="font-mono text-[#3A2522]">{deleteBookingModal.booking.checkInDate} → {deleteBookingModal.booking.checkOutDate}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#3A2522]/70">المبلغ:</span>
                    <span className="font-bold text-[#570A1B]">{deleteBookingModal.booking.totalAmount.toLocaleString('ar-SA')} ر.س</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-bold">ماذا سيحدث عند الحذف؟</span>
                  </div>
                  <ul className="space-y-1 text-right pr-5">
                    <li>• سيتم حذف الحجز نهائياً من قاعدة البيانات</li>
                    <li>• سيصل إشعار فوري للضيف عبر الموقع</li>
                    <li>• سيختفي الحجز من قائمة إدارة الحجوزات فوراً</li>
                    <li>• لا يمكن استرجاع الحجز بعد الحذف</li>
                  </ul>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setDeleteBookingModal({ open: false, booking: null })}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-alexandria font-bold text-sm transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={confirmDeleteBooking}
                    disabled={deletingBookingId === deleteBookingModal.booking.id}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-alexandria font-bold text-sm transition-colors shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {deletingBookingId === deleteBookingModal.booking.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري الحذف...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>تأكيد الحذف</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contract loading screen */}
        {contractLoadingBooking && (
          <LoadingScreen
            key={contractLoadingBooking.id}
            duration={5000}
            onLoaded={() => {
              const booking = contractLoadingBooking;
              setContractLoadingBooking(null);
              if (booking) {
                void downloadContractPDF(booking);
              }
            }}
          />
        )}

      </div>
    </div>
  );
};

