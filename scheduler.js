// scheduler.js
const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

const REMINDERS_FILE_PATH = path.join(__dirname, 'reminders.json');
const CHECK_INTERVAL = 60 * 1000;

let schedulerIntervalId = null; 

async function readReminders() {
    try {
        await fs.access(REMINDERS_FILE_PATH); 
        const data = await fs.readFile(REMINDERS_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') { return []; }
        console.error("[Scheduler] Erro ao ler lembretes:", error);
        return [];
    }
}

async function saveReminders(reminders) {
    try {
        await fs.writeFile(REMINDERS_FILE_PATH, JSON.stringify(reminders, null, 2));
    } catch (error) {
        console.error("[Scheduler] Erro ao salvar lembretes:", error);
    }
}

async function checkAndSendReminders(sock) {
    const reminders = await readReminders();
    const now = Date.now();
    let remindersWereUpdated = false;

    for (const reminder of reminders) {
        if (now >= reminder.triggerTimestamp && !(reminder.isRecurring === false && reminder.isSent === true)) {
            console.log(`[Scheduler] Enviando lembrete (ID: ${reminder.id}) para ${reminder.targetJid}`);
            try {
                const reminderMessage = `🔔 *Lembrete da Julia* 🔔\n\n- ${reminder.message}`;
                await sock.sendMessage(reminder.targetJid, { text: reminderMessage });
                
                remindersWereUpdated = true;
                if (reminder.isRecurring) {
                    const nextTriggerDate = dayjs(reminder.triggerTimestamp).add(1, 'year');
                    reminder.triggerTimestamp = nextTriggerDate.valueOf();
                    console.log(`[Scheduler] Lembrete recorrente (ID: ${reminder.id}) reagendado para ${nextTriggerDate.format('DD/MM/YYYY HH:mm')}`);
                } else {
                    reminder.isSent = true;
                }
            } catch (error) {
                console.error(`[Scheduler] Falha ao enviar lembrete para ${reminder.targetJid}. Erro:`, error);
            }
        }
    }

    if (remindersWereUpdated) {
        const activeReminders = reminders.filter(r => r.isSent === false);
        await saveReminders(activeReminders);
        console.log(`[Scheduler] Arquivo de lembretes atualizado, ${activeReminders.length} lembretes ativos restantes.`);
    }
}

function initializeScheduler(sock) {
    if (schedulerIntervalId) return schedulerIntervalId;
    console.log(`[Scheduler] Agendador iniciado. Verificando a cada ${CHECK_INTERVAL / 1000} segundos.`);
    checkAndSendReminders(sock);
    schedulerIntervalId = setInterval(() => checkAndSendReminders(sock), CHECK_INTERVAL);
    return schedulerIntervalId;
}

function stopScheduler() {
    if (schedulerIntervalId) {
        clearInterval(schedulerIntervalId);
        schedulerIntervalId = null;
        console.log("[Scheduler] Agendador parado.");
    }
}

module.exports = { initializeScheduler, stopScheduler, saveReminders, readReminders };
