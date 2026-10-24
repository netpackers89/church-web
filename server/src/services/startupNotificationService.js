import { sendStartupConfirmation as sendEmailConfirmation } from '../email/index.js';
import { sendStartupConfirmation as sendTelegramConfirmation } from '../telegram/services/messaging.js';
import { updateProviderStatus } from './notificationStatus.js';

async function checkProvider(name, sendConfirmation) {
  try {
    const details = await sendConfirmation();
    updateProviderStatus(name, { status: 'delivered', error: null });
    console.info(`[notifications] ${name}: startup confirmation delivered.`);
    return { provider: name, status: 'delivered', details };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown provider error.';
    updateProviderStatus(name, { status: 'failed', error: message });
    console.error(`[notifications] ${name}: startup confirmation failed: ${message}`);
    return { provider: name, status: 'failed', error: message };
  }
}

export function sendStartupConfirmations({ telegram = false } = {}) {
  const checks = [checkProvider('email', sendEmailConfirmation)];
  if (telegram) checks.push(checkProvider('telegram', sendTelegramConfirmation));
  return Promise.all(checks);
}
