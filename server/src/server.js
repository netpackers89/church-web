import app from './app.js';
import { config } from './config/env.js';
import { ensureDatabaseReady, pool } from './config/db.js';
import { sendStartupConfirmations } from './services/startupNotificationService.js';
import { startTelegramBot, stopTelegramBot } from './telegram/index.js';
import { startDailyVerseScheduler, stopDailyVerseScheduler } from './services/dailyVerseService.js';
import { startGroupPostScheduler, stopGroupPostScheduler } from './services/groupPostScheduler.js';
import { closeEmailTransporter } from './email/transporter.js';

const server = app.listen(config.port, () => {
	console.info(`Church notification server listening on port ${config.port}.`);
	void ensureDatabaseReady()
		.then(() => console.info('[database] PostgreSQL is ready.'))
		.catch((error) => console.error(`[database] PostgreSQL is unavailable: ${error.message}`));
	void sendStartupConfirmations({ telegram: config.telegram.sendStartupConfirmation });
	startTelegramBot();
	startDailyVerseScheduler();
	startGroupPostScheduler();
});

let shutdownPromise;

function stopServer(signal) {
	if (shutdownPromise) return shutdownPromise;
	console.info(`${signal} received; shutting down server.`);
	stopDailyVerseScheduler();
	stopGroupPostScheduler();
	shutdownPromise = new Promise((resolve) => {
		server.close((error) => resolve(error));
	}).then(async (serverCloseError) => {
		if (serverCloseError) {
			console.error('[shutdown] HTTP server close failed:', serverCloseError.message);
		}
		const results = await Promise.allSettled([
			stopTelegramBot(),
			closeEmailTransporter(),
			pool.end(),
		]);
		const failed = results.filter((result) => result.status === 'rejected');
		for (const result of failed) {
			console.error('[shutdown] cleanup failed:', result.reason?.message || result.reason);
		}
		if (serverCloseError || failed.length) process.exitCode = 1;
	});
	return shutdownPromise;
}

process.on('SIGINT', () => stopServer('SIGINT'));
process.on('SIGTERM', () => stopServer('SIGTERM'));
