// fiscalScheduler.js
const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const settingsManager = require('./groupSettingsManager');

const CHECK_INTERVAL = 60 * 1000; // Verifica a cada 1 minuto
const FISCAL_STICKER_PATH = path.join(__dirname, 'assets', 'fiscal.webp');
const FISCAL_MAX_SENDS_PER_DAY = 3;
const FISCAL_MIN_HOURS_BETWEEN_SENDS = 4;
const FISCAL_SEND_CHANCE = 1 / 240; // Aprox. 3x por dia (1 vez a cada 4 horas em média)

let schedulerIntervalId = null;
let fiscalState = {}; // { 'groupId': { sentCount: 0, lastSent: timestamp } }
let lastResetDate = dayjs().date();

async function checkAndSendFiscalSticker(sock) {
    const now = dayjs();
    
    // Reinicia as contagens diárias à meia-noite
    if (now.date() !== lastResetDate) {
        console.log('[Fiscal Scheduler] A reiniciar contagens diárias.');
        fiscalState = {};
        lastResetDate = now.date();
    }

    const allSettings = settingsManager.getAllSettings();
    const fiscalGroups = Object.keys(allSettings).filter(jid => allSettings[jid].fiscalMode === 'on');

    if (fiscalGroups.length === 0) return;

    for (const groupId of fiscalGroups) {
        const state = fiscalState[groupId] || { sentCount: 0, lastSent: 0 };
        
        const hoursSinceLastSend = dayjs(state.lastSent).isValid() ? now.diff(dayjs(state.lastSent), 'hour') : FISCAL_MIN_HOURS_BETWEEN_SENDS + 1;
        const shouldSend = Math.random() < FISCAL_SEND_CHANCE;

        if (state.sentCount < FISCAL_MAX_SENDS_PER_DAY && hoursSinceLastSend >= FISCAL_MIN_HOURS_BETWEEN_SENDS && shouldSend) {
            console.log(`[Fiscal Scheduler] A enviar sticker para o grupo ${groupId}`);
            try {
                const stickerBuffer = await fs.readFile(FISCAL_STICKER_PATH);
                const sticker = new Sticker(stickerBuffer, {
                    pack: 'Fiscalização',
                    author: 'Julia Bot',
                    type: StickerTypes.DEFAULT,
			quality: 75,
                });
                await sock.sendMessage(groupId, await sticker.toMessage());

                // Atualiza o estado
                state.sentCount++;
                state.lastSent = now.valueOf();
                fiscalState[groupId] = state;

            } catch (error) {
                console.error(`[Fiscal Scheduler] Falha ao enviar sticker para ${groupId}:`, error);
            }
        }
    }
}

function initializeFiscalScheduler(sock) {
    if (schedulerIntervalId) return;
    
    console.log(`[Fiscal Scheduler] Agendador de fiscalização iniciado.`);
    
    schedulerIntervalId = setInterval(() => {
        checkAndSendFiscalSticker(sock);
    }, CHECK_INTERVAL);
}

function stopFiscalScheduler() {
    if (schedulerIntervalId) {
        clearInterval(schedulerIntervalId);
        schedulerIntervalId = null;
        console.log("[Fiscal Scheduler] Agendador de fiscalização parado.");
    }
}

module.exports = { 
    initializeFiscalScheduler, 
    stopFiscalScheduler,
};

