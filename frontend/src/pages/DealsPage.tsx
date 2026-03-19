import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dealsService } from '../services/deals.service';
import { asHttpError } from '../services/http';
import { useAuthStore } from '../store/authStore';
import type { DealStatus, DealSummary } from '../types/domain';
import { formatDate, formatMoney } from '../utils/format';
import { translateBoolean, translateEnum } from '../utils/i18n';

type DealFilter = '' | DealStatus;

function pick(language: string, ar: string, en: string): string {
  return language.startsWith('ar') ? ar : en;
}

export function DealsPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isAdminOrModerator = user?.staffRole === 'ADMIN' || user?.staffRole === 'MODERATOR';
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<DealFilter>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [offerId, setOfferId] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [currency, setCurrency] = useState('');
  const [quantity, setQuantity] = useState('1');

  const [reviewDealId, setReviewDealId] = useState('');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');

  const loadDeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dealsService.listMyDeals(statusFilter || undefined);
      setDeals(result.items);
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleCreateFromOffer = async () => {
    const parsedOfferId = Number(offerId);
    if (!Number.isFinite(parsedOfferId) || parsedOfferId <= 0) return;

    setMessage(null);
    try {
      const created = await dealsService.createFromOffer({
        offerId: parsedOfferId,
        finalPrice: finalPrice ? Number(finalPrice) : undefined,
        currency: currency.trim().toUpperCase() || undefined,
        quantity: quantity ? Number(quantity) : 1,
      });
      setMessage(t('deals.dealCreatedMsg', { dealId: created.id, offerId: parsedOfferId }));
      setOfferId('');
      setFinalPrice('');
      setCurrency('');
      setQuantity('1');
      await loadDeals();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleConfirmDeal = async (dealId: number) => {
    setMessage(null);
    try {
      const confirmed = await dealsService.confirmDeal(dealId);
      setMessage(
        t('deals.dealConfirmedMsg', {
          dealId: confirmed.id,
          status: translateEnum(t, 'dealStatus', confirmed.status),
        }),
      );
      await loadDeals();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleCreateReview = async () => {
    const parsedDealId = Number(reviewDealId);
    const parsedRating = Number(rating);
    if (!Number.isFinite(parsedDealId) || parsedDealId <= 0) return;
    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) return;

    setMessage(null);
    try {
      const review = await dealsService.createReview(parsedDealId, {
        rating: parsedRating,
        comment: comment || undefined,
      });
      setMessage(t('deals.reviewSubmittedMsg', { reviewId: review.id }));
      setReviewDealId('');
      setRating('5');
      setComment('');
      await loadDeals();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleOpenDispute = async (dealId: number) => {
    const reason = window.prompt(t('deals.disputeReasonPrompt'), t('deals.disputeReasonDefault'))?.trim();
    if (!reason) return;

    const description = window.prompt(t('deals.disputeDetailsPrompt'), t('deals.disputeDetailsDefault'))?.trim();
    if (!description) return;

    setMessage(null);
    try {
      const result = await dealsService.openDispute(dealId, { reason, description });
      setMessage(t('deals.disputeOpenedMsg', { disputeId: result.dispute.id, dealId: result.deal.id }));
      await loadDeals();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleReviewDispute = async (dealId: number) => {
    const note = window.prompt(t('deals.reviewNotePrompt'), t('deals.reviewNoteDefault'))?.trim();
    setMessage(null);
    try {
      const result = await dealsService.reviewDispute(dealId, { note: note || undefined });
      setMessage(
        t('deals.disputeReviewedMsg', {
          disputeId: result.dispute.id,
          status: translateEnum(t, 'disputeStatus', result.dispute.status),
        }),
      );
      await loadDeals();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleCloseDispute = async (dealId: number) => {
    const resolution = window.prompt(t('deals.resolutionNotePrompt'), t('deals.resolutionNoteDefault'))?.trim();
    setMessage(null);
    try {
      const result = await dealsService.resolveDispute(dealId, {
        action: 'close_no_escrow',
        resolution: resolution || undefined,
      });
      setMessage(
        t('deals.disputeResolvedMsg', {
          disputeId: result.dispute.id,
          action: translateEnum(t, 'disputeResolutionAction', 'close_no_escrow'),
        }),
      );
      await loadDeals();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  return (
    <div className="stack">
      <h1 className="page-title">{t('deals.title')}</h1>
      <p className="page-subtitle">{t('deals.subtitle')}</p>

      <section className="card">
        <div className="card__header">
          <h2>{t('deals.myDeals')}</h2>
          <div className="inline">
            <select
              className="select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as DealFilter)}
            >
              <option value="">{t('deals.allStatuses')}</option>
              <option value="PENDING">{translateEnum(t, 'dealStatus', 'PENDING')}</option>
              <option value="CONFIRMED">{translateEnum(t, 'dealStatus', 'CONFIRMED')}</option>
              <option value="COMPLETED">{translateEnum(t, 'dealStatus', 'COMPLETED')}</option>
              <option value="RATED">{translateEnum(t, 'dealStatus', 'RATED')}</option>
              <option value="CANCELLED">{translateEnum(t, 'dealStatus', 'CANCELLED')}</option>
              <option value="DISPUTED">{translateEnum(t, 'dealStatus', 'DISPUTED')}</option>
            </select>
            <button type="button" className="button button--secondary" onClick={loadDeals} disabled={loading}>
              {t('deals.refresh')}
            </button>
          </div>
        </div>

        <p className="muted-text">
          {pick(
            i18n.language,
            'هذه الصفحة توثق الاتفاق بين الطرفين فقط، ولا تتضمن أي دفع داخلي داخل المنصة عند الإطلاق.',
            'This page documents the agreement only. Souqly does not handle internal item payments at launch.',
          )}
        </p>

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="muted-text">{message}</p> : null}

        <div className="list">
          {deals.map((deal) => (
            <div key={deal.id} className="row">
              <div className="row__title">
                {t('deals.deal', { id: deal.id })} • {translateEnum(t, 'dealStatus', deal.status)}
              </div>
              <div className="row__meta">
                {t('deals.listing', { title: deal.listing.title })} • {formatMoney(deal.finalPrice, deal.currency)} •{' '}
                {t('deals.qty')} {deal.quantity} • {t('deals.created')} {formatDate(deal.createdAt)}
              </div>
              <div className="row__meta">
                {t('deals.buyerConfirmed')} {translateBoolean(t, deal.buyerConfirmed)} • {t('deals.sellerConfirmed')}{' '}
                {translateBoolean(t, deal.sellerConfirmed)}
              </div>
              {deal.meetingPlace ? (
                <div className="row__meta">
                  {pick(i18n.language, 'مكان اللقاء', 'Meeting place')}: {deal.meetingPlace}
                </div>
              ) : null}
              <div className="button-row">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => handleConfirmDeal(deal.id)}
                  disabled={deal.status === 'COMPLETED' || deal.status === 'RATED' || deal.status === 'CANCELLED' || deal.status === 'DISPUTED'}
                >
                  {t('deals.confirmDeal')}
                </button>
                <button
                  type="button"
                  className="button button--warning"
                  onClick={() => handleOpenDispute(deal.id)}
                  disabled={deal.status === 'CANCELLED' || deal.status === 'DISPUTED'}
                >
                  {t('deals.openDispute')}
                </button>
                {isAdminOrModerator && deal.status === 'DISPUTED' ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => handleReviewDispute(deal.id)}
                  >
                    {t('deals.reviewDispute')}
                  </button>
                ) : null}
                {isAdminOrModerator && deal.status === 'DISPUTED' ? (
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => handleCloseDispute(deal.id)}
                  >
                    {pick(i18n.language, 'إغلاق النزاع', 'Close Dispute')}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {!loading && deals.length === 0 ? <p className="muted-text">{t('deals.noDealsFound')}</p> : null}
        </div>
      </section>

      <section className="grid grid--2">
        <div className="card">
          <h2>{t('deals.createDealFromOffer')}</h2>
          <div className="stack">
            <label className="field">
              <span className="label">{t('deals.offerId')}</span>
              <input className="input" type="number" min={1} value={offerId} onChange={(event) => setOfferId(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">{t('deals.finalPriceOptional')}</span>
              <input className="input" type="number" min={0} value={finalPrice} onChange={(event) => setFinalPrice(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">{t('deals.currencyOptional')}</span>
              <input className="input" value={currency} onChange={(event) => setCurrency(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">{t('deals.quantity')}</span>
              <input className="input" type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </label>
            <button type="button" className="button button--warning" onClick={handleCreateFromOffer}>
              {t('deals.createDeal')}
            </button>
          </div>
        </div>

        <div className="card">
          <h2>{t('deals.submitReview')}</h2>
          <div className="stack">
            <label className="field">
              <span className="label">{t('deals.dealId')}</span>
              <input className="input" type="number" min={1} value={reviewDealId} onChange={(event) => setReviewDealId(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">{t('deals.rating')}</span>
              <input className="input" type="number" min={1} max={5} value={rating} onChange={(event) => setRating(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">{t('deals.commentOptional')}</span>
              <textarea className="textarea" rows={4} value={comment} onChange={(event) => setComment(event.target.value)} />
            </label>
            <button type="button" className="button button--primary" onClick={handleCreateReview}>
              {t('deals.submitReview')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
