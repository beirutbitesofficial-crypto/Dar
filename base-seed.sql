--
-- PostgreSQL database dump
--

\restrict BlHeQk5thaCNzcKAD5JBkHbB9GimoclwrZmWSmVRSoRE8qcTQGlxAdlbeyCHWbM

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

INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u05x00010cmiozkx1vb5', 'AREA', 'إقليم الخروب', 'Iqlim El Kharroub', 'iqlim-el-kharroub', NULL, 33.645000, 35.450000, true, 0, '2026-10-21 15:32:50.133', '2026-10-21 15:32:50.133');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06300030cmiomi2ha9o', 'TOWN', 'برجا', 'Barja', 'barja', 'cmvi9u05x00010cmiozkx1vb5', 33.645000, 35.440000, true, 0, '2026-10-21 15:32:50.139', '2026-10-21 15:32:50.139');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06600050cmitsaxk0wj', 'TOWN', 'شحيم', 'Chehim', 'chehim', 'cmvi9u05x00010cmiozkx1vb5', 33.623300, 35.480800, true, 1, '2026-10-21 15:32:50.142', '2026-10-21 15:32:50.142');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06a00070cmiwpy93iei', 'TOWN', 'كترمايا', 'Ketermaya', 'ketermaya', 'cmvi9u05x00010cmiozkx1vb5', 33.691100, 35.445600, true, 2, '2026-10-21 15:32:50.147', '2026-10-21 15:32:50.147');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06d00090cmic0rjr9uy', 'TOWN', 'سبلين', 'Sibline', 'sibline', 'cmvi9u05x00010cmiozkx1vb5', 33.632500, 35.436100, true, 3, '2026-10-21 15:32:50.149', '2026-10-21 15:32:50.149');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06f000b0cmiil3fn8a1', 'TOWN', 'المغيرية', 'Mghairieh', 'mghairieh', 'cmvi9u05x00010cmiozkx1vb5', 33.655000, 35.470800, true, 4, '2026-10-21 15:32:50.151', '2026-10-21 15:32:50.151');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06h000d0cmiwnmkrr01', 'TOWN', 'دلهون', 'Dalhoun', 'dalhoun', 'cmvi9u05x00010cmiozkx1vb5', 33.660800, 35.469700, true, 5, '2026-10-21 15:32:50.153', '2026-10-21 15:32:50.153');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06j000f0cmi7qxh5vtb', 'TOWN', 'الجدرا', 'Jadra', 'jadra', 'cmvi9u05x00010cmiozkx1vb5', 33.613100, 35.410000, true, 6, '2026-10-21 15:32:50.156', '2026-10-21 15:32:50.156');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06m000h0cmimi7d3jk0', 'TOWN', 'الوردانية', 'Wardaniyeh', 'wardaniyeh', 'cmvi9u05x00010cmiozkx1vb5', 33.623600, 35.426700, true, 7, '2026-10-21 15:32:50.158', '2026-10-21 15:32:50.158');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06o000j0cmi0ka8acdm', 'AREA', 'صيدا', 'Saida', 'saida', NULL, 33.563100, 35.368900, true, 1, '2026-10-21 15:32:50.16', '2026-10-21 15:32:50.16');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06q000l0cmih1k11h6l', 'TOWN', 'صيدا المدينة', 'Saida City', 'saida-city', 'cmvi9u06o000j0cmi0ka8acdm', 33.563100, 35.368900, true, 0, '2026-10-21 15:32:50.162', '2026-10-21 15:32:50.162');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06s000n0cmi5vjtt3o8', 'NEIGHBORHOOD', 'البلدة القديمة', 'Old City', 'saida-old-city', 'cmvi9u06q000l0cmih1k11h6l', NULL, NULL, true, 0, '2026-10-21 15:32:50.164', '2026-10-21 15:32:50.164');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06u000p0cmiqff8qtmr', 'NEIGHBORHOOD', 'الواجهة البحرية', 'Seafront', 'saida-seafront', 'cmvi9u06q000l0cmih1k11h6l', NULL, NULL, true, 1, '2026-10-21 15:32:50.166', '2026-10-21 15:32:50.166');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06w000r0cmi2h8nohyd', 'NEIGHBORHOOD', 'الدكرمان', 'Dekerman', 'saida-dekerman', 'cmvi9u06q000l0cmih1k11h6l', NULL, NULL, true, 2, '2026-10-21 15:32:50.168', '2026-10-21 15:32:50.168');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u06y000t0cmi5bw07hp1', 'TOWN', 'حارة صيدا', 'Haret Saida', 'haret-saida', 'cmvi9u06o000j0cmi0ka8acdm', 33.558300, 35.383600, true, 1, '2026-10-21 15:32:50.17', '2026-10-21 15:32:50.17');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u070000v0cmiuw89k61k', 'TOWN', 'عبرا', 'Abra', 'abra', 'cmvi9u06o000j0cmi0ka8acdm', 33.554400, 35.395600, true, 2, '2026-10-21 15:32:50.172', '2026-10-21 15:32:50.172');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u072000x0cmi04k48qg0', 'TOWN', 'مجدليون', 'Majdelyoun', 'majdelyoun', 'cmvi9u06o000j0cmi0ka8acdm', 33.572800, 35.408900, true, 3, '2026-10-21 15:32:50.174', '2026-10-21 15:32:50.174');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u073000z0cmi9ugbam80', 'TOWN', 'الهلالية', 'Hlalieh', 'hlalieh', 'cmvi9u06o000j0cmi0ka8acdm', 33.565000, 35.390000, true, 4, '2026-10-21 15:32:50.176', '2026-10-21 15:32:50.176');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u07600110cmixyh7zz0t', 'TOWN', 'الغازية', 'Ghazieh', 'ghazieh', 'cmvi9u06o000j0cmi0ka8acdm', 33.515000, 35.370000, true, 5, '2026-10-21 15:32:50.178', '2026-10-21 15:32:50.178');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u07700130cmihx3rtgnz', 'AREA', 'الجية', 'Jiyeh', 'jiyeh', NULL, 33.650000, 35.416700, true, 2, '2026-10-21 15:32:50.18', '2026-10-21 15:32:50.18');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u07900150cmi2lygqgik', 'TOWN', 'الجية', 'Jiyeh', 'jiyeh-town', 'cmvi9u07700130cmihx3rtgnz', 33.650000, 35.416700, true, 0, '2026-10-21 15:32:50.182', '2026-10-21 15:32:50.182');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u07b00170cmi8tw9okoa', 'NEIGHBORHOOD', 'الشاطئ', 'Beachfront', 'jiyeh-beachfront', 'cmvi9u07900150cmi2lygqgik', NULL, NULL, true, 0, '2026-10-21 15:32:50.183', '2026-10-21 15:32:50.183');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u07d00190cmicn1vl10b', 'NEIGHBORHOOD', 'الجية القديمة', 'Old Village', 'jiyeh-old-village', 'cmvi9u07900150cmi2lygqgik', NULL, NULL, true, 1, '2026-10-21 15:32:50.185', '2026-10-21 15:32:50.185');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u07f001b0cmidroaxh97', 'AREA', 'الناعمة', 'Naameh', 'naameh', NULL, 33.741800, 35.468800, true, 3, '2026-10-21 15:32:50.187', '2026-10-21 15:32:50.187');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u07g001d0cmi9kh1a4q6', 'TOWN', 'الناعمة', 'Naameh', 'naameh-town', 'cmvi9u07f001b0cmidroaxh97', 33.741800, 35.468800, true, 0, '2026-10-21 15:32:50.189', '2026-10-21 15:32:50.189');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u07i001f0cmi36pbig58', 'TOWN', 'حارة الناعمة', 'Haret En Naameh', 'haret-naameh', 'cmvi9u07f001b0cmidroaxh97', 33.736000, 35.474500, true, 1, '2026-10-21 15:32:50.19', '2026-10-21 15:32:50.19');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u07k001h0cmi3501j0t3', 'AREA', 'الدامور', 'Damour', 'damour', NULL, 33.724700, 35.450800, true, 4, '2026-10-21 15:32:50.192', '2026-10-21 15:32:50.192');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u07l001j0cmi0h0dbm0p', 'TOWN', 'الدامور', 'Damour', 'damour-town', 'cmvi9u07k001h0cmi3501j0t3', 33.724700, 35.450800, true, 0, '2026-10-21 15:32:50.194', '2026-10-21 15:32:50.194');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u07n001l0cmisjhrd26q', 'NEIGHBORHOOD', 'الساحل', 'Coast', 'damour-coast', 'cmvi9u07l001j0cmi0h0dbm0p', NULL, NULL, true, 0, '2026-10-21 15:32:50.196', '2026-10-21 15:32:50.196');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u07p001n0cmifiooanh5', 'NEIGHBORHOOD', 'التلال', 'Hills', 'damour-hills', 'cmvi9u07l001j0cmi0h0dbm0p', NULL, NULL, true, 1, '2026-10-21 15:32:50.197', '2026-10-21 15:32:50.197');
INSERT INTO public."Location" (id, kind, "nameAr", "nameEn", slug, "parentId", lat, lng, active, "sortOrder", "createdAt", "updatedAt") VALUES ('cmvi9u07r001p0cmi0wayt1kx', 'TOWN', 'المشرف', 'Mechref', 'mechref', 'cmvi9u07k001h0cmi3501j0t3', 33.715000, 35.475000, true, 1, '2026-10-21 15:32:50.199', '2026-10-21 15:32:50.199');


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

INSERT INTO public."AppSetting" (key, value, "updatedById", "updatedAt") VALUES ('reminders', '{"daysAfterDue": [3, 10], "daysBeforeDue": [3, 0]}', NULL, '2026-10-21 15:32:50.262');


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

INSERT INTO public."LegalDocument" (id, kind, version, "bodyAr", "bodyEn", "legalReviewPending", "publishedAt") VALUES ('cmvi9u08m001r0cmi1zqf7jpq', 'TERMS', '2026-10-draft-1', '【مسودة — بحاجة لمراجعة قانونية محلية قبل الإطلاق】

١. دار منصّة وساطة عقارية مُدارة. كل التواصل بين الزبون وفريق دار، وما في تواصل مباشر مع المالك عبر التطبيق.
٢. البيع: عمولة وساطة يدفعها البائع (حالياً ٢٫٥٪) وعمولة يدفعها الشاري (حالياً ٢٫٥٪)، وكل وحدة بتنحسب على السعر النهائي المتّفق عليه. الأرقام المعروضة تقديرية وما بتشمل الضرائب والرسوم الأخرى.
٣. الإيجار: رسوم إدارة ووساطة شهرية متكرّرة (حالياً ٥٠ دولار) بيدفعها المستأجر ضمن الإيجار الشهري طول مدة العقد، إلّا إذا اتُّفق خطياً على غير هيك.
٤. الرسوم والنِسَب المعتمدة لكل طلب أو عقد هي اللي وافقت عليها وقت الطلب أو التوقيع، ومحفوظة مع رقم نسخة الشروط.
٥. الإعلانات بتخضع لمراجعة الفريق قبل النشر.', '[DRAFT — requires local legal review before launch]

1. Dar is a managed real estate brokerage platform. All communication is between the customer and the Dar team; there is no direct owner contact through the app.
2. Sales: a brokerage commission paid by the seller (currently 2.5%) and a separate commission paid by the buyer (currently 2.5%), each calculated on the final agreed sale price. Displayed figures are estimates and exclude taxes and other charges.
3. Rentals: a recurring monthly management & brokerage fee (currently $50) paid by the tenant as part of the monthly rent for the length of the lease, unless agreed otherwise in writing.
4. The fees and rates that apply to a request or agreement are those accepted at the time, stored with the terms version.
5. Listings are reviewed by our team before publication.', true, '2026-10-21 15:32:50.231');
INSERT INTO public."LegalDocument" (id, kind, version, "bodyAr", "bodyEn", "legalReviewPending", "publishedAt") VALUES ('cmvi9u08p001s0cmisiyn1uh8', 'PRIVACY', '2026-10-draft-1', '【مسودة — بحاجة لمراجعة قانونية محلية قبل الإطلاق】
منجمع الاسم والإيميل ورقم التلفون لنتواصل معك بخصوص طلباتك. معلومات المالكين والعناوين الدقيقة ما بتنشر للعموم ومحصورة بالإدارة والموظف المسؤول. منحذف الصور من بيانات الموقع (GPS) عند الرفع. بتقدر تطلب حذف حسابك؛ بعض السجلات المالية بتنحفظ للمدة القانونية.', '[DRAFT — requires local legal review before launch]
We collect your name, email and phone number to contact you about your requests. Owner details and exact addresses are never published and are limited to administrators and the assigned employee. We remove location (GPS) metadata from uploaded photos. You can request account deletion; some financial records are retained for the legally required period.', true, '2026-10-21 15:32:50.234');


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

INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('listing.approved', 'انتشر إعلانك', 'Your listing is live', 'تمت الموافقة على الإعلان {ref} وصار ظاهر للزباين.', 'Listing {ref} was approved and is now visible.', true, '2026-10-21 15:32:50.236');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('listing.rejected', 'إعلانك بحاجة لتعديل', 'Your listing needs changes', 'الإعلان {ref}: {reason}', 'Listing {ref}: {reason}', true, '2026-10-21 15:32:50.238');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('listing.revision_approved', 'تمت الموافقة على التعديلات', 'Changes approved', 'تحدّث الإعلان {ref}.', 'Listing {ref} was updated.', true, '2026-10-21 15:32:50.239');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('listing.revision_rejected', 'ما تمت الموافقة على التعديلات', 'Changes not approved', 'الإعلان {ref}: {reason}', 'Listing {ref}: {reason}', true, '2026-10-21 15:32:50.241');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('media.rejected', 'صورة بحاجة لتغيير', 'A photo needs replacing', 'الإعلان {ref}: {reason}', 'Listing {ref}: {reason}', true, '2026-10-21 15:32:50.242');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('viewing.confirmed', 'تأكّد موعد الزيارة', 'Viewing confirmed', 'موعدك {date}. شوف التفاصيل بالتطبيق.', 'Your viewing is on {date}. See details in the app.', true, '2026-10-21 15:32:50.243');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('viewing.cancelled', 'انلغت الزيارة', 'Viewing cancelled', 'فريقنا رح يتواصل معك لموعد جديد.', 'Our team will contact you about a new time.', true, '2026-10-21 15:32:50.245');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('message.new', 'رسالة جديدة من فريق {brand}', 'New message from the {brand} team', 'افتح التطبيق لتقرأ الرسالة.', 'Open the app to read it.', true, '2026-10-21 15:32:50.246');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('rent.reminder.before', 'تذكير بالإيجار', 'Rent reminder', 'الإيجار {amount} مستحق بتاريخ {date}.', 'Rent of {amount} is due on {date}.', true, '2026-10-21 15:32:50.248');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('rent.reminder.after', 'الإيجار متأخّر', 'Rent overdue', 'الإيجار {amount} كان مستحق بتاريخ {date}. تواصل معنا إذا في شي.', 'Rent of {amount} was due on {date}. Contact us if anything is wrong.', true, '2026-10-21 15:32:50.249');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('rent.payment_received', 'استلمنا دفعتك', 'Payment received', 'رقم الإيصال {receipt}.', 'Receipt {receipt}.', true, '2026-10-21 15:32:50.251');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('payout.recorded', 'حوّلنالك الإيجار', 'Rent transferred to you', 'سجّلنا تحويل {ref}. شوف كشف الحساب.', 'Payout {ref} recorded. See your statement.', true, '2026-10-21 15:32:50.252');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('rental.activated', 'صار عقد الإيجار ساري', 'Lease is active', 'العقد {ref} صار ساري.', 'Lease {ref} is now active.', true, '2026-10-21 15:32:50.254');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('sale.closed', 'تمّ البيع', 'Sale completed', 'سجّلنا البيع {ref}.', 'Sale {ref} has been recorded.', true, '2026-10-21 15:32:50.255');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('staff.viewing_requested', 'طلب زيارة جديد', 'New viewing request', 'على الإعلان {ref}.', 'For listing {ref}.', true, '2026-10-21 15:32:50.256');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('staff.viewing_rescheduled', 'زبون غيّر موعد زيارة', 'Viewing rescheduled', 'راجع الأوقات الجديدة.', 'Review the new preferred times.', true, '2026-10-21 15:32:50.258');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('staff.new_message', 'رسالة جديدة من زبون', 'New customer message', 'افتح المحادثة للرد.', 'Open the conversation to reply.', true, '2026-10-21 15:32:50.259');
INSERT INTO public."NotificationTemplate" (key, "titleAr", "titleEn", "bodyAr", "bodyEn", active, "updatedAt") VALUES ('staff.lead_assigned', 'تعيّنلك عميل جديد', 'New lead assigned', 'شوف التفاصيل بلوحة التحكم.', 'See details in the dashboard.', true, '2026-10-21 15:32:50.261');


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

INSERT INTO public."PricingSettings" (id, version, "saleBuyerBps", "saleSellerBps", "rentalMonthlyFeeCents", "rentalPricingMode", "termsVersion", "changeReason", "createdById", "createdAt") VALUES ('cmvi9u08l001q0cmiw1sh4jxz', 1, 250, 250, 5000, 'NET_PLUS_FEE', '2026-10-draft-1', 'Initial defaults: 2.5% seller + 2.5% buyer; $50/month rental fee paid by tenant', NULL, '2026-10-21 15:32:50.229');


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

\unrestrict BlHeQk5thaCNzcKAD5JBkHbB9GimoclwrZmWSmVRSoRE8qcTQGlxAdlbeyCHWbM

