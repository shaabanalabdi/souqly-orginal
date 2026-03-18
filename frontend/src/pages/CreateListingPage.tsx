import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { ListingCard } from '../components/ListingCard';
import { categoriesService } from '../services/categories.service';
import { geoService } from '../services/geo.service';
import { listingsService } from '../services/listings.service';
import { mediaService } from '../services/media.service';
import { asHttpError } from '../services/http';
import type {
  AttributeDefinition,
  Category,
  Country,
  ListingCondition,
  Subcategory,
} from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';

type ContactVisibility = 'hidden' | 'visible' | 'approval';

interface ListingDraft {
  images: string[];
  title: string;
  description: string;
  categorySlug: string;
  subcategoryId: string;
  attributes: Record<number, string>;
  price: string;
  currency: string;
  condition: ListingCondition;
  countryId: string;
  cityId: string;
  latitude: string;
  longitude: string;
  phoneVisibility: ContactVisibility;
  whatsappVisibility: ContactVisibility;
}

const INITIAL_DRAFT: ListingDraft = {
  images: [],
  title: '',
  description: '',
  categorySlug: '',
  subcategoryId: '',
  attributes: {},
  price: '',
  currency: 'SAR',
  condition: 'USED',
  countryId: '',
  cityId: '',
  latitude: '',
  longitude: '',
  phoneVisibility: 'visible',
  whatsappVisibility: 'visible',
};

const STEP_TITLES = [
  { ar: 'الأساسيات', en: 'Basics' },
  { ar: 'التفاصيل', en: 'Details' },
  { ar: 'الموقع والتواصل', en: 'Location & Contact' },
  { ar: 'المراجعة والنشر', en: 'Review & Publish' },
];

function normalizeVisibility(value: ContactVisibility): boolean {
  return value === 'visible';
}

export function CreateListingPage() {
  const { pick, locale } = useLocaleSwitch();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<ListingDraft>(INITIAL_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [publishLoading, setPublishLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [createdListingId, setCreatedListingId] = useState<number | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<Array<{ id: number; name: string }>>([]);
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);

  useEffect(() => {
    const loadStatic = async () => {
      try {
        const [categoriesResult, countriesResult] = await Promise.all([
          categoriesService.listCategories(),
          geoService.listCountries(),
        ]);
        setCategories(categoriesResult);
        setCountries(countriesResult);
      } catch (error) {
        setStatusMessage(asHttpError(error).message);
      }
    };

    void loadStatic();
  }, []);

  useEffect(() => {
    const loadSubcategories = async () => {
      if (!draft.categorySlug) {
        setSubcategories([]);
        setAttributes([]);
        setDraft((prev) => ({ ...prev, subcategoryId: '', attributes: {} }));
        return;
      }

      try {
        const result = await categoriesService.listSubcategories(draft.categorySlug);
        setSubcategories(result.subcategories);
      } catch {
        setSubcategories([]);
      }
    };

    void loadSubcategories();
  }, [draft.categorySlug]);

  useEffect(() => {
    const loadCities = async () => {
      if (!draft.countryId) {
        setCities([]);
        setDraft((prev) => ({ ...prev, cityId: '' }));
        return;
      }

      const selectedCountry = countries.find((country) => String(country.id) === draft.countryId);
      if (!selectedCountry) return;

      try {
        const result = await geoService.listCountryCities(selectedCountry.code);
        setCities(result.cities.map((city) => ({ id: city.id, name: city.name })));
      } catch {
        setCities([]);
      }
    };

    void loadCities();
  }, [countries, draft.countryId]);

  useEffect(() => {
    const loadAttributes = async () => {
      if (!draft.subcategoryId) {
        setAttributes([]);
        setDraft((prev) => ({ ...prev, attributes: {} }));
        return;
      }

      const selectedSubcategory = subcategories.find((item) => String(item.id) === draft.subcategoryId);
      if (!selectedSubcategory) return;

      try {
        const result = await categoriesService.listAttributes(selectedSubcategory.slug);
        setAttributes(result.attributes);
      } catch {
        setAttributes([]);
      }
    };

    void loadAttributes();
  }, [draft.subcategoryId, subcategories]);

  const progressWidth = `${(step / STEP_TITLES.length) * 100}%`;

  const validateStep = (currentStep: number): boolean => {
    const nextErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (draft.images.length === 0) {
        nextErrors.images = pick('أضف صورة واحدة على الأقل.', 'Add at least one image.');
      }
      if (draft.title.trim().length < 5) {
        nextErrors.title = pick('العنوان يجب أن يكون 5 أحرف على الأقل.', 'Title must be at least 5 characters.');
      }
      if (draft.description.trim().length < 20) {
        nextErrors.description = pick(
          'الوصف يجب أن يكون 20 حرفًا على الأقل.',
          'Description must be at least 20 characters.',
        );
      }
    }

    if (currentStep === 2) {
      if (!draft.categorySlug) {
        nextErrors.categorySlug = pick('اختر الفئة.', 'Select a category.');
      }
      if (!draft.subcategoryId) {
        nextErrors.subcategoryId = pick('اختر الفئة الفرعية.', 'Select a subcategory.');
      }
      if (!draft.price || Number(draft.price) <= 0) {
        nextErrors.price = pick('أدخل سعرًا صحيحًا.', 'Enter a valid price.');
      }
    }

    if (currentStep === 3) {
      if (!draft.countryId) {
        nextErrors.countryId = pick('اختر الدولة.', 'Select country.');
      }
      if (!draft.cityId) {
        nextErrors.cityId = pick('اختر المدينة.', 'Select city.');
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const nextStep = () => {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(STEP_TITLES.length, prev + 1));
  };

  const previousStep = () => setStep((prev) => Math.max(1, prev - 1));

  const onPickImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploadingImages(true);
    setStatusMessage('');
    try {
      const uploaded = await mediaService.uploadImages(files);
      const urls = uploaded.map((item) => item.url);
      setDraft((prev) => ({ ...prev, images: Array.from(new Set([...prev.images, ...urls])) }));
    } catch (error) {
      setStatusMessage(asHttpError(error).message);
    } finally {
      setUploadingImages(false);
    }
  };

  const updateAttribute = (key: number, value: string) => {
    setDraft((prev) => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [key]: value,
      },
    }));
  };

  const previewPrice = useMemo(() => Number(draft.price || 0), [draft.price]);

  const publish = async () => {
    if (!validateStep(3)) return;

    setPublishLoading(true);
    setStatusMessage('');
    try {
      const attributesPayload = attributes
        .map((attribute) => ({
          attributeDefinitionId: attribute.id,
          value: (draft.attributes[attribute.id] ?? '').trim(),
        }))
        .filter((item) => item.value.length > 0);

      const created = await listingsService.create({
        subcategoryId: Number(draft.subcategoryId),
        countryId: Number(draft.countryId),
        cityId: Number(draft.cityId),
        titleAr: draft.title,
        descriptionAr: draft.description,
        priceAmount: Number(draft.price),
        currency: draft.currency,
        condition: draft.condition,
        locationLat: draft.latitude ? Number(draft.latitude) : undefined,
        locationLng: draft.longitude ? Number(draft.longitude) : undefined,
        phoneVisibility: normalizeVisibility(draft.phoneVisibility),
        whatsappVisibility: normalizeVisibility(draft.whatsappVisibility),
        images: draft.images,
        attributes: attributesPayload,
      });

      setCreatedListingId(created.id);
      setStatusMessage(pick('تم نشر الإعلان بنجاح.', 'Listing published successfully.'));
      setDraft(INITIAL_DRAFT);
      setStep(1);
      setErrors({});
    } catch (error) {
      setStatusMessage(asHttpError(error).message);
    } finally {
      setPublishLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-ink">{pick('إنشاء إعلان جديد', 'Create New Listing')}</h1>
        <p className="mt-1 text-sm text-muted">
          {pick('اتبع الخطوات لإكمال الإعلان بشكل احترافي.', 'Follow steps to publish a high-quality listing.')}
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted">
          {STEP_TITLES.map((item, index) => (
            <span key={item.en} className={step === index + 1 ? 'text-primary' : ''}>
              {index + 1}. {pick(item.ar, item.en)}
            </span>
          ))}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: progressWidth }} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
        {step === 1 ? (
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">{pick('رفع الصور', 'Upload Images')}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => void onPickImages(event)}
                className={`w-full rounded-xl border border-dashed px-3 py-6 text-sm ${
                  errors.images ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
                }`}
              />
              {uploadingImages ? <p className="text-xs text-muted">{pick('جارٍ رفع الصور...', 'Uploading images...')}</p> : null}
              {errors.images ? <p className="text-xs text-rose-600">{errors.images}</p> : null}
            </label>

            <div className="grid grid-cols-4 gap-2">
              {draft.images.slice(0, 8).map((image) => (
                <img key={image} src={image} alt="" className="h-20 w-full rounded-lg object-cover" />
              ))}
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">{pick('العنوان', 'Title')}</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                className={`h-11 w-full rounded-xl border px-3 text-sm ${
                  errors.title ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200'
                }`}
              />
              {errors.title ? <p className="text-xs text-rose-600">{errors.title}</p> : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">{pick('الوصف', 'Description')}</span>
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                className={`min-h-32 w-full rounded-xl border px-3 py-2 text-sm ${
                  errors.description ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200'
                }`}
              />
              {errors.description ? <p className="text-xs text-rose-600">{errors.description}</p> : null}
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">{pick('الفئة', 'Category')}</span>
              <select
                value={draft.categorySlug}
                onChange={(event) => setDraft((prev) => ({ ...prev, categorySlug: event.target.value }))}
                className={`h-11 w-full rounded-xl border px-3 text-sm ${
                  errors.categorySlug ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200'
                }`}
              >
                <option value="">{pick('اختر الفئة', 'Select category')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.categorySlug ? <p className="text-xs text-rose-600">{errors.categorySlug}</p> : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">{pick('الفئة الفرعية', 'Subcategory')}</span>
              <select
                value={draft.subcategoryId}
                onChange={(event) => setDraft((prev) => ({ ...prev, subcategoryId: event.target.value }))}
                className={`h-11 w-full rounded-xl border px-3 text-sm ${
                  errors.subcategoryId ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200'
                }`}
                disabled={!draft.categorySlug}
              >
                <option value="">{pick('اختر الفئة الفرعية', 'Select subcategory')}</option>
                {subcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
              {errors.subcategoryId ? <p className="text-xs text-rose-600">{errors.subcategoryId}</p> : null}
            </label>

            {attributes.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {attributes.map((attribute) => (
                  <label key={attribute.id} className="space-y-2">
                    <span className="text-sm font-medium text-ink">{attribute.name}</span>
                    <input
                      value={draft.attributes[attribute.id] ?? ''}
                      onChange={(event) => updateAttribute(attribute.id, event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    />
                  </label>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">{pick('السعر', 'Price')}</span>
                <input
                  type="number"
                  min={1}
                  value={draft.price}
                  onChange={(event) => setDraft((prev) => ({ ...prev, price: event.target.value }))}
                  className={`h-11 w-full rounded-xl border px-3 text-sm ${
                    errors.price ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200'
                  }`}
                />
                {errors.price ? <p className="text-xs text-rose-600">{errors.price}</p> : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">{pick('العملة', 'Currency')}</span>
                <input
                  value={draft.currency}
                  onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">{pick('الحالة', 'Condition')}</span>
              <select
                value={draft.condition}
                onChange={(event) => setDraft((prev) => ({ ...prev, condition: event.target.value as ListingCondition }))}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
              >
                <option value="NEW">{pick('جديد', 'New')}</option>
                <option value="USED">{pick('مستعمل', 'Used')}</option>
              </select>
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">{pick('الدولة', 'Country')}</span>
                <select
                  value={draft.countryId}
                  onChange={(event) => setDraft((prev) => ({ ...prev, countryId: event.target.value }))}
                  className={`h-11 w-full rounded-xl border px-3 text-sm ${
                    errors.countryId ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200'
                  }`}
                >
                  <option value="">{pick('اختر الدولة', 'Select country')}</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
                {errors.countryId ? <p className="text-xs text-rose-600">{errors.countryId}</p> : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">{pick('المدينة', 'City')}</span>
                <select
                  value={draft.cityId}
                  onChange={(event) => setDraft((prev) => ({ ...prev, cityId: event.target.value }))}
                  className={`h-11 w-full rounded-xl border px-3 text-sm ${
                    errors.cityId ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200'
                  }`}
                  disabled={!draft.countryId}
                >
                  <option value="">{pick('اختر المدينة', 'Select city')}</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
                {errors.cityId ? <p className="text-xs text-rose-600">{errors.cityId}</p> : null}
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">{pick('خط العرض', 'Latitude')}</span>
                <input
                  value={draft.latitude}
                  onChange={(event) => setDraft((prev) => ({ ...prev, latitude: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  placeholder="24.7136"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">{pick('خط الطول', 'Longitude')}</span>
                <input
                  value={draft.longitude}
                  onChange={(event) => setDraft((prev) => ({ ...prev, longitude: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  placeholder="46.6753"
                />
              </label>
            </div>

            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-muted">
              {pick('محدد الموقع (Map Picker) سيظهر هنا', 'Map Picker will appear here')}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-ink">{pick('إظهار الهاتف', 'Phone visibility')}</legend>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  checked={draft.phoneVisibility === 'hidden'}
                  onChange={() => setDraft((prev) => ({ ...prev, phoneVisibility: 'hidden' }))}
                />
                {pick('مخفي', 'Hidden')}
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  checked={draft.phoneVisibility === 'visible'}
                  onChange={() => setDraft((prev) => ({ ...prev, phoneVisibility: 'visible' }))}
                />
                {pick('ظاهر', 'Visible')}
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  checked={draft.phoneVisibility === 'approval'}
                  onChange={() => setDraft((prev) => ({ ...prev, phoneVisibility: 'approval' }))}
                />
                {pick('بعد الموافقة', 'After Approval')}
              </label>
            </fieldset>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-ink">{pick('معاينة الإعلان', 'Listing Preview')}</h2>
            <div className="max-w-sm">
              <ListingCard
                id="preview"
                title={draft.title || pick('عنوان الإعلان', 'Listing title')}
                price={previewPrice}
                currency={draft.currency}
                location={cities.find((city) => String(city.id) === draft.cityId)?.name || pick('المدينة', 'City')}
                imageUrl={draft.images[0]}
                badge={pick('معاينة', 'Preview')}
                locale={locale}
              />
            </div>
            <button
              type="button"
              onClick={() => void publish()}
              disabled={publishLoading}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:opacity-60"
            >
              {publishLoading ? pick('جارٍ النشر...', 'Publishing...') : pick('نشر الإعلان', 'Publish Listing')}
            </button>
            {createdListingId ? (
              <p className="text-sm font-medium text-emerald-700">
                {pick('رقم الإعلان', 'Listing ID')}: {createdListingId}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {statusMessage ? <p className="text-sm text-emerald-700">{statusMessage}</p> : null}

      <footer className="flex items-center justify-between">
        <button
          type="button"
          onClick={previousStep}
          disabled={step === 1}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
        >
          {pick('السابق', 'Back')}
        </button>
        {step < STEP_TITLES.length ? (
          <button
            type="button"
            onClick={nextStep}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
          >
            {pick('التالي', 'Next')}
          </button>
        ) : null}
      </footer>
    </section>
  );
}
