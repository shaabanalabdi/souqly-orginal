import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, ErrorStatePanel, Input, LoadingState, useToast } from '../components/ui';
import { listingsService } from '../services/listings.service';
import { asHttpError } from '../services/http';
import type { ContactVisibility, ListingDetails } from '../types/domain';
import { useLocaleSwitch } from '../utils/localeSwitch';

const VISIBILITY_OPTIONS: Array<{
  value: ContactVisibility;
  labelAr: string;
  labelEn: string;
}> = [
  { value: 'HIDDEN', labelAr: 'مخفي', labelEn: 'Hidden' },
  { value: 'VISIBLE', labelAr: 'مرئي', labelEn: 'Visible' },
  { value: 'APPROVAL', labelAr: 'بعد الموافقة', labelEn: 'After approval' },
];

export function EditListingPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { push } = useToast();
  const { pick } = useLocaleSwitch();
  const [listing, setListing] = useState<ListingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    priceAmount: '',
    currency: 'USD',
    negotiable: false,
    phoneNumber: '',
    whatsappNumber: '',
    phoneVisibility: 'APPROVAL' as ContactVisibility,
    whatsappVisibility: 'APPROVAL' as ContactVisibility,
  });

  useEffect(() => {
    if (!id) {
      setErrorMessage(pick('معرّف الإعلان غير صالح.', 'Invalid listing id.'));
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const result = await listingsService.manageDetails(Number(id));
        if (!active) {
          return;
        }

        setListing(result);
        setForm({
          title: result.title,
          description: result.description,
          priceAmount: result.priceAmount === null ? '' : String(result.priceAmount),
          currency: result.currency ?? 'USD',
          negotiable: result.negotiable,
          phoneNumber: result.contact.phoneNumber ?? '',
          whatsappNumber: result.contact.whatsappNumber ?? '',
          phoneVisibility: result.contact.phoneVisibility,
          whatsappVisibility: result.contact.whatsappVisibility,
        });
      } catch (error) {
        if (active) {
          setErrorMessage(asHttpError(error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [id, pick]);

  if (loading) {
    return <LoadingState text={pick('جارٍ تحميل بيانات الإعلان...', 'Loading listing details...')} />;
  }

  if (!listing) {
    return (
      <ErrorStatePanel
        title={pick('تعذر فتح الإعلان', 'Failed to open listing')}
        message={errorMessage || pick('لم يتم العثور على الإعلان المطلوب.', 'The requested listing was not found.')}
        action={
          <Button variant="secondary" onClick={() => navigate('/my-listings')}>
            {pick('العودة إلى إعلاناتي', 'Back to My Listings')}
          </Button>
        }
      />
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <h1 className="text-2xl font-black text-ink">{pick('تعديل الإعلان', 'Edit Listing')}</h1>
        <p className="mt-2 text-sm text-muted">
          {pick('يمكنك تعديل البيانات الأساسية وخصوصية التواصل لهذا الإعلان من هنا.', 'You can edit the core data and contact privacy for this listing here.')}
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label={pick('العنوان', 'Title')}
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />
          <Input
            label={pick('السعر', 'Price')}
            type="number"
            min="0"
            value={form.priceAmount}
            onChange={(event) => setForm((prev) => ({ ...prev, priceAmount: event.target.value }))}
          />
          <Input
            label={pick('العملة', 'Currency')}
            value={form.currency}
            onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
          />
          <Input
            label={pick('Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ', 'Phone Number')}
            value={form.phoneNumber}
            onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
          />
          <Input
            label={pick('Ø±Ù‚Ù… ÙˆØ§ØªØ³Ø§Ø¨', 'WhatsApp Number')}
            value={form.whatsappNumber}
            onChange={(event) => setForm((prev) => ({ ...prev, whatsappNumber: event.target.value }))}
          />
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-ink">{pick('خيارات إضافية', 'Extra Options')}</span>
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 text-sm text-ink">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.negotiable}
                  onChange={(event) => setForm((prev) => ({ ...prev, negotiable: event.target.checked }))}
                />
                <span>{pick('السعر قابل للتفاوض', 'Negotiable')}</span>
              </label>

              <div className="grid gap-1">
                <span className="font-semibold text-ink">{pick('رؤية الهاتف', 'Phone visibility')}</span>
                {VISIBILITY_OPTIONS.map((option) => (
                  <label key={`phone-${option.value}`} className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="phone-visibility"
                      checked={form.phoneVisibility === option.value}
                      onChange={() => setForm((prev) => ({ ...prev, phoneVisibility: option.value }))}
                    />
                    <span>{pick(option.labelAr, option.labelEn)}</span>
                  </label>
                ))}
              </div>

              <div className="grid gap-1">
                <span className="font-semibold text-ink">{pick('رؤية واتساب', 'WhatsApp visibility')}</span>
                {VISIBILITY_OPTIONS.map((option) => (
                  <label key={`whatsapp-${option.value}`} className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="whatsapp-visibility"
                      checked={form.whatsappVisibility === option.value}
                      onChange={() => setForm((prev) => ({ ...prev, whatsappVisibility: option.value }))}
                    />
                    <span>{pick(option.labelAr, option.labelEn)}</span>
                  </label>
                ))}
              </div>
            </div>
          </label>
        </div>

        <label className="mt-4 grid gap-1.5">
          <span className="text-sm font-semibold text-ink">{pick('الوصف', 'Description')}</span>
          <textarea
            rows={8}
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary"
          />
        </label>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            isLoading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                const updated = await listingsService.update(listing.id, {
                  titleAr: form.title.trim(),
                  descriptionAr: form.description.trim(),
                  priceAmount: form.priceAmount.trim() ? Number(form.priceAmount) : undefined,
                  currency: form.currency.trim() || undefined,
                  negotiable: form.negotiable,
                  phoneNumber: form.phoneNumber.trim() || undefined,
                  whatsappNumber: form.whatsappNumber.trim() || undefined,
                  phoneVisibility: form.phoneVisibility,
                  whatsappVisibility: form.whatsappVisibility,
                });
                setListing(updated);
                push(pick('تم تحديث الإعلان.', 'Listing updated.'), 'success');
                navigate('/my-listings');
              } catch (error) {
                push(asHttpError(error).message, 'error');
              } finally {
                setSaving(false);
              }
            }}
            disabled={!form.title.trim() || !form.description.trim()}
          >
            {pick('حفظ التعديلات', 'Save Changes')}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/my-listings')}>
            {pick('إلغاء', 'Cancel')}
          </Button>
        </div>
      </section>
    </section>
  );
}
