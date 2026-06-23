
const fs = require('fs').promises;
const path = require('path');
const authManager = require('../managers/authManager.js');
const config = require('../../config.js');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');



const alertsFilePath = path.join(__dirname, '..', '..', 'data', 'alert_log.json');
let alertLog = {};
// Formato novo: { grupo: { user: { count: N, history: [{ reason, by, date }] } } }

function migrateUserData(val) {
    // Migra formato antigo (número) para novo (objeto)
    if (typeof val === 'number') return { count: val, history: [] };
    if (typeof val === 'object' && val !== null && typeof val.count === 'number') return val;
    return { count: 0, history: [] };
}

function getUserAlerts(chatJid, userJid) {
    if (!alertLog[chatJid]) alertLog[chatJid] = {};
    if (!alertLog[chatJid][userJid]) alertLog[chatJid][userJid] = { count: 0, history: [] };
    alertLog[chatJid][userJid] = migrateUserData(alertLog[chatJid][userJid]);
    return alertLog[chatJid][userJid];
}

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

        if (!alertLog[chatJid]) alertLog[chatJid] = {};

        const args = commandText.split(' ').slice(1);
        const subCommand = args[0]?.toLowerCase();

        // ── LIST ─────────────────────────────
        if (subCommand === 'list' || subCommand === 'lista') {
            const allJids = Object.keys(alertLog[chatJid] || {});
            const usersWithAlerts = allJids.filter(jid => {
                const d = getUserAlerts(chatJid, jid);
                return d.count > 0;
            });
            if (usersWithAlerts.length === 0) {
                await sock.sendMessage(chatJid, { text: "📋 Ninguém tem alertas neste grupo. Parabéns!" });
                return;
            }
            let listText = "*📋 Lista de Alertas do Grupo 📋*\n\n";
            const mentions = [];
            usersWithAlerts.forEach(jid => {
                const d = getUserAlerts(chatJid, jid);
                listText += `• @${jid.split('@')[0]}: *${d.count}/3* alertas\n`;
                if (d.history.length > 0) {
                    const last = d.history[d.history.length - 1];
                    if (last.reason) listText += `  └ Último motivo: _${last.reason}_\n`;
                }
                mentions.push(jid);
            });
            await sock.sendMessage(chatJid, { text: listText, mentions });
            return;
        }

        // ── VER ──────────────────────────────
        if (subCommand === 'ver' || subCommand === 'info' || subCommand === 'check') {
            let checkJid = mentionedJids[0];
            if (!checkJid) {
                const quotedP = msg.message?.extendedTextMessage?.contextInfo?.participant;
                if (quotedP) checkJid = quotedP;
            }
            if (!checkJid) {
                await sock.sendMessage(chatJid, { text: "Mencione alguém ou responda a mensagem da pessoa.\n*Exemplo:* `/alerta ver @pessoa`" }, { quoted: msg });
                return;
            }
            const d = getUserAlerts(chatJid, checkJid);
            if (d.count === 0 && d.history.length === 0) {
                await sock.sendMessage(chatJid, { text: `✅ @${checkJid.split('@')[0]} não tem nenhum alerta.`, mentions: [checkJid] });
                return;
            }
            let text = `🚨 *Alertas de @${checkJid.split('@')[0]}*\n\n`;
            text += `📊 *Contagem:* ${d.count}/3\n\n`;
            if (d.history.length > 0) {
                text += `📜 *Histórico:*\n`;
                d.history.forEach((h, i) => {
                    const dateStr = h.date ? new Date(h.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '?';
                    text += `\n${i + 1}. *${dateStr}*`;
                    if (h.by) text += ` — por @${h.by.split('@')[0]}`;
                    text += `\n   ${h.reason || '_Sem motivo_'}`;
                });
            } else {
                text += `_Sem histórico detalhado (alertas antigos)._`;
            }
            const mentions = [checkJid, ...d.history.map(h => h.by).filter(Boolean)];
            await sock.sendMessage(chatJid, { text, mentions: [...new Set(mentions)] });
            return;
        }

        
        // ── RESET ────────────────────────────
        if (subCommand === 'reset') {
            let resetJid = mentionedJids[0];
            if (!resetJid) {
                const quotedP = msg.message?.extendedTextMessage?.contextInfo?.participant;
                if (quotedP) resetJid = quotedP;
            }
            if (!resetJid) {
                await sock.sendMessage(chatJid, { text: "Mencione alguém ou responda a mensagem.\n*Exemplo:* `/alerta reset @pessoa`" }, { quoted: msg });
                return;
            }
            const d = getUserAlerts(chatJid, resetJid);
            if (d.count > 0 || d.history.length > 0) {
                alertLog[chatJid][resetJid] = { count: 0, history: [] };
                await saveAlerts();
                await sock.sendMessage(chatJid, { text: `✅ Alertas de @${resetJid.split('@')[0]} foram resetados.`, mentions: [resetJid] });
            } else {
                await sock.sendMessage(chatJid, { text: `@${resetJid.split('@')[0]} não tinha nenhum alerta.`, mentions: [resetJid] });
            }
            return;
        }

        
        // Pegar alvo: menção OU autor da mensagem respondida
        let targetJid = mentionedJids[0];
        if (!targetJid) {
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (quotedParticipant) {
                targetJid = quotedParticipant;
            }
        }
        if (!targetJid) {
            await sock.sendMessage(chatJid, { text: "Você precisa mencionar alguém ou *responder a mensagem* da pessoa para dar um alerta.\n\n*Exemplo:*\n`/alerta @pessoa por spam`\nOu responda uma mensagem com `/alerta motivo`" }, { quoted: msg });
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

        // Se veio de menção, motivo começa do args[1]; se veio de reply, args[0] já é motivo
        const reasonStartIdx = mentionedJids.length > 0 ? 1 : 0;
        const reason = args.slice(reasonStartIdx).join(' ').replace(`@${targetJid.split('@')[0]}`, '').trim();

        const userData = getUserAlerts(chatJid, targetJid);
        userData.count++;
        userData.history.push({
            reason: reason || null,
            by: commandSenderJid,
            date: Date.now()
        });
        const currentAlerts = userData.count;
        await saveAlerts();

        if (currentAlerts >= 4) {
            
            const botJid = jidNormalizedUser(sock.user.id);
            const botParticipant = groupMetadata.participants.find(p => p.id === botJid);

            if (botParticipant?.admin) {
                let banText = `☠️ BANIDO ☠️\n\nO utilizador @${targetJid.split('@')[0]} atingiu o limite de *4/3* alertas e foi removido do grupo.`;
                if (reason) banText += `\n\n*Último motivo:* ${reason}`;

                await sock.sendMessage(chatJid, { text: banText, mentions: [targetJid] });
                await sock.groupParticipantsUpdate(chatJid, [targetJid], "remove");
                alertLog[chatJid][targetJid] = { count: 0, history: [] };
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
    description: "Sistema de avisos/ban com histórico de motivos.",
    category: "admin",
    usage: "/alerta @pessoa [motivo]\n/alerta ver @pessoa\n/alerta list\n/alerta reset @pessoa",
    aliases: ["/aviso","/warn","/advertencia","/banlist"]
};
