// src/commands/sync.js

const fs = require('fs').promises;
const path = require('path');

// Define o caminho para o arquivo de cache
const BOT_JID_CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'bot_jid_cache.json');

async function syncCommand(sock, msg, msgDetails) {
    if (!msgDetails.isGroup) {
        await sock.sendMessage(msgDetails.sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return;
    }

    // Extrai as menções diretamente da mensagem que contém o comando
    const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Verifica se o bot foi realmente mencionado
    if (mentions.length === 0) {
        await sock.sendMessage(
            msgDetails.sender,
            { text: "Uso incorreto. Você precisa me mencionar no comando.\n\n*Exemplo:* `/sync @Julia`" },
            { quoted: msg }
        );
        return;
    }

    // O primeiro JID mencionado será o @lid correto do bot
    const learnedJid = mentions[0];

    try {
        let botJidCache = {};
        // Tenta ler o arquivo de cache existente para não apagar outros grupos
        try {
            const data = await fs.readFile(BOT_JID_CACHE_PATH, 'utf-8');
            botJidCache = JSON.parse(data);
        } catch (error) {
            // Se o arquivo não existir, um novo será criado
            console.log('[Sync] Arquivo de cache de JIDs não encontrado, criando um novo.');
        }

        // Atualiza ou adiciona o JID do bot para o grupo atual
        botJidCache[msgDetails.sender] = learnedJid;

        // Salva o objeto atualizado de volta no arquivo
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
