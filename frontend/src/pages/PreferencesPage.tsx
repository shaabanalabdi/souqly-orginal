import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { preferencesService } from '../services/preferences.service';
import { verificationService, type IdentityDocumentType } from '../services/verification.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';
import type {
  FavoriteSummary,
  MyIdentityVerificationResult,
  NotificationFrequency,
  SavedSearch,
} from '../types/domain';
import { formatDate, formatMoney } from '../utils/format';

export function PreferencesPage() {
  const { t } = useTranslation('preferences');
  const user = useAuthStore((state) => state.user);
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const [favorites, setFavorites] = useState<FavoriteSummary[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [identityVerification, setIdentityVerification] = useState<MyIdentityVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [favoriteListingId, setFavoriteListingId] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchFiltersText, setSearchFiltersText] = useState('{"q":"car","countryId":1}');
  const [searchFrequency, setSearchFrequency] = useState<NotificationFrequency>('daily');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [identityDocumentType, setIdentityDocumentType] = useState<IdentityDocumentType>('NATIONAL_ID');
  const [identityDocumentNumberMasked, setIdentityDocumentNumberMasked] = useState('');
  const [identityDocumentFrontUrl, setIdentityDocumentFrontUrl] = useState('');
  const [identityDocumentBackUrl, setIdentityDocumentBackUrl] = useState('');
  const [identitySelfieUrl, setIdentitySelfieUrl] = useState('');
  const [identityNote, setIdentityNote] = useState('');

  useEffect(() => {
    setPhone(user?.phone ?? '');
  }, [user?.phone]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [favoritesResult, savedResult, identityResult] = await Promise.all([
        preferencesService.listFavorites(),
        preferencesService.listSavedSearches(),
        verificationService.getMyIdentityVerification(),
      ]);
      setFavorites(favoritesResult.items);
      setSavedSearches(savedResult.items);
      setIdentityVerification(identityResult);
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleAddFavorite = async () => {
    const listingId = Number(favoriteListingId);
    if (!Number.isFinite(listingId) || listingId <= 0) return;

    setMessage(null);
    try {
      await preferencesService.addFavorite(listingId);
      setFavoriteListingId('');
      setMessage('Favorite added.');
      await loadData();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleRemoveFavorite = async (listingId: number) => {
    setMessage(null);
    try {
      await preferencesService.removeFavorite(listingId);
      setMessage('Favorite removed.');
      await loadData();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleCreateSavedSearch = async () => {
    setMessage(null);
    try {
      const parsedFilters = JSON.parse(searchFiltersText) as Record<string, unknown>;
      await preferencesService.createSavedSearch({
        name: searchName,
        filters: parsedFilters,
        notificationFrequency: searchFrequency,
      });
      setSearchName('');
      setMessage('Saved search created.');
      await loadData();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleDeleteSavedSearch = async (id: number) => {
    setMessage(null);
    try {
      await preferencesService.deleteSavedSearch(id);
      setMessage('Saved search deleted.');
      await loadData();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleRequestPhoneOtp = async () => {
    if (!phone.trim()) return;

    setMessage(null);
    try {
      const result = await authService.requestPhoneVerification(phone.trim());
      setOtpRequested(true);
      setMessage(`Verification code sent via ${result.channel}. Expires in ${result.expiresInSeconds} seconds.`);
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phone.trim() || !otpCode.trim()) return;

    setMessage(null);
    try {
      const result = await authService.verifyPhoneOtp({
        phone: phone.trim(),
        code: otpCode.trim(),
      });
      setOtpCode('');
      setOtpRequested(false);
      setMessage(`Phone ${result.phone} verified successfully.`);
      await refreshUser();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleSubmitIdentityVerification = async () => {
    if (!identityDocumentFrontUrl.trim()) return;

    setMessage(null);
    try {
      await verificationService.submitIdentityVerification({
        documentType: identityDocumentType,
        documentNumberMasked: identityDocumentNumberMasked.trim() || undefined,
        documentFrontUrl: identityDocumentFrontUrl.trim(),
        documentBackUrl: identityDocumentBackUrl.trim() || undefined,
        selfieUrl: identitySelfieUrl.trim() || undefined,
        note: identityNote.trim() || undefined,
      });
      setMessage('Identity verification request submitted successfully.');
      setIdentityNote('');
      await refreshUser();
      await loadData();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  return (
    <div className="stack">
      <h1 className="page-title">{t('title')}</h1>
      <p className="page-subtitle">{t('subtitle')}</p>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="muted-text">{message}</p> : null}

      <section className="card">
        <h2>{t('phoneVerification')}</h2>
        <div className="stack">
          <label className="field">
            <span className="label">{t('phoneNumber')}</span>
            <input
              className="input"
              placeholder="+9639XXXXXXXX"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>

          <div className="button-row">
            <button type="button" className="button button--primary" onClick={handleRequestPhoneOtp}>{t('requestOtp')}</button>
          </div>

          {otpRequested ? (
            <>
              <label className="field">
                <span className="label">{t('otpCode')}</span>
                <input
                  className="input"
                  placeholder="123456"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                />
              </label>
              <div className="button-row">
                <button type="button" className="button button--secondary" onClick={handleVerifyPhoneOtp}>{t('verifyPhone')}</button>
              </div>
            </>
          ) : null}

          <p className="muted-text">
            Current verification status: {user?.phoneVerified ? t('verified') : t('notVerified')}
          </p>
        </div>
      </section>

      <section className="card">
        <h2>{t('identityVerification')}</h2>
        <div className="stack">
          <p className="muted-text">
            Current status: {user?.identityVerificationStatus ?? t('none')}
            {user?.identityVerifiedAt ? ` (verified at ${formatDate(user.identityVerifiedAt)})` : ''}
          </p>

          {identityVerification?.currentRequest ? (
            <p className="muted-text">
              Latest request: {identityVerification.currentRequest.documentType} - submitted{' '}
              {formatDate(identityVerification.currentRequest.submittedAt)}
              {identityVerification.currentRequest.reviewedAt
                ? ` - reviewed ${formatDate(identityVerification.currentRequest.reviewedAt)}`
                : ''}
            </p>
          ) : (
            <p className="muted-text">{t('noIdentityRequest')}</p>
          )}

          <label className="field">
            <span className="label">{t('documentType')}</span>
            <select
              className="select"
              value={identityDocumentType}
              onChange={(event) => setIdentityDocumentType(event.target.value as IdentityDocumentType)}
              disabled={identityVerification ? !identityVerification.canSubmit : false}
            >
              <option value="nationalId">{t('nationalId')}</option>
              <option value="passport">{t('passport')}</option>
              <option value="driverLicense">{t('driverLicense')}</option>
              <option value="other">{t('other')}</option>
            </select>
          </label>

          <label className="field">
            <span className="label">{t('documentNumber')}</span>
            <input
              className="input"
              placeholder="****1234"
              value={identityDocumentNumberMasked}
              onChange={(event) => setIdentityDocumentNumberMasked(event.target.value)}
              disabled={identityVerification ? !identityVerification.canSubmit : false}
            />
          </label>

          <label className="field">
            <span className="label">{t('documentFront')}</span>
            <input
              className="input"
              placeholder="https://..."
              value={identityDocumentFrontUrl}
              onChange={(event) => setIdentityDocumentFrontUrl(event.target.value)}
              disabled={identityVerification ? !identityVerification.canSubmit : false}
            />
          </label>

          <label className="field">
            <span className="label">{t('documentBack')}</span>
            <input
              className="input"
              placeholder="https://..."
              value={identityDocumentBackUrl}
              onChange={(event) => setIdentityDocumentBackUrl(event.target.value)}
              disabled={identityVerification ? !identityVerification.canSubmit : false}
            />
          </label>

          <label className="field">
            <span className="label">{t('selfieUrl')}</span>
            <input
              className="input"
              placeholder="https://..."
              value={identitySelfieUrl}
              onChange={(event) => setIdentitySelfieUrl(event.target.value)}
              disabled={identityVerification ? !identityVerification.canSubmit : false}
            />
          </label>

          <label className="field">
            <span className="label">{t('note')}</span>
            <textarea
              className="textarea"
              value={identityNote}
              onChange={(event) => setIdentityNote(event.target.value)}
              disabled={identityVerification ? !identityVerification.canSubmit : false}
            />
          </label>

          <div className="button-row">
            <button
              type="button"
              className="button button--primary"
              onClick={handleSubmitIdentityVerification}
              disabled={identityVerification ? !identityVerification.canSubmit : false}
            >{t('submitIdentity')}</button>
          </div>
        </div>
      </section>

      <section className="grid grid--2">
        <div className="card">
          <h2>{t('favorites')}</h2>
          <div className="inline" style={{ marginBottom: '0.65rem' }}>
            <input
              className="input"
              type="number"
              min={1}
              placeholder={t('listingId')}
              value={favoriteListingId}
              onChange={(event) => setFavoriteListingId(event.target.value)}
            />
            <button type="button" className="button button--primary" onClick={handleAddFavorite}>{t('add')}</button>
            <button type="button" className="button button--ghost" onClick={loadData} disabled={loading}>{t('refresh')}</button>
          </div>

          <div className="list">
            {favorites.map((favorite) => (
              <div key={favorite.favoriteId} className="row">
                <div className="row__title">
                  <Link to={`/listings/${favorite.listing.id}`}>{favorite.listing.title}</Link>
                </div>
                <div className="row__meta">
                  {formatMoney(favorite.listing.priceAmount, favorite.listing.currency)} • {favorite.listing.countryName} /{' '}
                  {favorite.listing.cityName} • Added {formatDate(favorite.createdAt)}
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => handleRemoveFavorite(favorite.listing.id)}
                  >{t('remove')}</button>
                </div>
              </div>
            ))}
            {!loading && favorites.length === 0 ? <p className="muted-text">{t('noFavorites')}</p> : null}
          </div>
        </div>

        <div className="card">
          <h2>{t('savedSearches')}</h2>
          <div className="stack" style={{ marginBottom: '0.75rem' }}>
            <label className="field">
              <span className="label">{t('name')}</span>
              <input className="input" value={searchName} onChange={(event) => setSearchName(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">{t('filtersJson')}</span>
              <textarea
                className="textarea"
                value={searchFiltersText}
                onChange={(event) => setSearchFiltersText(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">{t('frequency')}</span>
              <select
                className="select"
                value={searchFrequency}
                onChange={(event) => setSearchFrequency(event.target.value as NotificationFrequency)}
              >
                <option value="instant">{t('instant')}</option>
                <option value="daily">{t('daily')}</option>
                <option value="weekly">{t('weekly')}</option>
              </select>
            </label>
            <div className="button-row">
              <button type="button" className="button button--primary" onClick={handleCreateSavedSearch}>{t('saveSearch')}</button>
            </div>
          </div>

          <div className="list">
            {savedSearches.map((savedSearch) => (
              <div key={savedSearch.id} className="row">
                <div className="row__title">
                  {savedSearch.name} ({savedSearch.notificationFrequency})
                </div>
                <pre className="row__meta" style={{ whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(savedSearch.filters, null, 2)}
                </pre>
                <div className="row__meta">Created {formatDate(savedSearch.createdAt)}</div>
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => handleDeleteSavedSearch(savedSearch.id)}
                  >{t('delete')}</button>
                </div>
              </div>
            ))}
            {!loading && savedSearches.length === 0 ? <p className="muted-text">{t('noSavedSearches')}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
