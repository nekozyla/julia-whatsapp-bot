
const cron = require('node-cron');
const muchaManager = require('./muchaMusicaManager.js');

const BASE_BACKOFF = 5 * 60 * 1000;  // 5 minutos de backoff após erro
const MAX_BACKOFF = 30 * 60 * 1000;  // Máximo 30 minutos de backoff

let notificationJob = null;
let changeDayJob = null;
const groupErrorBackoff = new Map(); // groupJid -> { until: timestamp, attempts: number }

/**
 * Verifica se o socket está conectado e pronto para enviar mensagens
 */
function isSocketReady(sock) {
    if (!sock) return false;
    // Baileys expõe o estado da conexão em sock.ws ou sock.user
    if (!sock.user) return false;
    // Verifica se o websocket subjacente está aberto
    if (sock.ws && sock.ws.readyState !== undefined && sock.ws.readyState !== 1) return false;
    return true;
}

/**
 * Verifica se um grupo está em período de backoff após erro
 */
function isInBackoff(groupJid) {
    const info = groupErrorBackoff.get(groupJid);
    if (!info) return false;
    if (Date.now() >= info.until) {
        groupErrorBackoff.delete(groupJid);
        return false;
    }
    return true;
}

/**
 * Registra erro de conexão para um grupo, incrementando o backoff
 */
function registerError(groupJid) {
    const info = groupErrorBackoff.get(groupJid) || { until: 0, attempts: 0, logged: false };
    info.attempts++;
    const delay = Math.min(BASE_BACKOFF * info.attempts, MAX_BACKOFF);
    info.until = Date.now() + delay;
    const isFirst = !info.logged;
    info.logged = true;
    groupErrorBackoff.set(groupJid, info);
    return { delay, isFirst };
}

/**
 * Rotina programada pra verificar se deve pular o dia de cada grupo.
 * Feito separado pra garantir que à meia noite vire o dia no bot,
 * mesmo antes das 8h.
 */
async function runDayAdvance() {
    const activeGroups = muchaManager.getActiveGroups();
    if (activeGroups.length === 0) return;

    for (const groupJid of activeGroups) {
        try {
            const gs = muchaManager.getGroupState(groupJid);
            if (!gs || !gs.active) continue;

            await muchaManager.advanceDay(groupJid);
        } catch (error) {
            console.error(`[MuchaMusica] Erro ao avançar dia para grupo ${groupJid}:`, error.message);
        }
    }
}

/**
 * Verifica todos os grupos ativos e envia notificação
 */
async function checkAllGroupsAndNotify(sock) {
    // Verifica se o socket está conectado antes de processar qualquer grupo
    if (!isSocketReady(sock)) {
        return;
    }

    const activeGroups = muchaManager.getActiveGroups();
    if (activeGroups.length === 0) return;

    const today = muchaManager.todayStr();

    for (const groupJid of activeGroups) {
        try {
            // Pula grupos em período de backoff por erro anterior
            if (isInBackoff(groupJid)) continue;

            const gs = muchaManager.getGroupState(groupJid);
            if (!gs || !gs.active) continue;

            // Verifica se precisa avançar o dia caso não tenha rodado a meia-noite por desligamento do bot
            if (gs.currentDay !== today) {
                await muchaManager.advanceDay(groupJid);
            }

            // Envia notificação se ainda não enviou hoje
            if (!muchaManager.wasNotifiedToday(groupJid)) {
                const member = muchaManager.getCurrentMember(groupJid);
                if (!member) continue;

                const songs = muchaManager.getSongHistory(groupJid);
                const pending = muchaManager.getAllPending(groupJid);
                const totalPending = Object.values(pending).reduce((sum, arr) => sum + arr.length, 0);

                const mentionText = muchaManager.getMemberMentionText(groupJid, member.jid);

                let text = `┏━━❪ 🎵 𝗠𝗨𝗖𝗛𝗔 𝗠𝗨́𝗦𝗜𝗖𝗔 ❫━━\n┃\n`;
                text += `┃ ➢ 𝗛𝗼𝗷𝗲 é o dia de:\n`;
                text += `┃ ➢ 🎤 ${mentionText}\n┃\n`;
                text += `┃ ➢ Use */dodia* para registrar\n`;
                text += `┃ ➢ sua música do dia!\n┃\n`;
                text += `┣━━❪ 📊 𝗦𝗧𝗔𝗧𝗦 ❫━━\n┃\n`;
                text += `┃ ➢ 𝗠𝘂́𝘀𝗶𝗰𝗮𝘀 › ${songs.length}\n`;
                if (totalPending > 0) {
                    text += `┃ ➢ 𝗣𝗲𝗻𝗱𝗲𝗻𝘁𝗲𝘀 › ${totalPending}\n`;
                }
                text += `┃\n┗━━━━━━━━━━━━━━`;

                await sock.sendMessage(groupJid, {
                    text,
                    mentions: [member.jid]
                });

                // Limpa backoff após sucesso
                groupErrorBackoff.delete(groupJid);
                await muchaManager.markNotified(groupJid);
            }
        } catch (error) {
            const isConnectionError = error.message?.includes('Connection Closed')
                || error.message?.includes('connection closed')
                || error.message?.includes('ECONNRESET')
                || error.message?.includes('not connected');

            if (isConnectionError) {
                const { delay, isFirst } = registerError(groupJid);
                if (isFirst) {
                    const mins = Math.round(delay / 60000);
                    console.warn(`[MuchaMusica] Conexão fechada para grupo ${groupJid}. Tentando reconectar (backoff: ${mins}min).`);
                }
                // Se é erro de conexão, não adianta tentar os outros grupos agora
                break;
            } else {
                console.error(`[MuchaMusica] Erro ao processar grupo ${groupJid}:`, error.message);
            }
        }
    }
}

function initializeMuchaMusicaScheduler(sock) {
    if (notificationJob || changeDayJob) return;

    // setTimeout pra verificar inicialização porque o cron pode já ter passado hoje (se estivesse offline nas 8 da manhã)
    setTimeout(() => {
        const hour = new Date(new Date().getTime() - 3 * 60 * 60 * 1000).getUTCHours();
        if (hour >= 8) {
            checkAllGroupsAndNotify(sock).catch(e => console.error('[MuchaMusica] Erro no check inicial:', e.message));
        }
    }, 5000);

    // Ajustamos Node Cron pra horários reais no Timezone do SP
    changeDayJob = cron.schedule('0 0 * * *', () => {
        runDayAdvance().catch(e => console.error('[MuchaMusica] Erro no cron do advance day:', e.message));
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });

    notificationJob = cron.schedule('0 8 * * *', () => {
        checkAllGroupsAndNotify(sock).catch(e => console.error('[MuchaMusica] Erro no cron das 8h:', e.message));
    }, {
        scheduled: true,
        timezone: "America/Sao_Paulo"
    });
}

function stopMuchaMusicaScheduler() {
    if (notificationJob) {
        notificationJob.stop();
        notificationJob = null;
    }
    if (changeDayJob) {
        changeDayJob.stop();
        changeDayJob = null;
    }
    groupErrorBackoff.clear();
    console.log('[MuchaMusica] Scheduler parado.');
}

module.exports = {
    initializeMuchaMusicaScheduler,
    stopMuchaMusicaScheduler
};
