// Masks digits 1-4 of Spanish DNI (format: 8 digits + letter)
const DNI_RE = /\b(\d{4})(\d{4}[A-Z])\b/g;
// Masks middle groups of IBAN, leaving country code and last 4 chars
const IBAN_RE = /\b([A-Z]{2}\d{2})([\s\d]{10,30})(\d{4})\b/g;

export function maskContent(text: string): string {
  return text
    .replace(DNI_RE, '****$2')
    .replace(IBAN_RE, (_, prefix, middle, last) =>
      `${prefix} ${middle.replace(/\d/g, '*').replace(/\s+/g, ' ').trim()} ${last}`
    );
}

export function containsSensitiveData(text: string): boolean {
  DNI_RE.lastIndex = 0;
  IBAN_RE.lastIndex = 0;
  return DNI_RE.test(text) || IBAN_RE.test(text);
}
