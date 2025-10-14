// src/commands/passwd.js
const crypto = require('crypto');
const authManager = require('../managers/authManager.js');
const { getContentType } = require('@whiskeysockets/baileys');

// Armazena em memória as senhas pendentes e a quem pertencem
// Formato: { "/senha_unica": "jid_do_utilizador@s.whatsapp.net" }
const pendingPasswords = {};

/**
 * Monitor que verifica todas as mensagens privadas à procura de uma senha de ativação.
 */
async function passwordMonitor(sock, { messages }) {
    const msg = messages[0];
    const senderJid = msg.key.remoteJid;
    const isGroup = senderJid.endsWith('@g.us');

    // Processa apenas mensagens privadas que não sejam do próprio bot
    if (isGroup || msg.key.fromMe) return;

    const textContent = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();

    // Verifica se a mensagem enviada é uma senha pendente E se foi enviada pelo utilizador correto
    const userJidToAuthorize = pendingPasswords[textContent];
    if (userJidToAuthorize && userJidToAuthorize === senderJid) {
        try {
            // Remove a senha para que não possa ser usada novamente
            delete pendingPasswords[textContent]; 

            await authManager.addAllowedContact(senderJid);
            await sock.sendMessage(senderJid, { text: "✅ Senha correta! A sua conta foi autorizada.\n\nSeja bem-vindo(a)! Use o comando `/help` em qualquer chat para ver o que eu posso fazer." });
            console.log(`[Passwd] Utilizador ${senderJid} autorizado com sucesso via senha.`);

        } catch (e) {
            console.error("[Passwd] Erro ao autorizar utilizador via senha:", e);
            await sock.sendMessage(senderJid, { text: "Ocorreu um erro ao processar a sua senha. Por favor, peça para ser convidado(a) novamente." });
        }
    }
}


/**
 * Handler principal do comando /passwd, que inicia o convite.
 */
async function handlePasswdCommand(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Apenas utilizadores já autorizados podem gerar convites
    if (!authManager.isContactAllowed(commandSenderJid)) {
        await sock.sendMessage(sender, { text: "Apenas utilizadores autorizados podem convidar outros." }, { quoted: msg });
        return;
    }

    if (mentionedJids.length !== 1) {
        await sock.sendMessage(sender, { text: "Para convidar alguém, mencione a pessoa no comando.\n\n*Exemplo:*\n`/passwd @pessoa`" }, { quoted: msg });
        return;
    }

    const applicantJid = mentionedJids[0];

    // Anexa o monitor de mensagens ao bot na primeira vez que o comando é executado
    if (!sock.passwordListenerAttached) {
        sock.ev.on('messages.upsert', (data) => passwordMonitor(sock, data));
        sock.passwordListenerAttached = true;
        console.log('[Passwd] Monitor de senhas ativado e anexado ao bot.');
    }

    // Gera uma senha única e aleatória
    const password = `/${crypto.randomBytes(4).toString('hex')}`;

    // Armazena a senha, associando-a ao JID do convidado
    pendingPasswords[password] = applicantJid;

    // Define um tempo de expiração para a senha (5 minutos)
    setTimeout(() => {
        if (pendingPasswords[password]) {
            delete pendingPasswords[password];
            console.log(`[Passwd] Senha "${password}" para ${applicantJid} expirou.`);
        }
    }, 300000); // 300.000 ms = 5 minutos

    const instructionMessage = `Olá! Você foi convidado(a) para usar a Julia.\n\nPara ativar a sua conta, copie e envie a seguinte senha **exatamente como está, neste chat privado**:\n\n\`\`\`${password}\`\`\`\n\nA senha é válida por 5 minutos.`;

    try {
        // Tenta enviar a mensagem privada ao convidado
        await sock.sendMessage(applicantJid, { text: instructionMessage });
        // Confirma ao autor do comando que o convite foi enviado
        await sock.sendMessage(sender, { text: `✅ Convite com senha enviado para o privado de @${applicantJid.split('@')[0]}.`, mentions: [applicantJid] }, { quoted: msg });
    } catch (e) {
        console.error("[Passwd] Erro ao enviar PM para o convidado:", e);
        await sock.sendMessage(sender, { text: `Não consegui enviar a mensagem privada para @${applicantJid.split('@')[0]}. Peça para ele(a) iniciar uma conversa comigo primeiro.`, mentions: [applicantJid] }, { quoted: msg });
    }
}

module.exports = handlePasswdCommand;
