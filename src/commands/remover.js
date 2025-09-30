// src/commands/remover.js (Versão com registo de remoções)
const { sendJuliaError } = require('../utils/utils.js');
const fs = require('fs').promises;
const path = require('path');

const countsFilePath = path.join(__dirname, '..', '..', 'data', 'message_counts.json');
const removedUsersPath = path.join(__dirname, '..', '..', 'data', 'removed_users.json');

/**
 * Guarda um registo dos utilizadores removidos.
 */
async function logRemovedUsers(groupJid, removedJids) {
    let removedLog = {};
    try {
        const data = await fs.readFile(removedUsersPath, 'utf-8');
        removedLog = JSON.parse(data);
    } catch (e) {
        // O ficheiro não existe ainda, o que é normal
    }

    if (!removedLog[groupJid]) {
        removedLog[groupJid] = [];
    }

    // Adiciona apenas os JIDs que ainda não estão na lista
    removedJids.forEach(jid => {
        if (!removedLog[groupJid].includes(jid)) {
            removedLog[groupJid].push(jid);
        }
    });

    await fs.writeFile(removedUsersPath, JSON.stringify(removedLog, null, 2));
}


async function handleRemoveCommand(sock, msg, msgDetails) {
    const { sender, commandText, commandSenderJid, pushName } = msgDetails;

    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    try {
        const groupMetadata = await sock.groupMetadata(sender);
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);
        const botParticipant = groupMetadata.participants.find(p => p.id === botJid);

        if (!botParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Eu preciso ser administradora do grupo para conseguir remover alguém." }, { quoted: msg });
            return true;
        }
        if (!senderParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Desculpe, apenas administradores podem usar este comando." }, { quoted: msg });
            return true;
        }

        // --- LÓGICA PARA REMOVER FANTASMAS ---
        if (commandText.includes('@ghost')) {
            console.log(`[Remover] Admin ${pushName} solicitou a remoção de fantasmas do grupo ${groupMetadata.subject}.`);
            await sock.sendMessage(sender, { text: "👻 A caça aos fantasmas começou! A analisar os membros silenciosos..." });

            let messageCounts = {};
            try {
                const data = await fs.readFile(countsFilePath, 'utf-8');
                messageCounts = JSON.parse(data);
            } catch (e) {
                await sock.sendMessage(sender, { text: "Não encontrei os dados de atividade do grupo. Ative o ranking com `/rank on` primeiro." });
                return true;
            }

            const activeUsers = Object.keys(messageCounts[sender] || {});
            const allParticipants = groupMetadata.participants;
            const ghosts = [];

            for (const participant of allParticipants) {
                if (participant.admin) continue;
                if (!activeUsers.includes(participant.id)) {
                    ghosts.push(participant.id);
                }
            }

            if (ghosts.length === 0) {
                await sock.sendMessage(sender, { text: "Nenhum fantasma encontrado. Todos os membros (não-admins) já enviaram pelo menos uma mensagem." });
                return true;
            }

            await logRemovedUsers(sender, ghosts); // Guarda o registo
            await sock.groupParticipantsUpdate(sender, ghosts, "remove");
            await sock.sendMessage(sender, { text: `✅ ${ghosts.length} membro(s) fantasma(s) foram removidos com sucesso!` });

            return true;
        }

        // --- LÓGICA PARA REMOVER UM ÚNICO UTILIZADOR ---
        const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo;
        let targetJid = quotedMsgInfo?.mentionedJid?.[0] || quotedMsgInfo?.participant;

        if (!targetJid) {
            await sock.sendMessage(sender, { text: "Você precisa marcar o usuário ou responder a uma mensagem dele para removê-lo.\n\n*Exemplo:*\n`/remover @usuario`\n\n*Para remover inativos:*\n`/remover @ghost`" }, { quoted: msg });
            return true;
        }
        
        const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
        if (targetParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Não posso remover outro administrador." }, { quoted: msg });
            return true;
        }
        
        console.log(`[Remover] Admin ${pushName} solicitou a remoção de ${targetJid} do grupo ${groupMetadata.subject}.`);
        
        await logRemovedUsers(sender, [targetJid]); // Guarda o registo
        await sock.groupParticipantsUpdate(sender, [targetJid], "remove");

    } catch (error) {
        console.error("[Remover] Erro ao remover participante:", error);
        await sendJuliaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleRemoveCommand;
