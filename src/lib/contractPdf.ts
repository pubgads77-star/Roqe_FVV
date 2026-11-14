import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Booking, SITE_INFO } from '../data/apartmentsData';
import contractLogo from '../assets/images/contract-logo.png';

/* ============================================================================
   بيانات العقد المنظم (Variables) — يفصل التصميم عن المنطق
   ============================================================================ */
interface ContractData {
  bookingNumber: string;
  contractDate: string;
  apartmentsCount: number;
  ownerName: string;
  logoUrl: string;
  tenantName: string;
  tenantPhone: string;
  tenantIdNumber: string;
  guestsCount: number;
  checkInDate: string;
  checkOutDate: string;
  rentType: string;
  nightsCount: number;
  totalAmount: number;
  currency: string;
  paymentStatusText: string;
}

/* ============================================================================
   أدوات مساعدة (حماية من XSS + معالجة القيم الناقصة)
   ============================================================================ */

const escapeHtml = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const safeValue = (value: unknown, fallback: string = '—'): string => {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  return str.length === 0 ? fallback : escapeHtml(str);
};

const formatDateSafe = (dateStr: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatShortDateSafe = (dateStr: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const buildContractData = (booking: Booking): ContractData => {
  const paymentStatusText =
    booking.paymentStatus === 'paid'
      ? 'تم الدفع'
      : 'غير مدفوع يرجى السداد بسرعه';

  return {
    bookingNumber: safeValue(booking.bookingNumber),
    contractDate: formatDateSafe(new Date().toISOString()),
    apartmentsCount: typeof booking.apartmentsCount === 'number' ? booking.apartmentsCount : 1,
    ownerName: escapeHtml(SITE_INFO.ownerName || 'المالك/احمد الحارثي'),
    logoUrl: contractLogo,
    tenantName: safeValue(booking.guestName),
    tenantPhone: safeValue(booking.guestPhone),
    tenantIdNumber: safeValue(booking.guestIdNumber),
    guestsCount: typeof booking.guestCount === 'number' ? booking.guestCount : 0,
    checkInDate: formatShortDateSafe(booking.checkInDate),
    checkOutDate: formatShortDateSafe(booking.checkOutDate),
    rentType: 'يومي',
    nightsCount: typeof booking.nights === 'number' ? booking.nights : 0,
    totalAmount: typeof booking.totalAmount === 'number' ? booking.totalAmount : 0,
    currency: 'SAR',
    paymentStatusText,
  };
};

/* ============================================================================
   القالب HTML المستقل (الشكل فقط) — هوية رُقِيّ Luxury Modern Classic
   ============================================================================ */
const buildContractHtml = (data: ContractData): string => {
  const totalDisplay = data.totalAmount.toLocaleString('ar-SA');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>عقد إيجار | ${data.ownerName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700;800&family=Tajawal:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700;800&family=Tajawal:wght@400;500;600;700;800&display=swap');
    :root {
      --ink: #3A2522;
      --muted: #765f56;
      --soft: #F3E2CC;
      --accent: #C6A16B;
      --burgundy: #570A1B;
      --cream: #FFF9F1;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      background: #eadbc9;
      color: var(--ink);
      font-family: 'Tajawal', Tahoma, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.65;
      direction: rtl;
      text-align: right;
    }
    .page {
      position: relative; overflow: hidden;
      width: 210mm; min-height: 297mm;
      margin: 0 auto; padding: 15mm 13mm 14mm;
      background: var(--cream);
      border: 1px solid rgba(198,161,107,.75);
      border-radius: 3px;
      box-shadow: 0 10px 32px rgba(58,37,34,.13);
    }
    .page::before {
      content: ''; position: absolute; inset: 0 0 auto; height: 3mm;
      background: linear-gradient(90deg, #570A1B 0%, #84394A 48%, #570A1B 100%);
      border-bottom: 1px solid var(--accent);
    }
    .top {
      display: grid; grid-template-columns: 1fr 1.15fr 1fr;
      align-items: center; gap: 8px; min-height: 55mm;
    }
    .contact { color: var(--muted); font-size: 11px; }
    .contact strong { color: var(--burgundy); font-size: 13px; font-weight: 800; display: block; margin-bottom: 5px; }
    .contact.left { direction: ltr; text-align: left; }
    .contact.right { text-align: right; }
    .brand { display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .logo-wrap { height: 55mm; width: 100%; margin: 0 auto 1mm; }
    .logo { max-width: 52mm; max-height: 53mm; width: auto; height: auto; object-fit: contain; display: block; margin: 0 auto; }
    .brand-name {
      color: var(--burgundy);
      font-family: 'Alexandria','Tajawal',Tahoma,sans-serif;
      font-size: 15px; font-weight: 700; text-align: center;
    }
    .contract-title {
      color: var(--burgundy);
      font-family: 'Alexandria','Tajawal',Tahoma,sans-serif;
      font-size: 22px; font-weight: 800;
      line-height: 1.2;
      margin: 2mm 0 7mm; text-align: center;
    }
    .section { border: 1px solid rgba(198,161,107,.72); border-radius: 7px; background: #fffdf9; margin-bottom: 4.5mm; overflow: hidden; }
    .section-head {
      color: var(--cream); background: var(--burgundy); border-bottom: 1px solid var(--accent);
      padding: 8px 12px;
      font-family: 'Alexandria','Tajawal',Tahoma,sans-serif;
      font-size: 12px; font-weight: 700;
      display: flex; justify-content: space-between; align-items: center;
    }
    .section-head .en { color: #F3E2CC; direction: ltr; }
    /* محاذاة عمودية موحدة لجميع الجداول والخلايا داخل العقد */
    td, th { vertical-align: middle; line-height: 1.5; }
    .top { align-items: center; }
    .section-head { align-items: center; padding: 7px 12px 9px; }
    .info-table, .reservation-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .info-table td { padding: 7px 10px 10px; vertical-align: middle; overflow-wrap: anywhere; border-bottom: 1px solid rgba(198,161,107,.4); line-height: 1.5; }
    .info-table .field-en { width: 31%; direction: ltr; text-align: left; color: #765f56; line-height: 1.5; }
    .info-table .field-ar { width: 31%; text-align: right; color: var(--burgundy); font-weight: 700; line-height: 1.5; }
    .info-table .value { width: 38%; text-align: center; color: var(--ink); font-weight: 600; line-height: 1.5; }
    .reservation-table th, .reservation-table td {
      border: 1px solid rgba(198,161,107,.65); padding: 6px 5px 9px;
      text-align: center; vertical-align: middle; overflow-wrap: anywhere; line-height: 1.5;
    }
    .reservation-table th { background: #F3E2CC; color: var(--burgundy); font-weight: 800; }
    .reservation-table td { background: #fffdf9; color: var(--ink); }
    .reservation-table .en { color: #765f56; direction: ltr; }
    .total-row {
      border: 1px solid var(--accent); border-radius: 7px;
      background: var(--burgundy); color: var(--cream);
      padding: 11px 13px; margin-top: 2mm;
      display: grid; grid-template-columns: 1fr 1.6fr 1fr; align-items: center; gap: 8px;
    }
    .total-label { font-weight: 700; font-family: 'Alexandria','Tajawal',Tahoma,sans-serif; }
    .total-label.en { direction: ltr; text-align: left; }
    .total-value { text-align: center; font-size: 21px; font-weight: 800; color: #F3E2CC; direction: ltr; }
    .total-label.ar { text-align: right; }
    .note { margin-top: 8px; color: var(--muted); font-size: 9px; text-align: center; font-family: 'Tajawal', Tahoma, sans-serif; }
    @page { size: A4 portrait; margin: 0; }
    @media print {
      html, body { width: 210mm; background: #fff; }
      .page { width: 210mm; min-height: 297mm; margin: 0; border: 0; border-radius: 0; box-shadow: none; background: var(--cream); }
      .section { break-inside: avoid; }
      .total-row { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="page" id="rental-contract">
    <header class="top">
      <div class="contact left">
        <strong>Tel:</strong> ${safeValue(SITE_INFO.phone)}
      </div>
      <div class="brand">
        <div class="logo-wrap" id="logo-wrap">
          <img class="logo" id="brand-logo" src="${data.logoUrl}" alt="شعار رُقِيّ" onerror="this.style.display='none'" />
        </div>
        <div class="brand-name">${escapeHtml(SITE_INFO.name)}</div>
      </div>
      <div class="contact right">
        <strong>${data.ownerName}</strong>
      </div>
    </header>

    <h1 class="contract-title">عقد إيجار</h1>

    <section class="section">
      <div class="section-head"><span>معلومات العقد</span><span class="en">Contract Information</span></div>
      <table class="info-table">
        <tbody>
          <tr>
            <td class="field-ar">رقم الحجز</td>
            <td class="value">${data.bookingNumber}</td>
            <td class="field-en">Booking No.</td>
          </tr>
          <tr>
            <td class="field-ar">تاريخ العقد</td>
            <td class="value">${data.contractDate}</td>
            <td class="field-en">Contract Date</td>
          </tr>
          <tr>
            <td class="field-ar">عدد الشقق</td>
            <td class="value">${data.apartmentsCount}</td>
            <td class="field-en">Apartments</td>
          </tr>
          <tr>
            <td class="field-ar">حالة الدفع</td>
            <td class="value">${escapeHtml(data.paymentStatusText)}</td>
            <td class="field-en">Payment Status</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="section">
      <div class="section-head"><span>معلومات المستأجر</span><span class="en">Tenant Information</span></div>
      <table class="info-table">
        <tbody>
          <tr>
            <td class="field-ar">اسم المستأجر</td>
            <td class="value">${data.tenantName}</td>
            <td class="field-en">Tenant Name</td>
          </tr>
          <tr>
            <td class="field-ar">رقم الجوال</td>
            <td class="value">${data.tenantPhone}</td>
            <td class="field-en">Phone</td>
          </tr>
          <tr>
            <td class="field-ar">رقم الهوية</td>
            <td class="value">${data.tenantIdNumber}</td>
            <td class="field-en">ID Number</td>
          </tr>
          <tr>
            <td class="field-ar">عدد الضيوف</td>
            <td class="value">${data.guestsCount} شخص</td>
            <td class="field-en">Guests</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="section">
      <div class="section-head"><span>جدول الحجوزات</span><span class="en">Reservations</span></div>
      <table class="reservation-table">
        <thead>
          <tr>
            <th>من <span class="en">From</span></th>
            <th>إلى <span class="en">To</span></th>
            <th>نوع الإيجار <span class="en">Rent Type</span></th>
            <th>عدد الليالي <span class="en">Nights</span></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${data.checkInDate}</td>
            <td>${data.checkOutDate}</td>
            <td>${data.rentType}</td>
            <td>${data.nightsCount} ليلة</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div class="total-row">
      <span class="total-label ar">الإجمالي</span>
      <span class="total-value">${totalDisplay} ${data.currency}</span>
      <span class="total-label en">Total</span>
    </div>

    <div class="note">رُقِيّ للشقق الفندقية · عقد إلكتروني موثق · ${data.ownerName}</div>
  </main>
</body>
</html>`;
};

/* ============================================================================
   تحميل صورة الشعار والتأكد من اكتمالها
   ============================================================================ */
const waitForLogo = (url: string, timeoutMs: number): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!url) { resolve(false); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(false), timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
};

/* ============================================================================
   انتظار الخطوط (أفضل جهد — لا يفشل إذا تأخرت)
   ============================================================================ */
const waitForFonts = (timeoutMs: number): Promise<void> => {
   return new Promise((resolve) => {
     const timer = setTimeout(() => resolve(), timeoutMs);
     if (document.fonts) {
       document.fonts.ready.then(() => {
         clearTimeout(timer);
         resolve();
       }).catch(() => {
         clearTimeout(timer);
         resolve();
       });
     } else {
       clearTimeout(timer);
       resolve();
     }
   });
};

/* ============================================================================
   توليد ملف PDF من العقد (بدون تعديل أي بيانات في قاعدة البيانات)
   ============================================================================ */
export const generateRentalContractPDF = async (booking: Booking): Promise<Blob> => {
  const data = buildContractData(booking);

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.visibility = 'visible';
  container.innerHTML = buildContractHtml(data);
  document.body.appendChild(container);

  try {
    await waitForFonts(10000);
    await waitForLogo(data.logoUrl, 8000);

    const element = document.getElementById('rental-contract');
    if (!element) {
      throw new Error('عنصر العقد غير موجود في القالب');
    }

    const canvas = await html2canvas(element, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      width: element.offsetWidth,
      height: element.offsetHeight,
    });

    const imgData = canvas.toDataURL('image/png');

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    const pdfBlob = doc.output('blob');
    return pdfBlob;
  } finally {
    document.body.removeChild(container);
  }
};

/* ============================================================================
   تنزيل ملف PDF للعقد
   ============================================================================ */
const dataFileName = (bookingNumber: string): string => {
  const safe = String(bookingNumber).replace(/[^A-Za-z0-9_-]/g, '_');
  return `Rental-Contract-${safe}`;
};

const toWhatsAppNumber = (phone: string): string => {
  let raw = String(phone || '').trim();
  if (!raw) return '';
  // Convert international prefix 00xx -> +xx for normalization
  if (raw.startsWith('00')) raw = '+' + raw.slice(2);
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  // If number came with explicit +, trust international digits as-is
  if (raw.startsWith('+')) return digits;

  // Fallbacks for legacy local formats
  if (digits.startsWith('05') && digits.length === 10) {
    digits = '966' + digits.slice(1);
  } else if (digits.startsWith('5') && digits.length === 9) {
    digits = '966' + digits;
  } else if (digits.startsWith('0') && digits.length > 1) {
    // Best-effort legacy fallback (defaults to KSA if country unknown)
    digits = '966' + digits.replace(/^0+/, '');
  }
  return digits;
};

export const openGuestWhatsAppChat = (booking: Booking): void => {
  const phone = toWhatsAppNumber(booking.guestPhone);
  const message = `مرحباً ${booking.guestName}،\nبخصوص حجزكم رقم ${booking.bookingNumber} في شقق رُقِيّ الفندقية.`;
  const waUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
};

export const shareContractViaWhatsApp = async (booking: Booking): Promise<void> => {
  // Open direct WhatsApp chat with guest (contract sending handled manually by admin as needed)
  openGuestWhatsAppChat(booking);
};

export const downloadContractPDF = async (booking: Booking): Promise<void> => {
  try {
    console.log('[contractPdf] بدء إنشاء العقد للحجز:', booking.bookingNumber);

    const blob = await generateRentalContractPDF(booking);
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${dataFileName(booking.bookingNumber)}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('[contractPdf] تم تنزيل العقد بنجاح:', link.download);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'خطأ غير معروف في إنشاء العقد';
    console.error('[contractPdf] خطأ:', error);
    alert('فشل في إنشاء وتنزيل عقد الإيجار: ' + msg);
    throw error;
  }
};
