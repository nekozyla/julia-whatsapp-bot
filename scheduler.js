// scheduler.js
const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const REMINDERS_FILE_PATH = path.join(__dirname, 'reminders.json');
const CHECK_INTERVAL = 60 * 1000; // Verifica a cada 60 segundos

let schedulerIntervalId = null; 
let remindersCache = []; // Cache em memória para acesso rápido

/**
 * Lê os lembretes do arquivo JSON para o cache.
 */
async function loadReminders() {
    try {
        const data = await fs.readFile(REMINDERS_FILE_PATH, 'utf-8');
        remindersCache = JSON.parse(data);
        console.log(`[Scheduler] ${remindersCache.length} lembretes carregados do arquivo.`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Scheduler] Arquivo de lembretes não encontrado, iniciando um novo.');
            remindersCache = [];
        } else {
            console.error("[Scheduler] Erro ao carregar lembretes:", error);
        }
    }
}

/**
 * Salva o cache de lembretes de volta no arquivo JSON.
 */
async function saveReminders() {
    try {
        await fs.writeFile(REMINDERS_FILE_PATH, JSON.stringify(remindersCache, null, 2));
    } catch (error) {
        console.error("[Scheduler] Erro ao salvar lembretes:", error);
    }
}

/**
 * Adiciona um novo lembrete e salva a lista.
 * @param {object} newReminder - O objeto do novo lembrete.
 */
async function addReminder(newReminder) {
    remindersCache.push(newReminder);
    await saveReminders();
}

/**
 * Retorna todos os lembretes ativos para um chat específico.
 * @param {string} chatId - O JID do chat.
 * @returns {Array} - Uma lista de lembretes.
 */
function getRemindersForChat(chatId) {
    return remindersCache.filter(r => r.targetJid === chatId);
}

/**
 * Verifica e envia os lembretes pendentes.
 * @param {object} sock - A instância do socket Baileys.
 */
async function checkAndSendReminders(sock) {
    const now = dayjs();
    let remindersWereUpdated = false;

    for (const reminder of remindersCache) {
        const triggerTime = dayjs(reminder.triggerTimestamp);

        if (now.isSame(triggerTime, 'minute') || now.isAfter(triggerTime)) {
            console.log(`[Scheduler] Disparando lembrete (ID: ${reminder.id}) para ${reminder.targetJid}`);
            try {
                // Monta a mensagem com menção ao criador do lembrete
                const creatorMention = `@${reminder.creatorJid.split('@')[0]}`;
                const reminderMessage = `🔔 *Lembrete Agendado* 🔔\n\n${reminder.message}\n\n_Agendado por ${creatorMention}_`;
                
                await sock.sendMessage(reminder.targetJid, { 
                    text: reminderMessage,
                    mentions: [reminder.creatorJid] 
                });
                
                remindersWereUpdated = true;

                if (reminder.isRecurring) {
                    // Reagenda o lembrete recorrente para o próximo ano na mesma data e hora
                    reminder.triggerTimestamp = triggerTime.add(1, 'year').valueOf();
                    console.log(`[Scheduler] Lembrete recorrente (ID: ${reminder.id}) reagendado para ${dayjs(reminder.triggerTimestamp).format('DD/MM/YYYY HH:mm')}`);
                } else {
                    // Marca o lembrete como "enviado" para ser removido depois
                    reminder.sent = true;
                }
            } catch (error) {
                console.error(`[Scheduler] Falha ao enviar lembrete para ${reminder.targetJid}. Erro:`, error);
            }
        }
    }

    if (remindersWereUpdated) {
        // Filtra os lembretes que não são recorrentes e já foram enviados
        remindersCache = remindersCache.filter(r => r.isRecurring || !r.sent);
        await saveReminders();
    }
}

/**
 * Inicia o agendador.
 * @param {object} sock - A instância do socket Baileys.
 */
function initializeScheduler(sock) {
    if (schedulerIntervalId) return;
    
    loadReminders().then(() => {
        console.log(`[Scheduler] Agendador iniciado. Verificando a cada ${CHECK_INTERVAL / 1000} segundos.`);
        checkAndSendReminders(sock); // Verifica uma vez ao iniciar
        schedulerIntervalId = setInterval(() => checkAndSendReminders(sock), CHECK_INTERVAL);
    });
}

module.exports = { 
    initializeScheduler, 
    addReminder,
    getRemindersForChat
};
