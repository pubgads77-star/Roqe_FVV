import React from 'react';
import { 
  CheckCircle2, 
  Printer, 
  Calendar, 
  User, 
  ArrowLeft, 
  Home, 
  Share2,
  Building2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Booking, SITE_INFO } from '../data/apartmentsData';

interface BookingConfirmationProps {
  booking: Booking;
  onReturnHome: () => void;
}

const STATUS_CONFIG = {
  pending: { label: 'بانتظار التأكيد', icon: Clock, color: 'bg-amber-100 text-amber-800', iconColor: 'text-amber-600' },
  confirmed: { label: 'تم التأكيد ✓', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-800', iconColor: 'text-emerald-600' },
  completed: { label: 'مكتمل ✓', icon: CheckCircle2, color: 'bg-blue-100 text-blue-800', iconColor: 'text-blue-600' },
  cancelled: { label: 'ملغي ✗', icon: AlertCircle, color: 'bg-red-100 text-red-800', iconColor: 'text-red-600' }
} as const;

// Helper to format Firestore Timestamp
const formatDate = (date: any) => {
  if (!date) return '—';
  if (date.toDate) return date.toDate().toLocaleString('ar-SA');
  if (typeof date === 'string') return new Date(date).toLocaleString('ar-SA');
  return '—';
};

// Same generateWhatsAppMessage function as BookingWizard
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
• الإيجار (${booking.nights} ليالٍ × ${booking.pricePerNight.toLocaleString('ar-SA')} ر.س): ${booking.subtotal.toLocaleString('ar-SA')} ر.س
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

export const BookingConfirmation: React.FC<BookingConfirmationProps> = ({
  booking,
  onReturnHome
}) => {
  const statusConfig = STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="py-10 md:py-16 bg-[#F3E2CC] min-h-screen text-[#3A2522]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-8">
        
        {/* Status Announcement Card */}
        <div className="bg-[#FFF9F1] rounded-3xl border-2 border-[#570A1B] shadow-2xl p-6 sm:p-10 text-center space-y-6">
          
          {/* Animated Status Ring */}
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center border-4 shadow-lg animate-bounce ${statusConfig.color.replace('bg-', 'bg-').replace('text-', 'border-')}`}>
            <StatusIcon className={`w-10 h-10 ${statusConfig.iconColor}`} />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3.5 py-1 rounded-full font-semibold text-xs border">{statusConfig.label}</span>
            <h1 className="font-alexandria font-extrabold text-2xl sm:text-3xl text-[#570A1B]">
              شكراً لاختيارك رُقِيّ للشقق الفندقية
            </h1>
            <p className="text-xs sm:text-sm text-[#3A2522]/80 font-light">
              {booking.status === 'pending' 
                ? 'تم استلام طلب حجزك بنجاح، وهو الآن بانتظار مراجعة الإدارة وتأكيد التحويل البنكي.'
                : 'يسعدنا استضافتك، تم تأكيد حجزك وإرسال التفاصيل إلى جوالك.'}
            </p>
          </div>

          {/* Booking Code Banner */}
          <div className="bg-[#570A1B] text-[#FFF9F1] p-4 rounded-2xl border border-[#C6A16B] flex items-center justify-between">
            <div className="text-right">
              <span className="text-[11px] text-[#C6A16B] block">رقم الحجز المرجعي</span>
              <span className="font-mono font-bold text-lg sm:text-xl text-[#FFF9F1] tracking-wider">
                {booking.bookingNumber}
              </span>
            </div>
            <div className={`bg-[#FFF9F1]/10 px-3 py-1.5 rounded-lg border border-[#C6A16B]/40 text-xs ${statusConfig.iconColor}`}>
              حالة الحجز: {statusConfig.label}
            </div>
          </div>

          {/* Summary Details Grid */}
          <div className="bg-[#F3E2CC]/50 p-5 rounded-2xl border border-[#C6A16B]/40 space-y-3 text-right text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-[#C6A16B]/30 pb-2">
              <span className="text-[#3A2522]/70 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#570A1B]" />
                الوحدة المحجوزة:
              </span>
              <span className="font-alexandria font-bold text-[#570A1B]">
                {booking.apartmentName}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#C6A16B]/30 pb-2">
              <span className="text-[#3A2522]/70 flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#570A1B]" />
                اسم المستأجر:
              </span>
              <span className="font-semibold text-[#570A1B]">
                {booking.guestName}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#C6A16B]/30 pb-2">
              <span className="text-[#3A2522]/70 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#570A1B]" />
                فترة الإقامة:
              </span>
              <span className="font-mono font-medium text-[#570A1B]">
                من {booking.checkInDate} إلى {booking.checkOutDate} ({booking.nights} ليالٍ)
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[#3A2522]/80 font-bold">المبلغ الإجمالي للتحويل:</span>
              <span className="font-alexandria font-extrabold text-base text-[#570A1B]">
                {booking.totalAmount.toLocaleString('ar-SA')} ر.س
              </span>
            </div>
          </div>

          {/* Payment Info for Pending */}
          {booking.status === 'pending' && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
              <h3 className="font-alexandria font-bold text-sm text-amber-800 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                بيانات التحويل البنكي (مصرف الراجحي)
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-3 rounded-xl border border-amber-300">
                  <p className="text-amber-700/70">المستفيد</p>
                  <p className="font-bold text-amber-900">احمد سعد مطر العضياني الحارثي</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-300">
                  <p className="text-amber-700/70">رقم الحساب</p>
                  <p className="font-bold text-amber-900 font-mono dir-ltr">077030010006083063875</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-300">
                  <p className="text-amber-700/70">الآيبان</p>
                  <p className="font-bold text-amber-900 font-mono dir-ltr text-[10px]">SA59 8000 0858 6080 1306 3875</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-amber-300">
                  <p className="text-amber-700/70">المبلغ للتحويل</p>
                  <p className="font-bold text-amber-900">{booking.totalAmount.toLocaleString('ar-SA')} ر.س</p>
                </div>
              </div>
              <p className="text-[10px] text-amber-700/80 text-center">
                احتفظ بإيصال التحويل وأرسله عبر واتساب لتأكيد الحجز
              </p>
            </div>
          )}

          {/* WhatsApp & Return Home buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#C6A16B]/30">
            <a
              href={`https://wa.me/${SITE_INFO.whatsapp}?text=${encodeURIComponent(generateWhatsAppMessage(booking))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-[#25D366] hover:bg-[#20ba5a] text-white py-3 px-4 rounded-xl font-alexandria font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow"
            >
              <span>{booking.status === 'pending' ? 'إرسال إيصال التحويل' : 'إرسال تأكيد لواتساب الاستقبال'}</span>
            </a>

            <button
              onClick={onReturnHome}
              className="flex-1 bg-[#F3E2CC] hover:bg-[#e7d2b8] text-[#570A1B] py-3 px-4 rounded-xl font-alexandria font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 border border-[#570A1B]/30"
            >
              <Home className="w-4 h-4" />
              <span>العودة للرئيسية</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
