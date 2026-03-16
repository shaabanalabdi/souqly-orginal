import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { categoriesService } from '../services/categories.service';
import { geoService } from '../services/geo.service';
import { listingsService } from '../services/listings.service';
import { mediaService } from '../services/media.service';
import { asHttpError } from '../services/http';
import type { AttributeDefinition, Category, Country, ListingCondition, Subcategory } from '../types/domain';

interface ListingFormState {
  categorySlug: string;
  subcategoryId: string;
  countryId: string;
  cityId: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  priceAmount: string;
  currency: string;
  condition: '' | ListingCondition;
  negotiable: boolean;
  phoneVisibility: boolean;
  whatsappVisibility: boolean;
  manualUrlsText: string;
}

const initialFormState: ListingFormState = {
  categorySlug: '',
  subcategoryId: '',
  countryId: '',
  cityId: '',
  titleAr: '',
  titleEn: '',
  descriptionAr: '',
  descriptionEn: '',
  priceAmount: '',
  currency: '',
  condition: '',
  negotiable: true,
  phoneVisibility: false,
  whatsappVisibility: false,
  manualUrlsText: '',
};

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function CreateListingPage() {
  const [form, setForm] = useState<ListingFormState>(initialFormState);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<Array<{ id: number; name: string }>>([]);
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<number, string>>({});
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [createdListingId, setCreatedListingId] = useState<number | null>(null);

  const selectedCountryCode = useMemo(() => {
    const countryId = Number(form.countryId);
    if (!countryId) return '';
    return countries.find((country) => country.id === countryId)?.code ?? '';
  }, [countries, form.countryId]);

  const selectedSubcategorySlug = useMemo(() => {
    const subcategoryId = Number(form.subcategoryId);
    if (!subcategoryId) return '';
    return subcategories.find((subcategory) => subcategory.id === subcategoryId)?.slug ?? '';
  }, [subcategories, form.subcategoryId]);

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [categoriesResult, countriesResult] = await Promise.all([
          categoriesService.listCategories(),
          geoService.listCountries(),
        ]);
        setCategories(categoriesResult);
        setCountries(countriesResult);
      } catch (err) {
        setError(asHttpError(err).message);
      }
    };

    void loadInitial();
  }, []);

  useEffect(() => {
    if (!form.categorySlug) {
      setSubcategories([]);
      setForm((prev) => ({ ...prev, subcategoryId: '' }));
      return;
    }

    const loadSubcategories = async () => {
      try {
        const result = await categoriesService.listSubcategories(form.categorySlug);
        setSubcategories(result.subcategories);
      } catch (err) {
        setError(asHttpError(err).message);
      }
    };

    void loadSubcategories();
  }, [form.categorySlug]);

  useEffect(() => {
    if (!selectedCountryCode) {
      setCities([]);
      setForm((prev) => ({ ...prev, cityId: '' }));
      return;
    }

    const loadCities = async () => {
      try {
        const result = await geoService.listCountryCities(selectedCountryCode);
        setCities(result.cities);
      } catch (err) {
        setError(asHttpError(err).message);
      }
    };

    void loadCities();
  }, [selectedCountryCode]);

  useEffect(() => {
    if (!selectedSubcategorySlug) {
      setAttributes([]);
      setAttributeValues({});
      return;
    }

    const loadAttributes = async () => {
      try {
        const result = await categoriesService.listAttributes(selectedSubcategorySlug);
        setAttributes(result.attributes);
      } catch (err) {
        setError(asHttpError(err).message);
      }
    };

    void loadAttributes();
  }, [selectedSubcategorySlug]);

  const handleUploadSelectedImages = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one image file.');
      return;
    }

    setUploadingImages(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await mediaService.uploadImages(selectedFiles);
      const urls = result.map((item) => item.url);
      setUploadedImages((prev) => Array.from(new Set([...prev, ...urls])));
      setSelectedFiles([]);
      setSuccessMessage(`${urls.length} image(s) uploaded successfully.`);
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveUploadedImage = (url: string) => {
    setUploadedImages((prev) => prev.filter((item) => item !== url));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setCreatedListingId(null);

    const manualUrls = form.manualUrlsText
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);

    const images = Array.from(new Set([...uploadedImages, ...manualUrls]));
    if (images.length === 0) {
      setError('At least one image is required. Upload files or add manual URLs.');
      setLoading(false);
      return;
    }

    const attributesPayload = attributes
      .map((attribute) => ({
        attributeDefinitionId: attribute.id,
        value: (attributeValues[attribute.id] ?? '').trim(),
      }))
      .filter((item) => item.value.length > 0);

    try {
      const createdListing = await listingsService.create({
        subcategoryId: Number(form.subcategoryId),
        countryId: Number(form.countryId),
        cityId: Number(form.cityId),
        titleAr: form.titleAr,
        titleEn: form.titleEn || undefined,
        descriptionAr: form.descriptionAr,
        descriptionEn: form.descriptionEn || undefined,
        priceAmount: parseOptionalNumber(form.priceAmount),
        currency: form.currency.trim().toUpperCase() || undefined,
        negotiable: form.negotiable,
        condition: form.condition || undefined,
        phoneVisibility: form.phoneVisibility,
        whatsappVisibility: form.whatsappVisibility,
        images,
        attributes: attributesPayload,
      });

      setCreatedListingId(createdListing.id);
      setSuccessMessage(
        `Listing #${createdListing.id} submitted successfully with status ${createdListing.status}.`,
      );
      setForm(initialFormState);
      setSubcategories([]);
      setCities([]);
      setAttributes([]);
      setAttributeValues({});
      setUploadedImages([]);
      setSelectedFiles([]);
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card">
      <h1 className="page-title">Create Listing</h1>
      <p className="page-subtitle">Submit a new classified ad with real image upload support.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <div className="grid grid--3">
          <label className="field">
            <span className="label">Category</span>
            <select
              className="select"
              required
              value={form.categorySlug}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  categorySlug: event.target.value,
                  subcategoryId: '',
                }))
              }
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">Subcategory</span>
            <select
              className="select"
              required
              value={form.subcategoryId}
              onChange={(event) => setForm((prev) => ({ ...prev, subcategoryId: event.target.value }))}
              disabled={subcategories.length === 0}
            >
              <option value="">Select subcategory</option>
              {subcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">Condition</span>
            <select
              className="select"
              value={form.condition}
              onChange={(event) => setForm((prev) => ({ ...prev, condition: event.target.value as ListingCondition | '' }))}
            >
              <option value="">Not specified</option>
              <option value="NEW">NEW</option>
              <option value="USED">USED</option>
            </select>
          </label>

          <label className="field">
            <span className="label">Country</span>
            <select
              className="select"
              required
              value={form.countryId}
              onChange={(event) => setForm((prev) => ({ ...prev, countryId: event.target.value, cityId: '' }))}
            >
              <option value="">Select country</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">City</span>
            <select
              className="select"
              required
              value={form.cityId}
              onChange={(event) => setForm((prev) => ({ ...prev, cityId: event.target.value }))}
              disabled={cities.length === 0}
            >
              <option value="">Select city</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="label">Currency</span>
            <input
              className="input"
              value={form.currency}
              onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
              placeholder="USD"
            />
          </label>

          <label className="field">
            <span className="label">Price</span>
            <input
              className="input"
              type="number"
              min={0}
              value={form.priceAmount}
              onChange={(event) => setForm((prev) => ({ ...prev, priceAmount: event.target.value }))}
            />
          </label>
        </div>

        <label className="field">
          <span className="label">Arabic title</span>
          <input
            className="input"
            required
            minLength={5}
            maxLength={200}
            value={form.titleAr}
            onChange={(event) => setForm((prev) => ({ ...prev, titleAr: event.target.value }))}
          />
        </label>

        <label className="field">
          <span className="label">English title (optional)</span>
          <input
            className="input"
            minLength={5}
            maxLength={200}
            value={form.titleEn}
            onChange={(event) => setForm((prev) => ({ ...prev, titleEn: event.target.value }))}
          />
        </label>

        <label className="field">
          <span className="label">Arabic description</span>
          <textarea
            className="textarea"
            required
            minLength={20}
            maxLength={5000}
            value={form.descriptionAr}
            onChange={(event) => setForm((prev) => ({ ...prev, descriptionAr: event.target.value }))}
          />
        </label>

        <label className="field">
          <span className="label">English description (optional)</span>
          <textarea
            className="textarea"
            minLength={20}
            maxLength={5000}
            value={form.descriptionEn}
            onChange={(event) => setForm((prev) => ({ ...prev, descriptionEn: event.target.value }))}
          />
        </label>

        <section className="card">
          <h3>Images</h3>
          <p className="muted-text">Upload image files to S3 or add manual URLs as fallback.</p>

          <div className="stack">
            <label className="field">
              <span className="label">Select image files (max 10, 8MB each)</span>
              <input
                className="input"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
              />
            </label>

            <div className="button-row">
              <button
                type="button"
                className="button button--secondary"
                onClick={handleUploadSelectedImages}
                disabled={uploadingImages || selectedFiles.length === 0}
              >
                {uploadingImages ? 'Uploading...' : 'Upload selected images'}
              </button>
            </div>

            <div className="list">
              {uploadedImages.map((url) => (
                <div key={url} className="row">
                  <div className="row__meta">{url}</div>
                  <div className="button-row">
                    <button
                      type="button"
                      className="button button--danger"
                      onClick={() => handleRemoveUploadedImage(url)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {uploadedImages.length === 0 ? (
                <p className="muted-text">No uploaded images yet.</p>
              ) : null}
            </div>

            <label className="field">
              <span className="label">Manual image URLs (optional, one per line)</span>
              <textarea
                className="textarea"
                value={form.manualUrlsText}
                onChange={(event) => setForm((prev) => ({ ...prev, manualUrlsText: event.target.value }))}
                placeholder="https://example.com/a.jpg&#10;https://example.com/b.jpg"
              />
            </label>
          </div>
        </section>

        {attributes.length > 0 ? (
          <section className="card">
            <h3>Dynamic Attributes</h3>
            <div className="grid grid--2">
              {attributes.map((attribute) => (
                <label key={attribute.id} className="field">
                  <span className="label">
                    {attribute.name}
                    {attribute.isRequired ? ' *' : ''}
                  </span>
                  <input
                    className="input"
                    required={attribute.isRequired}
                    value={attributeValues[attribute.id] ?? ''}
                    onChange={(event) =>
                      setAttributeValues((prev) => ({
                        ...prev,
                        [attribute.id]: event.target.value,
                      }))
                    }
                    placeholder={attribute.options.length > 0 ? attribute.options.join(', ') : undefined}
                  />
                </label>
              ))}
            </div>
          </section>
        ) : null}

        <div className="inline">
          <label className="inline">
            <input
              type="checkbox"
              checked={form.negotiable}
              onChange={(event) => setForm((prev) => ({ ...prev, negotiable: event.target.checked }))}
            />
            Negotiable
          </label>

          <label className="inline">
            <input
              type="checkbox"
              checked={form.phoneVisibility}
              onChange={(event) => setForm((prev) => ({ ...prev, phoneVisibility: event.target.checked }))}
            />
            Phone visible
          </label>

          <label className="inline">
            <input
              type="checkbox"
              checked={form.whatsappVisibility}
              onChange={(event) => setForm((prev) => ({ ...prev, whatsappVisibility: event.target.checked }))}
            />
            WhatsApp visible
          </label>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {successMessage ? <p className="success-text">{successMessage}</p> : null}
        {createdListingId ? (
          <p className="muted-text">
            Listing reference: #{createdListingId}. Public details page only works when status becomes ACTIVE.
          </p>
        ) : null}

        <div className="button-row">
          <button type="submit" className="button button--primary" disabled={loading || uploadingImages}>
            {loading ? 'Submitting...' : 'Submit listing'}
          </button>
          <Link className="button button--ghost" to="/">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}