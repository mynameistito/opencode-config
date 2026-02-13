const ISO_SUFFIX_REGEX = /\.\d+Z$/;

export function formatDate(date: Date): string {
  return date.toISOString().replace(ISO_SUFFIX_REGEX, "");
}

export function getTimeWindow(hours: number): {
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const start = new Date(now.getTime() - hours * 60 * 60 * 1000);
  return {
    startTime: formatDate(start),
    endTime: formatDate(now),
  };
}

export function validateHours(hours: unknown): number {
  if (hours === undefined) {
    return 24;
  }
  const parsed = Number(hours);
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid hours value: ${hours}. Must be a positive number.`
    );
  }
  return parsed;
}
