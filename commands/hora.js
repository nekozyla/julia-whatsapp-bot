// commands/hora.js
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const localizedFormat = require('dayjs/plugin/localizedFormat');
require('dayjs/locale/pt-br'); // Carrega o local para o português

// Configura o Day.js
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
dayjs.locale('pt-br'); // Define o português como padrão
dayjs.tz.setDefault("America/Sao_Paulo"); // Define o fuso horário padrão

async function handleHoraCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    try {
        // Pega a hora atual usando a configuração do Day.js
        const now = dayjs().tz();
        
        // Formata a data e hora de uma forma amigável em português
        const formattedTime = now.format('dddd, D [de] MMMM [de] YYYY [às] HH:mm:ss');

        const replyText = `🕒 A hora atual no sistema do bot é:\n\n*${formattedTime}*\n\nFuso Horário: _America/Sao_Paulo_`;

        await sock.sendMessage(sender, { text: replyText }, { quoted: msg });

    } catch (error) {
        console.error("[Hora] Erro ao obter a hora:", error);
        await sock.sendMessage(sender, { text: "Ocorreu um erro ao tentar verificar a hora." }, { quoted: msg });
    }

    return true; // Indica que o comando foi processado
}

module.exports = handleHoraCommand;
