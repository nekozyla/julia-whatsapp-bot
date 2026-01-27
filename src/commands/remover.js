
const { sendJuliaError } = require('../utils/utils.js');
const fs = require('fs').promises;
const path = require('path');
const groupMetadataManager = require('../managers/groupMetadataManager.js');

const countsFilePath = path.join(__dirname, '..', '..', 'data', 'message_counts.json');
const removedUsersPath = path.join(__dirname, '..', '..', 'data', 'removed_users.json');
const lastRemovedPath = path.join(__dirname, '..', '..', 'data', 'last_removed.json');
const BOT_JID_CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'bot_jid_cache.json');


async function getBotJid(groupId) {
    try {
        const data = await fs.readFile(BOT_JID_CACHE_PATH, 'utf-8');
        const cache = JSON.parse(data);
        return cache[groupId] || cache['global'];
    } catch (error) {
        return null;
    }
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
    const { sender, commandText, commandSenderJid, pushName } = msgDetails;

    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return;
    }

    try {
        const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, sender);
        const botJid = await getBotJid(sender); 

        if (!botJid) {
            await sock.sendMessage(sender, { text: "Não consegui verificar minha identidade neste grupo. Por favor, execute o comando `/sync @Julia` primeiro." }, { quoted: msg });
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
            await sock.sendMessage(sender, { text: "👻 A caça aos fantasmas começou! A analisar os membros silenciosos..." });
            let messageCounts = {};
            try {
                const data = await fs.readFile(countsFilePath, 'utf-8');
                messageCounts = JSON.parse(data);
            } catch (e) {
                await sock.sendMessage(sender, { text: "Não encontrei os dados de atividade do grupo. Ative o ranking com `/rank on` primeiro." });
                return;
            }

            const activeUsers = Object.keys(messageCounts[sender] || {});
            const ghosts = groupMetadata.participants
                .filter(p => !p.admin && !activeUsers.includes(p.id))
                .map(p => p.id);

            if (ghosts.length === 0) {
                await sock.sendMessage(sender, { text: "Nenhum fantasma encontrado. Todos os membros (não-admins) já enviaram pelo menos uma mensagem." });
                return;
            }

            await logRemovedUsers(sender, ghosts);
            await sock.groupParticipantsUpdate(sender, ghosts, "remove");
            await sock.sendMessage(sender, { text: `✅ ${ghosts.length} membro(s) fantasma(s) foram removidos com sucesso!` });
            return;
        }

        const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo;
        let targetJid = quotedMsgInfo?.mentionedJid?.[0] || quotedMsgInfo?.participant;

        if (!targetJid) {
            await sock.sendMessage(sender, { text: "Você precisa marcar o usuário ou responder a uma mensagem dele para removê-lo.\n\n*Exemplo:*\n`/remover @usuario`\n\n*Para remover inativos:*\n`/remover @ghost`" }, { quoted: msg });
            return;
        }

        const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
        if (targetParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Não posso remover outro administrador." }, { quoted: msg });
            return;
        }

        await logRemovedUsers(sender, [targetJid]);
        await sock.groupParticipantsUpdate(sender, [targetJid], "remove");

    } catch (error) {
        console.error("[Remover] Erro ao remover participante:", error);
        await sendJuliaError(sock, sender, msg, error);
    }
}

handleRemoveCommand.commandData = {
    name: "remover",
    description: "Remove participante do grupo (ou fantasmas).",
    category: "admin",
    usage: "/remover @user | /remover @ghost",
    aliases: ["/ban", "/kick", "/expulsar"]
};

module.exports = handleRemoveCommand;
