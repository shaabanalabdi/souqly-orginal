function getDocumentLocale(): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }

  return document.documentElement.lang || undefined;
}

function getFallbackText(): string {
  const locale = getDocumentLocale();
  return locale?.startsWith('ar') ? 'غير متوفر' : 'N/A';
}

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount === null || amount === undefined) {
    return getFallbackText();
  }

  const safeCurrency = currency ?? 'USD';
  try {
    return new Intl.NumberFormat(getDocumentLocale(), {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${safeCurrency}`;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return getFallbackText();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(getDocumentLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}
