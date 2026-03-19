import { useEffect, useState } from 'react';
import { AccountShell } from '../components/AccountShell';
import { Button, Input, useToast } from '../components/ui';
import { authService } from '../services/auth.service';
import { mediaService } from '../services/media.service';
import { verificationService, type IdentityDocumentType } from '../services/verification.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';
import type { MyIdentityVerificationResult } from '../types/domain';
import { formatDate } from '../utils/format';
import { useLocaleSwitch } from '../utils/localeSwitch';

type UploadField = 'documentFrontUrl' | 'documentBackUrl' | 'selfieUrl';

export function SecurityPage() {
  const { push } = useToast();
  const { pick } = useLocaleSwitch();
  const user = useAuthStore((state) => state.user);
  const refreshUser = useAuthStore((state) => state.refreshUser);

  const [identityVerification, setIdentityVerification] = useState<MyIdentityVerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingField, setUploadingField] = useState<UploadField | null>(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [phoneForm, setPhoneForm] = useState({ phone: user?.phone ?? '', code: '' });
  const [identityForm, setIdentityForm] = useState({
    documentType: 'NATIONAL_ID' as IdentityDocumentType,
    documentFrontUrl: '',
    documentBackUrl: '',
    selfieUrl: '',
    note: '',
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const result = await verificationService.getMyIdentityVerification();
        if (active) {
          setIdentityVerification(result);
        }
      } catch {
        if (active) {
          setIdentityVerification(null);
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
  }, []);

  const canSubmitIdentity = identityVerification ? identityVerification.canSubmit : true;

  const handleUpload = async (field: UploadField, files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    setUploadingField(field);
    try {
      const [uploaded] = await mediaService.uploadImages([files[0]], 'verification');
      if (!uploaded) {
        throw new Error(pick('تعذر رفع الملف.', 'Failed to upload file.'));
      }

      setIdentityForm((prev) => ({ ...prev, [field]: uploaded.url }));
      push(pick('تم رفع الملف بنجاح.', 'File uploaded successfully.'), 'success');
    } catch (error) {
      push(asHttpError(error).message, 'error');
    } finally {
      setUploadingField((current) => (current === field ? null : current));
    }
  };

  return (
    <AccountShell
      title={pick('التحقق والأمان', 'Verification & Security')}
      description={pick('إدارة كلمة المرور وتأكيد الهاتف والتحقق من الهوية.', 'Manage your password, phone confirmation, and identity verification.')}
    >
      <section className="grid gap-4 xl:grid-cols-3">
        <StatusCard
          label={pick('البريد الإلكتروني', 'Email')}
          value={user?.emailVerified ? pick('مؤكد', 'Verified') : pick('غير مؤكد', 'Unverified')}
          tone={user?.emailVerified ? 'success' : 'warning'}
        />
        <StatusCard
          label={pick('الهاتف', 'Phone')}
          value={user?.phoneVerified ? pick('مؤكد', 'Verified') : pick('غير مؤكد', 'Unverified')}
          tone={user?.phoneVerified ? 'success' : 'warning'}
        />
        <StatusCard
          label={pick('الهوية', 'Identity')}
          value={user?.identityVerificationStatus ?? 'NONE'}
          tone={user?.identityVerificationStatus === 'VERIFIED' ? 'success' : 'default'}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">{pick('تغيير كلمة المرور', 'Change Password')}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input
            label={pick('كلمة المرور الحالية', 'Current Password')}
            type="password"
            value={passwordForm.currentPassword}
            onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
          />
          <Input
            label={pick('كلمة المرور الجديدة', 'New Password')}
            type="password"
            value={passwordForm.newPassword}
            onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
          />
        </div>
        <div className="mt-4">
          <Button
            onClick={async () => {
              try {
                await authService.changePassword(passwordForm);
                setPasswordForm({ currentPassword: '', newPassword: '' });
                push(pick('تم تحديث كلمة المرور.', 'Password updated.'), 'success');
              } catch (error) {
                push(asHttpError(error).message, 'error');
              }
            }}
            disabled={!passwordForm.currentPassword.trim() || !passwordForm.newPassword.trim()}
          >
            {pick('تحديث كلمة المرور', 'Update Password')}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">{pick('تأكيد الهاتف', 'Phone Verification')}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input
            label={pick('رقم الهاتف', 'Phone')}
            value={phoneForm.phone}
            onChange={(event) => setPhoneForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <Input
            label={pick('رمز OTP', 'OTP Code')}
            value={phoneForm.code}
            onChange={(event) => setPhoneForm((prev) => ({ ...prev, code: event.target.value }))}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const result = await authService.requestPhoneVerification(phoneForm.phone.trim());
                push(
                  pick(
                    `تم إرسال الرمز عبر ${result.channel} وصلاحيته ${result.expiresInSeconds} ثانية.`,
                    `Code sent via ${result.channel} and expires in ${result.expiresInSeconds} seconds.`,
                  ),
                  'success',
                );
              } catch (error) {
                push(asHttpError(error).message, 'error');
              }
            }}
            disabled={!phoneForm.phone.trim()}
          >
            {pick('إرسال الرمز', 'Send Code')}
          </Button>
          <Button
            onClick={async () => {
              try {
                await authService.verifyPhoneOtp({ phone: phoneForm.phone.trim(), code: phoneForm.code.trim() });
                await refreshUser();
                push(pick('تم تأكيد الهاتف.', 'Phone verified.'), 'success');
              } catch (error) {
                push(asHttpError(error).message, 'error');
              }
            }}
            disabled={!phoneForm.phone.trim() || !phoneForm.code.trim()}
          >
            {pick('تأكيد الهاتف', 'Verify Phone')}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">{pick('التحقق من الهوية', 'Identity Verification')}</h2>
        {loading ? <p className="mt-3 text-sm text-muted">{pick('جارٍ تحميل حالة التحقق...', 'Loading verification status...')}</p> : null}

        {identityVerification?.currentRequest ? (
          <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-muted">
            <p>{pick('الحالة الحالية', 'Current status')}: <span className="font-semibold text-ink">{identityVerification.currentRequest.status}</span></p>
            <p>{pick('تاريخ الإرسال', 'Submitted')}: {formatDate(identityVerification.currentRequest.submittedAt)}</p>
            {identityVerification.currentRequest.reviewedAt ? (
              <p>{pick('تاريخ المراجعة', 'Reviewed')}: {formatDate(identityVerification.currentRequest.reviewedAt)}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-ink">{pick('نوع المستند', 'Document Type')}</span>
            <select
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-primary"
              value={identityForm.documentType}
              onChange={(event) => setIdentityForm((prev) => ({ ...prev, documentType: event.target.value as IdentityDocumentType }))}
              disabled={!canSubmitIdentity}
            >
              <option value="NATIONAL_ID">{pick('هوية وطنية', 'National ID')}</option>
              <option value="PASSPORT">{pick('جواز سفر', 'Passport')}</option>
              <option value="DRIVER_LICENSE">{pick('رخصة قيادة', 'Driver License')}</option>
              <option value="OTHER">{pick('أخرى', 'Other')}</option>
            </select>
          </label>

          <UploadFieldCard
            label={pick('الوجه الأمامي', 'Front document')}
            description={identityForm.documentFrontUrl || pick('لم يتم رفع ملف بعد.', 'No file uploaded yet.')}
            loading={uploadingField === 'documentFrontUrl'}
            disabled={!canSubmitIdentity}
            onChange={(files) => void handleUpload('documentFrontUrl', files)}
          />
          <UploadFieldCard
            label={pick('الوجه الخلفي', 'Back document')}
            description={identityForm.documentBackUrl || pick('اختياري.', 'Optional.')}
            loading={uploadingField === 'documentBackUrl'}
            disabled={!canSubmitIdentity}
            onChange={(files) => void handleUpload('documentBackUrl', files)}
          />
          <UploadFieldCard
            label={pick('صورة السيلفي', 'Selfie')}
            description={identityForm.selfieUrl || pick('اختياري.', 'Optional.')}
            loading={uploadingField === 'selfieUrl'}
            disabled={!canSubmitIdentity}
            onChange={(files) => void handleUpload('selfieUrl', files)}
          />
        </div>

        <label className="mt-3 grid gap-1.5">
          <span className="text-sm font-semibold text-ink">{pick('ملاحظة', 'Note')}</span>
          <textarea
            rows={4}
            value={identityForm.note}
            onChange={(event) => setIdentityForm((prev) => ({ ...prev, note: event.target.value }))}
            disabled={!canSubmitIdentity}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary"
          />
        </label>

        <div className="mt-4">
          <Button
            onClick={async () => {
              try {
                await verificationService.submitIdentityVerification({
                  documentType: identityForm.documentType,
                  documentFrontUrl: identityForm.documentFrontUrl,
                  documentBackUrl: identityForm.documentBackUrl || undefined,
                  selfieUrl: identityForm.selfieUrl || undefined,
                  note: identityForm.note.trim() || undefined,
                });
                const result = await verificationService.getMyIdentityVerification();
                setIdentityVerification(result);
                await refreshUser();
                push(pick('تم إرسال طلب التحقق.', 'Verification request submitted.'), 'success');
              } catch (error) {
                push(asHttpError(error).message, 'error');
              }
            }}
            disabled={!canSubmitIdentity || !identityForm.documentFrontUrl}
          >
            {pick('إرسال الطلب', 'Submit Request')}
          </Button>
        </div>
      </section>
    </AccountShell>
  );
}

function UploadFieldCard({
  label,
  description,
  loading,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  loading: boolean;
  disabled: boolean;
  onChange: (files: FileList | null) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || loading}
        onChange={(event) => onChange(event.target.files)}
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
      />
      <span className="text-xs text-muted">{loading ? 'Uploading...' : description}</span>
    </label>
  );
}

function StatusCard({ label, value, tone }: { label: string; value: string; tone: 'success' | 'warning' | 'default' }) {
  const toneClasses =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-slate-200 bg-white text-slate-700';

  return (
    <article className={`rounded-2xl border p-4 shadow-soft ${toneClasses}`}>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </article>
  );
}
