// commands/palavrao.js
const profanityManager = require('../managers/profanityManager'); // Usando .cjs para consistência

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandText, isSuperAdmin } = msgDetails;

    if (!isSuperAdmin) {
        // Se não for admin, o comando simplesmente não faz nada.
        return;
    }

    // --- CORREÇÃO PRINCIPAL ---
    // Verifica se a mensagem realmente tem texto. Se não, envia o menu de ajuda e para.
    if (!commandText) {
        await sock.sendMessage(sender, { text: "Comando inválido. Use:\n- `/palavrao add <palavra>`\n- `/palavrao remove <palavra>`\n- `/palavrao list`" }, { quoted: msg });
        return;
    }
    
    // Extrai os argumentos do comando de forma segura
    const args = commandText.split(' ');
    const subCommand = args[1] || ''; // Pega o sub-comando (add, remove, list) ou uma string vazia
    const word = args.slice(2).join(' '); // Pega todo o resto do texto como a palavra

    switch (subCommand.toLowerCase()) {
        case 'add':
            if (!word) {
                await sock.sendMessage(sender, { text: "Uso: `/palavrao add <palavra>`" }, { quoted: msg });
                return;
            }
            if (await profanityManager.addWord(word)) {
                await sock.sendMessage(sender, { text: `✅ Palavra "${word}" adicionada à lista de filtros.` }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: `A palavra "${word}" já existe na lista.` }, { quoted: msg });
            }
            break;

        case 'remove':
            if (!word) {
                await sock.sendMessage(sender, { text: "Uso: `/palavrao remove <palavra>`" }, { quoted: msg });
                return;
            }
            if (await profanityManager.removeWord(word)) {
                await sock.sendMessage(sender, { text: `🗑️ Palavra "${word}" removida da lista de filtros.` }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: `A palavra "${word}" não foi encontrada na lista.` }, { quoted: msg });
            }
            break;

        case 'list':
            const wordList = profanityManager.getWords();
            const message = wordList.length > 0
                ? `*Lista de Palavras Filtradas:*\n\n- ${wordList.join('\n- ')}`
                : "A lista de palavras filtradas está vazia.";
            await sock.sendMessage(sender, { text: message }, { quoted: msg });
            break;

        default:
            await sock.sendMessage(sender, { text: "Comando inválido. Use:\n- `/palavrao add <palavra>`\n- `/palavrao remove <palavra>`\n- `/palavrao list`" }, { quoted: msg });
            break;
    }
};
