const METHOD_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

function safeHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizePaymentMethods(value, legacy = {}) {
  const configured = Array.isArray(value) ? value : [];
  const methods = configured.flatMap((method) => {
    if (!method || method.isPublic === false) return [];
    const id = typeof method.id === 'string' ? method.id.trim() : '';
    const name = typeof method.name === 'string' ? method.name.trim().slice(0, 120) : '';
    const type = typeof method.type === 'string' ? method.type.trim().toUpperCase() : 'BANK';
    const accountHolder = typeof method.accountHolder === 'string' ? method.accountHolder.trim().slice(0, 160) : '';
    const accountNumber = typeof method.accountNumber === 'string' ? method.accountNumber.trim().slice(0, 80) : '';
    const phoneNumber = typeof method.phoneNumber === 'string' ? method.phoneNumber.trim().slice(0, 40) : '';
    const currency = typeof method.currency === 'string' ? method.currency.trim().toUpperCase() : 'ETB';
    if (!METHOD_ID_PATTERN.test(id) || !name || !['BANK', 'TELEBIRR', 'OTHER'].includes(type)) return [];
    if (type === 'TELEBIRR' ? !phoneNumber : !accountNumber) return [];
    if (!CURRENCY_PATTERN.test(currency)) return [];
    return [{
      id, name, type, accountHolder,
      accountNumber: accountNumber || null,
      phoneNumber: phoneNumber || null,
      branch: typeof method.branch === 'string' ? method.branch.trim().slice(0, 200) : '',
      instructions: typeof method.instructions === 'string' ? method.instructions.trim().slice(0, 1000) : '',
      logoUrl: safeHttpUrl(method.logoUrl),
      currency,
    }];
  });

  if (methods.length) return methods;
  const bank = legacy.bank_account && typeof legacy.bank_account === 'object' ? legacy.bank_account : {};
  const bankName = String(bank.bankName ?? legacy.bankName ?? '').trim();
  const accountNumber = String(bank.accountNumber ?? legacy.accountNumber ?? '').trim();
  if (!bankName || !accountNumber) return [];
  const currency = String(bank.currency ?? legacy.currency ?? 'ETB').trim().toUpperCase();
  return [{
    id: 'legacy-bank-account',
    name: bankName,
    type: 'BANK',
    accountHolder: String(bank.accountHolder ?? legacy.accountHolder ?? '').trim(),
    accountNumber,
    phoneNumber: null,
    branch: String(bank.bankBranch ?? legacy.bankBranch ?? '').trim(),
    instructions: String(bank.transferInstructions ?? legacy.transferInstructions ?? '').trim(),
    logoUrl: null,
    currency: CURRENCY_PATTERN.test(currency) ? currency : 'ETB',
  }];
}

export function validatePaymentReference(value) {
  if (typeof value !== 'string') return null;
  const reference = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._/#-]{2,199}$/.test(reference)) {
    throw Object.assign(new Error('Enter a valid transaction reference (3–200 letters, numbers, spaces, or . _ / # -).'), { status: 400 });
  }
  return reference;
}
