import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { MapView, Marker } from '@/components/map';
import {
  AMENITIES_BY_TYPE,
  FIELD_APPLICABILITY,
  formatBasisPoints,
  formatUSD,
  hasLikelyContactInfo,
  missingForSubmission,
  normalizeLebanesePhone,
  ownerRentalPreview,
  ownerSaleEstimate,
  parseMoneyInput,
  PropertyType,
  type ListingType,
} from '@dar/shared';
import { Line } from '@/components/listing';
import { Badge, Button, Card, Chip, ErrorState, Field, Loading, Row, Screen, Segmented, Text } from '@/components/ui';
import { del, get, post, put } from '@/lib/api';
import { useLocations, useSettings } from '@/lib/hooks';
import { useI18n } from '@/lib/i18n';
import { colors, radius, space } from '@/lib/theme';
import { uploadAsset, type UploadKind } from '@/lib/upload';

const STEPS = ['basics', 'location', 'details', 'price', 'media', 'contact', 'review'] as const;
type Step = (typeof STEPS)[number];

interface MediaItem { id: string; kind: string; url: string | null; isCover: boolean; reviewStatus: string; fileName: string }
interface LocalUpload { key: string; kind: UploadKind; uri: string; progress: number; failed?: boolean; asset: any }

export default function ListingWizard() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const { dict, locale, err } = useI18n();
  const qc = useQueryClient();
  const settings = useSettings();
  const locations = useLocations();
  const [id, setId] = useState<string | null>(routeId === 'new' ? null : routeId);
  const [step, setStep] = useState<Step>('basics');
  const [d, setD] = useState<Record<string, any>>({ listingType: 'RENT' as ListingType, amenities: [] });
  const [status, setStatus] = useState('DRAFT');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploads, setUploads] = useState<LocalUpload[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceText, setPriceText] = useState('');

  const load = async (pid: string) => {
    const p = await get<any>(`/v1/owner/properties/${pid}`);
    setD({ ...p });
    setStatus(p.status);
    setMedia(p.media);
    setPriceText(p.priceCents ? String(p.priceCents / 100) : '');
  };
  useEffect(() => {
    if (id) load(id).catch((e) => setError(err(e.code))).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: string, v: any) => setD((s) => ({ ...s, [k]: v }));
  const type = d.propertyType as PropertyType | undefined;
  const applicable = type ? FIELD_APPLICABILITY[type].applicable : [];
  const name = (l: { nameAr: string; nameEn: string }) => (locale === 'ar' ? l.nameAr : l.nameEn);
  const areas = (locations.data ?? []).filter((l) => l.kind === 'AREA');
  const towns = (locations.data ?? []).filter((l) => l.kind === 'TOWN' && l.parentId === d.areaId);
  const hoods = (locations.data ?? []).filter((l) => l.kind === 'NEIGHBORHOOD' && l.parentId === d.townId);
  const town = (locations.data ?? []).find((l) => l.id === d.townId);
  const textHasContact = useMemo(() => hasLikelyContactInfo([d.titleAr, d.titleEn, d.descriptionAr, d.descriptionEn].filter(Boolean).join('\n')), [d.titleAr, d.titleEn, d.descriptionAr, d.descriptionEn]);

  /** Fields sent to the API — only what the owner can edit. */
  const payload = () => {
    const keys = ['listingType', 'propertyType', 'titleAr', 'titleEn', 'descriptionAr', 'descriptionEn', 'areaId', 'townId', 'neighborhoodId', 'exactAddress', 'latitude', 'longitude', 'priceCents', 'sizeSqm', 'bedrooms', 'bathrooms', 'floor', 'totalFloors', 'furnished', 'amenities', 'otherAmenities', 'availableFrom', 'ownerContactName', 'ownerContactPhone', 'ownerContactEmail', 'ownerNotesForStaff'];
    const out: Record<string, any> = {};
    for (const k of keys) if (d[k] !== undefined && d[k] !== null && d[k] !== '') out[k] = d[k];
    if (out.ownerContactPhone) out.ownerContactPhone = String(out.ownerContactPhone);
    return out;
  };

  const save = async (): Promise<string | null> => {
    setSaving(true);
    setError(null);
    try {
      const body = payload();
      const res = id ? await put<any>(`/v1/owner/properties/${id}`, body) : await post<any>('/v1/owner/properties', body);
      setId(res.id);
      setStatus(res.status);
      setMedia(res.media);
      qc.invalidateQueries({ queryKey: ['owner-listings'] });
      return res.id;
    } catch (e: any) {
      const field = e.details?.fields?.[0];
      setError(field ? `${field.path}: ${err(field.code)}` : err(e.code));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const go = async (dir: 1 | -1) => {
    const i = STEPS.indexOf(step);
    // A draft must exist before uploading media.
    if (dir === 1 && (STEPS[i + 1] === 'media' || step === 'price' || step === 'contact')) {
      if (!(await save())) return;
    }
    setStep(STEPS[Math.min(STEPS.length - 1, Math.max(0, i + dir))]!);
  };

  // ------------------------------------------------------------- uploads
  const startUpload = async (u: LocalUpload, pid: string) => {
    setUploads((s) => s.map((x) => (x.key === u.key ? { ...x, progress: 0, failed: false } : x)));
    try {
      const m = await uploadAsset(u.kind, u.asset, { propertyId: pid }, (p) => setUploads((s) => s.map((x) => (x.key === u.key ? { ...x, progress: p } : x))));
      setUploads((s) => s.filter((x) => x.key !== u.key));
      setMedia((s) => [...s, { ...(m as any), kind: u.kind, reviewStatus: 'PENDING', fileName: u.asset.fileName ?? '' }]);
    } catch (e: any) {
      setUploads((s) => s.map((x) => (x.key === u.key ? { ...x, failed: true } : x)));
      if (e.code === 'UPLOAD_TOO_LARGE' || e.code === 'UPLOAD_TYPE') Alert.alert(err(e.code));
    }
  };

  const pick = async (kind: 'PHOTO' | 'VIDEO' | 'DOCUMENT') => {
    const pid = id ?? (await save());
    if (!pid) return;
    let assets: any[] = [];
    if (kind === 'DOCUMENT') {
      const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], multiple: true, copyToCacheDirectory: true });
      if (r.canceled) return;
      assets = r.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType, fileName: a.name, fileSize: a.size }));
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      // EXIF is not requested from the picker; the server strips any remaining metadata.
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: kind === 'PHOTO' ? ['images'] : ['videos'], allowsMultipleSelection: kind === 'PHOTO', selectionLimit: 15, exif: false, quality: 1 });
      if (r.canceled) return;
      assets = r.assets;
    }
    const items = assets.map((a, i) => ({ key: `${Date.now()}-${i}`, kind, uri: a.uri, progress: 0, asset: a }) as LocalUpload);
    setUploads((s) => [...s, ...items]);
    for (const u of items) await startUpload(u, pid); // sequential: gentler on mobile networks
  };

  const photos = media.filter((m) => m.kind === 'PHOTO');
  const reorder = async (from: number, to: number) => {
    if (!id || to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m!);
    setMedia([...next, ...media.filter((x) => x.kind !== 'PHOTO')]);
    await put(`/v1/owner/properties/${id}/media/order`, { orderedIds: next.map((p) => p.id), coverId: next.find((p) => p.isCover)?.id ?? next[0]!.id }).catch(() => undefined);
  };
  const setCover = async (mid: string) => {
    if (!id) return;
    setMedia((s) => s.map((m) => ({ ...m, isCover: m.id === mid })));
    await put(`/v1/owner/properties/${id}/media/order`, { orderedIds: photos.map((p) => p.id), coverId: mid });
  };
  const remove = async (mid: string) => {
    await del(`/v1/uploads/${mid}`);
    if (id) await load(id);
  };

  const submit = async () => {
    const pid = await save();
    if (!pid) return;
    setSaving(true);
    try {
      await post(`/v1/owner/properties/${pid}/submit`);
      qc.invalidateQueries({ queryKey: ['owner-listings'] });
      Alert.alert(dict.owner.submitted, dict.owner.submittedBody);
      router.replace(`/owner/${pid}`);
    } catch (e: any) {
      setError(e.details?.missing ? `${dict.owner.missingFields} ${e.details.missing.map((m: string) => label(m)).join('، ')}` : err(e.code));
    } finally {
      setSaving(false);
    }
  };

  const label = (k: string) =>
    ({ titleAr: dict.owner.titleAr, descriptionAr: dict.owner.descriptionAr, areaId: dict.search.location, townId: dict.search.location, exactAddress: dict.owner.exactAddress, priceCents: dict.owner.askingPrice, ownerContactPhone: dict.owner.contactPhone, photos: dict.owner.photos, coverPhoto: dict.owner.setCover, sizeSqm: dict.property.size, bedrooms: dict.property.bedrooms, bathrooms: dict.property.bathrooms, floor: dict.property.floor, listingType: dict.search.title, propertyType: dict.search.propertyType } as Record<string, string>)[k] ?? k;

  if (loading || settings.isLoading) return <Screen><Loading /></Screen>;
  if (!settings.data) return <Screen><ErrorState error={settings.error} onRetry={settings.refetch} /></Screen>;
  const s = settings.data;
  const price = d.priceCents as number | undefined;
  const missing = missingForSubmission({ ...d, priceCents: price, photoCount: photos.length, hasCover: photos.some((p) => p.isCover) });
  const published = ['PUBLISHED', 'PAUSED'].includes(status);
  const num = (k: string) => (v: string) => set(k, v.replace(/[^\d-]/g, '') === '' ? null : Number(v.replace(/[^\d-]/g, '')));

  return (
    <Screen edges={['bottom']}>
      {/* Step indicator */}
      <Row style={{ marginBottom: space.lg, flexWrap: 'wrap' }} >
        {STEPS.map((st, i) => (
          <Pressable key={st} onPress={() => (id || i === 0) && setStep(st)} accessibilityRole="tab" accessibilityState={{ selected: st === step }} style={[styles.step, st === step && styles.stepActive]}>
            <Text variant="caption" style={{ color: st === step ? colors.surface : colors.textMuted }}>{i + 1}. {dict.owner.steps[st]}</Text>
          </Pressable>
        ))}
      </Row>
      {published && <Text variant="small" style={{ color: colors.warning, marginBottom: space.md }}>{dict.owner.pendingRevision}</Text>}

      {step === 'basics' && (
        <>
          <Segmented value={d.listingType} onChange={(v) => !published && set('listingType', v)} options={[{ value: 'RENT', label: dict.listingType.RENT }, { value: 'SALE', label: dict.listingType.SALE }]} />
          <Text variant="heading" style={{ marginTop: space.lg }}>{dict.search.propertyType}</Text>
          <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
            {Object.values(PropertyType).map((p) => <Chip key={p} label={dict.propertyType[p]} selected={type === p} onPress={() => set('propertyType', p)} />)}
          </Row>
          <Text variant="small" style={{ color: colors.text, marginVertical: space.md }}>{dict.owner.noContactInText}</Text>
          <Field label={dict.owner.titleAr} value={d.titleAr ?? ''} onChangeText={(v) => set('titleAr', v)} maxLength={120} />
          <Field label={`${dict.owner.titleEn} (${dict.common.optional})`} value={d.titleEn ?? ''} onChangeText={(v) => set('titleEn', v)} maxLength={120} />
          <Field label={dict.owner.descriptionAr} value={d.descriptionAr ?? ''} onChangeText={(v) => set('descriptionAr', v)} multiline maxLength={4000} />
          <Field label={`${dict.owner.descriptionEn} (${dict.common.optional})`} value={d.descriptionEn ?? ''} onChangeText={(v) => set('descriptionEn', v)} multiline maxLength={4000} />
          {textHasContact && <Text variant="small" style={{ color: colors.warning }} accessibilityRole="alert">⚠ {dict.owner.contactDetected}</Text>}
        </>
      )}

      {step === 'location' && (
        <>
          <Text variant="heading">{dict.search.location}</Text>
          <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
            {areas.map((a) => <Chip key={a.id} label={name(a)} selected={d.areaId === a.id} onPress={() => setD((x) => ({ ...x, areaId: a.id, townId: null, neighborhoodId: null }))} />)}
          </Row>
          {towns.length > 0 && <Row style={{ flexWrap: 'wrap', marginBottom: space.sm }}>{towns.map((t) => <Chip key={t.id} label={name(t)} selected={d.townId === t.id} onPress={() => setD((x) => ({ ...x, townId: t.id, neighborhoodId: null }))} />)}</Row>}
          {hoods.length > 0 && <Row style={{ flexWrap: 'wrap', marginBottom: space.md }}>{hoods.map((h) => <Chip key={h.id} label={name(h)} selected={d.neighborhoodId === h.id} onPress={() => set('neighborhoodId', d.neighborhoodId === h.id ? null : h.id)} />)}</Row>}
          <Field label={dict.owner.exactAddress} hint={dict.owner.exactAddressHint} value={d.exactAddress ?? ''} onChangeText={(v) => set('exactAddress', v)} multiline maxLength={300} />
          <Text variant="small" style={{ color: colors.text, marginBottom: space.sm }}>{dict.owner.pinOnMap}</Text>
          <MapView
            style={{ height: 220, borderRadius: radius.lg }}
            initialRegion={{ latitude: d.latitude ?? town?.lat ?? 33.64, longitude: d.longitude ?? town?.lng ?? 35.43, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
            onPress={(e) => setD((x) => ({ ...x, latitude: Number(e.nativeEvent.coordinate.latitude.toFixed(6)), longitude: Number(e.nativeEvent.coordinate.longitude.toFixed(6)) }))}
          >
            {d.latitude && <Marker coordinate={{ latitude: d.latitude, longitude: d.longitude }} pinColor={colors.primary} />}
          </MapView>
          <Text variant="caption" style={{ marginTop: 6 }}>{dict.owner.exactAddressHint}</Text>
        </>
      )}

      {step === 'details' && (
        <>
          {!type ? <Text variant="small">{dict.search.propertyType}</Text> : (
            <>
              <Field label={`${dict.property.size} (${dict.common.sqm})`} keyboardType="numeric" value={d.sizeSqm?.toString() ?? ''} onChangeText={num('sizeSqm')} />
              {applicable.includes('bedrooms') && <Field label={dict.property.bedrooms} keyboardType="numeric" value={d.bedrooms?.toString() ?? ''} onChangeText={num('bedrooms')} />}
              {applicable.includes('bathrooms') && <Field label={dict.property.bathrooms} keyboardType="numeric" value={d.bathrooms?.toString() ?? ''} onChangeText={num('bathrooms')} />}
              {applicable.includes('floor') && <Field label={dict.property.floor} keyboardType="numbers-and-punctuation" value={d.floor?.toString() ?? ''} onChangeText={num('floor')} />}
              {applicable.includes('totalFloors') && <Field label={dict.property.totalFloors} keyboardType="numeric" value={d.totalFloors?.toString() ?? ''} onChangeText={num('totalFloors')} />}
              {applicable.includes('furnished') && (
                <Row style={{ marginBottom: space.lg }}>
                  <Chip label={dict.search.furnished} selected={d.furnished === true} onPress={() => set('furnished', true)} />
                  <Chip label={dict.search.unfurnished} selected={d.furnished === false} onPress={() => set('furnished', false)} />
                </Row>
              )}
              <Text variant="heading">{dict.property.amenities}</Text>
              <Row style={{ flexWrap: 'wrap', marginVertical: space.sm }}>
                {AMENITIES_BY_TYPE[type].map((a) => (
                  <Chip key={a} label={(dict.amenities as any)[a]} selected={(d.amenities ?? []).includes(a)} onPress={() => set('amenities', (d.amenities ?? []).includes(a) ? d.amenities.filter((x: string) => x !== a) : [...(d.amenities ?? []), a])} />
                ))}
              </Row>
              <Field label={`${dict.property.amenities} — ${dict.common.optional}`} value={d.otherAmenities ?? ''} onChangeText={(v) => set('otherAmenities', v)} maxLength={300} />
              <Field label={`${dict.property.availableFrom} (YYYY-MM-DD)`} value={d.availableFrom ?? ''} onChangeText={(v) => set('availableFrom', v || null)} placeholder="2026-11-01" keyboardType="numbers-and-punctuation" />
            </>
          )}
        </>
      )}

      {step === 'price' && (
        <>
          <Field
            label={d.listingType === 'SALE' ? dict.owner.askingPrice : s.rentalPricingMode === 'NET_PLUS_FEE' ? dict.owner.netRent : dict.owner.totalRent}
            keyboardType="decimal-pad"
            value={priceText}
            onChangeText={(v) => { setPriceText(v); const c = parseMoneyInput(v); set('priceCents', c && c > 0 ? c : undefined); }}
            placeholder={d.listingType === 'SALE' ? '150,000' : '500'}
          />
          {price ? (
            <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
              {d.listingType === 'SALE' ? (() => {
                const e = ownerSaleEstimate(price, { sellerBps: s.saleSellerBps, buyerBps: s.saleBuyerBps });
                return (
                  <>
                    <Text variant="heading">{dict.owner.saleEstimateTitle}</Text>
                    <Line label={dict.owner.askingPrice} value={formatUSD(e.askingPriceCents, locale)} />
                    <Line label={dict.owner.sellerCommission.replace('{rate}', formatBasisPoints(e.sellerBps))} value={`− ${formatUSD(e.sellerCommissionCents, locale)}`} />
                    <Line label={dict.owner.sellerProceeds} value={formatUSD(e.sellerProceedsCents, locale)} strong />
                    <Text variant="caption">{dict.owner.saleEstimateNote}</Text>
                  </>
                );
              })() : (() => {
                const mode = d.rentPricingMode ?? s.rentalPricingMode;
                let e;
                try { e = ownerRentalPreview(price, { mode, monthlyFeeCents: s.rentalMonthlyFeeCents }); } catch { return <Text variant="small" style={{ color: colors.danger }}>{err('GENERIC')}</Text>; }
                return (
                  <>
                    <Text variant="heading">{dict.owner.rentEstimateTitle}</Text>
                    <Line label={dict.owner.rentYouReceive} value={formatUSD(e.landlordNetCents, locale)} strong />
                    <Line label={e.feeDeductedFromOwner ? dict.owner.rentFeeDeducted : dict.owner.rentMonthlyFee} value={formatUSD(e.platformFeeCents, locale)} />
                    <Line label={dict.owner.rentTenantPays} value={formatUSD(e.tenantTotalCents, locale)} />
                    <Text variant="caption">{dict.owner.rentNote}</Text>
                  </>
                );
              })()}
            </Card>
          ) : null}
        </>
      )}

      {step === 'media' && (
        <>
          <Text variant="heading">{dict.owner.photos}</Text>
          <Text variant="small" style={{ marginBottom: space.md }}>{dict.owner.photosHint}</Text>
          <Text variant="caption" style={{ color: colors.text, marginBottom: space.md }}>{dict.owner.noContactInText}</Text>
          <View style={styles.grid}>
            {photos.map((m, i) => (
              <View key={m.id} style={styles.thumbWrap}>
                {m.url && <Image source={{ uri: m.url }} style={styles.thumb} accessibilityLabel={`${i + 1}`} />}
                {m.isCover && <View style={styles.cover}><Badge label={dict.owner.setCover.split(' ')[0]!} tone="green" /></View>}
                {m.reviewStatus === 'REJECTED' && <View style={styles.cover}><Badge label={dict.listingStatus.REJECTED} tone="red" /></View>}
                <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
                  <IconBtn name="chevron-back" label="←" onPress={() => reorder(i, i - 1)} />
                  <IconBtn name={m.isCover ? 'star' : 'star-outline'} label={dict.owner.setCover} onPress={() => setCover(m.id)} />
                  <IconBtn name="trash-outline" label={dict.common.remove} onPress={() => remove(m.id)} />
                  <IconBtn name="chevron-forward" label="→" onPress={() => reorder(i, i + 1)} />
                </Row>
              </View>
            ))}
            {uploads.filter((u) => u.kind === 'PHOTO').map((u) => <UploadTile key={u.key} u={u} onRetry={() => id && startUpload(u, id)} />)}
          </View>
          <Button title={dict.owner.addPhotos} icon="images-outline" variant="secondary" onPress={() => pick('PHOTO')} style={{ marginTop: space.md }} />

          <Text variant="heading" style={{ marginTop: space.xl }}>{dict.owner.video}</Text>
          {media.filter((m) => m.kind === 'VIDEO').map((m) => <Text key={m.id} variant="small">🎬 {m.fileName}</Text>)}
          {uploads.filter((u) => u.kind === 'VIDEO').map((u) => <UploadRow key={u.key} u={u} onRetry={() => id && startUpload(u, id)} />)}
          <Button title={dict.owner.video} icon="videocam-outline" variant="ghost" onPress={() => pick('VIDEO')} />

          <Text variant="heading" style={{ marginTop: space.xl }}>{dict.owner.documents}</Text>
          <Text variant="small">{dict.owner.documentsHint}</Text>
          {media.filter((m) => m.kind === 'DOCUMENT').map((m) => (
            <Row key={m.id} style={{ justifyContent: 'space-between' }}><Text variant="small">📄 {m.fileName}</Text><IconBtn name="trash-outline" label={dict.common.remove} onPress={() => remove(m.id)} /></Row>
          ))}
          {uploads.filter((u) => u.kind === 'DOCUMENT').map((u) => <UploadRow key={u.key} u={u} onRetry={() => id && startUpload(u, id)} />)}
          <Button title={dict.owner.documents} icon="document-attach-outline" variant="ghost" onPress={() => pick('DOCUMENT')} />
        </>
      )}

      {step === 'contact' && (
        <>
          <Text variant="small" style={{ color: colors.text, marginBottom: space.md }}>{dict.owner.contactPrivate}</Text>
          <Field label={dict.owner.contactName} value={d.ownerContactName ?? ''} onChangeText={(v) => set('ownerContactName', v)} autoComplete="name" />
          <Field
            label={dict.owner.contactPhone}
            value={d.ownerContactPhone ?? ''}
            onChangeText={(v) => set('ownerContactPhone', v)}
            keyboardType="phone-pad"
            placeholder="71 123 456"
            error={d.ownerContactPhone && !normalizeLebanesePhone(d.ownerContactPhone) ? err('PHONE_INVALID') : undefined}
          />
          <Field label={dict.owner.contactEmail} value={d.ownerContactEmail ?? ''} onChangeText={(v) => set('ownerContactEmail', v || null)} keyboardType="email-address" autoCapitalize="none" />
          <Field label={`${dict.viewing.notes} (${dict.common.optional})`} value={d.ownerNotesForStaff ?? ''} onChangeText={(v) => set('ownerNotesForStaff', v)} multiline maxLength={1000} />
        </>
      )}

      {step === 'review' && (
        <>
          {missing.length > 0 ? (
            <Card style={{ borderColor: colors.warning }}>
              <Text variant="heading">{dict.owner.missingFields}</Text>
              {missing.map((m) => <Text key={m} variant="small">• {label(m)}</Text>)}
            </Card>
          ) : (
            <Card><Text variant="body">✓ {d.titleAr}</Text><Text variant="small">{photos.length} {dict.owner.photos}</Text></Card>
          )}
          {textHasContact && <Text variant="small" style={{ color: colors.warning, marginTop: space.md }}>⚠ {dict.owner.contactDetected}</Text>}
          {!published && (
            <Button title={status === 'REJECTED' ? dict.owner.resubmit : dict.owner.submitForReview} onPress={submit} loading={saving} disabled={missing.length > 0} style={{ marginTop: space.lg }} />
          )}
        </>
      )}

      {error && <Text variant="small" style={{ color: colors.danger, marginTop: space.md }} accessibilityRole="alert">{error}</Text>}
      <Row style={{ marginTop: space.xl, justifyContent: 'space-between' }}>
        <Button title={dict.common.back} variant="ghost" onPress={() => (step === 'basics' ? router.back() : go(-1))} />
        <Button title={dict.common.saveDraft} variant="secondary" onPress={save} loading={saving} />
        {step !== 'review' && <Button title={dict.common.continue} onPress={() => go(1)} disabled={step === 'basics' && !type} />}
      </Row>
    </Screen>
  );
}

function IconBtn({ name, label, onPress }: { name: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={20} color={colors.primary} />
    </Pressable>
  );
}

function UploadTile({ u, onRetry }: { u: LocalUpload; onRetry: () => void }) {
  const { dict } = useI18n();
  return (
    <View style={styles.thumbWrap}>
      <Image source={{ uri: u.uri }} style={[styles.thumb, { opacity: 0.5 }]} />
      <View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${Math.round(u.progress * 100)}%`, backgroundColor: u.failed ? colors.danger : colors.primary }]} /></View>
      {u.failed ? <Button title={dict.common.retry} variant="ghost" onPress={onRetry} /> : <Text variant="caption">{dict.owner.uploading.replace('{percent}', String(Math.round(u.progress * 100)))}</Text>}
    </View>
  );
}

function UploadRow({ u, onRetry }: { u: LocalUpload; onRetry: () => void }) {
  const { dict } = useI18n();
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text variant="small">{u.failed ? dict.owner.uploadFailed : dict.owner.uploading.replace('{percent}', String(Math.round(u.progress * 100)))}</Text>
      {u.failed && <Button title={dict.common.retry} variant="ghost" onPress={onRetry} />}
    </Row>
  );
}

const styles = StyleSheet.create({
  step: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceMuted },
  stepActive: { backgroundColor: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  thumbWrap: { width: '47%' },
  thumb: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  cover: { position: 'absolute', top: 6, start: 6 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, overflow: 'hidden', marginTop: 6 },
  progressBar: { height: 6 },
});
