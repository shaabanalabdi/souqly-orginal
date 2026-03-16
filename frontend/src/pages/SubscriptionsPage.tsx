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

const BILLING_CYCLES = [
  { months: 1 as const, label: 'Monthly' },
  { months: 3 as const, label: 'Quarterly (−5%)' },
  { months: 12 as const, label: 'Yearly (−15%)' },
];

function statusBadgeClass(status: StoreSubscriptionStatus): string {
  if (status === 'ACTIVE') return 'badge badge--success';
  if (status === 'CANCELED') return 'badge badge--danger';
  return 'badge badge--muted';
}

export function SubscriptionsPage() {
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
    if (!window.confirm('Cancel your current subscription?')) return;
    setActionLoading(true);
    setMessage(null);
    setError(null);
    try {
      await subscriptionsService.cancel();
      setMessage('Subscription canceled.');
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
      <h1 className="page-title">Store Subscriptions</h1>

      {!current?.eligibleForStorePlans && current !== null ? (
        <div className="alert alert--info">
          Store subscriptions are available for <strong>business profiles</strong> only. Upgrade your
          profile to unlock store plans.{' '}
          <Link to="/business-profile" className="link-inline">
            Open Business Profile
          </Link>
        </div>
      ) : null}

      {/* Current subscription */}
      {activeSub ? (
        <section className="card" style={{ marginBottom: '2rem' }}>
          <div className="card__header">
            <h2>Current Subscription</h2>
            <span className={statusBadgeClass(activeSub.status)}>{activeSub.status}</span>
          </div>
          <div className="list">
            <div className="row">
              <span className="row__label">Plan</span>
              <span className="row__value">{activeSub.planName}</span>
            </div>
            <div className="row">
              <span className="row__label">Price paid</span>
              <span className="row__value">${activeSub.priceUsd.toFixed(2)}</span>
            </div>
            <div className="row">
              <span className="row__label">Started</span>
              <span className="row__value">{formatDate(activeSub.startedAt)}</span>
            </div>
            <div className="row">
              <span className="row__label">Expires</span>
              <span className="row__value">
                {formatDate(activeSub.expiresAt)}{' '}
                {isActive ? (
                  <span className="badge badge--success">{activeSub.daysRemaining}d left</span>
                ) : null}
              </span>
            </div>
            <div className="row">
              <span className="row__label">Auto-renew</span>
              <span className="row__value">{activeSub.autoRenew ? 'Yes' : 'No'}</span>
            </div>
          </div>
          {isActive ? (
            <div style={{ padding: '1rem' }}>
              <button
                type="button"
                className="button button--danger"
                onClick={handleCancel}
                disabled={actionLoading}
              >
                Cancel Subscription
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Billing cycle selector */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Choose Billing Cycle</h2>
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
          />
          Auto-renew
        </label>
      </section>

      {/* Plans grid */}
      {loading ? (
        <p>Loading plans…</p>
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
                  <span className="row__label">Price</span>
                  <span className="row__value">
                    <strong>${getPlanPrice(plan).toFixed(2)}</strong>
                    {selectedCycle === 1 ? '/mo' : selectedCycle === 3 ? '/3 mo' : '/yr'}
                  </span>
                </div>
                <div className="row">
                  <span className="row__label">Listings / month</span>
                  <span className="row__value">
                    {plan.maxListingsPerMonth === null ? 'Unlimited' : plan.maxListingsPerMonth}
                  </span>
                </div>
                <div className="row">
                  <span className="row__label">Featured slots</span>
                  <span className="row__value">{plan.featuredSlots}</span>
                </div>
                <div className="row">
                  <span className="row__label">Analytics</span>
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
                    {isActive && activeSub?.planCode === plan.code ? 'Current Plan' : 'Subscribe'}
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
