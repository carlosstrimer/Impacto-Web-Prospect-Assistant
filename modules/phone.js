// FILE: modules/phone.js
export function normalizePhone(raw, pais) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  if (!digits) return null;
  if (s.startsWith('+')) return '+' + digits;

  const p = (pais || '').toLowerCase();
  const isBR = /brasil|brazil|^br$/.test(p);
  const isUS = /eua|usa|estados unidos|^us$/.test(p);

  if (isUS) {
    if (digits.length === 10 || digits.length === 11) return '+1' + digits;
    if (digits.startsWith('1') && digits.length >= 11 && digits.length <= 12) return '+' + digits;
  }

  if (isBR) {
    if (digits.length === 10 || digits.length === 11) return '+55' + digits;
    if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) return '+' + digits;
  }

  // Já contém DDI do Brasil
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return '+' + digits;

  // 10-11 dígitos sem DDI: assume Brasil (caso predominante do time)
  if (digits.length === 10 || digits.length === 11) return '+55' + digits;

  // Internacional: aceita DDI já embutido
  if (digits.length >= 8 && digits.length <= 15) return '+' + digits;

  return null;
}

export function toWhatsAppUrl(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return 'https://wa.me/' + digits;
}