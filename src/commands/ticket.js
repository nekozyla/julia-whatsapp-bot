const ticketManager = require('../managers/ticketManager.js');

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandSenderJid, args, isSuperAdmin, originalText } = msgDetails;

    // Se nenhum argumento for passado
    if (!args || args.length === 0) {
        let text = "🎫 *Sistema de Tickets PV*\n\n";
        
        if (isSuperAdmin) {
            text += "👑 *Comandos Admin:*\n";
            text += "➔ */ticket gerar <dias>* - Gera um código\n";
            text += "➔ */ticket pendentes* - Lista não resgatados\n";
            text += "➔ */ticket revogar <codigo>* - Remove código\n";
            text += "➔ */ticket revogaruser <jid/mencao>* - Revoga acesso\n";
            text += "➔ */ticket ativos* - Lista usuários usando\n\n";
        }
        
        text += "👤 *Comandos Usuário:*\n";
        text += "➔ */ticket <código>* - Resgata um ticket\n";
        text += "➔ */ticket status* - Vê seu tempo restante\n";

        return sock.sendMessage(sender, { text }, { quoted: msg });
    }

    const subCommand = args[0].toLowerCase();

    // ── Resgatar Ticket ───────────────────────────────────────
    // Se o submcomando não for nenhuma das palavras-chave de admin ou 'status', tentamos resgatar direto.
    // Especialmente útil para o fluxo "/ticket XXXX-XXXX-XXXX"
    if (!['gerar', 'pendentes', 'revogar', 'revogaruser', 'ativos', 'status'].includes(subCommand) || (subCommand === 'resgatar' && args[1])) {
        const potentialCode = subCommand === 'resgatar' ? args[1] : args[0];
        
        const result = await ticketManager.redeemTicket(potentialCode, commandSenderJid);
        
        if (result.success) {
            const expDate = new Date(result.expiresAt).toLocaleString('pt-BR');
            return sock.sendMessage(sender, {
                text: `✅ *Ticket resgatado com sucesso!*\n\nVocê ganhou *${result.days} dias* de acesso ao bot no PV.\nSeu acesso é válido até: *${expDate}*\n\nAproveite os comandos! 🎉`
            }, { quoted: msg });
        } else {
            return sock.sendMessage(sender, {
                text: `❌ *Falha ao resgatar.*\n\nO código fornecido (*${potentialCode}*) é inválido ou já foi usado.`
            }, { quoted: msg });
        }
    }

    // ── Status do Usuário ─────────────────────────────────────
    if (subCommand === 'status') {
        const info = ticketManager.getAccessInfo(commandSenderJid);
        if (!info || !info.active) {
            return sock.sendMessage(sender, {
                text: `ℹ️ Você não possui acesso ativo por ticket no momento.`
            }, { quoted: msg });
        }

        const expDate = new Date(info.expiresAt).toLocaleString('pt-BR');
        const daysRemaining = (info.remainingMs / (1000 * 60 * 60 * 24)).toFixed(1);

        return sock.sendMessage(sender, {
            text: `🎫 *Seu Status de Ticket PV*\n\nStatus: ✅ Ativo\nExpiração: *${expDate}*\nTempo Restante: *${daysRemaining} dias*\n\nCódigos ativados: ${info.activatedCodes.join(', ')}`
        }, { quoted: msg });
    }

    // ── ÁREA RESTRITA: SUPER ADMIN ────────────────────────────
    if (!isSuperAdmin) {
        return sock.sendMessage(sender, { text: "🚫 *Acesso Negado* - Comando restrito para Super Admins." }, { quoted: msg });
    }

    if (subCommand === 'gerar') {
        const days = parseInt(args[1], 10);
        if (isNaN(days) || days <= 0) {
            return sock.sendMessage(sender, { text: `⚠️ *Uso correto:* /ticket gerar <número de dias>` }, { quoted: msg });
        }

        const code = await ticketManager.createTicket(days, commandSenderJid);
        return sock.sendMessage(sender, {
            text: `🎟️ *Ticket Gerado!*\n\nCódigo: *${code}*\nDias de Acesso: *${days}* dias\n\nEnvie este código ao usuário para ativar o modo PV. Ele deve usar:\n*/ticket ${code}* no PV do bot.`
        }, { quoted: msg });
    }

    if (subCommand === 'pendentes') {
        const pending = ticketManager.listPendingTickets();
        if (pending.length === 0) {
            return sock.sendMessage(sender, { text: "Nenhum ticket pendente." }, { quoted: msg });
        }

        let text = `🎟️ *Tickets Pendentes (${pending.length}):*\n\n`;
        pending.forEach((t, i) => {
            const date = new Date(t.createdAt).toLocaleDateString('pt-BR');
            text += `${i+1}. *${t.code}* - ${t.days} dia(s) (Criado em ${date})\n`;
        });
        return sock.sendMessage(sender, { text: text.trim() }, { quoted: msg });
    }

    if (subCommand === 'revogar') {
        const code = args[1];
        if (!code) return sock.sendMessage(sender, { text: "⚠️ Use /ticket revogar <codigo>" }, { quoted: msg });

        const success = await ticketManager.revokeTicket(code);
        if (success) {
            return sock.sendMessage(sender, { text: `✅ Ticket *${code}* revogado com sucesso.` }, { quoted: msg });
        } else {
            return sock.sendMessage(sender, { text: `❌ Código não encontrado.` }, { quoted: msg });
        }
    }

    if (subCommand === 'ativos') {
        const actives = ticketManager.getAllActiveUsers();
        if (actives.length === 0) {
            return sock.sendMessage(sender, { text: "Nenhum usuário com acesso ativo por ticket." }, { quoted: msg });
        }

        let text = `🎫 *Usuários com Ticket PV Ativo (${actives.length}):*\n\n`;
        actives.forEach((user, i) => {
            const date = new Date(user.expiresAt).toLocaleDateString('pt-BR');
            const jidDisplay = user.jid.split('@')[0];
            const daysLeft = (user.remainingMs / (1000 * 60 * 60 * 24)).toFixed(1);
            text += `${i+1}. @${jidDisplay} - Falta ${daysLeft} dias (Exp: ${date})\n`;
        });
        
        const mentions = actives.map(u => u.jid);
        return sock.sendMessage(sender, { text: text.trim(), mentions }, { quoted: msg });
    }

    if (subCommand === 'revogaruser') {
        let jid = args[1];
        if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            jid = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else if (jid && !jid.includes('@')) {
            jid = jid.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        }

        if (!jid) return sock.sendMessage(sender, { text: "⚠️ Use /ticket revogaruser @user ou passe o número." }, { quoted: msg });

        const success = await ticketManager.revokeUserAccess(jid);
        if (success) {
            return sock.sendMessage(sender, { text: `✅ Acesso revogado para @${jid.split('@')[0]}`, mentions: [jid] }, { quoted: msg });
        } else {
            return sock.sendMessage(sender, { text: `❌ Este usuário não possui acesso ativo por ticket.` }, { quoted: msg });
        }
    }

    return sock.sendMessage(sender, { text: "❌ Subcomando desconhecido." }, { quoted: msg });
};

module.exports.commandData = {
    name: "ticket",
    description: "Gerenciar ou resgatar tickets de uso do bot no PV.",
    category: "admin",
    usage: "/ticket <código> | /ticket gerar <dias>",
    aliases: ["/resgatar", "/tickets"],
    isNSFW: false
};
