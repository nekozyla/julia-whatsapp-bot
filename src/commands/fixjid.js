

const fs = require('fs').promises;
const path = require('path');
const config = require('../../config.js');


const BOT_JID_CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'bot_jid_cache.json');
const BOT_NAME = config.BOT_NAME || 'Bot';

async function syncCommand(sock, msg, msgDetails) {
    if (!msgDetails.isGroup) {
        await sock.sendMessage(msgDetails.sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return;
    }


    const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];


    if (mentions.length === 0) {
        await sock.sendMessage(
            msgDetails.sender,
            { text: `Uso incorreto. Você precisa me mencionar no comando.\n\n*Exemplo:* \`/fixjid @${BOT_NAME}\`` },
            { quoted: msg }
        );
        return;
    }


    const learnedJid = mentions[0];

    try {
        let botJidCache = {};

        try {
            const data = await fs.readFile(BOT_JID_CACHE_PATH, 'utf-8');
            botJidCache = JSON.parse(data);
        } catch (error) {

            console.log('[Sync] Arquivo de cache de JIDs não encontrado, criando um novo.');
        }


        botJidCache[msgDetails.sender] = learnedJid;
        botJidCache['global'] = learnedJid;


        await fs.writeFile(BOT_JID_CACHE_PATH, JSON.stringify(botJidCache, null, 2));

        console.log(`[Sync] Sincronização COMPLETA para ${msgDetails.sender}. JID aprendido: ${learnedJid}`);
        await sock.sendMessage(
            msgDetails.sender,
            { text: `✅ Sincronizada com sucesso! Agora já posso te ouvir neste grupo.` },
            { quoted: msg }
        );

    } catch (error) {
        console.error("[Sync] Erro ao salvar o JID no cache:", error);
        await sock.sendMessage(msgDetails.sender, { text: "❌ Ocorreu um erro ao salvar a sincronização." }, { quoted: msg });
    }
}

module.exports = syncCommand;


module.exports.commandData = {
    name: "fixjid",
    description: "Corrige o JID do bot em cache.",
    category: "super",
    usage: "/fixjid",
    aliases: ["/updateme"]
};
