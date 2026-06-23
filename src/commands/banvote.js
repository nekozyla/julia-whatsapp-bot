/**
 * /banvote — Comando de votação de banimento democrático.
 * 
 * Cria uma enquete nativa do WhatsApp para que membros do grupo
 * votem se um membro deve ser banido ou não. O resultado é
 * avaliado por maioria simples quando todos votam ou ao fim do 
 * timer de 5 minutos.
 */

const groupMetadataManager = require('../managers/groupMetadataManager.js');
const pollManager = require('../managers/pollManager.js');
const config = require('../../config.js');

const BOT_NAME = config.BOT_NAME || 'Bot';
const BANVOTE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

// Opções da enquete
const OPTION_BAN = '🔨 Banir';
const OPTION_PARDON = '🕊️ Perdoar';

async function handleBanVoteCommand(sock, msg, msgDetails) {
    const { sender, commandText, commandSenderJid, botJid, isGroup } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: 'Este comando só pode ser usado em grupos.' }, { quoted: msg });
        return;
    }

    try {
        const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, sender);

        // Checar se o bot é admin
        if (!botJid) {
            await sock.sendMessage(sender, { text: `Não consegui verificar minha identidade neste grupo.` }, { quoted: msg });
            return;
        }

        const botParticipant = groupMetadata.participants.find(p => p.id === botJid);
        if (!botParticipant?.admin) {
            await sock.sendMessage(sender, { text: 'Eu preciso ser administradora do grupo para poder banir alguém.' }, { quoted: msg });
            return;
        }

        // Checar se quem chamou é admin
        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);
        if (!senderParticipant?.admin) {
            await sock.sendMessage(sender, { text: 'Apenas administradores podem iniciar uma votação de banimento.' }, { quoted: msg });
            return;
        }

        // Checar se já tem banvote ativo neste grupo
        const existing = pollManager.findPollByChat(sender);

        // Bypass: /banvote end — encerra imediatamente com o placar atual
        const args = (commandText || '').trim().split(/\s+/);
        if (args[1] === 'end' || args[1] === 'fim') {
            if (!existing) {
                await sock.sendMessage(sender, { text: 'Não há nenhuma votação ativa para encerrar.' }, { quoted: msg });
                return;
            }
            const tally = pollManager.getTally(existing.msgId);
            const banVotes = tally[OPTION_BAN]?.length || 0;
            const pardonVotes = tally[OPTION_PARDON]?.length || 0;
            const result = banVotes > pardonVotes ? 'ban' : 'pardon';
            await finalizeBanVote(sock, sender, existing.poll.targetJid, existing.msgId, result, tally);
            return;
        }

        if (existing) {
            await sock.sendMessage(sender, { text: '⚠️ Já existe uma votação de banimento ativa neste grupo. Aguarde ela finalizar ou use `/banvote end` para encerrar agora.' }, { quoted: msg });
            return;
        }

        // Encontrar o alvo
        const quotedCtx = msg.message?.extendedTextMessage?.contextInfo;
        const mentionedJids = quotedCtx?.mentionedJid || [];
        const quotedParticipant = quotedCtx?.participant;

        let targetJid = mentionedJids.length > 0 ? mentionedJids[0] : quotedParticipant;

        if (!targetJid) {
            await sock.sendMessage(sender, {
                text: '❌ Você precisa marcar alguém ou responder a uma mensagem para iniciar a votação.\n\n*Exemplo:* `/banvote @usuario`'
            }, { quoted: msg });
            return;
        }

        // Não pode banvotar um admin
        const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
        if (!targetParticipant) {
            await sock.sendMessage(sender, { text: 'O usuário mencionado não está no grupo.' }, { quoted: msg });
            return;
        }
        if (targetParticipant.admin) {
            await sock.sendMessage(sender, { text: 'Não é possível iniciar votação para banir um administrador.' }, { quoted: msg });
            return;
        }

        // Calcular eleitores elegíveis (todos exceto o alvo e o bot)
        const eligibleVoters = groupMetadata.participants
            .filter(p => p.id !== targetJid && p.id !== botJid)
            .map(p => p.id);

        const targetName = targetJid.split('@')[0];

        // Enviar a enquete nativa
        const pollMsg = await sock.sendMessage(sender, {
            poll: {
                name: `⚖️ Julgamento de @${targetName} — Devemos banir este membro?`,
                values: [OPTION_BAN, OPTION_PARDON],
                selectableCount: 1 // seleção única
            },
            mentions: [targetJid]
        });

        const pollMsgId = pollMsg?.key?.id;
        if (!pollMsgId) {
            await sock.sendMessage(sender, { text: '❌ Falha ao criar a enquete.' });
            return;
        }

        // Extrair o messageSecret que o Baileys gerou
        const messageSecret = pollMsg.message?.messageContextInfo?.messageSecret;

        // Registrar no PollManager
        const onUpdate = async (poll, voterJid, selectedNames) => {
            try {
                const tally = pollManager.getTally(pollMsgId);
                const banVotes = tally[OPTION_BAN]?.length || 0;
                const pardonVotes = tally[OPTION_PARDON]?.length || 0;
                const totalVotes = banVotes + pardonVotes;

                console.log(`[BanVote] Placar atualizado: ${OPTION_BAN}=${banVotes} | ${OPTION_PARDON}=${pardonVotes} (${totalVotes}/${eligibleVoters.length})`);

                // Maioria simples: se mais da metade votou e tem maioria clara, resolve
                const majority = Math.floor(eligibleVoters.length / 2) + 1;
                
                if (banVotes >= majority) {
                    await finalizeBanVote(sock, sender, targetJid, pollMsgId, 'ban', tally);
                } else if (pardonVotes >= majority) {
                    await finalizeBanVote(sock, sender, targetJid, pollMsgId, 'pardon', tally);
                }
            } catch (e) {
                console.error('[BanVote] Erro no callback de atualização:', e);
            }
        };

        pollManager.registerPoll(pollMsgId, {
            chatJid: sender,
            targetJid,
            options: [OPTION_BAN, OPTION_PARDON],
            messageSecret,
            creatorJid: botJid,
            onUpdate
        });

        // Timer de segurança: resolve por maioria simples após 5 minutos
        setTimeout(async () => {
            const poll = pollManager.getPoll(pollMsgId);
            if (!poll) return; // Já foi resolvida

            const tally = pollManager.getTally(pollMsgId);
            const banVotes = tally[OPTION_BAN]?.length || 0;
            const pardonVotes = tally[OPTION_PARDON]?.length || 0;

            if (banVotes > pardonVotes) {
                await finalizeBanVote(sock, sender, targetJid, pollMsgId, 'ban', tally);
            } else {
                await finalizeBanVote(sock, sender, targetJid, pollMsgId, 'pardon', tally);
            }
        }, BANVOTE_DURATION_MS);

        const minutes = Math.floor(BANVOTE_DURATION_MS / 60000);
        await sock.sendMessage(sender, {
            text: `⚖️ *Votação de Banimento Aberta!*\n\n👤 Réu: @${targetName}\n⏱️ Duração: ${minutes} minutos\n\n📊 Vote na enquete acima para decidir o destino deste membro.\nMaioria simples decide. O resultado será aplicado automaticamente.`,
            mentions: [targetJid]
        });

    } catch (error) {
        console.error('[BanVote] Erro:', error);
        await sock.sendMessage(sender, { text: `Erro ao iniciar votação: ${error.message}` }, { quoted: msg });
    }
}

async function finalizeBanVote(sock, chatJid, targetJid, pollMsgId, result, tally) {
    // Evitar dupla finalização
    const poll = pollManager.getPoll(pollMsgId);
    if (!poll) return;
    pollManager.removePoll(pollMsgId);

    const banVotes = tally[OPTION_BAN]?.length || 0;
    const pardonVotes = tally[OPTION_PARDON]?.length || 0;
    const targetName = targetJid.split('@')[0];

    if (result === 'ban') {
        try {
            await sock.groupParticipantsUpdate(chatJid, [targetJid], 'remove');
            await sock.sendMessage(chatJid, {
                text: `⚖️ *Veredicto: BANIDO*\n\n🔨 @${targetName} foi removido do grupo por votação popular.\n\n📊 Resultado: ${banVotes} a favor do ban × ${pardonVotes} contra.`,
                mentions: [targetJid]
            });
        } catch(e) {
            console.error('[BanVote] Erro ao remover membro:', e);
            await sock.sendMessage(chatJid, {
                text: `⚖️ *Veredicto: BANIDO*\n\nA votação decidiu pelo banimento de @${targetName} (${banVotes}×${pardonVotes}), mas eu não consegui removê-lo. Verifique minhas permissões.`,
                mentions: [targetJid]
            });
        }
    } else {
        await sock.sendMessage(chatJid, {
            text: `⚖️ *Veredicto: PERDOADO*\n\n🕊️ @${targetName} foi absolvido pela votação popular.\n\n📊 Resultado: ${banVotes} a favor do ban × ${pardonVotes} contra.`,
            mentions: [targetJid]
        });
    }
}

handleBanVoteCommand.commandData = {
    name: "banvote",
    description: "Inicia uma votação de banimento via enquete nativa do WhatsApp.",
    category: "admin",
    usage: "/banvote @usuario",
    aliases: ["/votekick", "/voteban", "/vb", "/votacao"]
};

module.exports = handleBanVoteCommand;
