/**
 * PLACEHOLDER legal text. Every document here must be reviewed by a lawyer
 * qualified in Lebanon before launch. The API serves the version stored in
 * the database (admin-editable); these are only the seed defaults.
 *
 * Accepting terms in the app records consent. It does NOT by itself
 * guarantee that a commission or fee can be collected.
 */
export const LEGAL_REVIEW_PENDING = true;

export const PLACEHOLDER_TERMS = {
  version: '2026-10-draft-1',
  ar: `【مسودة — بحاجة لمراجعة قانونية محلية قبل الإطلاق】

١. دار منصّة وساطة عقارية مُدارة. كل التواصل بين الزبون وفريق دار، وما في تواصل مباشر مع المالك عبر التطبيق.
٢. البيع: عمولة وساطة يدفعها البائع (حالياً ٢٫٥٪) وعمولة يدفعها الشاري (حالياً ٢٫٥٪)، وكل وحدة بتنحسب على السعر النهائي المتّفق عليه. الأرقام المعروضة تقديرية وما بتشمل الضرائب والرسوم الأخرى.
٣. الإيجار: رسوم إدارة ووساطة شهرية متكرّرة (حالياً ٥٠ دولار) بيدفعها المستأجر ضمن الإيجار الشهري طول مدة العقد، إلّا إذا اتُّفق خطياً على غير هيك.
٤. الرسوم والنِسَب المعتمدة لكل طلب أو عقد هي اللي وافقت عليها وقت الطلب أو التوقيع، ومحفوظة مع رقم نسخة الشروط.
٥. الإعلانات بتخضع لمراجعة الفريق قبل النشر.`,
  en: `[DRAFT — requires local legal review before launch]

1. Dar is a managed real estate brokerage platform. All communication is between the customer and the Dar team; there is no direct owner contact through the app.
2. Sales: a brokerage commission paid by the seller (currently 2.5%) and a separate commission paid by the buyer (currently 2.5%), each calculated on the final agreed sale price. Displayed figures are estimates and exclude taxes and other charges.
3. Rentals: a recurring monthly management & brokerage fee (currently $50) paid by the tenant as part of the monthly rent for the length of the lease, unless agreed otherwise in writing.
4. The fees and rates that apply to a request or agreement are those accepted at the time, stored with the terms version.
5. Listings are reviewed by our team before publication.`,
};

export const PLACEHOLDER_PRIVACY = {
  version: '2026-10-draft-1',
  ar: `【مسودة — بحاجة لمراجعة قانونية محلية قبل الإطلاق】
منجمع الاسم والإيميل ورقم التلفون لنتواصل معك بخصوص طلباتك. معلومات المالكين والعناوين الدقيقة ما بتنشر للعموم ومحصورة بالإدارة والموظف المسؤول. منحذف الصور من بيانات الموقع (GPS) عند الرفع. بتقدر تطلب حذف حسابك؛ بعض السجلات المالية بتنحفظ للمدة القانونية.`,
  en: `[DRAFT — requires local legal review before launch]
We collect your name, email and phone number to contact you about your requests. Owner details and exact addresses are never published and are limited to administrators and the assigned employee. We remove location (GPS) metadata from uploaded photos. You can request account deletion; some financial records are retained for the legally required period.`,
};
