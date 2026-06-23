const muchaManager = require('../managers/muchaMusicaManager.js');
const groupMetadataManager = require('../managers/groupMetadataManager.js');
const contactManager = require('../managers/contactManager.js');

/**
 * Resolve o formato de menção de um usuário
 * - Se tiver Nick Customizado, vai mostrar apenas o nick
 * - Se não, retorna a menção em @numero, e adiciona ela no Mentions do baileys
 */
function resolveMention(memberJid, mentionsArray) {
    const nick = contactManager.getNickname(memberJid);
    if (nick) return nick;
    if (!mentionsArray.includes(memberJid)) mentionsArray.push(memberJid);
    return `@${memberJid.split('@')[0]}`;
}

async function handleMuchaMusicaCommand(sock, msg, msgDetails) {
    const { sender, commandSenderJid, isGroup, isSuperAdmin, args } = msgDetails;

    // Só funciona em grupo
    if (!isGroup) {
        return sock.sendMessage(sender, {
            text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Comando apenas para grupos\n┃\n┗━━━━━━━━━━━━━━'
        }, { quoted: msg });
    }

    const sub = (args[0] || '').toLowerCase();

    // ── ON: Ativar modo ──────────────────────────────
    if (sub === 'on') {
        let isAdmin = isSuperAdmin;
        if (!isAdmin) {
            try {
                const meta = await groupMetadataManager.getGroupMetadata(sock, sender);
                const participant = meta?.participants?.find(p => p.id === commandSenderJid);
                isAdmin = !!participant?.admin;
            } catch (e) { }
        }

        if (!isAdmin) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas admins podem ativar\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        if (muchaManager.isActive(sender)) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Mucha Música já está ativo!\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use /muchamusica off pra desativar\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        try {
            const meta = await groupMetadataManager.getGroupMetadata(sock, sender);
            if (!meta || !meta.participants) {
                return sock.sendMessage(sender, {
                    text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Não consegui obter membros do grupo\n┃\n┗━━━━━━━━━━━━━━'
                }, { quoted: msg });
            }

            const botJid = msgDetails.botJid;
            const members = meta.participants
                .filter(p => p.id !== botJid)
                .map(p => ({
                    jid: p.id,
                    name: contactManager.getNickname(p.id) || p.id.split('@')[0]
                }));

            if (members.length < 2) {
                return sock.sendMessage(sender, {
                    text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Precisa de pelo menos 2 membros\n┃\n┗━━━━━━━━━━━━━━'
                }, { quoted: msg });
            }

            await muchaManager.activate(sender, members);
            const firstMember = muchaManager.getCurrentMember(sender);

            const mentions = [];
            const mentionText = resolveMention(firstMember.jid, mentions);

            let text = `┏━━❪ 🎵 𝗠𝗨𝗖𝗛𝗔 𝗠𝗨́𝗦𝗜𝗖𝗔 ❫━━\n┃\n`;
            text += `┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Ativado! ✅\n`;
            text += `┃ ➢ 𝗠𝗲𝗺𝗯𝗿𝗼𝘀 › ${members.length}\n┃\n`;
            text += `┣━━❪ 🎤 𝗛𝗢𝗝𝗘 ❫━━\n┃\n`;
            text += `┃ ➢ É a vez de ${mentionText}!\n`;
            text += `┃ ➢ Use */dodia* para registrar\n┃\n`;
            text += `┣━━❪ ℹ️ 𝗜𝗡𝗙𝗢 ❫━━\n┃\n`;
            text += `┃ ➢ Notificação diária às 8h\n`;
            text += `┃ ➢ Cada dia um membro manda\n`;
            text += `┃ ➢ uma música pra galera!\n┃\n`;
            text += `┗━━━━━━━━━━━━━━`;

            return sock.sendMessage(sender, { text, mentions }, { quoted: msg });
        } catch (e) {
            console.error('[MuchaMusica] Erro ao ativar:', e);
            return sock.sendMessage(sender, {
                text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao ativar\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }
    }

    // ── OFF: Desativar modo ──────────────────────────
    if (sub === 'off') {
        let isAdmin = isSuperAdmin;
        if (!isAdmin) {
            try {
                const meta = await groupMetadataManager.getGroupMetadata(sock, sender);
                const participant = meta?.participants?.find(p => p.id === commandSenderJid);
                isAdmin = !!participant?.admin;
            } catch (e) { }
        }

        if (!isAdmin) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas admins podem desativar\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        if (!muchaManager.isActive(sender)) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Mucha Música não está ativo\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        await muchaManager.deactivate(sender);
        return sock.sendMessage(sender, {
            text: '┏━━❪ 🎵 𝗠𝗨𝗖𝗛𝗔 𝗠𝗨́𝗦𝗜𝗖𝗔 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Desativado ❌\n┃ ➢ 𝗗𝗶𝗰𝗮 › Os dados foram preservados\n┃ ➢ Use /muchamusica on para reativar\n┃\n┗━━━━━━━━━━━━━━'
        }, { quoted: msg });
    }

    // ── RESET: Apagar tudo ──────────────────────────
    if (sub === 'reset') {
        let isAdmin = isSuperAdmin;
        if (!isAdmin) {
            try {
                const meta = await groupMetadataManager.getGroupMetadata(sock, sender);
                const participant = meta?.participants?.find(p => p.id === commandSenderJid);
                isAdmin = !!participant?.admin;
            } catch (e) { }
        }

        if (!isAdmin) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas admins podem resetar\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        await muchaManager.resetGroup(sender);
        return sock.sendMessage(sender, {
            text: '┏━━❪ 🎵 𝗠𝗨𝗖𝗛𝗔 𝗠𝗨́𝗦𝗜𝗖𝗔 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Resetado 🗑️\n┃ ➢ Todos os dados foram apagados\n┃\n┗━━━━━━━━━━━━━━'
        }, { quoted: msg });
    }

    // ── STATUS: Quem é o membro da vez ──────────────
    if (sub === 'status' || !sub) {
        if (!muchaManager.isActive(sender)) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 🎵 𝗠𝗨𝗖𝗛𝗔 𝗠𝗨́𝗦𝗜𝗖𝗔 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Inativo\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use /muchamusica on\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        const member = muchaManager.getCurrentMember(sender);
        const songs = muchaManager.getSongHistory(sender);
        const pending = muchaManager.getAllPending(sender);
        const today = muchaManager.todayStr();
        const mentions = [];

        // Verifica se já mandou hoje
        const sentToday = songs.some(s => s.day === today && s.memberJid === member.jid);

        let text = `┏━━❪ 🎵 𝗠𝗨𝗖𝗛𝗔 𝗠𝗨́𝗦𝗜𝗖𝗔 ❫━━\n┃\n`;
        text += `┃ ➢ 𝗗𝗶𝗮 › ${today}\n`;
        text += `┃ ➢ 𝗩𝗲𝘇 𝗱𝗲 › ${resolveMention(member.jid, mentions)}`;
        text += sentToday ? ' ✅\n' : ' ⏳\n';
        text += `┃ ➢ 𝗠𝘂́𝘀𝗶𝗰𝗮𝘀 › ${songs.length}\n┃\n`;

        // Pendências
        const pendingEntries = Object.entries(pending);
        if (pendingEntries.length > 0) {
            text += `┣━━❪ ⚠️ 𝗣𝗘𝗡𝗗𝗘𝗡𝗧𝗘𝗦 ❫━━\n┃\n`;
            for (const [jid, days] of pendingEntries) {
                const name = resolveMention(jid, mentions);
                text += `┃ ➢ ${name} › ${days.length} música(s)\n`;
            }
            text += `┃\n`;
        }

        // Últimas 3 músicas
        if (songs.length > 0) {
            text += `┣━━❪ 🎶 𝗥𝗘𝗖𝗘𝗡𝗧𝗘𝗦 ❫━━\n┃\n`;
            const recent = songs.slice(-3).reverse();
            for (const s of recent) {
                const name = resolveMention(s.memberJid, mentions);
                const late = s.late ? ' ⏰' : '';
                const trackStr = s.track === '🔗 (ver link)' ? (s.link || '🔗 Link avulso') : s.track;
                const artistStr = s.artist === '🔗 (ver link)' ? '' : ` — ${s.artist}`;
                text += `┃ ➢ ${trackStr}${artistStr}${late}\n`;
                text += `┃   por ${name} (${s.day})\n`;
            }
            text += `┃\n`;
        }

        text += `┗━━━━━━━━━━━━━━`;

        return sock.sendMessage(sender, { text, mentions }, { quoted: msg });
    }

    // ── TABELA: Histórico completo ──────────────────
    if (sub === 'tabela' || sub === 'historico' || sub === 'lista') {
        if (!muchaManager.isActive(sender)) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Modo não ativo\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        const gs = muchaManager.getGroupState(sender);
        const songs = muchaManager.getSongHistory(sender);
        const mentions = [];

        if (songs.length === 0) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 🎵 𝗧𝗔𝗕𝗘𝗟𝗔 ❫━━\n┃\n┃ ➢ Nenhuma música registrada ainda!\n┃ ➢ Use /dodia para começar\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        const rotationKeys = new Map(gs.rotation.map((jid, idx) => [jid, idx]));
        
        const sortedSongs = [...songs].sort((a, b) => {
            const dayDiff = a.day.localeCompare(b.day);
            if (dayDiff !== 0) return dayDiff;
            return (rotationKeys.get(a.memberJid) || 0) - (rotationKeys.get(b.memberJid) || 0);
        });

        // Paginar
        const page = Math.max(1, parseInt(args[1]) || 1);
        const perPage = 15;
        const totalPages = Math.ceil(sortedSongs.length / perPage);
        const start = (page - 1) * perPage;
        const pageSongs = sortedSongs.slice(start, start + perPage);

        let text = `┏━━❪ 🎵 𝗧𝗔𝗕𝗘𝗟𝗔 ❫━━\n┃\n`;
        text += `┃ ➢ 𝗣á𝗴𝗶𝗻𝗮 › ${page}/${totalPages}\n`;
        text += `┃ ➢ 𝗧𝗼𝘁𝗮𝗹 › ${sortedSongs.length} música(s)\n┃\n`;
        text += `┣━━❪ 📋 𝗛𝗜𝗦𝗧𝗢́𝗥𝗜𝗖𝗢 ❫━━\n┃\n`;

        for (let i = 0; i < pageSongs.length; i++) {
            const s = pageSongs[i];
            const num = String(start + i + 1).padStart(2, '0');
            const name = resolveMention(s.memberJid, mentions);
            const late = s.late ? ' ⏰' : ' ✅';
            const trackStr = s.track === '🔗 (ver link)' ? (s.link || '🔗 Link avulso') : s.track;
            const artistStr = s.artist === '🔗 (ver link)' ? '' : ` — ${s.artist}`;
            text += `┃ ${num}. ${trackStr}${artistStr}${late}\n`;
            text += `┃     📅 ${s.day} • ${name}\n`;
        }

        if (totalPages > 1) {
            text += `┃\n┃ ➢ /muchamusica tabela ${page < totalPages ? page + 1 : 1}\n`;
        }

        text += `┃\n┗━━━━━━━━━━━━━━`;

        return sock.sendMessage(sender, { text, mentions }, { quoted: msg });
    }

    // ── RANK: Ranking de músicas ────────────────────
    if (sub === 'rank' || sub === 'ranking') {
        if (!muchaManager.isActive(sender)) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Modo não ativo\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        const ranking = muchaManager.getRanking(sender);
        const mentions = [];

        if (ranking.length === 0) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 🏆 𝗥𝗔𝗡𝗞 ❫━━\n┃\n┃ ➢ Nenhuma música registrada ainda!\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        const medals = ['🥇', '🥈', '🥉'];

        let text = `┏━━❪ 🏆 𝗥𝗔𝗡𝗞𝗜𝗡𝗚 ❫━━\n┃\n`;
        for (let i = 0; i < ranking.length; i++) {
            const r = ranking[i];
            const medal = medals[i] || `${i + 1}.`;
            const name = resolveMention(r.jid, mentions);
            const lateStr = r.late > 0 ? ` (${r.late} atrasada${r.late > 1 ? 's' : ''})` : '';
            text += `┃ ${medal} ${name} › ${r.total} música(s)${lateStr}\n`;
        }

        text += `┃\n┗━━━━━━━━━━━━━━`;

        return sock.sendMessage(sender, { text, mentions }, { quoted: msg });
    }

    // ── PULAR: Pula a vez do atual ──────────────────
    if (sub === 'pular' || sub === 'skip') {
        let isAdmin = isSuperAdmin;
        if (!isAdmin) {
            try {
                const meta = await groupMetadataManager.getGroupMetadata(sock, sender);
                const participant = meta?.participants?.find(p => p.id === commandSenderJid);
                isAdmin = !!participant?.admin;
            } catch (e) { }
        }

        if (!isAdmin) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas admins podem pular\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        if (!muchaManager.isActive(sender)) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Modo não ativo\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        const result = await muchaManager.skipCurrent(sender);
        if (!result) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao pular\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        const mentions = [];
        const skippedName = resolveMention(result.skippedJid, mentions);
        const newName = resolveMention(result.newMember.jid, mentions);

        let text = `┏━━❪ 🎵 𝗣𝗨𝗟𝗔𝗗𝗢 ❫━━\n┃\n`;
        text += `┃ ➢ ${skippedName} foi pulado ⏭️\n`;
        text += `┃ ➢ Ficou como pendente\n┃\n`;
        text += `┃ ➢ Agora é a vez de:\n`;
        text += `┃ ➢ 🎤 ${newName}\n┃\n`;
        text += `┗━━━━━━━━━━━━━━`;

        return sock.sendMessage(sender, { text, mentions }, { quoted: msg });
    }

    // ── ORDEM: Mostra a rotação ─────────────────────
    if (sub === 'ordem' || sub === 'rotacao' || sub === 'fila') {
        if (!muchaManager.isActive(sender)) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Modo não ativo\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        const rotation = muchaManager.getRotation(sender);
        const songs = muchaManager.getSongHistory(sender);
        const pendingMap = muchaManager.getAllPending(sender);
        const today = muchaManager.todayStr();
        const mentions = [];

        let text = `┏━━❪ 🎵 𝗢𝗥𝗗𝗘𝗠 ❫━━\n┃\n`;
        for (let i = 0; i < rotation.length; i++) {
            const r = rotation[i];
            const name = resolveMention(r.jid, mentions);
            
            let status = '';
            // Se tá pendente
            const pendings = pendingMap[r.jid] || [];
            if (pendings.length > 0) {
                status += ' ⏳';
            }

            // Se é o atual ou já mandou
            if (r.isCurrent) {
                const mandouHoje = songs.some(s => s.day === today && s.memberJid === r.jid);
                status += mandouHoje ? ' ✅ (mandou hoje)' : ' 🎤 (HOJE)';
            } else {
                // Checa se ele já mandou pra todos os dias DELE
                // Na vdd a lógica simplificada pro Mucha é: se ele n é current,
                // e n tem pendencia, então ele tá ok. Mas se tiver na fila ainda por vir, ele n mandou.
                // Mas pra indicador legal é: "tá pendente? mostra. é a vez dele? mostra. tem nada? nada".
                if (pendings.length > 0) {
                   status += ` (${pendings.length} devendo)`;
                }
            }

            text += `┃ ${String(i + 1).padStart(2, '0')}. ${name}${status}\n`;
        }
        text += `┃\n┗━━━━━━━━━━━━━━`;

        return sock.sendMessage(sender, { text, mentions }, { quoted: msg });
    }

    // ── HELP: Subcomando não reconhecido ─────────────
    let text = `┏━━❪ 🎵 𝗠𝗨𝗖𝗛𝗔 𝗠𝗨́𝗦𝗜𝗖𝗔 ❫━━\n┃\n`;
    text += `┃ ➢ /muchamusica on\n┃   Ativa o modo\n`;
    text += `┃ ➢ /muchamusica off\n┃   Desativa o modo\n`;
    text += `┃ ➢ /muchamusica status\n┃   Status atual\n`;
    text += `┃ ➢ /muchamusica tabela\n┃   Histórico de músicas\n`;
    text += `┃ ➢ /muchamusica rank\n┃   Ranking do grupo\n`;
    text += `┃ ➢ /muchamusica ordem\n┃   Ordem da rotação\n`;
    text += `┃ ➢ /muchamusica pular\n┃   Pula a vez (admin)\n`;
    text += `┃ ➢ /muchamusica reset\n┃   Reseta tudo (admin)\n┃\n`;
    text += `┃ ➢ /dodia <música - artista>\n┃   Registra a música do dia\n┃\n`;
    text += `┗━━━━━━━━━━━━━━`;

    return sock.sendMessage(sender, { text }, { quoted: msg });
}

module.exports = handleMuchaMusicaCommand;

module.exports.commandData = {
    name: "muchamusica",
    description: "Modo de rotação diária de músicas no grupo.",
    category: "diversao",
    usage: "/muchamusica <on|off|status|tabela|rank|ordem|pular|reset>",
    aliases: ["/mm", "/musicadodia"]
};
