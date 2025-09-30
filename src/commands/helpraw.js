// commands/helpraw.js
const fs = require('fs');
const path = require('path');
const { sendJuliaError } = require('../utils/utils.js'); // Reutilizando a função de erro

async function handleHelpRawCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    try {
        // O '__dirname' é uma variável especial do Node.js que representa
        // o diretório do arquivo atual (neste caso, a pasta 'commands').
        const commandDir = __dirname;
        
        // Lê todos os arquivos do diretório de forma síncrona
        const commandFiles = fs.readdirSync(commandDir).filter(file => file.endsWith('.js'));

        if (commandFiles.length === 0) {
            await sock.sendMessage(sender, { text: "Nenhum comando encontrado na pasta." }, { quoted: msg });
            return true;
        }

        // Mapeia a lista de nomes de arquivo para uma lista de comandos
        const commandList = commandFiles.map(file => {
            // Remove a extensão '.js' do nome do arquivo e adiciona '!' no início
            return `!${path.basename(file, '.js')}`;
        });

        const replyText = `*Comandos Disponíveis (Leitura Direta):*\n\n${commandList.join('\n')}`;

        await sock.sendMessage(sender, { text: replyText });

    } catch (error) {
        console.error("[HelpRaw] Erro ao ler a pasta de comandos:", error);
        // Usa a função de erro padronizada que criamos
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; // Indica que o comando foi processado
}

module.exports = handleHelpRawCommand;
