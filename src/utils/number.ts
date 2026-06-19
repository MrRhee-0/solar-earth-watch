export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function compactNumber(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits
  });
}

export function decimateForDisplay<T>(items: T[], maxPoints = 360): T[] {
  if (items.length <= maxPoints) {
    return items.slice();
  }

  const stride = Math.ceil(items.length / maxPoints);
  return items.filter((_, index) => index % stride === 0);
}
