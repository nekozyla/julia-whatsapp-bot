
const fs = require('fs').promises;
const path = require('path');
const settingsManager = require('../managers/groupSettingsManager.js');
const groupMetadataManager = require('../managers/groupMetadataManager.js');



const rulesFilePath = path.join(__dirname, '..', '..', 'data', 'censura_rules.json');
let censorshipRules = {}; 


async function loadRules() {
    try {
        await fs.mkdir(path.dirname(rulesFilePath), { recursive: true });
        const data = await fs.readFile(rulesFilePath, 'utf-8');
        censorshipRules = JSON.parse(data);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            
            censorshipRules = {};
        } else {
            console.error('[Censura] Erro ao carregar regras:', error);
        }
    }
}


async function saveRules() {
    try {
        await fs.writeFile(rulesFilePath, JSON.stringify(censorshipRules, null, 2));
    } catch (error) {
        console.error('[Censura] Erro ao salvar regras:', error);
    }
}


loadRules();









async function censorshipMonitor(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid.endsWith('@g.us')) return;

    const chatJid = msg.key.remoteJid;
    const authorJid = msg.key.participant;
    const textContent = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    
    const isCensorshipOn = settingsManager.getSetting(chatJid, 'censorshipMode', 'off');
    if (isCensorshipOn !== 'on' || !authorJid) return;

    
    
    const groupMeta = await groupMetadataManager.getGroupMetadata(sock, chatJid);

    
    if (!groupMeta) return;

    const participant = groupMeta.participants.find(p => p.id === authorJid);
    if (participant?.admin) return;

    const rules = censorshipRules[chatJid] || { words: [], users: [] };
    let shouldDelete = false;
    let reason = '';

    
    if (rules.users.includes(authorJid)) {
        shouldDelete = true;
        reason = 'Utilizador na lista de censura.';
    }
    
    else if (rules.words.some(word => new RegExp(`\\b${word}\\b`, 'i').test(textContent))) {
        shouldDelete = true;
        reason = 'Palavra proibida detetada.';
    }

    if (shouldDelete) {
        try {
            await sock.sendMessage(chatJid, { delete: msg.key });
            console.log(`[Censura] Mensagem de ${authorJid} apagada no grupo ${chatJid}. Motivo: ${reason}`);
        } catch (e) {
            console.error(`[Censura] Falha ao apagar mensagem. O bot é admin? Erro:`, e);
        }
    }
}



module.exports = async (sock, msg, msgDetails) => {
    const { sender: chatJid, commandText, commandSenderJid } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." });
        return;
    }

    const groupMeta = await groupMetadataManager.getGroupMetadata(sock, chatJid);
    const participant = groupMeta.participants.find(p => p.id === commandSenderJid);
    const isAdmin = !!participant?.admin;

    if (!isAdmin) {
        await sock.sendMessage(chatJid, { text: "Apenas administradores do grupo podem gerir a censura." }, { quoted: msg });
        return;
    }

    
    if (!censorshipRules[chatJid]) {
        censorshipRules[chatJid] = { words: [], users: [] };
    }

    const args = commandText.split(' ').slice(1);
    const subCommand = args[0]?.toLowerCase();
    const value = args[1];

    switch (subCommand) {
        case 'on':
            
            await settingsManager.setSetting(chatJid, 'censorshipMode', 'on');
            if (!sock.censorshipListenerAttached) {
                sock.ev.on('messages.upsert', (data) => censorshipMonitor(sock, data));
                sock.censorshipListenerAttached = true; 
                console.log('[Censura] Monitor de censura ativado e anexado ao bot.');
            }
            await sock.sendMessage(chatJid, { text: "✅ *Modo Censura ATIVADO*.\nAs regras de censura estão agora ativas neste grupo." });
            break;

        case 'off':
            await settingsManager.setSetting(chatJid, 'censorshipMode', 'off');
            await sock.sendMessage(chatJid, { text: "✅ *Modo Censura DESATIVADO*." });
            break;

        case 'add':
            const type = args[1]?.toLowerCase();
            const item = args[2];
            if (type === 'palavra' && item) {
                censorshipRules[chatJid].words.push(item.toLowerCase());
                await saveRules();
                await sock.sendMessage(chatJid, { text: `✅ Palavra "\`${item}\`" adicionada à lista de censura.` });
            } else if (type === 'user' && mentionedJids.length > 0) {
                const userJid = mentionedJids[0];
                censorshipRules[chatJid].users.push(userJid);
                await saveRules();
                await sock.sendMessage(chatJid, { text: `✅ Utilizador @${userJid.split('@')[0]} adicionado à lista de censura.`, mentions: [userJid] });
            } else {
                await sock.sendMessage(chatJid, { text: "Uso incorreto. Ex: `/censura add palavra <texto>` ou `/censura add user @pessoa`" });
            }
            break;

        case 'del':
            const typeDel = args[1]?.toLowerCase();
            const itemDel = args[2];
            if (typeDel === 'palavra' && itemDel) {
                censorshipRules[chatJid].words = censorshipRules[chatJid].words.filter(w => w !== itemDel.toLowerCase());
                await saveRules();
                await sock.sendMessage(chatJid, { text: `✅ Palavra "\`${itemDel}\`" removida da lista.` });
            } else if (typeDel === 'user' && mentionedJids.length > 0) {
                const userJid = mentionedJids[0];
                censorshipRules[chatJid].users = censorshipRules[chatJid].users.filter(u => u !== userJid);
                await saveRules();
                await sock.sendMessage(chatJid, { text: `✅ Utilizador @${userJid.split('@')[0]} removido da lista.`, mentions: [userJid] });
            } else {
                await sock.sendMessage(chatJid, { text: "Uso incorreto. Ex: `/censura del palavra <texto>` ou `/censura del user @pessoa`" });
            }
            break;

        case 'list':
            const rules = censorshipRules[chatJid];
            let listText = `*📜 Regras de Censura Atuais*\n\n`;
            listText += `*Palavras Proibidas:*\n${rules.words.length > 0 ? rules.words.map(w => `- \`${w}\``).join('\n') : '_Nenhuma_'}\n\n`;
            listText += `*Utilizadores Censurados:*\n`;
            if (rules.users.length > 0) {
                rules.users.forEach(jid => listText += `- @${jid.split('@')[0]}\n`);
                await sock.sendMessage(chatJid, { text: listText, mentions: rules.users });
            } else {
                listText += '_Nenhum_';
                await sock.sendMessage(chatJid, { text: listText });
            }
            break;

        default:
            const status = settingsManager.getSetting(chatJid, 'censorshipMode', 'off').toUpperCase();
            await sock.sendMessage(chatJid, { text: `*Comando de Censura* (Apenas Admins)\n\n*Status Atual:* ${status}\n\n*Comandos:*\n- \`/censura on|off\`\n- \`/censura add|del palavra <texto>\`\n- \`/censura add|del user @pessoa\`\n- \`/censura list\`` });
            break;
    }
};


module.exports.commandData = {
    name: "censura",
    description: "Palavras proibidas.",
    category: "admin",
    usage: "/censura",
    aliases: []
};
