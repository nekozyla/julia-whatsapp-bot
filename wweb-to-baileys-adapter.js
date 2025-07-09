// wweb-to-baileys-adapter.js
const { MessageMedia } = require('whatsapp-web.js');

/**
 * Adapta uma mensagem do formato whatsapp-web.js para o formato que os comandos antigos (Baileys) esperam.
 * @param {import('whatsapp-web.js').Client} wwebClient - O cliente do whatsapp-web.js.
 * @param {import('whatsapp-web.js').Message} wwebMsg - A mensagem recebida do whatsapp-web.js.
 * @returns {Promise<{sock: object, baileysMsg: object, msgDetails: object}>} - Um objeto contendo o 'sock' e 'msg' adaptados.
 */
async function adaptMessage(wwebClient, wwebMsg) {

    // 1. Cria um objeto "sock" falso que traduz as chamadas para a nova biblioteca
    const sock = {
        /**
         * Traduz o sock.sendMessage do Baileys para o client.sendMessage do wweb.js
         */
        async sendMessage(jid, content, options = {}) {
            // Traduz o formato do conteúdo
            let finalContent = content.text || ''; // Pega o texto por padrão
            let finalOptions = {};

            // Se for um sticker
            if (content.sticker) {
                finalContent = new MessageMedia('image/webp', content.sticker.toString('base64'));
                finalOptions.sendMediaAsSticker = true;
            }

            // Adiciona a lógica para responder a uma mensagem (quoted)
            if (options.quoted) {
                finalOptions.quotedMessageId = options.quoted.id._serialized;
            }

            return wwebClient.sendMessage(jid, finalContent, finalOptions);
        },

        // Adicionaremos mais funções aqui (groupMetadata, etc.) à medida que migrarmos outros comandos
    };

    // 2. Cria um objeto "baileysMsg" falso com a estrutura que os comandos esperam
    const chat = await wwebMsg.getChat();
    const contact = await wwebMsg.getContact();

    const baileysMsg = {
        key: {
            remoteJid: wwebMsg.from,
            fromMe: wwebMsg.fromMe,
            id: wwebMsg.id.id,
            participant: chat.isGroup ? wwebMsg.author : undefined,
        },
        message: {
            // Por enquanto, focamos no texto. Adicionaremos outros tipos depois.
            conversation: wwebMsg.body,
            extendedTextMessage: {
                text: wwebMsg.body,
            },
        },
        pushName: contact.pushName || contact.name,
    };

    // 3. Recria o objeto msgDetails
    const msgDetails = {
        sender: wwebMsg.from,
        pushName: baileysMsg.pushName,
        // Adicionaremos mais detalhes aqui conforme necessário
    };
    
    return { sock, baileysMsg, msgDetails };
}

module.exports = { adaptMessage };
