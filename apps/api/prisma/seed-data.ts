/**
 * Base reference data. Coordinates are APPROXIMATE town centres used only for
 * the public "approximate location" map pins — verify and adjust them in the
 * admin dashboard (Locations) before launch.
 */
export interface SeedLocation {
  slug: string;
  nameAr: string;
  nameEn: string;
  lat?: number;
  lng?: number;
  children?: SeedLocation[];
}

export const LOCATIONS: SeedLocation[] = [
  {
    slug: 'iqlim-el-kharroub',
    nameAr: 'إقليم الخروب',
    nameEn: 'Iqlim El Kharroub',
    lat: 33.645,
    lng: 35.45,
    children: [
      { slug: 'barja', nameAr: 'برجا', nameEn: 'Barja', lat: 33.645, lng: 35.44 },
      { slug: 'chehim', nameAr: 'شحيم', nameEn: 'Chehim', lat: 33.6233, lng: 35.4808 },
      { slug: 'ketermaya', nameAr: 'كترمايا', nameEn: 'Ketermaya', lat: 33.6911, lng: 35.4456 },
      { slug: 'sibline', nameAr: 'سبلين', nameEn: 'Sibline', lat: 33.6325, lng: 35.4361 },
      { slug: 'mghairieh', nameAr: 'المغيرية', nameEn: 'Mghairieh', lat: 33.655, lng: 35.4708 },
      { slug: 'dalhoun', nameAr: 'دلهون', nameEn: 'Dalhoun', lat: 33.6608, lng: 35.4697 },
      { slug: 'jadra', nameAr: 'الجدرا', nameEn: 'Jadra', lat: 33.6131, lng: 35.41 },
      { slug: 'wardaniyeh', nameAr: 'الوردانية', nameEn: 'Wardaniyeh', lat: 33.6236, lng: 35.4267 },
    ],
  },
  {
    slug: 'saida',
    nameAr: 'صيدا',
    nameEn: 'Saida',
    lat: 33.5631,
    lng: 35.3689,
    children: [
      {
        slug: 'saida-city',
        nameAr: 'صيدا المدينة',
        nameEn: 'Saida City',
        lat: 33.5631,
        lng: 35.3689,
        children: [
          { slug: 'saida-old-city', nameAr: 'البلدة القديمة', nameEn: 'Old City' },
          { slug: 'saida-seafront', nameAr: 'الواجهة البحرية', nameEn: 'Seafront' },
          { slug: 'saida-dekerman', nameAr: 'الدكرمان', nameEn: 'Dekerman' },
        ],
      },
      { slug: 'haret-saida', nameAr: 'حارة صيدا', nameEn: 'Haret Saida', lat: 33.5583, lng: 35.3836 },
      { slug: 'abra', nameAr: 'عبرا', nameEn: 'Abra', lat: 33.5544, lng: 35.3956 },
      { slug: 'majdelyoun', nameAr: 'مجدليون', nameEn: 'Majdelyoun', lat: 33.5728, lng: 35.4089 },
      { slug: 'hlalieh', nameAr: 'الهلالية', nameEn: 'Hlalieh', lat: 33.565, lng: 35.39 },
      { slug: 'ghazieh', nameAr: 'الغازية', nameEn: 'Ghazieh', lat: 33.515, lng: 35.37 },
    ],
  },
  {
    slug: 'jiyeh',
    nameAr: 'الجية',
    nameEn: 'Jiyeh',
    lat: 33.65,
    lng: 35.4167,
    children: [
      {
        slug: 'jiyeh-town',
        nameAr: 'الجية',
        nameEn: 'Jiyeh',
        lat: 33.65,
        lng: 35.4167,
        children: [
          { slug: 'jiyeh-beachfront', nameAr: 'الشاطئ', nameEn: 'Beachfront' },
          { slug: 'jiyeh-old-village', nameAr: 'الجية القديمة', nameEn: 'Old Village' },
        ],
      },
    ],
  },
  {
    slug: 'naameh',
    nameAr: 'الناعمة',
    nameEn: 'Naameh',
    lat: 33.7418,
    lng: 35.4688,
    children: [
      { slug: 'naameh-town', nameAr: 'الناعمة', nameEn: 'Naameh', lat: 33.7418, lng: 35.4688 },
      { slug: 'haret-naameh', nameAr: 'حارة الناعمة', nameEn: 'Haret En Naameh', lat: 33.736, lng: 35.4745 },
    ],
  },
  {
    slug: 'damour',
    nameAr: 'الدامور',
    nameEn: 'Damour',
    lat: 33.7247,
    lng: 35.4508,
    children: [
      {
        slug: 'damour-town',
        nameAr: 'الدامور',
        nameEn: 'Damour',
        lat: 33.7247,
        lng: 35.4508,
        children: [
          { slug: 'damour-coast', nameAr: 'الساحل', nameEn: 'Coast' },
          { slug: 'damour-hills', nameAr: 'التلال', nameEn: 'Hills' },
        ],
      },
      { slug: 'mechref', nameAr: 'المشرف', nameEn: 'Mechref', lat: 33.715, lng: 35.475 },
    ],
  },
];

export const NOTIFICATION_TEMPLATES: { key: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string }[] = [
  { key: 'listing.approved', titleAr: 'انتشر إعلانك', titleEn: 'Your listing is live', bodyAr: 'تمت الموافقة على الإعلان {ref} وصار ظاهر للزباين.', bodyEn: 'Listing {ref} was approved and is now visible.' },
  { key: 'listing.rejected', titleAr: 'إعلانك بحاجة لتعديل', titleEn: 'Your listing needs changes', bodyAr: 'الإعلان {ref}: {reason}', bodyEn: 'Listing {ref}: {reason}' },
  { key: 'listing.revision_approved', titleAr: 'تمت الموافقة على التعديلات', titleEn: 'Changes approved', bodyAr: 'تحدّث الإعلان {ref}.', bodyEn: 'Listing {ref} was updated.' },
  { key: 'listing.revision_rejected', titleAr: 'ما تمت الموافقة على التعديلات', titleEn: 'Changes not approved', bodyAr: 'الإعلان {ref}: {reason}', bodyEn: 'Listing {ref}: {reason}' },
  { key: 'media.rejected', titleAr: 'صورة بحاجة لتغيير', titleEn: 'A photo needs replacing', bodyAr: 'الإعلان {ref}: {reason}', bodyEn: 'Listing {ref}: {reason}' },
  { key: 'viewing.confirmed', titleAr: 'تأكّد موعد الزيارة', titleEn: 'Viewing confirmed', bodyAr: 'موعدك {date}. شوف التفاصيل بالتطبيق.', bodyEn: 'Your viewing is on {date}. See details in the app.' },
  { key: 'viewing.cancelled', titleAr: 'انلغت الزيارة', titleEn: 'Viewing cancelled', bodyAr: 'فريقنا رح يتواصل معك لموعد جديد.', bodyEn: 'Our team will contact you about a new time.' },
  { key: 'message.new', titleAr: 'رسالة جديدة من فريق {brand}', titleEn: 'New message from the {brand} team', bodyAr: 'افتح التطبيق لتقرأ الرسالة.', bodyEn: 'Open the app to read it.' },
  { key: 'rent.reminder.before', titleAr: 'تذكير بالإيجار', titleEn: 'Rent reminder', bodyAr: 'الإيجار {amount} مستحق بتاريخ {date}.', bodyEn: 'Rent of {amount} is due on {date}.' },
  { key: 'rent.reminder.after', titleAr: 'الإيجار متأخّر', titleEn: 'Rent overdue', bodyAr: 'الإيجار {amount} كان مستحق بتاريخ {date}. تواصل معنا إذا في شي.', bodyEn: 'Rent of {amount} was due on {date}. Contact us if anything is wrong.' },
  { key: 'rent.payment_received', titleAr: 'استلمنا دفعتك', titleEn: 'Payment received', bodyAr: 'رقم الإيصال {receipt}.', bodyEn: 'Receipt {receipt}.' },
  { key: 'payout.recorded', titleAr: 'حوّلنالك الإيجار', titleEn: 'Rent transferred to you', bodyAr: 'سجّلنا تحويل {ref}. شوف كشف الحساب.', bodyEn: 'Payout {ref} recorded. See your statement.' },
  { key: 'rental.activated', titleAr: 'صار عقد الإيجار ساري', titleEn: 'Lease is active', bodyAr: 'العقد {ref} صار ساري.', bodyEn: 'Lease {ref} is now active.' },
  { key: 'sale.closed', titleAr: 'تمّ البيع', titleEn: 'Sale completed', bodyAr: 'سجّلنا البيع {ref}.', bodyEn: 'Sale {ref} has been recorded.' },
  { key: 'staff.viewing_requested', titleAr: 'طلب زيارة جديد', titleEn: 'New viewing request', bodyAr: 'على الإعلان {ref}.', bodyEn: 'For listing {ref}.' },
  { key: 'staff.viewing_rescheduled', titleAr: 'زبون غيّر موعد زيارة', titleEn: 'Viewing rescheduled', bodyAr: 'راجع الأوقات الجديدة.', bodyEn: 'Review the new preferred times.' },
  { key: 'staff.new_message', titleAr: 'رسالة جديدة من زبون', titleEn: 'New customer message', bodyAr: 'افتح المحادثة للرد.', bodyEn: 'Open the conversation to reply.' },
  { key: 'staff.lead_assigned', titleAr: 'تعيّنلك عميل جديد', titleEn: 'New lead assigned', bodyAr: 'شوف التفاصيل بلوحة التحكم.', bodyEn: 'See details in the dashboard.' },
];

export const AMENITY_LABELS: Record<string, [string, string]> = {
  parking: ['موقف سيارة', 'Parking'],
  elevator: ['مصعد', 'Elevator'],
  balcony: ['بلكون', 'Balcony'],
  terrace: ['تراس', 'Terrace'],
  sea_view: ['إطلالة بحر', 'Sea view'],
  mountain_view: ['إطلالة جبل', 'Mountain view'],
  generator: ['اشتراك موتير', 'Generator subscription'],
  solar_power: ['طاقة شمسية', 'Solar power'],
  state_electricity: ['كهربا دولة', 'State electricity'],
  water_well: ['بير مي', 'Water well'],
  water_tank: ['خزان مي', 'Water tank'],
  central_heating: ['تدفئة مركزية', 'Central heating'],
  air_conditioning: ['مكيّفات', 'Air conditioning'],
  storage: ['غرفة تخزين', 'Storage room'],
  garden: ['حديقة', 'Garden'],
  pool: ['مسبح', 'Pool'],
  concierge: ['ناطور', 'Concierge'],
  pets_allowed: ['مسموح الحيوانات الأليفة', 'Pets allowed'],
};
