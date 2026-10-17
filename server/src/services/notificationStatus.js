const providers = {
  email: { status: 'pending', checkedAt: null, error: null },
  telegram: { status: 'pending', checkedAt: null, error: null },
};

export function updateProviderStatus(name, result) {
  providers[name] = { ...result, checkedAt: new Date().toISOString() };
}

export function getProviderStatus() {
  return {
    email: { ...providers.email },
    telegram: { ...providers.telegram },
  };
}