export const TARGET_MARKET_COUNTRY_CODES = ['SY', 'JO', 'LB', 'PS', 'IQ'] as const;

const targetMarketCountrySet = new Set<string>(TARGET_MARKET_COUNTRY_CODES);

export function isTargetMarketCountry(code: string): boolean {
  return targetMarketCountrySet.has(code.toUpperCase());
}

export function filterTargetMarketCountries<T extends { code: string }>(countries: T[]): T[] {
  return countries.filter((country) => isTargetMarketCountry(country.code));
}
