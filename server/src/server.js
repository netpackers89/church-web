import app from './app.js';
import { config } from './config/env.js';
import { ensureDatabaseReady, pool } from './config/db.js';
import { sendStartupConfirmations } from './services/startupNotificationService.js';
import { startTelegramBot, stopTelegramBot } from './services/telegramBotService.js';
import { startDailyVerseScheduler } from './services/dailyVerseService.js';

const server = app.listen(config.port, () => {
	console.info(`Church notification server listening on port ${config.port}.`);
	void ensureDatabaseReady()
		.then(() => console.info('[database] PostgreSQL is ready.'))
		.catch((error) => console.error(`[database] PostgreSQL is unavailable: ${error.message}`));
	void sendStartupConfirmations();
	startTelegramBot();
	startDailyVerseScheduler();
});

function stopServer(signal) {
	console.info(`${signal} received; shutting down server.`);
	server.close(async () => {
		await stopTelegramBot();
		await pool.end();
		process.exit(0);
	});
}

process.on('SIGINT', () => stopServer('SIGINT'));
process.on('SIGTERM', () => stopServer('SIGTERM'));
