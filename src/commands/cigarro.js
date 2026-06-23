const fumoManager = require('../managers/fumoManager');
const contactManager = require('../managers/contactManager');
const groupMetadataManager = require('../managers/groupMetadataManager');

// Mapeamento de commandName → tipo interno
const SMOKE_TYPES = {
    cigarro: 'cigarro',
    tabaco: 'tabaco',
    paiero: 'tabaco',
    kumbaya: 'tabaco',
    beck: 'beck',
    maconha: 'beck',
    baseado: 'beck',
    tabeck: 'tabeck',
    tabaconha: 'tabeck',
};

const TYPE_EMOJI = {
    cigarro: '🚬',
    tabaco: '🌻',
    beck: '🍁',
    tabeck: '🍃',
};

const TYPE_LABEL = {
    cigarro: 'Cigarro',
    tabaco: 'Tabaco',
    beck: 'Beck',
    tabeck: 'Tabeck',
};

// Medalhas para o rank
const MEDALS = ['🥇', '🥈', '🥉'];

async function handleFumoCommand(sock, msg, msgDetails) {
    const { sender: chatJid, commandName, commandSenderJid, isSuperAdmin, args } = msgDetails;

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, {
            text: '┏━━❪ 🚬 𝗙𝗨𝗠𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Só funciona em grupos\n┃\n┗━━━━━━━━━━━━━━'
        }, { quoted: msg });
        return;
    }

    // ── Registro de fumo ────────────────────────────────────────────
    if (SMOKE_TYPES[commandName]) {
        const type = SMOKE_TYPES[commandName];

        // Modo ajuste: /cigarro -N ou +N @pessoa (somente admins)
        const adjustArg = args.find(a => /^[+-]\d+$/.test(a));
        const isAdjust = !!adjustArg;
        if (isAdjust) {
            const delta = parseInt(adjustArg, 10); // positivo = adicionar, negativo = remover

            let isAdmin = isSuperAdmin;
            if (!isAdmin) {
                try {
                    const meta = await groupMetadataManager.getGroupMetadata(sock, chatJid);
                    const participant = meta.participants.find(p => p.id === commandSenderJid);
                    isAdmin = !!participant?.admin;
                } catch (e) { }
            }
            if (!isAdmin) {
                await sock.sendMessage(chatJid, {
                    text: '┏━━❪ 🚬 𝗙𝗨𝗠𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas admins podem ajustar fumos\n┃\n┗━━━━━━━━━━━━━━'
                }, { quoted: msg });
                return;
            }

            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedParticipantRaw = msg.message?.extendedTextMessage?.contextInfo?.participant;
            const quotedStanzaId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
            let targetJid = mentionedJids[0] || quotedParticipantRaw;

            // Resolve @lid → @s.whatsapp.net
            if (targetJid && targetJid.endsWith('@lid')) {
                let resolved = null;
                if (quotedStanzaId && msgDetails.messageStore) {
                    try {
                        const quotedMsg = msgDetails.messageStore.get(quotedStanzaId);
                        const storedParticipant = quotedMsg?.key?.participant;
                        if (storedParticipant && storedParticipant.endsWith('@s.whatsapp.net')) {
                            resolved = storedParticipant;
                        }
                    } catch (e) { }
                }
                if (!resolved) {
                    try {
                        const meta = await groupMetadataManager.getGroupMetadata(sock, chatJid);
                        const matched = meta.participants.find(p =>
                            p.lid === targetJid ||
                            (p.id && p.id.endsWith('@lid') === false && targetJid.split('@')[0] === p.lid?.split('@')[0])
                        );
                        if (matched?.id && matched.id.endsWith('@s.whatsapp.net')) resolved = matched.id;
                    } catch (e) { }
                }
                if (resolved) targetJid = resolved;
            }

            if (!targetJid) {
                await sock.sendMessage(chatJid, {
                    text: `┏━━❪ 🚬 𝗙𝗨𝗠𝗢 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › /${commandName} -3 @pessoa\n┃ ➢ 𝗼𝘂 › /${commandName} +2 @pessoa\n┃\n┗━━━━━━━━━━━━━━`
                }, { quoted: msg });
                return;
            }

            // Monta candidatos incluindo variante @lid
            const jidCandidates = [targetJid];
            if (quotedParticipantRaw && quotedParticipantRaw !== targetJid) jidCandidates.push(quotedParticipantRaw);
            try {
                const meta = await groupMetadataManager.getGroupMetadata(sock, chatJid);
                const matchedP = meta.participants.find(p => p.id === targetJid || p.id === quotedParticipantRaw);
                if (matchedP?.lid && !jidCandidates.includes(matchedP.lid)) jidCandidates.push(matchedP.lid);
            } catch (e) { }
            targetJid = fumoManager.findStoredJid(chatJid, jidCandidates);

            // Valida remoção: não pode remover mais do que tem
            if (delta < 0) {
                const countsBefore = fumoManager.getUserCounts(chatJid, targetJid);
                if (countsBefore[type] === 0) {
                    await sock.sendMessage(chatJid, {
                        text: `┏━━❪ 🚬 𝗙𝗨𝗠𝗢 ❫━━\n┃\n┃ ➢ 𝗔𝗩𝗜𝗦𝗢 › Essa pessoa não tem ${TYPE_LABEL[type]} registrado\n┃\n┗━━━━━━━━━━━━━━`
                    }, { quoted: msg });
                    return;
                }
            }

            await fumoManager.adjustSmoke(chatJid, targetJid, type, delta);
            const newPoints = fumoManager.getUserPoints(chatJid, targetJid);
            const newUnits = fumoManager.getUserUnits(chatJid, targetJid);
            const nick = contactManager.getNickname(targetJid);
            const displayName = nick || `@${targetJid.split('@')[0]}`;
            const mentionList = nick ? [] : [targetJid];
            const acao = delta > 0 ? `𝗔𝗱𝗶𝗰𝗶𝗼𝗻𝗮𝗱𝗼` : `𝗥𝗲𝗺𝗼𝘃𝗶𝗱𝗼`;
            const sinal = delta > 0 ? `+${delta}` : `${delta}`;

            await sock.sendMessage(chatJid, {
                text:
                    `┏━━❪ ${TYPE_EMOJI[type]} 𝗙𝗨𝗠𝗢 ❫━━\n` +
                    `┃\n` +
                    `┃ ➢ ${acao} › *${sinal}x ${TYPE_LABEL[type]}* de *${displayName}*\n` +
                    `┃ ➢ 𝗙𝘂𝗺𝗼𝘀 › *${newUnits}* unidades\n` +
                    `┃ ➢ 𝗣𝗼𝗻𝘁𝘂𝗮𝗰𝗮𝗼 › *${newPoints}* pts\n` +
                    `┃\n` +
                    `┗━━━━━━━━━━━━━━`,
                mentions: mentionList,
            }, { quoted: msg });
            return;
        }

        // Quantidade opcional: /cigarro 3 (registra N de uma vez, máx 20)
        const qtyArg = /^\d+$/.test(args[0] || '') ? args[0] : null;
        const qty = qtyArg ? Math.min(Math.max(parseInt(qtyArg, 10), 1), 20) : 1;

        for (let i = 0; i < qty; i++) {
            await fumoManager.recordSmoke(chatJid, commandSenderJid, type);
        }

        const points = fumoManager.POINTS[type];
        const totalGrupo = fumoManager.getGroupTotal(chatJid);
        const totalUser = fumoManager.getUserUnits(chatJid, commandSenderJid);
        const userPoints = fumoManager.getUserPoints(chatJid, commandSenderJid);
        const dailyUnits = fumoManager.getDailyUserUnits(chatJid, commandSenderJid);
        const emoji = TYPE_EMOJI[type];
        const label = TYPE_LABEL[type];
        const qtySuffix = qty > 1 ? ` (${qty}x)` : '';

        await sock.sendMessage(chatJid, {
            text:
                `┏━━❪ ${emoji} 𝗙𝗨𝗠𝗢 ❫━━\n` +
                `┃\n` +
                `┃ ➢ 𝗧𝗶𝗽𝗼 › *${label}*${qtySuffix} (+${points * qty} pts)\n` +
                `┃ ➢ 𝗦𝗲𝘂𝘀 𝗙𝘂𝗺𝗼𝘀 › *${totalUser}* unidades\n` +
                `┃ ➢ 𝗦𝘂𝗮 𝗣𝗼𝗻𝘁𝘂𝗮𝗰𝗮𝗼 › *${userPoints}* pts\n` +
                `┃ ➢ 𝗛𝗼𝗶𝗲 › *${dailyUnits}* unidades\n` +
                `┃ ➢ 𝗧𝗼𝘁𝗮𝗹 𝗚𝗿𝘂𝗽𝗼 › *${totalGrupo}* cigarros\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`,
        }, { quoted: msg });
        return;
    }

    // ── /meufumo — stats pessoais (aceita menção/reply p/ ver de outra pessoa)
    if (commandName === 'meufumo') {
        const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
        const targetJid = mentionedJids[0] || quotedParticipant || commandSenderJid;
        const isSelf = targetJid === commandSenderJid;

        const counts = fumoManager.getUserCounts(chatJid, targetJid);
        const units = fumoManager.getUserUnits(chatJid, targetJid);
        const points = fumoManager.getUserPoints(chatJid, targetJid);

        // Descobrir posição no rank
        const ranking = fumoManager.getGroupRanking(chatJid);
        const pos = ranking.findIndex(r => r.jid === targetJid);
        const posText = pos === -1 ? 'Sem rank' : `#${pos + 1} de ${ranking.length}`;

        // Nome para exibição
        let displayName;
        const mentions = [];
        if (isSelf) {
            displayName = '𝗠𝗘𝗨 𝗙𝗨𝗠𝗢';
        } else {
            const nick = contactManager.getNickname(targetJid);
            if (nick) {
                displayName = `𝗙𝗨𝗠𝗢 𝗗𝗘 ${nick}`;
            } else {
                mentions.push(targetJid);
                displayName = `𝗙𝗨𝗠𝗢 𝗗𝗘 @${targetJid.split('@')[0]}`;
            }
        }

        await sock.sendMessage(chatJid, {
            text:
                `┏━━❪ 🚬 ${displayName} ❫━━\n` +
                `┃\n` +
                `┃ ➢ 𝗣𝗼𝘀𝗶𝗰𝗮𝗼 › *${posText}*\n` +
                `┃ ➢ 𝗧𝗼𝘁𝗮𝗹 𝗨𝗻𝗶𝗱𝗮𝗱𝗲𝘀 › *${units}*\n` +
                `┃ ➢ 𝗣𝗼𝗻𝘁𝘂𝗮𝗰𝗮𝗼 › *${points}* pts\n` +
                `┃\n` +
                `┃ 𝗗𝗲𝘁𝗮𝗹𝗵𝗲𝘀:\n` +
                `┃  🚬 Cigarro (1pt) › ${counts.cigarro}x\n` +
                `┃  🌻 Tabaco (2pts) › ${counts.tabaco}x\n` +
                `┃  🍁 Beck (3pts)   › ${counts.beck}x\n` +
                `┃  🍃 Tabeck (5pts) › ${counts.tabeck}x\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`,
            mentions,
        }, { quoted: msg });
        return;
    }

    // ── /fumorank — ranking do grupo ──────────────────────────────────
    if (commandName === 'fumorank') {
        const ranking = fumoManager.getGroupRanking(chatJid);
        const totalGrupo = fumoManager.getGroupTotal(chatJid);
        const baseline = fumoManager.getUnknownBaseline(chatJid);
        const showAll = args.some(a => String(a).toLowerCase() === 'all');

        if (ranking.length === 0) {
            await sock.sendMessage(chatJid, {
                text:
                    `┏━━❪ 🚬 𝗥𝗔𝗡𝗞 𝗙𝗨𝗠𝗢 ❫━━\n` +
                    `┃\n` +
                    `┃ ➢ 𝗧𝗼𝘁𝗮𝗹 𝗴𝗿𝘂𝗽𝗼 › *${totalGrupo}* cigarros\n` +
                    `┃\n` +
                    `┃ ➢ Ninguém fumou ainda neste grupo!\n` +
                    `┃\n` +
                    `┗━━━━━━━━━━━━━━`,
            }, { quoted: msg });
            return;
        }

        // Buscar metadados do grupo para nomes
        let participants = {};
        try {
            const meta = await groupMetadataManager.getGroupMetadata(sock, chatJid);
            for (const p of meta.participants) participants[p.id] = p;
        } catch (e) { }

        let lines = '';
        const mentions = [];
        const limit = showAll ? ranking.length : Math.min(ranking.length, 10);
        for (let i = 0; i < limit; i++) {
            const { jid, points } = ranking[i];
            const medal = MEDALS[i] || `${i + 1}.`;
            const nick = contactManager.getNickname(jid);
            let name;
            if (nick) {
                name = nick;
            } else {
                mentions.push(jid);
                name = `@${jid.split('@')[0]}`;
            }
            lines += `┃ ${medal} *${name}* › ${points} fumos\n`;
        }

        let baselineNote = '';
        if (baseline > 0) {
            baselineNote = `┃ ➢ 𝗗𝗲𝘀𝗰𝗼𝗻𝗵𝗲𝗰𝗶𝗱𝗼 › +${baseline} cigarros\n`;
        }

        await sock.sendMessage(chatJid, {
            text:
                `┏━━❪ 🚬 𝗥𝗔𝗡𝗞 𝗙𝗨𝗠𝗢 ❫━━\n` +
                `┃\n` +
                `┃ ➢ 𝗧𝗼𝘁𝗮𝗹 𝗴𝗿𝘂𝗽𝗼 › *${totalGrupo}* cigarros\n` +
                baselineNote +
                `┃\n` +
                lines +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`,
            mentions,
        }, { quoted: msg });
        return;
    }

    // ── /fumohoje — rank do dia ──────────────────────────────────────
    if (commandName === 'fumohoje') {
        const ranking = fumoManager.getDailyGroupRanking(chatJid);
        const date = fumoManager.getDailyDate();

        if (ranking.length === 0) {
            await sock.sendMessage(chatJid, {
                text:
                    `┏━━❪ 🚬 𝗙𝗨𝗠𝗢𝗦 𝗛𝗢𝗝𝗘 ❫━━\n` +
                    `┃\n` +
                    `┃ ➢ *${date}* — Nenhum fumo registrado hoje!\n` +
                    `┃\n` +
                    `┗━━━━━━━━━━━━━━`,
            }, { quoted: msg });
            return;
        }

        let lines = '';
        const mentionsHoje = [];
        for (let i = 0; i < Math.min(ranking.length, 10); i++) {
            const { jid, points } = ranking[i];
            const medal = MEDALS[i] || `${i + 1}.`;
            const nick = contactManager.getNickname(jid);
            let name;
            if (nick) {
                name = nick;
            } else {
                mentionsHoje.push(jid);
                name = `@${jid.split('@')[0]}`;
            }
            lines += `┃ ${medal} *${name}* › ${points} fumos\n`;
        }

        await sock.sendMessage(chatJid, {
            text:
                `┏━━❪ 🚬 𝗙𝗨𝗠𝗢𝗦 𝗛𝗢𝗝𝗘 ❫━━\n` +
                `┃\n` +
                `┃ ➢ *${date}*\n` +
                `┃\n` +
                lines +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`,
            mentions: mentionsHoje,
        }, { quoted: msg });
        return;
    }

    // ── /fumostat — média por categoria ─────────────────────────────
    if (commandName === 'fumostat') {
        const stats = fumoManager.getGroupCategoryStats(chatJid);
        const totalGrupo = fumoManager.getGroupTotal(chatJid);

        const fmt = (n) => Number.isInteger(n) ? String(n) : n.toFixed(2);

        const linha = (emoji, label, s) =>
            `┃ ${emoji} *${label}*\n` +
            `┃   ➢ Total › ${s.totalUnits} unid. / ${s.totalPoints} pts\n` +
            `┃   ➢ Fumantes › ${s.activeFumantes} pessoas\n` +
            `┃   ➢ Média › ${fmt(s.avgUnitsPerFumante)} unid./pessoa\n`;

        const text =
            `┏━━❪ 🚬 𝗘𝗦𝗧𝗔𝗧𝗦 𝗗𝗢 𝗚𝗥𝗨𝗣𝗢 ❫━━\n` +
            `┃\n` +
            `┃ ➢ 𝗧𝗼𝘁𝗮𝗹 𝗴𝗿𝘂𝗽𝗼 › *${totalGrupo}* cigarros\n` +
            `┃\n` +
            linha('🚬', 'Cigarro (1pt)', stats.cigarro) +
            `┃\n` +
            linha('🌻', 'Tabaco (2pts)', stats.tabaco) +
            `┃\n` +
            linha('🍁', 'Beck (3pts)', stats.beck) +
            `┃\n` +
            linha('🍃', 'Tabeck (5pts)', stats.tabeck) +
            `┃\n` +
            `┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(chatJid, { text }, { quoted: msg });
        return;
    }

    // ── /fumolimpo — lista não fumantes ─────────────────────────────
    if (commandName === 'fumolimpo') {
        const ranking = fumoManager.getGroupRanking(chatJid);
        const fumantesJids = new Set(ranking.map(r => r.jid));

        let groupMeta;
        try {
            groupMeta = await groupMetadataManager.getGroupMetadata(sock, chatJid);
        } catch (e) {
            await sock.sendMessage(chatJid, {
                text: '┏━━❪ 🚬 𝗙𝗨𝗠𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Não foi possível buscar participantes\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
            return;
        }

        const naoFumantes = groupMeta.participants.filter(p => !fumantesJids.has(p.id));

        if (naoFumantes.length === 0) {
            await sock.sendMessage(chatJid, {
                text: '┏━━❪ 🚬 𝗟𝗜𝗠𝗣𝗢𝗦 ❫━━\n┃\n┃ ➢ Todo mundo já fumou pelo menos uma vez!\n┃\n┗━━━━━━━━━━━━━━',
            }, { quoted: msg });
            return;
        }

        const mentionsLimpo = [];
        let lines = '';
        for (const p of naoFumantes) {
            const nick = contactManager.getNickname(p.id);
            if (nick) {
                lines += `┃ • ${nick}\n`;
            } else {
                mentionsLimpo.push(p.id);
                lines += `┃ • @${p.id.split('@')[0]}\n`;
            }
        }

        await sock.sendMessage(chatJid, {
            text:
                `┏━━❪ 🚬 𝗟𝗜𝗠𝗣𝗢𝗦 ❫━━\n` +
                `┃\n` +
                `┃ ➢ *${naoFumantes.length}* pessoa(s) sem registro:\n` +
                `┃\n` +
                lines +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`,
            mentions: mentionsLimpo,
        }, { quoted: msg });
        return;
    }

    // ── /fumoinit — define baseline de desconhecido (admin/superadmin) ──
    if (commandName === 'fumoinit') {
        // Verificar se é admin
        let isAdmin = isSuperAdmin;
        if (!isAdmin) {
            try {
                const meta = await groupMetadataManager.getGroupMetadata(sock, chatJid);
                const participant = meta.participants.find(p => p.id === commandSenderJid);
                isAdmin = !!participant?.admin;
            } catch (e) { }
        }

        if (!isAdmin) {
            await sock.sendMessage(chatJid, {
                text: `┏━━❪ 🚬 𝗙𝗨𝗠𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas admins podem usar este comando\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return;
        }

        const val = parseInt(args[0], 10);
        if (isNaN(val) || val < 0) {
            await sock.sendMessage(chatJid, {
                text:
                    `┏━━❪ 🚬 𝗙𝗨𝗠𝗢 ❫━━\n` +
                    `┃\n` +
                    `┃ ➢ 𝗨𝘀𝗼 › /fumoinit [número]\n` +
                    `┃ ➢ 𝗗𝗲𝘀𝗰 › Define cigarros fumados antes\n` +
                    `┃           da automação (contagem do grupo)\n` +
                    `┃\n` +
                    `┗━━━━━━━━━━━━━━`,
            }, { quoted: msg });
            return;
        }

        await fumoManager.setUnknownBaseline(chatJid, val);
        const novoTotal = fumoManager.getGroupTotal(chatJid);

        await sock.sendMessage(chatJid, {
            text:
                `┏━━❪ 🚬 𝗙𝗨𝗠𝗢 ❫━━\n` +
                `┃\n` +
                `┃ ➢ 𝗕𝗮𝘀𝗲𝗹𝗶𝗻𝗲 › *${val}* unidades definidas\n` +
                `┃ ➢ 𝗡𝗼𝘃𝗼 𝘁𝗼𝘁𝗮𝗹 𝗴𝗿𝘂𝗽𝗼 › *${novoTotal}* cigarros\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`,
        }, { quoted: msg });
        return;
    }
}

module.exports = handleFumoCommand;

module.exports.commandData = {
    name: 'cigarro',
    description: 'Registra um cigarro fumado e exibe o contador do grupo.',
    category: 'fumo',
    usage: '/cigarro | /tabaco | /beck | /tabeck | /fumorank [all] | /meufumo | /fumoinit [n]',
    aliases: ['/tabaco', '/paiero', '/kumbaya', '/beck', '/maconha', '/baseado', '/tabeck', '/tabaconha', '/fumorank', '/fumohoje', '/fumostat', '/fumolimpo', '/meufumo', '/fumoinit'],
};
