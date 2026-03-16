export interface OfferSystemMessagePayload {
  offerId: number;
  amount: number;
  quantity: number;
  status: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseOfferSystemMessage(content: string): OfferSystemMessagePayload | null {
  try {
    const parsed = JSON.parse(content);
    if (!isRecord(parsed)) {
      return null;
    }

    if (
      typeof parsed.offerId === 'number' &&
      typeof parsed.amount === 'number' &&
      typeof parsed.quantity === 'number' &&
      typeof parsed.status === 'string'
    ) {
      return {
        offerId: parsed.offerId,
        amount: parsed.amount,
        quantity: parsed.quantity,
        status: parsed.status,
      };
    }
  } catch {
    return null;
  }

  return null;
}
