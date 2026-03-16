export const STORE_PLAN_CODES = ['BASIC', 'PRO', 'PREMIUM'] as const;

export type StorePlanCode = (typeof STORE_PLAN_CODES)[number];

export interface StorePlanDefinition {
    code: StorePlanCode;
    name: string;
    priceUsdMonthly: number;
    maxListingsPerMonth: number | null;
    featuredSlots: number;
    analyticsLevel: 'basic' | 'advanced';
}

export const STORE_PLAN_CATALOG: StorePlanDefinition[] = [
    {
        code: 'BASIC',
        name: 'Basic Store',
        priceUsdMonthly: 19,
        maxListingsPerMonth: 200,
        featuredSlots: 2,
        analyticsLevel: 'basic',
    },
    {
        code: 'PRO',
        name: 'Pro Store',
        priceUsdMonthly: 49,
        maxListingsPerMonth: null,
        featuredSlots: 8,
        analyticsLevel: 'advanced',
    },
    {
        code: 'PREMIUM',
        name: 'Premium Store',
        priceUsdMonthly: 99,
        maxListingsPerMonth: null,
        featuredSlots: 20,
        analyticsLevel: 'advanced',
    },
];

export function getStorePlanByCode(code: StorePlanCode): StorePlanDefinition {
    return STORE_PLAN_CATALOG.find((plan) => plan.code === code)!;
}
