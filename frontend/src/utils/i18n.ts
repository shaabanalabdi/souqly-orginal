import type { TFunction } from 'i18next';

function rootKey(path: string): string {
  return `translation:${path}`;
}

export function translateEnum(
  t: TFunction,
  group: string,
  value: string | null | undefined,
  fallback?: string,
): string {
  if (!value) {
    return fallback ?? t(rootKey('common.notAvailable'));
  }

  return t(rootKey(`enums.${group}.${value}`), { defaultValue: fallback ?? value });
}

export function translateBoolean(t: TFunction, value: boolean): string {
  return value ? t(rootKey('common.yes')) : t(rootKey('common.no'));
}

export function translateNullableText(t: TFunction, value: string | null | undefined): string {
  return value ?? t(rootKey('common.notAvailable'));
}
