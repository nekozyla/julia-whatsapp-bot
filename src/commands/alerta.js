
const fs = require('fs').promises;
const path = require('path');
const authManager = require('../managers/authManager.js');
const config = require('../../config/config.js');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');



const alertsFilePath = path.join(__dirname, '..', '..', 'data', 'alert_log.json');
let alertLog = {}; 

async function loadAlerts() {
    try {
        await fs.mkdir(path.dirname(alertsFilePath), { recursive: true });
        const data = await fs.readFile(alertsFilePath, 'utf-8');
        alertLog = JSON.parse(data);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            
            alertLog = {};
        } else {
            console.error('[Alerta] Erro ao carregar alertas:', error);
        }
    }
}

async function saveAlerts() {
    try {
        await fs.writeFile(alertsFilePath, JSON.stringify(alertLog, null, 2));
    } catch (error) {
        console.error('[Alerta] Erro ao salvar alertas:', error);
    }
}

loadAlerts();




async function handleAlertCommand(sock, msg, msgDetails) {
    const { sender: chatJid, commandText, commandSenderJid } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." });
        return;
    }

    try {
        const groupMetadata = await sock.groupMetadata(chatJid);
        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);

        if (!senderParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: "Apenas administradores do grupo podem usar este comando." }, { quoted: msg });
            return;
        }

        if (!alertLog[chatJid]) {
            alertLog[chatJid] = {};
        }
        const groupAlerts = alertLog[chatJid];

        const args = commandText.split(' ').slice(1);
        const subCommand = args[0]?.toLowerCase();

        
        if (subCommand === 'list') {
            const usersWithAlerts = Object.keys(groupAlerts).filter(jid => groupAlerts[jid] > 0);
            if (usersWithAlerts.length === 0) {
                await sock.sendMessage(chatJid, { text: "📋 Ninguém tem alertas neste grupo. Parabéns!" });
                return;
            }
            let listText = "*📋 Lista de Alertas do Grupo 📋*\n\n";
            const mentions = [];
            usersWithAlerts.forEach(jid => {
                listText += `- @${jid.split('@')[0]}: *${groupAlerts[jid]}/3* alertas\n`;
                mentions.push(jid);
            });
            await sock.sendMessage(chatJid, { text: listText, mentions });
            return;
        }

        
        if (subCommand === 'reset') {
            const targetJid = mentionedJids[0];
            if (!targetJid) {
                await sock.sendMessage(chatJid, { text: "Você precisa de mencionar alguém para resetar os alertas.\n*Exemplo:* `/alerta reset @pessoa`" }, { quoted: msg });
                return;
            }
            if (groupAlerts[targetJid]) {
                groupAlerts[targetJid] = 0;
                await saveAlerts();
                await sock.sendMessage(chatJid, { text: `✅ Alertas de @${targetJid.split('@')[0]} foram resetados.`, mentions: [targetJid] });
            } else {
                await sock.sendMessage(chatJid, { text: `O utilizador @${targetJid.split('@')[0]} não tinha nenhum alerta.`, mentions: [targetJid] });
            }
            return;
        }

        
        const targetJid = mentionedJids[0];
        if (!targetJid) {
            await sock.sendMessage(chatJid, { text: "Você precisa de mencionar alguém para dar um alerta.\n\n*Exemplo:*\n`/alerta @pessoa por spam`" }, { quoted: msg });
            return;
        }

        const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
        const isTargetAdmin = !!targetParticipant?.admin;
        const isTargetSuperAdmin = authManager.isSuperAdmin(targetJid);

        if (targetJid === commandSenderJid) {
            await sock.sendMessage(chatJid, { text: "Você não pode dar um alerta a si mesmo." });
            return;
        }
        if (isTargetAdmin || isTargetSuperAdmin) {
            await sock.sendMessage(chatJid, { text: "Não é possível dar alertas a administradores." });
            return;
        }

        
        groupAlerts[targetJid] = (groupAlerts[targetJid] || 0) + 1;
        const currentAlerts = groupAlerts[targetJid];
        await saveAlerts();

        const reason = args.slice(1).join(' ').replace(`@${targetJid.split('@')[0]}`, '').trim();

        if (currentAlerts >= 4) {
            
            const botJid = jidNormalizedUser(sock.user.id);
            const botParticipant = groupMetadata.participants.find(p => p.id === botJid);

            if (botParticipant?.admin) {
                let banText = `☠️ BANIDO ☠️\n\nO utilizador @${targetJid.split('@')[0]} atingiu o limite de *4/3* alertas e foi removido do grupo.`;
                if (reason) banText += `\n\n*Último motivo:* ${reason}`;

                await sock.sendMessage(chatJid, { text: banText, mentions: [targetJid] });
                await sock.groupParticipantsUpdate(chatJid, [targetJid], "remove");
                groupAlerts[targetJid] = 0; 
                await saveAlerts();
            } else {
                await sock.sendMessage(chatJid, { text: `⚠️ O utilizador @${targetJid.split('@')[0]} atingiu *4/3* alertas, mas eu não sou admin para o remover!`, mentions: [targetJid] });
            }
        } else {
            
            let alertText = `🚨 ALERTA 🚨\n\nO utilizador @${targetJid.split('@')[0]} recebeu um alerta de @${commandSenderJid.split('@')[0]}.\n\n*Contagem atual:* ${currentAlerts}/3`;
            if (reason) alertText += `\n*Motivo:* ${reason}`;

            await sock.sendMessage(chatJid, { text: alertText, mentions: [targetJid, commandSenderJid] });
        }

    } catch (error) {
        console.error('[Alerta] Erro no comando:', error);
    }

    return true;
}

module.exports = handleAlertCommand;


module.exports.commandData = {
    name: "alerta",
    description: "Sistema de avisos/ban.",
    category: "admin",
    usage: "/alerta",
    aliases: ["/aviso","/warn","/advertencia","/banlist"]
};
