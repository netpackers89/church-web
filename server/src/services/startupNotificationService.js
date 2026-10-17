import { sendStartupConfirmation as sendEmailConfirmation } from './emailService.js';
import { sendStartupConfirmation as sendTelegramConfirmation } from './telegramService.js';
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

export function sendStartupConfirmations() {
  return Promise.all([
    checkProvider('email', sendEmailConfirmation),
    checkProvider('telegram', sendTelegramConfirmation),
  ]);
}