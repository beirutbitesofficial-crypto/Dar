import { cookies } from 'next/headers';
import { dictionaries, type Locale } from '@dar/shared';

/** Staff-facing labels. Customer-facing wording lives in @dar/shared i18n. */
const admin = {
  ar: {
    overview: 'نظرة عامة', moderation: 'المراجعة', properties: 'العقارات', leads: 'العملاء المحتملون', viewings: 'الزيارات',
    conversations: 'المحادثات', sales: 'المبيعات', agreements: 'عقود الإيجار', collections: 'التحصيل', payouts: 'تحويلات المالكين',
    settings: 'الإعدادات', locations: 'المناطق والمزايا', users: 'المستخدمون', reports: 'البلاغات', audit: 'سجل التدقيق', exports: 'التصدير',
    signOut: 'خروج', signIn: 'تسجيل الدخول', email: 'الإيميل', password: 'كلمة السر', save: 'حفظ', approve: 'موافقة', reject: 'رفض',
    reason: 'السبب', assign: 'تعيين', employee: 'الموظف', status: 'الحالة', actions: 'إجراءات', notes: 'ملاحظات داخلية', addNote: 'أضف ملاحظة',
    moneyCollected: 'المبالغ المحصّلة', revenueEarned: 'إيرادات الوساطة المحققة', feesUnpaid: 'رسوم وساطة غير مدفوعة',
    owedToLandlords: 'إيجارات مستحقة للمالكين', landlordPayouts: 'تحويلات للمالكين', activeRentals: 'إيجارات سارية',
    viewingsNext7: 'زيارات خلال ٧ أيام', overdue: 'دفعات متأخرة', salesThisMonth: 'مبيعات هالشهر', workload: 'توزيع العمل',
    empty: 'ما في شي حالياً', demo: 'تجريبي', recordPayment: 'تسجيل دفعة', amount: 'المبلغ ($)', method: 'الطريقة', date: 'التاريخ',
    reference: 'المرجع', reverse: 'عكس القيد', refund: 'استرداد', waive: 'إعفاء', confirm: 'تأكيد', print: 'طباعة', receipt: 'إيصال',
    statement: 'كشف حساب', recordPayout: 'تسجيل تحويل', activate: 'تفعيل', terminate: 'إنهاء مبكر', amend: 'تعديل العقد', renew: 'تجديد',
    create: 'إنشاء', newAgreement: 'عقد جديد', newClosing: 'تسجيل بيع', language: 'English', contactFlag: 'يحتوي معلومات تواصل محتملة',
    privateData: 'بيانات خاصة — يتم تسجيل الاطلاع', calendar: 'التقويم', requests: 'الطلبات', pipeline: 'مسار العملاء', search: 'بحث',
  },
  en: {
    overview: 'Overview', moderation: 'Moderation', properties: 'Properties', leads: 'Leads', viewings: 'Viewings',
    conversations: 'Conversations', sales: 'Sales', agreements: 'Rental agreements', collections: 'Collections', payouts: 'Owner payouts',
    settings: 'Settings', locations: 'Locations & amenities', users: 'Users', reports: 'Reports', audit: 'Audit log', exports: 'Exports',
    signOut: 'Sign out', signIn: 'Sign in', email: 'Email', password: 'Password', save: 'Save', approve: 'Approve', reject: 'Reject',
    reason: 'Reason', assign: 'Assign', employee: 'Employee', status: 'Status', actions: 'Actions', notes: 'Internal notes', addNote: 'Add note',
    moneyCollected: 'Money collected', revenueEarned: 'Brokerage revenue earned', feesUnpaid: 'Brokerage fees unpaid',
    owedToLandlords: 'Rent owed to landlords', landlordPayouts: 'Landlord payouts', activeRentals: 'Active rentals',
    viewingsNext7: 'Viewings next 7 days', overdue: 'Overdue payments', salesThisMonth: 'Sales this month', workload: 'Workload',
    empty: 'Nothing here right now', demo: 'Demo', recordPayment: 'Record payment', amount: 'Amount ($)', method: 'Method', date: 'Date',
    reference: 'Reference', reverse: 'Reverse', refund: 'Refund', waive: 'Waive', confirm: 'Confirm', print: 'Print', receipt: 'Receipt',
    statement: 'Statement', recordPayout: 'Record payout', activate: 'Activate', terminate: 'Terminate early', amend: 'Amend', renew: 'Renew',
    create: 'Create', newAgreement: 'New agreement', newClosing: 'Record sale', language: 'العربية', contactFlag: 'Possible contact details',
    privateData: 'Private data — access is audited', calendar: 'Calendar', requests: 'Requests', pipeline: 'Pipeline', search: 'Search',
  },
} as const;

export type AdminKey = keyof (typeof admin)['ar'];

export async function getLocale(): Promise<Locale> {
  return (await cookies()).get('dar_admin_locale')?.value === 'en' ? 'en' : 'ar';
}

export async function getT() {
  const locale = await getLocale();
  const t = (k: AdminKey) => admin[locale][k];
  return { t, locale, dict: dictionaries[locale], dir: locale === 'ar' ? 'rtl' : 'ltr' };
}
