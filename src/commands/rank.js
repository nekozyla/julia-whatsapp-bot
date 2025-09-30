// commands/rank.js
const fs = require('fs').promises;
const path = require('path');
const settingsManager = require('../managers/groupSettingsManager');

// --- LÓGICA DE GESTÃO DA CONTAGEM ---

const countsFilePath = path.join(__dirname, '..', '..', 'data', 'message_counts.json');
let messageCounts = {}; // Formato: { "groupJid": { "userJid": 123 } }

/**
 * Carrega a contagem de mensagens do ficheiro.
 */
async function loadCounts() {
    try {
        await fs.mkdir(path.dirname(countsFilePath), { recursive: true });
        const data = await fs.readFile(countsFilePath, 'utf-8');
        messageCounts = JSON.parse(data);
        console.log('[Rank] Contagem de mensagens carregada.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Rank] Ficheiro de contagem não encontrado, a iniciar um novo.');
            messageCounts = {};
        } else {
            console.error('[Rank] Erro ao carregar contagem:', error);
        }
    }
}

/**
 * Salva a contagem de mensagens no ficheiro.
 */
async function saveCounts() {
    try {
        await fs.writeFile(countsFilePath, JSON.stringify(messageCounts, null, 2));
    } catch (error) {
        console.error('[Rank] Erro ao salvar contagem:', error);
    }
}

/**
 * Incrementa a contagem de mensagens para um utilizador num grupo.
 * Esta função será chamada pelo main.js
 */
function incrementCount(groupJid, userJid) {
    if (!messageCounts[groupJid]) {
        messageCounts[groupJid] = {};
    }
    if (!messageCounts[groupJid][userJid]) {
        messageCounts[groupJid][userJid] = 0;
    }
    messageCounts[groupJid][userJid]++;
    // Salva periodicamente para não sobrecarregar o disco
    if (messageCounts[groupJid][userJid] % 10 === 0) {
        saveCounts();
    }
}

// Carrega a contagem quando o bot inicia
loadCounts();

// --- FIM DA GESTÃO ---


// --- HANDLER PRINCIPAL DO COMANDO ---

async function handleRankCommand(sock, msg, msgDetails) {
    const { sender: chatJid, commandText, commandSenderJid } = msgDetails;

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." });
        return;
    }

    const groupMeta = await sock.groupMetadata(chatJid);
    const participants = groupMeta.participants.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {});

    const args = commandText.split(' ');
    const subCommand = args[1]?.toLowerCase();

    const isAdmin = !!participants[commandSenderJid]?.admin;

    if (subCommand === 'on' || subCommand === 'off') {
        if (!isAdmin) {
            await sock.sendMessage(chatJid, { text: "Apenas administradores do grupo podem ativar ou desativar o ranking." });
            return;
        }
        const newStatus = subCommand === 'on' ? 'on' : 'off';
        await settingsManager.setSetting(chatJid, 'rankingMode', newStatus);
        if(newStatus === 'on' && !messageCounts[chatJid]) {
            messageCounts[chatJid] = {}; // Inicializa a contagem para o grupo
            await saveCounts();
        }
        await sock.sendMessage(chatJid, { text: `✅ O ranking de mensagens foi *${subCommand.toUpperCase()}* neste grupo.` });
        return;
    }

    // Exibe o ranking
    const groupCounts = messageCounts[chatJid];
    if (!groupCounts || Object.keys(groupCounts).length === 0) {
        await sock.sendMessage(chatJid, { text: "Ainda não há dados de ranking para este grupo. Um admin precisa de o ativar com `/rank on`." });
        return;
    }

    const sortedUsers = Object.entries(groupCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10); // Pega o Top 10

    let rankText = `*🏆 Ranking dos Mais Faladores do Grupo 🏆*\n\n`;
    const mentions = [];

    sortedUsers.forEach(([jid, count], index) => {
        const name = participants[jid] ? `(@${jid.split('@')[0]})` : '(Saiu do grupo)';
        const medal = ['🥇', '🥈', '🥉'][index] || `*${index + 1}.*`;
        rankText += `${medal} ${name} - *${count}* mensagens\n`;
        if (participants[jid]) {
            mentions.push(jid);
        }
    });

    await sock.sendMessage(chatJid, { text: rankText.trim(), mentions });
}

// Exporta a função principal do comando e a função de incremento
handleRankCommand.incrementCount = incrementCount;
module.exports = handleRankCommand;
