
const fs = require('fs');
const path = require('path');
const { sendJuliaError } = require('../utils/utils.js'); 

async function handleHelpRawCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    try {
        
        
        const commandDir = __dirname;

        
        const commandFiles = fs.readdirSync(commandDir).filter(file => file.endsWith('.js'));

        if (commandFiles.length === 0) {
            await sock.sendMessage(sender, { text: "Nenhum comando encontrado na pasta." }, { quoted: msg });
            return true;
        }

        
        const commandList = commandFiles.map(file => {
            
            return `!${path.basename(file, '.js')}`;
        });

        const replyText = `*Comandos Disponíveis (Leitura Direta):*\n\n${commandList.join('\n')}`;

        await sock.sendMessage(sender, { text: replyText });

    } catch (error) {
        console.error("[HelpRaw] Erro ao ler a pasta de comandos:", error);
        
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; 
}

module.exports = handleHelpRawCommand;


module.exports.commandData = {
    name: "helpraw",
    description: "Sem descrição disponível.",
    category: "util",
    usage: "/helpraw",
    aliases: []
};
