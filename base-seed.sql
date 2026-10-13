--
-- PostgreSQL database dump
--

\restrict fVyNf7wqkMPoSUjGatby82JckzuEqbkTFgfdebO9eeZZaciiPmDDL3Ux7kTbMUY

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-1.pgdg24.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: AccountDeletionRequest; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Location; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kyzl00014cinutywb3ol', 'AREA', 'إقليم الخروب', 'Iqlim El Kharroub', 'iqlim-el-kharroub', NULL, 33.645000, 35.450000, true, 0, '2026-10-13 19:24:23.457', '2026-10-13 19:24:23.457');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kyzq00034cinm6vjae4x', 'TOWN', 'برجا', 'Barja', 'barja', 'cmv72kyzl00014cinutywb3ol', 33.645000, 35.440000, true, 0, '2026-10-13 19:24:23.463', '2026-10-13 19:24:23.463');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kyzt00054cindzvcf3im', 'TOWN', 'شحيم', 'Chehim', 'chehim', 'cmv72kyzl00014cinutywb3ol', 33.623300, 35.480800, true, 1, '2026-10-13 19:24:23.465', '2026-10-13 19:24:23.465');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kyzw00074cinuz7dz24a', 'TOWN', 'كترمايا', 'Ketermaya', 'ketermaya', 'cmv72kyzl00014cinutywb3ol', 33.691100, 35.445600, true, 2, '2026-10-13 19:24:23.468', '2026-10-13 19:24:23.468');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kyzy00094cinbwyqpo6s', 'TOWN', 'سبلين', 'Sibline', 'sibline', 'cmv72kyzl00014cinutywb3ol', 33.632500, 35.436100, true, 3, '2026-10-13 19:24:23.47', '2026-10-13 19:24:23.47');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz00000b4cintczvki67', 'TOWN', 'المغيرية', 'Mghairieh', 'mghairieh', 'cmv72kyzl00014cinutywb3ol', 33.655000, 35.470800, true, 4, '2026-10-13 19:24:23.472', '2026-10-13 19:24:23.472');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz02000d4cin0q2aokxa', 'TOWN', 'دلهون', 'Dalhoun', 'dalhoun', 'cmv72kyzl00014cinutywb3ol', 33.660800, 35.469700, true, 5, '2026-10-13 19:24:23.474', '2026-10-13 19:24:23.474');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz04000f4cin8nemlvgu', 'TOWN', 'الجدرا', 'Jadra', 'jadra', 'cmv72kyzl00014cinutywb3ol', 33.613100, 35.410000, true, 6, '2026-10-13 19:24:23.477', '2026-10-13 19:24:23.477');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz07000h4cin8vx760dg', 'TOWN', 'الوردانية', 'Wardaniyeh', 'wardaniyeh', 'cmv72kyzl00014cinutywb3ol', 33.623600, 35.426700, true, 7, '2026-10-13 19:24:23.479', '2026-10-13 19:24:23.479');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz09000j4cinly2p3io6', 'AREA', 'صيدا', 'Saida', 'saida', NULL, 33.563100, 35.368900, true, 1, '2026-10-13 19:24:23.482', '2026-10-13 19:24:23.482');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz0b000l4cinzoscomsd', 'TOWN', 'صيدا المدينة', 'Saida City', 'saida-city', 'cmv72kz09000j4cinly2p3io6', 33.563100, 35.368900, true, 0, '2026-10-13 19:24:23.483', '2026-10-13 19:24:23.483');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz0d000n4cin01h7ntq4', 'NEIGHBORHOOD', 'البلدة القديمة', 'Old City', 'saida-old-city', 'cmv72kz0b000l4cinzoscomsd', NULL, NULL, true, 0, '2026-10-13 19:24:23.485', '2026-10-13 19:24:23.485');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz0g000p4cinwe9usr29', 'NEIGHBORHOOD', 'الواجهة البحرية', 'Seafront', 'saida-seafront', 'cmv72kz0b000l4cinzoscomsd', NULL, NULL, true, 1, '2026-10-13 19:24:23.488', '2026-10-13 19:24:23.488');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz0i000r4cintk68gwrs', 'NEIGHBORHOOD', 'الدكرمان', 'Dekerman', 'saida-dekerman', 'cmv72kz0b000l4cinzoscomsd', NULL, NULL, true, 2, '2026-10-13 19:24:23.49', '2026-10-13 19:24:23.49');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz0k000t4cinenuoc2k4', 'TOWN', 'حارة صيدا', 'Haret Saida', 'haret-saida', 'cmv72kz09000j4cinly2p3io6', 33.558300, 35.383600, true, 1, '2026-10-13 19:24:23.493', '2026-10-13 19:24:23.493');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz0m000v4cinbddp4o92', 'TOWN', 'عبرا', 'Abra', 'abra', 'cmv72kz09000j4cinly2p3io6', 33.554400, 35.395600, true, 2, '2026-10-13 19:24:23.495', '2026-10-13 19:24:23.495');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz0p000x4cinzdemytsj', 'TOWN', 'مجدليون', 'Majdelyoun', 'majdelyoun', 'cmv72kz09000j4cinly2p3io6', 33.572800, 35.408900, true, 3, '2026-10-13 19:24:23.497', '2026-10-13 19:24:23.497');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz0r000z4cinevzse4u6', 'TOWN', 'الهلالية', 'Hlalieh', 'hlalieh', 'cmv72kz09000j4cinly2p3io6', 33.565000, 35.390000, true, 4, '2026-10-13 19:24:23.499', '2026-10-13 19:24:23.499');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz0t00114cinc9pkdjtn', 'TOWN', 'الغازية', 'Ghazieh', 'ghazieh', 'cmv72kz09000j4cinly2p3io6', 33.515000, 35.370000, true, 5, '2026-10-13 19:24:23.501', '2026-10-13 19:24:23.501');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz0v00134cinvpd9z8y8', 'AREA', 'الجية', 'Jiyeh', 'jiyeh', NULL, 33.650000, 35.416700, true, 2, '2026-10-13 19:24:23.503', '2026-10-13 19:24:23.503');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz0x00154cinmhp20hy0', 'TOWN', 'الجية', 'Jiyeh', 'jiyeh-town', 'cmv72kz0v00134cinvpd9z8y8', 33.650000, 35.416700, true, 0, '2026-10-13 19:24:23.505', '2026-10-13 19:24:23.505');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz0z00174cinh548f0ew', 'NEIGHBORHOOD', 'الشاطئ', 'Beachfront', 'jiyeh-beachfront', 'cmv72kz0x00154cinmhp20hy0', NULL, NULL, true, 0, '2026-10-13 19:24:23.507', '2026-10-13 19:24:23.507');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz1100194cinpkumeip2', 'NEIGHBORHOOD', 'الجية القديمة', 'Old Village', 'jiyeh-old-village', 'cmv72kz0x00154cinmhp20hy0', NULL, NULL, true, 1, '2026-10-13 19:24:23.51', '2026-10-13 19:24:23.51');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz13001b4cinagxxz3m7', 'AREA', 'الناعمة', 'Naameh', 'naameh', NULL, 33.741800, 35.468800, true, 3, '2026-10-13 19:24:23.511', '2026-10-13 19:24:23.511');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz15001d4cinjuisdacn', 'TOWN', 'الناعمة', 'Naameh', 'naameh-town', 'cmv72kz13001b4cinagxxz3m7', 33.741800, 35.468800, true, 0, '2026-10-13 19:24:23.513', '2026-10-13 19:24:23.513');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz17001f4cinlf0sa89t', 'TOWN', 'حارة الناعمة', 'Haret En Naameh', 'haret-naameh', 'cmv72kz13001b4cinagxxz3m7', 33.736000, 35.474500, true, 1, '2026-10-13 19:24:23.515', '2026-10-13 19:24:23.515');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz19001h4cinn551sgxk', 'AREA', 'الدامور', 'Damour', 'damour', NULL, 33.724700, 35.450800, true, 4, '2026-10-13 19:24:23.517', '2026-10-13 19:24:23.517');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz1a001j4cineoj2lmh9', 'TOWN', 'الدامور', 'Damour', 'damour-town', 'cmv72kz19001h4cinn551sgxk', 33.724700, 35.450800, true, 0, '2026-10-13 19:24:23.519', '2026-10-13 19:24:23.519');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz1c001l4cinw1citir7', 'NEIGHBORHOOD', 'الساحل', 'Coast', 'damour-coast', 'cmv72kz1a001j4cineoj2lmh9', NULL, NULL, true, 0, '2026-10-13 19:24:23.52', '2026-10-13 19:24:23.52');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz1e001n4cin2lz9cfro', 'NEIGHBORHOOD', 'التلال', 'Hills', 'damour-hills', 'cmv72kz1a001j4cineoj2lmh9', NULL, NULL, true, 1, '2026-10-13 19:24:23.522', '2026-10-13 19:24:23.522');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmv72kz1g001p4cin13ky9umn', 'TOWN', 'المشرف', 'Mechref', 'mechref', 'cmv72kz19001h4cinn551sgxk', 33.715000, 35.475000, true, 1, '2026-10-13 19:24:23.524', '2026-10-13 19:24:23.524');


--
-- Data for Name: Property; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: RentalAgreement; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: AgreementAmendment; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Amenity; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('parking', 'موقف سيارة', 'Parking', '{APARTMENT,HOUSE_VILLA,COMMERCIAL}', true, 0);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('elevator', 'مصعد', 'Elevator', '{APARTMENT,HOUSE_VILLA,COMMERCIAL}', true, 1);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('balcony', 'بلكون', 'Balcony', '{APARTMENT,HOUSE_VILLA,COMMERCIAL}', true, 2);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('terrace', 'تراس', 'Terrace', '{APARTMENT,HOUSE_VILLA,COMMERCIAL}', true, 3);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('sea_view', 'إطلالة بحر', 'Sea view', '{APARTMENT,HOUSE_VILLA,LAND,COMMERCIAL}', true, 4);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('mountain_view', 'إطلالة جبل', 'Mountain view', '{APARTMENT,HOUSE_VILLA,LAND,COMMERCIAL}', true, 5);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('generator', 'اشتراك موتير', 'Generator subscription', '{APARTMENT,HOUSE_VILLA,COMMERCIAL}', true, 6);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('solar_power', 'طاقة شمسية', 'Solar power', '{APARTMENT,HOUSE_VILLA,COMMERCIAL}', true, 7);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('state_electricity', 'كهربا دولة', 'State electricity', '{APARTMENT,HOUSE_VILLA,LAND,COMMERCIAL}', true, 8);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('water_well', 'بير مي', 'Water well', '{APARTMENT,HOUSE_VILLA,LAND,COMMERCIAL}', true, 9);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('water_tank', 'خزان مي', 'Water tank', '{APARTMENT,HOUSE_VILLA,COMMERCIAL}', true, 10);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('central_heating', 'تدفئة مركزية', 'Central heating', '{APARTMENT,HOUSE_VILLA,COMMERCIAL}', true, 11);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('air_conditioning', 'مكيّفات', 'Air conditioning', '{APARTMENT,HOUSE_VILLA,COMMERCIAL}', true, 12);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('storage', 'غرفة تخزين', 'Storage room', '{APARTMENT,HOUSE_VILLA,COMMERCIAL}', true, 13);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('garden', 'حديقة', 'Garden', '{APARTMENT,HOUSE_VILLA}', true, 14);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('pool', 'مسبح', 'Pool', '{APARTMENT,HOUSE_VILLA}', true, 15);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('concierge', 'ناطور', 'Concierge', '{APARTMENT,COMMERCIAL}', true, 16);
INSERT INTO public."Amenity" (key, "labelAr", "labelEn", "appliesTo", active, "sortOrder") VALUES ('pets_allowed', 'مسموح الحيوانات الأليفة', 'Pets allowed', '{APARTMENT,HOUSE_VILLA}', true, 17);


--
-- Data for Name: AppSetting; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."AppSetting" (key, value, "updatedById", "updatedAt") VALUES ('reminders', '{"daysAfterDue": [3, 10], "daysBeforeDue": [3, 0]}', NULL, '2026-10-13 19:24:23.595');


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Lead; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Conversation; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: ConversationRead; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: DepositEntry; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Favorite; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: InternalNote; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: JobRun; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: LeadEvent; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: LegalDocument; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."LegalDocument" (id, kind, version, "bodyAr", "bodyEn", "legalReviewPending", "publishedAt") VALUES ('cmv72kz2f001r4cin20dnymoh', 'TERMS', '2026-10-draft-1', '【مسودة — بحاجة لمراجعة قانونية محلية قبل الإطلاق】

١. دار منصّة وساطة عقارية مُدارة. كل التواصل بين الزبون وفريق دار، وما في تواصل مباشر مع المالك عبر التطبيق.
٢. البيع: عمولة وساطة يدفعها البائع (حالياً ٢٫٥٪) وعمولة يدفعها الشاري (حالياً ٢٫٥٪)، وكل وحدة بتنحسب على السعر النهائي المتّفق عليه. الأرقام المعروضة تقديرية وما بتشمل الضرائب والرسوم الأخرى.
٣. الإيجار: رسوم إدارة ووساطة شهرية متكرّرة (حالياً ٥٠ دولار) بيدفعها المستأجر ضمن الإيجار الشهري طول مدة العقد، إلّا إذا اتُّفق خطياً على غير هيك.
٤. الرسوم والنِسَب المعتمدة لكل طلب أو عقد هي اللي وافقت عليها وقت الطلب أو التوقيع، ومحفوظة مع رقم نسخة الشروط.
٥. الإعلانات بتخضع لمراجعة الفريق قبل النشر.', '[DRAFT — requires local legal review before launch]

1. Dar is a managed real estate brokerage platform. All communication is between the customer and the Dar team; there is no direct owner contact through the app.
2. Sales: a brokerage commission paid by the seller (currently 2.5%) and a separate commission paid by the buyer (currently 2.5%), each calculated on the final agreed sale price. Displayed figures are estimates and exclude taxes and other charges.
3. Rentals: a recurring monthly management & brokerage fee (currently $50) paid by the tenant as part of the monthly rent for the length of the lease, unless agreed otherwise in writing.
4. The fees and rates that apply to a request or agreement are those accepted at the time, stored with the terms version.
5. Listings are reviewed by our team before publication.', true, '2026-10-13 19:24:23.559');
INSERT INTO public."LegalDocument" (id, kind, version, "bodyAr", "bodyEn", "legalReviewPending", "publishedAt") VALUES ('cmv72kz2i001s4cinnn0h9375', 'PRIVACY', '2026-10-draft-1', '【مسودة — بحاجة لمراجعة قانونية محلية قبل الإطلاق】
منجمع الاسم والإيميل ورقم التلفون لنتواصل معك بخصوص طلباتك. معلومات المالكين والعناوين الدقيقة ما بتنشر للعموم ومحصورة بالإدارة والموظف المسؤول. منحذف الصور من بيانات الموقع (GPS) عند الرفع. بتقدر تطلب حذف حسابك؛ بعض السجلات المالية بتنحفظ للمدة القانونية.', '[DRAFT — requires local legal review before launch]
We collect your name, email and phone number to contact you about your requests. Owner details and exact addresses are never published and are limited to administrators and the assigned employee. We remove location (GPS) metadata from uploaded photos. You can request account deletion; some financial records are retained for the legally required period.', true, '2026-10-13 19:24:23.563');


--
-- Data for Name: Message; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Media; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: NotificationTemplate; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('listing.approved', 'انتشر إعلانك', 'Your listing is live', 'تمت الموافقة على الإعلان {ref} وصار ظاهر للزباين.', 'Listing {ref} was approved and is now visible.', true, '2026-10-13 19:24:23.565');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('listing.rejected', 'إعلانك بحاجة لتعديل', 'Your listing needs changes', 'الإعلان {ref}: {reason}', 'Listing {ref}: {reason}', true, '2026-10-13 19:24:23.567');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('listing.revision_approved', 'تمت الموافقة على التعديلات', 'Changes approved', 'تحدّث الإعلان {ref}.', 'Listing {ref} was updated.', true, '2026-10-13 19:24:23.569');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('listing.revision_rejected', 'ما تمت الموافقة على التعديلات', 'Changes not approved', 'الإعلان {ref}: {reason}', 'Listing {ref}: {reason}', true, '2026-10-13 19:24:23.571');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('media.rejected', 'صورة بحاجة لتغيير', 'A photo needs replacing', 'الإعلان {ref}: {reason}', 'Listing {ref}: {reason}', true, '2026-10-13 19:24:23.572');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('viewing.confirmed', 'تأكّد موعد الزيارة', 'Viewing confirmed', 'موعدك {date}. شوف التفاصيل بالتطبيق.', 'Your viewing is on {date}. See details in the app.', true, '2026-10-13 19:24:23.574');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('viewing.cancelled', 'انلغت الزيارة', 'Viewing cancelled', 'فريقنا رح يتواصل معك لموعد جديد.', 'Our team will contact you about a new time.', true, '2026-10-13 19:24:23.576');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('message.new', 'رسالة جديدة من فريق {brand}', 'New message from the {brand} team', 'افتح التطبيق لتقرأ الرسالة.', 'Open the app to read it.', true, '2026-10-13 19:24:23.577');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('rent.reminder.before', 'تذكير بالإيجار', 'Rent reminder', 'الإيجار {amount} مستحق بتاريخ {date}.', 'Rent of {amount} is due on {date}.', true, '2026-10-13 19:24:23.579');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('rent.reminder.after', 'الإيجار متأخّر', 'Rent overdue', 'الإيجار {amount} كان مستحق بتاريخ {date}. تواصل معنا إذا في شي.', 'Rent of {amount} was due on {date}. Contact us if anything is wrong.', true, '2026-10-13 19:24:23.581');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('rent.payment_received', 'استلمنا دفعتك', 'Payment received', 'رقم الإيصال {receipt}.', 'Receipt {receipt}.', true, '2026-10-13 19:24:23.582');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('payout.recorded', 'حوّلنالك الإيجار', 'Rent transferred to you', 'سجّلنا تحويل {ref}. شوف كشف الحساب.', 'Payout {ref} recorded. See your statement.', true, '2026-10-13 19:24:23.584');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('rental.activated', 'صار عقد الإيجار ساري', 'Lease is active', 'العقد {ref} صار ساري.', 'Lease {ref} is now active.', true, '2026-10-13 19:24:23.585');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('sale.closed', 'تمّ البيع', 'Sale completed', 'سجّلنا البيع {ref}.', 'Sale {ref} has been recorded.', true, '2026-10-13 19:24:23.587');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('staff.viewing_requested', 'طلب زيارة جديد', 'New viewing request', 'على الإعلان {ref}.', 'For listing {ref}.', true, '2026-10-13 19:24:23.588');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('staff.viewing_rescheduled', 'زبون غيّر موعد زيارة', 'Viewing rescheduled', 'راجع الأوقات الجديدة.', 'Review the new preferred times.', true, '2026-10-13 19:24:23.59');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('staff.new_message', 'رسالة جديدة من زبون', 'New customer message', 'افتح المحادثة للرد.', 'Open the conversation to reply.', true, '2026-10-13 19:24:23.591');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('staff.lead_assigned', 'تعيّنلك عميل جديد', 'New lead assigned', 'شوف التفاصيل بلوحة التحكم.', 'See details in the dashboard.', true, '2026-10-13 19:24:23.593');


--
-- Data for Name: Offer; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: OwnerPayout; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: RentObligation; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: OwnerPayoutLine; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: PasswordResetToken; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: PricingSettings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."PricingSettings" (id, version, "saleBuyerBps", "saleSellerBps", "rentalMonthlyFeeCents", "rentalPricingMode", "termsVersion", "changeReason", "createdById", "createdAt") VALUES ('cmv72kz2d001q4cinj4rrnpdt', 1, 250, 250, 5000, 'NET_PLUS_FEE', '2026-10-draft-1', 'Initial defaults: 2.5% seller + 2.5% buyer; $50/month rental fee paid by tenant', NULL, '2026-10-13 19:24:23.558');


--
-- Data for Name: PropertyRevision; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: PushToken; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: ReminderSend; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: RentLedgerEntry; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Report; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: SaleClosing; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: SaleObligation; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: SaleLedgerEntry; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: ViewingRequest; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: OwnerPayout_refNo_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."OwnerPayout_refNo_seq"', 1, false);


--
-- Name: Property_refNo_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Property_refNo_seq"', 1, false);


--
-- Name: RentLedgerEntry_receiptNo_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."RentLedgerEntry_receiptNo_seq"', 1, false);


--
-- Name: RentalAgreement_refNo_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."RentalAgreement_refNo_seq"', 1, false);


--
-- Name: SaleClosing_refNo_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."SaleClosing_refNo_seq"', 1, false);


--
-- Name: SaleLedgerEntry_receiptNo_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."SaleLedgerEntry_receiptNo_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

\unrestrict fVyNf7wqkMPoSUjGatby82JckzuEqbkTFgfdebO9eeZZaciiPmDDL3Ux7kTbMUY

