export function normalizeIndianMobile(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;

  return null;
}

export function maskPhone(normalizedPhone: string): string {
  if (normalizedPhone.length < 4) return "**********";
  return `******${normalizedPhone.slice(-4)}`;
}
