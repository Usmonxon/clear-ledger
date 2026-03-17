/** Format a numeric string with space as thousands separator (e.g. "1 234 567") */
export function formatWithSeparators(value: string): string {
  if (!value) return "";
  // Split integer and decimal parts
  const [integer, decimal] = value.split(".");
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decimal !== undefined ? `${formatted}.${decimal}` : formatted;
}

/** Strip everything except digits and a single decimal point */
export function stripNonNumeric(value: string): string {
  // Remove spaces and non-numeric chars except dot
  let cleaned = value.replace(/[^\d.]/g, "");
  // Ensure only one decimal point
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex !== -1) {
    cleaned = cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, "");
  }
  return cleaned;
}
