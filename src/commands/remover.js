
const { sendGiratinaError } = require('../utils/utils.js');
const fs = require('fs').promises;
const path = require('path');
const groupMetadataManager = require('../managers/groupMetadataManager.js');
const config = require('../../config.js');

const BOT_NAME = config.BOT_NAME || 'Bot';

const removedUsersPath = path.join(__dirname, '..', '..', 'data', 'removed_users.json');
const lastRemovedPath = path.join(__dirname, '..', '..', 'data', 'last_removed.json');
const ghostQuarantineStatePath = path.join(__dirname, '..', '..', 'data', 'ghost_quarantines.json');

const GHOST_REMINDER_MS = 10 * 60 * 1000;
const GHOST_QUARANTINE_MS = 60 * 60 * 1000;
const activeGhostQuarantines = new Map();
let ghostRecoveryInitialized = false;

function serializeQuarantineState(state) {
    return {
        groupJid: state.groupJid,
        pendingJids: Array.from(state.pendingJids || []),
        watchMessageIds: Array.from(state.watchMessageIds || []),
        startedAt: state.startedAt,
        reminderAt: state.reminderAt,
        finalAt: state.finalAt,
        reminderSent: !!state.reminderSent,
        quarantineEnabledByBot: !!state.quarantineEnabledByBot
    };
}

async function flushGhostQuarantinesToDisk() {
    const payload = {};
    for (const [groupJid, state] of activeGhostQuarantines.entries()) {
        payload[groupJid] = serializeQuarantineState(state);
    }
    await fs.writeFile(ghostQuarantineStatePath, JSON.stringify(payload, null, 2));
}

async function persistGhostQuarantinesSafe() {
    try {
        await flushGhostQuarantinesToDisk();
    } catch (err) {
        console.warn('[Remover] Falha ao persistir quarentenas ghost:', err?.message || err);
    }
}

function splitInChunks(list, size = 25) {
    const chunks = [];
    for (let i = 0; i < list.length; i += size) {
        chunks.push(list.slice(i, i + size));
    }
    return chunks;
}

async function sendSilentMentions(sock, chatJid, jids, quotedMsg) {
    if (!Array.isArray(jids) || jids.length === 0) return;
    const chunks = splitInChunks(jids, 50);
    for (const chunk of chunks) {
        await sock.sendMessage(chatJid, {
            text: '‎',
            mentions: chunk
        }, quotedMsg ? { quoted: quotedMsg } : undefined);
    }
}

function clearGhostQuarantine(groupJid) {
    const state = activeGhostQuarantines.get(groupJid);
    if (!state) return;
    clearTimeout(state.reminderTimer);
    clearTimeout(state.finalTimer);
    activeGhostQuarantines.delete(groupJid);
}

async function clearGhostQuarantinePersisted(groupJid) {
    clearGhostQuarantine(groupJid);
    await persistGhostQuarantinesSafe();
}

function scheduleGhostQuarantineTimers(sock, groupJid, state) {
    clearTimeout(state.reminderTimer);
    clearTimeout(state.finalTimer);

    const now = Date.now();
    const reminderDelay = Math.max(0, (state.reminderAt || now) - now);
    const finalDelay = Math.max(0, (state.finalAt || now) - now);

    if (!state.reminderSent) {
        state.reminderTimer = setTimeout(() => {
            sendGhostReminder(sock, groupJid).catch(err => {
                console.warn('[Remover] Erro no lembrete de quarentena:', err?.message || err);
            });
        }, reminderDelay);
    }

    state.finalTimer = setTimeout(() => {
        finalizeGhostQuarantine(sock, groupJid).catch(err => {
            console.warn('[Remover] Erro ao finalizar quarentena:', err?.message || err);
            clearGhostQuarantinePersisted(groupJid).catch(() => { });
        });
    }, finalDelay);
}

async function recoverGhostQuarantines(sock) {
    if (ghostRecoveryInitialized) return;
    ghostRecoveryInitialized = true;

    let raw = '{}';
    try {
        raw = await fs.readFile(ghostQuarantineStatePath, 'utf-8');
    } catch (err) {
        if (err?.code !== 'ENOENT') {
            console.warn('[Remover] Falha ao ler ghost_quarantines.json:', err?.message || err);
        }
        return;
    }

    let stored = {};
    try {
        stored = JSON.parse(raw || '{}');
    } catch (err) {
        console.warn('[Remover] ghost_quarantines.json inválido, limpando estado:', err?.message || err);
        return;
    }

    const now = Date.now();
    for (const [groupJid, stateRaw] of Object.entries(stored || {})) {
        if (!stateRaw || !Array.isArray(stateRaw.pendingJids) || !Array.isArray(stateRaw.watchMessageIds)) {
            continue;
        }

        const finalAt = Number(stateRaw.finalAt || 0);
        if (!finalAt || finalAt <= now) {
            continue;
        }

        const state = {
            groupJid,
            pendingJids: new Set(stateRaw.pendingJids),
            watchMessageIds: new Set(stateRaw.watchMessageIds),
            startedAt: Number(stateRaw.startedAt || now),
            reminderAt: Number(stateRaw.reminderAt || (now + GHOST_REMINDER_MS)),
            finalAt,
            reminderSent: !!stateRaw.reminderSent,
            quarantineEnabledByBot: !!stateRaw.quarantineEnabledByBot,
            reminderTimer: null,
            finalTimer: null
        };

        activeGhostQuarantines.set(groupJid, state);
        scheduleGhostQuarantineTimers(sock, groupJid, state);
    }

    await persistGhostQuarantinesSafe();
}

async function finalizeGhostQuarantine(sock, groupJid) {
    const state = activeGhostQuarantines.get(groupJid);
    if (!state) return;

    clearTimeout(state.reminderTimer);
    clearTimeout(state.finalTimer);

    const remaining = Array.from(state.pendingJids);
    if (state.quarantineEnabledByBot) {
        try {
            await sock.groupSettingUpdate(groupJid, 'not_announcement');
        } catch (err) {
            console.warn('[Remover] Falha ao remover quarentena do grupo:', err?.message || err);
        }
    }

    if (remaining.length === 0) {
        await sock.sendMessage(groupJid, {
            text: '✅ Quarentena finalizada: todos reagiram a tempo. Ninguém foi removido.'
        });
        await clearGhostQuarantinePersisted(groupJid);
        return;
    }

    const mentionText = remaining.map(jid => `@${jid.split('@')[0]}`).join(' ');
    await sock.sendMessage(groupJid, {
        text: `⏰ Tempo esgotado. Os seguintes membros não reagiram e serão removidos:\n\n${mentionText}`,
        mentions: remaining
    });

    const chunks = splitInChunks(remaining, 25);
    let removedCount = 0;
    for (const chunk of chunks) {
        try {
            await sock.groupParticipantsUpdate(groupJid, chunk, 'remove');
            removedCount += chunk.length;
        } catch (err) {
            console.warn('[Remover] Falha ao remover parte dos ghosts em quarentena:', err?.message || err);
        }
    }

    if (removedCount > 0) {
        await logRemovedUsers(groupJid, remaining);
    }

    await sock.sendMessage(groupJid, {
        text: `🚫 Quarentena encerrada. ${removedCount} membro(s) removido(s) por ausência de reação.`
    });

    await clearGhostQuarantinePersisted(groupJid);
}

async function sendGhostReminder(sock, groupJid) {
    const state = activeGhostQuarantines.get(groupJid);
    if (!state) return;

    if (state.reminderSent) return;
    state.reminderSent = true;

    const pending = Array.from(state.pendingJids);
    if (pending.length === 0) {
        await persistGhostQuarantinesSafe();
        await sock.sendMessage(groupJid, {
            text: '✅ Todos já reagiram antes do lembrete de 10 minutos.'
        });
        return;
    }

    const mentionText = pending.map(jid => `@${jid.split('@')[0]}`).join(' ');
    const reminderMsg = await sock.sendMessage(groupJid, {
        text: `🔔 Lembrete da quarentena: ainda aguardando reação destas pessoas:\n\n${mentionText}\n\nReaja a esta mensagem para confirmar presença.`,
        mentions: pending
    });

    const reminderMsgId = reminderMsg?.key?.id;
    if (reminderMsgId) {
        state.watchMessageIds.add(reminderMsgId);
    }

    await persistGhostQuarantinesSafe();
}

async function logRemovedUsers(groupJid, removedJids) {
    let removedLog = {};
    try {
        const data = await fs.readFile(removedUsersPath, 'utf-8');
        removedLog = JSON.parse(data);
    } catch (e) { }

    if (!removedLog[groupJid]) {
        removedLog[groupJid] = [];
    }
    removedJids.forEach(jid => {
        if (!removedLog[groupJid].includes(jid)) {
            removedLog[groupJid].push(jid);
        }
    });
    await fs.writeFile(removedUsersPath, JSON.stringify(removedLog, null, 2));

    try {
        const lastDataRaw = await fs.readFile(lastRemovedPath, 'utf-8').catch(() => null);
        const lastData = lastDataRaw ? JSON.parse(lastDataRaw) : {};

        if (removedJids && removedJids.length > 0) {
            lastData[groupJid] = removedJids[removedJids.length - 1];
            await fs.writeFile(lastRemovedPath, JSON.stringify(lastData, null, 2));
        }
    } catch (e) {
        console.warn('[Remover] falha ao atualizar last_removed.json:', e.message);
    }
}

async function handleRemoveCommand(sock, msg, msgDetails) {
    const { sender, commandText, commandSenderJid, botJid } = msgDetails;

    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return;
    }

    try {
        const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, sender);

        if (!botJid) {
            await sock.sendMessage(sender, { text: `Não consegui verificar minha identidade neste grupo. Execute \`/fixjid @${BOT_NAME}\`.` }, { quoted: msg });
            return;
        }

        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);
        const botParticipant = groupMetadata.participants.find(p => p.id === botJid);

        if (!botParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Eu preciso ser administradora do grupo para conseguir remover alguém." }, { quoted: msg });
            return;
        }
        if (!senderParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Desculpe, apenas administradores podem usar este comando." }, { quoted: msg });
            return;
        }

        if (commandText.includes('@ghost')) {
            if (activeGhostQuarantines.has(sender)) {
                await sock.sendMessage(sender, {
                    text: '⚠️ Já existe uma quarentena de ghosts em andamento neste grupo. Aguarde finalizar.'
                }, { quoted: msg });
                return;
            }

            await sock.sendMessage(sender, { text: '👻 Iniciando protocolo de quarentena dos ghosts...' });

            const allParticipants = groupMetadata.participants || [];
            const allParticipantJids = allParticipants.map(p => p.id).filter(Boolean);

            const botCandidate = allParticipants.find(p => p.id === botJid);
            const botIsAdmin = !!botCandidate?.admin;

            const removableTargets = allParticipants
                .filter(p => !p.admin && p.id !== botJid)
                .map(p => p.id);

            if (removableTargets.length === 0) {
                await sock.sendMessage(sender, {
                    text: 'Nenhum membro elegível para quarentena (somente admins/bot no grupo).'
                }, { quoted: msg });
                return;
            }

            let quarantineEnabledByBot = false;
            if (botIsAdmin) {
                try {
                    await sock.groupSettingUpdate(sender, 'announcement');
                    quarantineEnabledByBot = true;
                } catch (err) {
                    console.warn('[Remover] Não foi possível ativar quarentena no grupo:', err?.message || err);
                }
            }

            await sendSilentMentions(sock, sender, allParticipantJids, msg);

            const quarantineMsg = await sock.sendMessage(sender, {
                text:
                    '🚨 *Quarentena de Ghost Ativada*\n\n' +
                    'Este grupo entrou em quarentena por *1 hora*.\n' +
                    'Todos os membros elegíveis devem reagir a esta mensagem com qualquer emoji para confirmar presença.\n\n' +
                    'Quem não reagir até o fim do prazo será removido do grupo.'
            }, { quoted: msg });

            const quarantineMsgId = quarantineMsg?.key?.id;
            if (!quarantineMsgId) {
                if (quarantineEnabledByBot) {
                    await sock.groupSettingUpdate(sender, 'not_announcement').catch(() => { });
                }
                await sock.sendMessage(sender, {
                    text: '❌ Não consegui iniciar a quarentena porque não foi possível rastrear a mensagem de confirmação.'
                }, { quoted: msg });
                return;
            }

            const state = {
                groupJid: sender,
                pendingJids: new Set(removableTargets),
                watchMessageIds: new Set([quarantineMsgId]),
                startedAt: Date.now(),
                reminderAt: Date.now() + GHOST_REMINDER_MS,
                finalAt: Date.now() + GHOST_QUARANTINE_MS,
                reminderSent: false,
                quarantineEnabledByBot,
                reminderTimer: null,
                finalTimer: null
            };

            activeGhostQuarantines.set(sender, state);
            scheduleGhostQuarantineTimers(sock, sender, state);
            await persistGhostQuarantinesSafe();

            await sock.sendMessage(sender, {
                text: `✅ Quarentena iniciada para ${removableTargets.length} membro(s). Lembrete em 10 minutos e encerramento em 1 hora.`
            });
            return;
        }

        const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo;
        const mentionedJids = quotedMsgInfo?.mentionedJid || [];
        const quotedParticipant = quotedMsgInfo?.participant;

        let targetJids = mentionedJids.length > 0
            ? mentionedJids
            : (quotedParticipant ? [quotedParticipant] : []);

        if (targetJids.length === 0) {
            await sock.sendMessage(sender, { text: "Você precisa marcar o(s) usuário(s) ou responder a uma mensagem para removê-los.\n\n*Exemplo:*\n`/remover @usuario1 @usuario2`\n\n*Para remover inativos:*\n`/remover @ghost`" }, { quoted: msg });
            return;
        }

        const adminTargets = targetJids.filter(jid => groupMetadata.participants.find(p => p.id === jid)?.admin);
        if (adminTargets.length > 0) {
            await sock.sendMessage(sender, { text: "Não posso remover administradores do grupo." }, { quoted: msg });
            return;
        }

        const validTargets = targetJids.filter(jid => groupMetadata.participants.find(p => p.id === jid));

        if (validTargets.length === 0) {
            await sock.sendMessage(sender, { text: "Nenhum dos usuários marcados está no grupo." }, { quoted: msg });
            return;
        }

        await logRemovedUsers(sender, validTargets);
        await sock.groupParticipantsUpdate(sender, validTargets, "remove");

        if (validTargets.length > 1) {
            await sock.sendMessage(sender, { text: `✅ ${validTargets.length} membro(s) removidos com sucesso!` }, { quoted: msg });
        }

    } catch (error) {
        console.error("[Remover] Erro ao remover participante:", error);
        await sendGiratinaError(sock, sender, msg, error);
    }
}

handleRemoveCommand.handleGhostReaction = async function handleGhostReaction(sock, reactionMsg) {
    try {
        const reactionMessage = reactionMsg?.message?.reactionMessage;
        if (!reactionMessage?.key?.id) return;

        const targetMessageId = reactionMessage.key.id;
        const reactorJid = reactionMsg.key?.participant || reactionMsg.key?.remoteJid;
        const chatJid = reactionMessage.key.remoteJid || reactionMsg.key?.remoteJid;

        if (!reactorJid || !chatJid) return;
        const state = activeGhostQuarantines.get(chatJid);
        if (!state) return;
        if (!state.watchMessageIds.has(targetMessageId)) return;
        if (!state.pendingJids.has(reactorJid)) return;

        state.pendingJids.delete(reactorJid);
        await persistGhostQuarantinesSafe();
    } catch (err) {
        console.warn('[Remover] Falha ao processar reação de quarentena:', err?.message || err);
    }
};

handleRemoveCommand.initGhostQuarantineRecovery = async function initGhostQuarantineRecovery(sock) {
    await recoverGhostQuarantines(sock);
};

handleRemoveCommand.commandData = {
    name: "remover",
    description: "Remove participante do grupo (ou inicia quarentena de ghosts).",
    category: "admin",
    usage: "/remover @user1 @user2 ... | /remover @ghost",
    aliases: ["/ban", "/kick", "/expulsar"]
};

module.exports = handleRemoveCommand;
