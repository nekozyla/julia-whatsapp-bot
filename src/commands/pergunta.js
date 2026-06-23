const authManager = require('../managers/authManager.js');
const { sendGiratinaError } = require('../utils/utils.js');
const groupMetadataManager = require('../managers/groupMetadataManager.js');
const perguntaManager = require('../managers/perguntaManager.js');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config.js');

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

async function handlePerguntaCommand(sock, msg, msgDetails) {
    const { sender, pushName, command, commandText, commandSenderJid } = msgDetails;

    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return;
    }

    // --- Subcomando: resultado ---
    const args = commandText.substring(command.length).trim();
    if (args.toLowerCase() === 'resultado' || args.toLowerCase() === 'respostas') {
        const active = perguntaManager.findActiveByChat(sender);
        if (!active) {
            await sock.sendMessage(sender, { text: "❌ Nenhuma pergunta ativa neste grupo." }, { quoted: msg });
            return;
        }

        const answers = perguntaManager.getAnswers(active.msgId);
        if (answers.length === 0) {
            await sock.sendMessage(sender, { text: "📋 *Resultado*\n\n" + active.q.question + "\n\nNenhuma resposta ainda." }, { quoted: msg });
            return;
        }

        let resultText = `📋 *Resultado*\n\n*Pergunta:* ${active.q.question}\n\n`;
        const totalUsers = new Set(answers.map(a => a.jid)).size;
        resultText += `*${answers.length} resposta(s) de ${totalUsers} pessoa(s):*\n\n`;
        resultText += answers.map((a, i) => `┃ @${a.jid.split('@')[0]}: _${a.text}_`).join('\n');

        await sock.sendMessage(sender, {
            text: resultText,
            mentions: [...new Set(answers.map(a => a.jid))]
        }, { quoted: msg });
        return;
    }

    // --- Subcomando: cancelar ---
    if (args.toLowerCase() === 'cancelar') {
        const active = perguntaManager.findActiveByChat(sender);
        if (!active) {
            await sock.sendMessage(sender, { text: "❌ Nenhuma pergunta ativa neste grupo." }, { quoted: msg });
            return;
        }

        const isGroupAdmin = await checkIsGroupAdmin(sock, sender, commandSenderJid);
        const isSuperAdmin = authManager.isSuperAdmin(commandSenderJid);
        const isCreator = active.q.creatorJid === commandSenderJid;

        if (!isGroupAdmin && !isSuperAdmin && !isCreator) {
            await sock.sendMessage(sender, { text: "Apenas o criador da pergunta ou um admin pode cancelá-la." }, { quoted: msg });
            return;
        }

        perguntaManager.deleteQuestion(active.msgId);
        await sock.sendMessage(sender, { text: "✅ Pergunta cancelada." }, { quoted: msg });
        return;
    }

    // --- Modo principal: criar pergunta ---
    if (!args || args.startsWith('--')) {
        await sock.sendMessage(sender, { text: "Uso: `/pergunta <texto da pergunta>`\nExemplo: `/pergunta Qual o melhor dia para a reunião?`" }, { quoted: msg });
        return;
    }

    try {
        const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, sender);
        const participants = groupMetadata.participants;
        const botJid = await getBotJid(sender);

        if (!botJid) {
            await sock.sendMessage(sender, { text: `Não consegui verificar minha identidade neste grupo. Por favor, execute o comando \`/sync @${config.BOT_NAME}\` primeiro.` }, { quoted: msg });
            return;
        }

        const senderParticipant = participants.find(p => p.id === commandSenderJid);
        const isGroupAdmin = !!senderParticipant?.admin;
        const isSuperAdmin = authManager.isSuperAdmin(commandSenderJid);

        if (!isGroupAdmin && !isSuperAdmin) {
            await sock.sendMessage(sender, { text: "Desculpe, apenas administradores podem usar este comando." }, { quoted: msg });
            return;
        }

        const mentions = participants
            .map(p => p.id)
            .filter(id => id !== botJid);

        const questionText = args;
        const silentText = `📢 *${pushName}* fez uma pergunta:\n\n❓ ${questionText}\n\n_Responda esta mensagem com sua resposta!_`;

        console.log(`[Pergunta] Admin ${pushName} criou pergunta no grupo "${groupMetadata.subject}"`);

        const sentMsg = await sock.sendMessage(sender, {
            text: silentText,
            mentions: mentions
        });

        // Registrar a pergunta para rastrear respostas
        if (sentMsg?.key?.id) {
            perguntaManager.createQuestion(sentMsg.key.id, sender, commandSenderJid, questionText);
        }

    } catch (error) {
        await sendGiratinaError(sock, sender, msg, error);
    }
}

async function checkIsGroupAdmin(sock, chatJid, userJid) {
    try {
        const meta = await groupMetadataManager.getGroupMetadata(sock, chatJid);
        const participant = meta.participants.find(p => p.id === userJid);
        return !!participant?.admin;
    } catch {
        return false;
    }
}

module.exports = handlePerguntaCommand;

module.exports.commandData = {
    name: "pergunta",
    description: "Cria uma pergunta aberta com menção silenciosa e armazena as respostas.",
    category: "admin",
    usage: "/pergunta <texto> | /pergunta resultado | /pergunta cancelar",
    aliases: ["/ask", "/enqueteaberta"]
};
