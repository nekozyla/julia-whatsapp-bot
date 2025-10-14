// src/commands/grupo.js (Corrigido com a lógica de Sync)
const { sendJuliaError } = require('../utils/utils.js');
const aliases = require('../../config/aliases.js');
const fs = require('fs').promises;
const path = require('path');

// Caminho para o ficheiro de cache que o comando /sync cria
const BOT_JID_CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'bot_jid_cache.json');

/**
 * Lê o cache para encontrar o JID do bot para um grupo específico.
 * @param {string} groupId O JID do grupo.
 * @returns {Promise<string|null>} O JID do bot no grupo ou null.
 */
async function getBotJid(groupId) {
    try {
        const data = await fs.readFile(BOT_JID_CACHE_PATH, 'utf-8');
        const cache = JSON.parse(data);
        return cache[groupId];
    } catch (error) {
        // Retorna null se o ficheiro não existir ou houver um erro de leitura
        return null;
    }
}


async function handleGroupStateCommand(sock, msg, msgDetails) {
    const { sender: chatJid, command, commandSenderJid } = msgDetails;

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." });
        return true;
    }

    const action = command === '/fechar' ? 'announcement' : 'not_announcement';
    const actionText = action === 'announcement' ? 'fechado' : 'aberto';
    const actionVerb = action === 'announcement' ? 'fechar' : 'abrir';

    try {
        const groupMetadata = await sock.groupMetadata(chatJid);
        
        // --- LÓGICA DE IDENTIDADE ATUALIZADA ---
        // Lê o JID do bot a partir do cache criado pelo /sync
        const botId = await getBotJid(chatJid);

        // Se não encontrar o bot no cache, avisa o admin para sincronizar
        if (!botId) {
            await sock.sendMessage(chatJid, { text: "Não consegui verificar minha identidade neste grupo. Por favor, execute o comando `/sync @Julia` primeiro." }, { quoted: msg });
            return;
        }

        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);
        const botParticipant = groupMetadata.participants.find(p => p.id === botId);

        if (!senderParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: `Apenas administradores podem ${actionVerb} o grupo.` }, { quoted: msg });
            return true;
        }

        // A verificação de admin do bot agora usa o ID sincronizado
        if (!botParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: `Eu preciso ser administradora do grupo para conseguir ${actionVerb} o grupo.` }, { quoted: msg });
            return true;
        }

        await sock.groupSettingUpdate(chatJid, action);

        await sock.sendMessage(chatJid, { text: `✅ O grupo foi ${actionText} com sucesso!` });

    } catch (error) {
        console.error(`[${command}] Erro:`, error);
        await sendJuliaError(sock, chatJid, msg, error);
    }

    return true;
}

module.exports = handleGroupStateCommand;
aliases['/abrir'] = '/grupo';
aliases['/fechar'] = '/grupo';
