import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscriptionsService } from '../services/subscriptions.service';
import { asHttpError } from '../services/http';
import { formatDate } from '../utils/format';
import type {
  CurrentStoreSubscriptionDto,
  StorePlanDto,
  StoreSubscriptionStatus,
} from '../types/domain';

function statusBadgeClass(status: StoreSubscriptionStatus): string {
  if (status === 'ACTIVE') return 'badge badge--success';
  if (status === 'CANCELED') return 'badge badge--danger';
  return 'badge badge--muted';
}

export function SubscriptionsPage() {
  const { t } = useTranslation('subscriptions');
  const BILLING_CYCLES = [
    { months: 1 as const, label: t('monthly') },
    { months: 3 as const, label: t('quarterly') },
    { months: 12 as const, label: t('yearly') },
  ];
  const [plans, setPlans] = useState<StorePlanDto[]>([]);
  const [current, setCurrent] = useState<CurrentStoreSubscriptionDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<1 | 3 | 12>(1);
  const [autoRenew, setAutoRenew] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansResult, currentResult] = await Promise.all([
        subscriptionsService.listPlans(),
        subscriptionsService.current().catch(() => null),
      ]);
      setPlans(plansResult);
      setCurrent(currentResult);
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubscribe = async (planCode: string) => {
    setActionLoading(true);
    setMessage(null);
    setError(null);
    try {
      await subscriptionsService.subscribe(planCode, selectedCycle, autoRenew);
      setMessage(`Subscribed to ${planCode} plan successfully.`);
      await loadData();
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm(t('cancelConfirm'))) return;
    setActionLoading(true);
    setMessage(null);
    setError(null);
    try {
      await subscriptionsService.cancel();
      setMessage(t('canceledMsg'));
      await loadData();
    } catch (err) {
      setError(asHttpError(err).message);
    } finally {
      setActionLoading(false);
    }
  };

  function getPlanPrice(plan: StorePlanDto): number {
    if (selectedCycle === 12) return plan.priceUsdYearly;
    if (selectedCycle === 3) return plan.priceUsdQuarterly;
    return plan.priceUsdMonthly;
  }

  const activeSub = current?.subscription;
  const isActive = current?.active ?? false;

  return (
    <div>
      <h1 className="page-title">{t('title')}</h1>

      {!current?.eligibleForStorePlans && current !== null ? (
        <div className="alert alert--info">
          Store subscriptions are available for <strong>business profiles</strong> only. Upgrade your
          profile to unlock store plans.{' '}
          <Link to="/business-profile" className="link-inline">{t('openBusinessProfile')}</Link>
        </div>
      ) : null}

      {/* Current subscription */}
      {activeSub ? (
        <section className="card" style={{ marginBottom: '2rem' }}>
          <div className="card__header">
            <h2>{t('currentSubscription')}</h2>
            <span className={statusBadgeClass(activeSub.status)}>{activeSub.status}</span>
          </div>
          <div className="list">
            <div className="row">
              <span className="row__label">{t('plan')}</span>
              <span className="row__value">{activeSub.planName}</span>
            </div>
            <div className="row">
              <span className="row__label">{t('pricePaid')}</span>
              <span className="row__value">${activeSub.priceUsd.toFixed(2)}</span>
            </div>
            <div className="row">
              <span className="row__label">{t('started')}</span>
              <span className="row__value">{formatDate(activeSub.startedAt)}</span>
            </div>
            <div className="row">
              <span className="row__label">{t('expires')}</span>
              <span className="row__value">
                {formatDate(activeSub.expiresAt)}{' '}
                {isActive ? (
                  <span className="badge badge--success">{activeSub.daysRemaining}d left</span>
                ) : null}
              </span>
            </div>
            <div className="row">
              <span className="row__label">{t('autoRenew')}</span>
              <span className="row__value">{activeSub.autoRenew ? t('yes') : t('no')}</span>
            </div>
          </div>
          {isActive ? (
            <div style={{ padding: '1rem' }}>
              <button
                type="button"
                className="button button--danger"
                onClick={handleCancel}
                disabled={actionLoading}
              >{t('cancelSubscription')}</button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Billing cycle selector */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2>{t('chooseBillingCycle')}</h2>
        <div className="button-row">
          {BILLING_CYCLES.map((cycle) => (
            <button
              key={cycle.months}
              type="button"
              className={selectedCycle === cycle.months ? 'button button--primary' : 'button button--ghost'}
              onClick={() => setSelectedCycle(cycle.months)}
            >
              {cycle.label}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
          <input
            type="checkbox"
            checked={autoRenew}
            onChange={(e) => setAutoRenew(e.target.checked)}
          />{t('autoRenew')}</label>
      </section>

      {/* Plans grid */}
      {loading ? (
        <p>{t('loadingPlans')}</p>
      ) : (
        <div className="grid grid--3col">
          {plans.map((plan) => (
            <div key={plan.code} className="card">
              <div className="card__header">
                <h3>{plan.name}</h3>
                <span className="badge badge--muted">{plan.code}</span>
              </div>
              <div className="list">
                <div className="row">
                  <span className="row__label">{t('price')}</span>
                  <span className="row__value">
                    <strong>${getPlanPrice(plan).toFixed(2)}</strong>
                    {selectedCycle === 1 ? t('perMonth') : selectedCycle === 3 ? t('per3Months') : t('perYear')}
                  </span>
                </div>
                <div className="row">
                  <span className="row__label">{t('listingsPerMonth')}</span>
                  <span className="row__value">
                    {plan.maxListingsPerMonth === null ? t('unlimited') : plan.maxListingsPerMonth}
                  </span>
                </div>
                <div className="row">
                  <span className="row__label">{t('featuredSlots')}</span>
                  <span className="row__value">{plan.featuredSlots}</span>
                </div>
                <div className="row">
                  <span className="row__label">{t('analytics')}</span>
                  <span className="row__value" style={{ textTransform: 'capitalize' }}>
                    {plan.analyticsLevel}
                  </span>
                </div>
              </div>
              {current?.eligibleForStorePlans ? (
                <div style={{ padding: '1rem' }}>
                  <button
                    type="button"
                    className="button button--primary"
                    style={{ width: '100%' }}
                    onClick={() => handleSubscribe(plan.code)}
                    disabled={actionLoading || (isActive && activeSub?.planCode === plan.code)}
                  >
                    {isActive && activeSub?.planCode === plan.code ? t('currentPlanBtn') : t('subscribeBtn')}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {message ? <p className="alert alert--success" style={{ marginTop: '1rem' }}>{message}</p> : null}
      {error ? <p className="alert alert--danger" style={{ marginTop: '1rem' }}>{error}</p> : null}
    </div>
  );
}
