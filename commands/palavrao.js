// commands/palavrao.js
// Aponta para o novo ficheiro unificado
const profanityManager = require('../profanityManager');
const { extractCommandText } = require('../utils');

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandText, isSuperAdmin } = msgDetails;

    if (!isSuperAdmin) {
        return true;
    }

    const text = extractCommandText(commandText, '!palavrao');
    const [subCommand, ...words] = text.split(' ');
    const word = words.join(' ');

    switch (subCommand.toLowerCase()) {
        case 'add':
            if (!word) {
                await sock.sendMessage(sender, { text: "Uso: `!palavrao add <palavra>`" });
                return true;
            }
            if (await profanityManager.addWord(word)) {
                await sock.sendMessage(sender, { text: `✅ Palavra "${word}" adicionada à lista de filtros.` });
            } else {
                await sock.sendMessage(sender, { text: `A palavra "${word}" já existe na lista.` });
            }
            break;

        case 'remove':
            if (!word) {
                await sock.sendMessage(sender, { text: "Uso: `!palavrao remove <palavra>`" });
                return true;
            }
            if (await profanityManager.removeWord(word)) {
                await sock.sendMessage(sender, { text: `🗑️ Palavra "${word}" removida da lista de filtros.` });
            } else {
                await sock.sendMessage(sender, { text: `A palavra "${word}" não foi encontrada na lista.` });
            }
            break;

        case 'list':
            const wordList = profanityManager.getWords();
            const message = wordList.length > 0
                ? `Lista de palavras filtradas:\n\n- ${wordList.join('\n- ')}`
                : "A lista de palavras filtradas está vazia.";
            await sock.sendMessage(sender, { text: message });
            break;

        default:
            await sock.sendMessage(sender, { text: "Comando inválido. Use:\n- `!palavrao add <palavra>`\n- `!palavrao remove <palavra>`\n- `!palavrao list`" });
            break;
    }

    return true;
};
