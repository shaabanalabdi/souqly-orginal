export interface TrustBadgeLabels {
  email: string;
  phone: string;
  id: string;
  sectionLabel: string;
}

export interface TrustBadgeProps {
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerified: boolean;
  className?: string;
  labels?: TrustBadgeLabels;
}

const DEFAULT_LABELS: TrustBadgeLabels = {
  email: 'البريد موثق',
  phone: 'الهاتف موثق',
  id: 'الهوية موثقة',
  sectionLabel: 'مؤشرات التوثيق',
};

function BadgeItem({ label, verified }: { label: string; verified: boolean }) {
  return (
    <li
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
        verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-muted'
      }`}
    >
      <span
        aria-hidden
        className={`inline-flex size-4 items-center justify-center rounded-full text-[10px] font-bold ${
          verified ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
        }`}
      >
        {verified ? '✓' : '•'}
      </span>
      <span>{label}</span>
    </li>
  );
}

export function TrustBadge({
  emailVerified,
  phoneVerified,
  idVerified,
  className = '',
  labels = DEFAULT_LABELS,
}: TrustBadgeProps) {
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`} aria-label={labels.sectionLabel}>
      <BadgeItem label={labels.email} verified={emailVerified} />
      <BadgeItem label={labels.phone} verified={phoneVerified} />
      <BadgeItem label={labels.id} verified={idVerified} />
    </ul>
  );
}
