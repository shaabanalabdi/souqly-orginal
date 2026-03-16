import { useEffect, useState } from 'react';
import { dealsService } from '../services/deals.service';
import { asHttpError } from '../services/http';
import type { DealStatus, DealSummary } from '../types/domain';
import { formatDate, formatMoney } from '../utils/format';
import { useAuthStore } from '../store/authStore';

type DealFilter = '' | DealStatus;

export function DealsPage() {
  const user = useAuthStore((state) => state.user);
  const isAdminOrModerator =
    user?.staffRole === 'ADMIN'
    || user?.staffRole === 'MODERATOR';
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
      setMessage(`Deal #${created.id} created from offer #${parsedOfferId}.`);
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
      setMessage(`Deal #${confirmed.id} updated to ${confirmed.status}.`);
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
      setMessage(`Review #${review.id} submitted.`);
      setReviewDealId('');
      setRating('5');
      setComment('');
      await loadDeals();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleHoldEscrow = async (dealId: number) => {
    setMessage(null);
    try {
      const updated = await dealsService.holdEscrow(dealId);
      setMessage(`Escrow held for deal #${updated.id}.`);
      await loadDeals();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleReleaseEscrow = async (dealId: number) => {
    setMessage(null);
    try {
      const updated = await dealsService.releaseEscrow(dealId);
      setMessage(`Escrow released for deal #${updated.id}.`);
      await loadDeals();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleRefundEscrow = async (dealId: number) => {
    setMessage(null);
    try {
      const updated = await dealsService.refundEscrow(dealId);
      setMessage(`Escrow refunded for deal #${updated.id}.`);
      await loadDeals();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleOpenDispute = async (dealId: number) => {
    const reason = window.prompt('Dispute reason (short):', 'Item condition mismatch')?.trim();
    if (!reason) return;
    const description = window
      .prompt('Dispute details:', 'Please provide full dispute details here.')
      ?.trim();
    if (!description) return;

    setMessage(null);
    try {
      const result = await dealsService.openDispute(dealId, { reason, description });
      setMessage(`Dispute #${result.dispute.id} opened for deal #${result.deal.id}.`);
      await loadDeals();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleReviewDispute = async (dealId: number) => {
    const note = window.prompt('Review note (optional):', 'Moderator is reviewing this dispute.')?.trim();
    setMessage(null);
    try {
      const result = await dealsService.reviewDispute(dealId, { note: note || undefined });
      setMessage(`Dispute #${result.dispute.id} moved to ${result.dispute.status}.`);
      await loadDeals();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  const handleResolveDispute = async (
    dealId: number,
    action: 'release_escrow' | 'refund_escrow' | 'close_no_escrow',
  ) => {
    const resolution = window.prompt('Resolution note (optional):', 'Resolved by moderation decision.')?.trim();
    setMessage(null);
    try {
      const result = await dealsService.resolveDispute(dealId, {
        action,
        resolution: resolution || undefined,
      });
      setMessage(`Dispute #${result.dispute.id} resolved with action ${action}.`);
      await loadDeals();
    } catch (err) {
      setMessage(asHttpError(err).message);
    }
  };

  return (
    <div className="stack">
      <h1 className="page-title">Deals</h1>
      <p className="page-subtitle">Create deal from accepted offer, confirm, and submit reviews.</p>

      <section className="card">
        <div className="card__header">
          <h2>My deals</h2>
          <div className="inline">
            <select
              className="select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as DealFilter)}
            >
              <option value="">All statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="DISPUTED">DISPUTED</option>
            </select>
            <button type="button" className="button button--secondary" onClick={loadDeals} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="muted-text">{message}</p> : null}

        <div className="list">
          {deals.map((deal) => (
            <div key={deal.id} className="row">
              <div className="row__title">
                Deal #{deal.id} • {deal.status}
              </div>
              <div className="row__meta">
                Listing: {deal.listing.title} • {formatMoney(deal.finalPrice, deal.currency)} • Qty {deal.quantity} •
                {` `}Created {formatDate(deal.createdAt)}
              </div>
              <div className="row__meta">
                Buyer confirmed: {deal.buyerConfirmed ? 'Yes' : 'No'} • Seller confirmed:{' '}
                {deal.sellerConfirmed ? 'Yes' : 'No'}
              </div>
              <div className="row__meta">
                Escrow: {deal.escrow.status}
                {deal.escrow.amount !== null && deal.escrow.currency ? (
                  <> • {formatMoney(deal.escrow.amount, deal.escrow.currency)}</>
                ) : null}
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => handleConfirmDeal(deal.id)}
                  disabled={deal.status === 'COMPLETED' || deal.status === 'CANCELLED' || deal.status === 'DISPUTED'}
                >
                  Confirm deal
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => handleHoldEscrow(deal.id)}
                  disabled={deal.escrow.status !== 'NONE' || deal.status === 'CANCELLED' || deal.status === 'DISPUTED'}
                >
                  Hold escrow
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => handleReleaseEscrow(deal.id)}
                  disabled={deal.escrow.status !== 'HELD' || deal.status === 'DISPUTED'}
                >
                  Release escrow
                </button>
                {isAdminOrModerator ? (
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => handleRefundEscrow(deal.id)}
                    disabled={deal.escrow.status !== 'HELD'}
                  >
                    Refund escrow
                  </button>
                ) : null}
                <button
                  type="button"
                  className="button button--warning"
                  onClick={() => handleOpenDispute(deal.id)}
                  disabled={deal.status === 'CANCELLED' || deal.status === 'DISPUTED'}
                >
                  Open dispute
                </button>
                {isAdminOrModerator && deal.status === 'DISPUTED' ? (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => handleReviewDispute(deal.id)}
                  >
                    Review dispute
                  </button>
                ) : null}
                {isAdminOrModerator && deal.status === 'DISPUTED' ? (
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => handleResolveDispute(deal.id, 'release_escrow')}
                  >
                    Resolve: Release
                  </button>
                ) : null}
                {isAdminOrModerator && deal.status === 'DISPUTED' ? (
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => handleResolveDispute(deal.id, 'refund_escrow')}
                  >
                    Resolve: Refund
                  </button>
                ) : null}
                {isAdminOrModerator && deal.status === 'DISPUTED' ? (
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => handleResolveDispute(deal.id, 'close_no_escrow')}
                  >
                    Resolve: Close
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {!loading && deals.length === 0 ? <p className="muted-text">No deals found.</p> : null}
        </div>
      </section>

      <section className="grid grid--2">
        <div className="card">
          <h2>Create Deal From Offer</h2>
          <div className="stack">
            <label className="field">
              <span className="label">Offer ID</span>
              <input className="input" type="number" min={1} value={offerId} onChange={(event) => setOfferId(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">Final price (optional)</span>
              <input
                className="input"
                type="number"
                min={0}
                value={finalPrice}
                onChange={(event) => setFinalPrice(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">Currency (optional)</span>
              <input className="input" value={currency} onChange={(event) => setCurrency(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">Quantity</span>
              <input
                className="input"
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
            <button type="button" className="button button--warning" onClick={handleCreateFromOffer}>
              Create deal
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Submit Review</h2>
          <div className="stack">
            <label className="field">
              <span className="label">Deal ID</span>
              <input
                className="input"
                type="number"
                min={1}
                value={reviewDealId}
                onChange={(event) => setReviewDealId(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">Rating (1-5)</span>
              <input className="input" type="number" min={1} max={5} value={rating} onChange={(event) => setRating(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">Comment</span>
              <input className="input" value={comment} onChange={(event) => setComment(event.target.value)} />
            </label>
            <button type="button" className="button button--secondary" onClick={handleCreateReview}>
              Submit review
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
