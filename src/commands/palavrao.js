
const profanityManager = require('../managers/profanityManager'); 

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandText, isSuperAdmin } = msgDetails;

    if (!isSuperAdmin) {
        
        return;
    }

    
    
    if (!commandText) {
        await sock.sendMessage(sender, { text: "Comando inválido. Use:\n- `/palavrao add <palavra>`\n- `/palavrao remove <palavra>`\n- `/palavrao list`" }, { quoted: msg });
        return;
    }
    
    
    const args = commandText.split(' ');
    const subCommand = args[1] || ''; 
    const word = args.slice(2).join(' '); 

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


module.exports.commandData = {
    name: "palavrao",
    description: "Filtro global de palavrões.",
    category: "super",
    usage: "/palavrao",
    aliases: ["/palavroes","/badwords","/filtropalavrao"]
};
