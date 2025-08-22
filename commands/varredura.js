// commands/varredura.js
const { ADMIN_JID } = require('../config');
const contactManager = require('../contactManager');
const agreementManager = require('../agreementManager');
const { sendJuliaError } = require('../utils');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function handleScanCommand(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;

    if (commandSenderJid !== ADMIN_JID) {
        return true; // Ignora silenciosamente
    }

    try {
        const allContacts = contactManager.getContacts().filter(jid => jid.endsWith('@s.whatsapp.net'));
        
        if (allContacts.length === 0) {
            await sock.sendMessage(sender, { text: "Nenhum contacto salvo para verificar." }, { quoted: msg });
            return true;
        }

        await sock.sendMessage(sender, { text: `🧹 A iniciar varredura de ${allContacts.length} contactos para verificar bloqueios. Este processo pode demorar...` }, { quoted: msg });

        let removedCount = 0;
        let checkedCount = 0;

        for (const jid of allContacts) {
            checkedCount++;
            try {
                // A função onWhatsApp verifica se um número existe e pode ser contactado.
                // Se o bot estiver bloqueado, ela geralmente retorna 'exists: false' ou falha.
                const [result] = await sock.onWhatsApp(jid);
                if (!result || !result.exists) {
                    console.log(`[Varredura] Contacto ${jid} não encontrado ou bloqueou o bot. A remover...`);
                    await contactManager.removeContact(jid);
                    await agreementManager.removeAgreement(jid);
                    removedCount++;
                }
            } catch (error) {
                // Erros de 'forbidden' também podem indicar um bloqueio
                if (error?.data === 403) {
                    console.log(`[Varredura] Contacto ${jid} bloqueou o bot (erro 403). A remover...`);
                    await contactManager.removeContact(jid);
                    await agreementManager.removeAgreement(jid);
                    removedCount++;
                } else {
                    console.error(`[Varredura] Erro ao verificar o contacto ${jid}:`, error.message);
                }
            }
            
            // Pausa de 1 segundo entre cada verificação para não sobrecarregar a API
            await sleep(1000);

            // Envia uma atualização de progresso a cada 25 contactos verificados
            if (checkedCount % 25 === 0 && checkedCount < allContacts.length) {
                await sock.sendMessage(sender, { text: `...verificados ${checkedCount} de ${allContacts.length}...` });
            }
        }

        const reportText = `🏁 Varredura concluída!\n\n- *Contactos verificados:* ${checkedCount}\n- *Contactos removidos por bloqueio:* ${removedCount}`;
        await sock.sendMessage(sender, { text: reportText });

    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleScanCommand;

