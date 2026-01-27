
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { sendJuliaError } = require('../utils/utils');
const config = require('../../config/config');
const axios = require('axios');
const FormData = require('form-data');

async function handleRemoveBgCommand(sock, msg, msgDetails) {
    const { sender, commandText } = msgDetails;
    const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = msg.message.imageMessage || quotedMsg?.imageMessage;

    if (!isImage) {
        await sock.sendMessage(sender, { text: "⚠️ Por favor, envie ou responda a uma imagem para remover o fundo." }, { quoted: msg });
        return;
    }

    if (!config.REMOVE_BG_KEY) {
        await sock.sendMessage(sender, {
            text: "⚠️ A chave da API do remove.bg não está configurada.\n\nPeça para o dono do bot adicionar `REMOVE_BG_KEY` no arquivo `.env`."
        }, { quoted: msg });
        return;
    }

    try {
        await sock.sendMessage(sender, { react: { text: '✂️', key: msg.key } });

        
        const messageToDownload = quotedMsg ? { message: quotedMsg } : msg;

        
        const buffer = await downloadMediaMessage(
            messageToDownload,
            'buffer',
            {},
            { logger: undefined, reuploadRequest: sock.updateMediaMessage }
        );

        
        const formData = new FormData();
        formData.append('size', 'auto');
        formData.append('image_file', buffer, 'image.jpg');

        
        const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
            headers: {
                ...formData.getHeaders(),
                'X-Api-Key': config.REMOVE_BG_KEY,
            },
            responseType: 'arraybuffer',
            encoding: null
        });

        if (response.status !== 200) {
            throw new Error(`Erro na API remove.bg: ${response.statusText}`);
        }

        
        await sock.sendMessage(sender, {
            image: response.data,
            caption: "✨ Fundo removido com sucesso!"
        }, { quoted: msg });

        await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });

    } catch (error) {
        console.error("[RemoveBG] Erro:", error?.response?.data ? error.response.data.toString() : error.message);

        let errorMessage = "Ocorreu um erro ao remover o fundo.";
        if (error?.response?.status === 402) {
            errorMessage = "⚠️ Os créditos da API do remove.bg acabaram.";
        } else if (error?.response?.status === 403) {
            errorMessage = "⚠️ Chave de API inválida.";
        }

        await sock.sendMessage(sender, { text: errorMessage }, { quoted: msg });
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
}

module.exports = handleRemoveBgCommand;


module.exports.commandData = {
    name: "removebg",
    description: "Remove fundo da imagem.",
    category: "midia",
    usage: "/removebg",
    aliases: ["/bg","/nobg"]
};
