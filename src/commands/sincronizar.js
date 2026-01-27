
const syncManager = require('../managers/syncManager.js');
const { sendJuliaError } = require('../utils/utils.js');
const groupMetadataManager = require('../managers/groupMetadataManager.js');

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandText, commandSenderJid, isGroup, isSuperAdmin } = msgDetails;
    const args = commandText.split(' ').slice(1);

    if (!isGroup) {
        await sock.sendMessage(sender, { text: 'Este comando só pode ser usado dentro de um grupo.' }, { quoted: msg });
        return;
    }

    if (args.length === 0) {
        const help = `*Sincronizar Grupos*\n\nUso:\n/sincronizar add <group_jid> - Vincula este grupo com <group_jid>\n/sincronizar remove <group_jid> - Remove o vínculo\n/sincronizar list - Lista grupos sincronizados com este\n\nVocê precisa ser administrador do grupo (ou SuperAdmin) para gerir sincronizações.`;
        await sock.sendMessage(sender, { text: help }, { quoted: msg });
        return;
    }

    const sub = args[0].toLowerCase();

    try {
        
        let isAuthorGroupAdmin = false;
        try {
            const meta = await groupMetadataManager.getGroupMetadata(sock, sender);
            const participant = meta.participants.find(p => p.id === commandSenderJid);
            isAuthorGroupAdmin = !!participant?.admin;
        } catch (e) {
            
        }

        if (!isSuperAdmin && !isAuthorGroupAdmin) {
            await sock.sendMessage(sender, { text: 'Apenas administradores podem gerir sincronizações.' }, { quoted: msg });
            return;
        }

        if (sub === 'add') {
            const target = args[1];
            if (!target || !target.endsWith('@g.us')) {
                await sock.sendMessage(sender, { text: 'Forneça o JID do grupo de destino. Ex: 12345-67890@g.us' }, { quoted: msg });
                return;
            }
            if (target === sender) {
                await sock.sendMessage(sender, { text: 'Não é possível vincular um grupo a si mesmo.' }, { quoted: msg });
                return;
            }

            
            try {
                const targetMeta = await groupMetadataManager.getGroupMetadata(sock, target);
                if (!targetMeta) {
                    await sock.sendMessage(sender, { text: 'Não consegui acessar o grupo de destino. Verifique se o JID está correto e se a Julia está presente no grupo.' }, { quoted: msg });
                    return;
                }
            } catch (e) {
                
            }

            await syncManager.addLink(sender, target);
            await sock.sendMessage(sender, { text: `✅ Grupos sincronizados: ${sender} ↔ ${target}` }, { quoted: msg });
            return;
        }

        if (sub === 'remove') {
            const target = args[1];
            if (!target || !target.endsWith('@g.us')) {
                await sock.sendMessage(sender, { text: 'Forneça o JID do grupo a remover. Ex: 12345-67890@g.us' }, { quoted: msg });
                return;
            }
            await syncManager.removeLink(sender, target);
            await sock.sendMessage(sender, { text: `✅ Vínculo removido: ${sender} -X- ${target}` }, { quoted: msg });
            return;
        }

        if (sub === 'list') {
            const links = await syncManager.getLinks(sender);
            if (!links || links.length === 0) {
                await sock.sendMessage(sender, { text: 'Este grupo não tem sincronizações configuradas.' }, { quoted: msg });
                return;
            }
            const listText = links.map(l => `- ${l}`).join('\n');
            await sock.sendMessage(sender, { text: `Grupos sincronizados com este:\n${listText}` }, { quoted: msg });
            return;
        }

        await sock.sendMessage(sender, { text: 'Subcomando inválido. Use `add`, `remove` ou `list`.' }, { quoted: msg });

    } catch (error) {
        console.error('[Sincronizar] Erro:', error);
        await sendJuliaError(sock, sender, msg, error);
    }
};


module.exports.commandData = {
    name: "sincronizar",
    description: "Sincronia de grupos.",
    category: "super",
    usage: "/sincronizar",
    aliases: ["/sync","/sinc"]
};
