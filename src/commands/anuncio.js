
const authManager = require('../managers/authManager.js');
const contactManager = require('../managers/contactManager.js');
const anuncioManager = require('../managers/anuncioManager.js');
const { sendGiratinaError } = require('../utils/utils.js');
const config = require('../../config.js');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function handleAnuncioCommand(sock, msg, msgDetails) {
    const { sender, commandText, commandSenderJid, isGroup, remoteJid } = msgDetails;

    if (!authManager.isSuperAdmin(commandSenderJid)) {
        return true;
    }

    const args = commandText.trim().split(/\s+/);
    const subCommand = args[1]?.toLowerCase();

    try {
        if (subCommand === 'block') {
            let targetJid = args[2];

            // Se não houver argumento e for em grupo, bloqueia o grupo atual
            if (!targetJid && isGroup) {
                targetJid = sender;
            } else if (!targetJid) {
                await sock.sendMessage(sender, { text: '❌ Especifique um JID ou número para bloquear, ou use o comando dentro de um grupo.' }, { quoted: msg });
                return true;
            }

            // Normaliza número se não tiver sufixo (assumindo user)
            if (!targetJid.includes('@')) {
                targetJid = targetJid.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            }

            const blocked = await anuncioManager.blockJid(targetJid);
            if (blocked) {
                await sock.sendMessage(sender, { text: `🚫 JID ${targetJid} adicionado à blacklist de anúncios.` }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: `⚠️ JID ${targetJid} já está na blacklist.` }, { quoted: msg });
            }
            return true;

        } else if (subCommand === 'unblock') {
            let targetJid = args[2];
            if (!targetJid) {
                await sock.sendMessage(sender, { text: '❌ Especifique um JID ou número para desbloquear.' }, { quoted: msg });
                return true;
            }

            if (!targetJid.includes('@')) {
                targetJid = targetJid.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            }

            const unblocked = await anuncioManager.unblockJid(targetJid);
            if (unblocked) {
                await sock.sendMessage(sender, { text: `✅ JID ${targetJid} removido da blacklist.` }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: `⚠️ JID ${targetJid} não estava na blacklist.` }, { quoted: msg });
            }
            return true;

        } else if (subCommand === 'list') {
            const blacklist = anuncioManager.getBlacklist();
            if (blacklist.length === 0) {
                await sock.sendMessage(sender, { text: '📜 A blacklist está vazia.' }, { quoted: msg });
            } else {
                const listText = blacklist.map((jid, index) => `${index + 1}. ${jid}`).join('\n');
                await sock.sendMessage(sender, { text: `🚫 *Blacklist de Anúncios* (${blacklist.length}):\n\n${listText}` }, { quoted: msg });
            }
            return true;
        }

        // Se não for subcomando de gestão, é envio de anúncio
        // Usa args[0] para saber o tamanho do comando usado (seja /anuncio, /global, etc) e remove-o
        const commandUsed = args[0];
        const messageToSend = commandText.trim().substring(commandUsed.length).trim();

        if (!messageToSend) {
            const usageText =
                `📢 *Gerenciador de Anúncios*

Use para enviar mensagens globais respeitando a blacklist.

*Comandos:*
- \`/anuncio <mensagem>\`: Envia para todos (privados e grupos).
- \`/anuncio block [jid/numero]\`: Bloqueia destinatário. (Se usado em grupo sem args, bloqueia o grupo).
- \`/anuncio unblock <jid/numero>\`: Desbloqueia destinatário.
- \`/anuncio list\`: Ver blacklist.`;
            await sock.sendMessage(sender, { text: usageText }, { quoted: msg });
            return true;
        }

        // Coletar destinatários
        let contactsToBroadcast = [];
        const privateContacts = contactManager.getContacts().filter(jid => !config.ADMIN_JIDS.includes(jid)); // Evitar spam para admins se quiser, ou manter. O original filtra ADMIN_JID mas aqui usamos lista.
        const allGroups = await sock.groupFetchAllParticipating();
        const groupJids = Object.keys(allGroups);

        contactsToBroadcast = [...new Set([...privateContacts, ...groupJids])];

        // Filtrar blacklist
        const originalCount = contactsToBroadcast.length;
        contactsToBroadcast = contactsToBroadcast.filter(jid => !anuncioManager.isBlocked(jid));
        const finalCount = contactsToBroadcast.length;
        const blockedCount = originalCount - finalCount;

        if (finalCount === 0) {
            await sock.sendMessage(sender, { text: "⚠️ Todos os destinatários possíveis estão bloqueados ou não há ninguém para enviar." }, { quoted: msg });
            return true;
        }

        const confirmationText = `📢 Iniciando anúncio para ${finalCount} destinatários.\n🚫 Bloqueados: ${blockedCount}\n\nO envio será feito com intervalos de segurança.`;
        await sock.sendMessage(sender, { text: confirmationText });

        console.log(`[Anuncio] Iniciando envio para ${finalCount} destinatários (Bloqueados: ${blockedCount}). Mensagem: "${messageToSend.substring(0, 50)}..."`);

        let successCount = 0;
        let errorCount = 0;

        // Processamento em background
        (async () => {
            for (let i = 0; i < contactsToBroadcast.length; i++) {
                const jid = contactsToBroadcast[i];
                try {
                    // Delay de segurança
                    const shortDelay = Math.floor(Math.random() * 20000) + 10000; // 10s a 30s
                    console.log(`[Anuncio] Aguardando ${shortDelay / 1000}s para enviar para ${jid} (${i + 1}/${finalCount})`);
                    await sleep(shortDelay);

                    await sock.sendMessage(jid, { text: messageToSend });
                    successCount++;

                } catch (error) {
                    console.error(`[Anuncio] Falha ao enviar para ${jid}:`, error);
                    errorCount++;
                }
            }

            const reportText = `📢 *Relatório de Anúncio*\n\n✅ Sucesso: ${successCount}\n❌ Falha: ${errorCount}\n🚫 Ignorados (Blacklist): ${blockedCount}`;
            await sock.sendMessage(sender, { text: reportText });
        })();

    } catch (error) {
        await sendGiratinaError(sock, sender, msg, error);
    }

    return true;
}

handleAnuncioCommand.commandData = {
    name: "anuncio",
    description: "Sistema de anúncios globais com blacklist.",
    category: "super",
    usage: "/anuncio <msg | block | unblock | list>",
    aliases: ["/anunciar", "/global"]
};

module.exports = handleAnuncioCommand;
