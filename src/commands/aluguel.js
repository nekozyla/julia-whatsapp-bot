const authManager = require('../managers/authManager.js');
const rentalManager = require('../managers/rentalManager.js');
const rentalCheckoutManager = require('../managers/rentalCheckoutManager.js');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const config = require('../../config.js');

const RENTAL_PLAN_DISCOUNTS = {
    30: 0,
    60: 0.05,
    90: 0.10,
    180: 0.15,
    365: 0.20
};

const RENTAL_PLAN_DAYS = Object.keys(RENTAL_PLAN_DISCOUNTS).map(Number).sort((a, b) => a - b);

function parseGroupFromArg(raw) {
    if (!raw) return null;
    const candidate = raw.trim();
    return candidate.endsWith('@g.us') ? candidate : null;
}

function parseInviteCode(raw) {
    if (!raw) return null;
    const text = String(raw).trim();
    const match = text.match(/chat\.whatsapp\.com\/([A-Za-z0-9]{20,40})/i);
    if (match?.[1]) return match[1];
    if (/^[A-Za-z0-9]{20,40}$/.test(text)) return text;
    return null;
}

function normalizeAscii(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim();
}

function crc16(payload) {
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
            crc &= 0xFFFF;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id, value) {
    const normalized = String(value || '');
    return `${id}${String(normalized.length).padStart(2, '0')}${normalized}`;
}

function buildPixPayload({ key, receiverName, city, amountCents, txid }) {
    const amount = (amountCents / 100).toFixed(2);
    const gui = tlv('00', 'br.gov.bcb.pix');
    const pixKey = tlv('01', key);
    const merchantAccount = tlv('26', `${gui}${pixKey}`);
    const merchantCategory = tlv('52', '0000');
    const currency = tlv('53', '986');
    const amountField = tlv('54', amount);
    const country = tlv('58', 'BR');
    const nameField = tlv('59', normalizeAscii(receiverName).slice(0, 25) || 'RECEBEDOR');
    const cityField = tlv('60', normalizeAscii(city).slice(0, 15) || 'SAOPAULO');
    const txidField = tlv('05', String(txid || '***').slice(0, 25));
    const additionalData = tlv('62', txidField);

    const withoutCrc = `000201${merchantAccount}${merchantCategory}${currency}${amountField}${country}${nameField}${cityField}${additionalData}6304`;
    const crc = crc16(withoutCrc);
    return `${withoutCrc}${crc}`;
}

function formatCurrency(cents) {
    return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent(value) {
    return `${Math.round((Number(value || 0) * 100))}%`;
}

function resolvePlanDays(rawValue) {
    const value = Number(rawValue || 30);
    if (!Number.isFinite(value)) return null;
    return RENTAL_PLAN_DAYS.includes(value) ? value : null;
}

function getPlanPricing(planDays, pricePerDayCents) {
    const discount = RENTAL_PLAN_DISCOUNTS[planDays] || 0;
    const fullAmountCents = planDays * pricePerDayCents;
    const amountCents = Math.round(fullAmountCents * (1 - discount));

    return {
        planDays,
        discount,
        fullAmountCents,
        amountCents,
        savedCents: Math.max(0, fullAmountCents - amountCents)
    };
}

function resolveProofTarget(msg, senderJid) {
    const message = msg?.message || {};

    if (message.imageMessage || message.documentMessage || message.videoMessage) {
        return {
            targetMsg: msg,
            mediaMessage: message,
            source: 'self'
        };
    }

    const contextInfo = message?.extendedTextMessage?.contextInfo;
    const quotedMessage = contextInfo?.quotedMessage;

    if (quotedMessage && (quotedMessage.imageMessage || quotedMessage.documentMessage || quotedMessage.videoMessage)) {
        return {
            targetMsg: {
                key: {
                    remoteJid: senderJid,
                    id: contextInfo.stanzaId,
                    participant: contextInfo.participant
                },
                message: quotedMessage
            },
            mediaMessage: quotedMessage,
            source: 'quoted'
        };
    }

    return null;
}

async function forwardProofMediaToAdmins(sock, proofTarget, caption) {
    const admins = Array.isArray(config.ADMIN_JIDS) ? config.ADMIN_JIDS : [];
    if (admins.length === 0) return;

    let mediaBuffer = null;
    try {
        mediaBuffer = await downloadMediaMessage(proofTarget.targetMsg, 'buffer', {}, { logger: undefined });
    } catch (error) {
        console.error('[Aluguel] Falha ao baixar mídia do comprovante:', error.message);
    }

    for (const adminJid of admins) {
        try {
            if (!mediaBuffer) {
                await sock.sendMessage(adminJid, { text: `${caption}\n\n⚠️ Não foi possível anexar a mídia automaticamente.` });
                continue;
            }

            if (proofTarget.mediaMessage.imageMessage) {
                await sock.sendMessage(adminJid, {
                    image: mediaBuffer,
                    caption
                });
                continue;
            }

            if (proofTarget.mediaMessage.videoMessage) {
                await sock.sendMessage(adminJid, {
                    video: mediaBuffer,
                    caption,
                    mimetype: proofTarget.mediaMessage.videoMessage.mimetype || 'video/mp4'
                });
                continue;
            }

            if (proofTarget.mediaMessage.documentMessage) {
                await sock.sendMessage(adminJid, {
                    document: mediaBuffer,
                    caption,
                    mimetype: proofTarget.mediaMessage.documentMessage.mimetype || 'application/octet-stream',
                    fileName: proofTarget.mediaMessage.documentMessage.fileName || `comprovante-${Date.now()}`
                });
                continue;
            }

            await sock.sendMessage(adminJid, { text: caption });
        } catch (error) {
            console.error('[Aluguel] Falha ao enviar comprovante para admin:', adminJid, error.message);
        }
    }
}

function extractProofInfo(msg) {
    const message = msg?.message || {};
    const quoted = message?.extendedTextMessage?.contextInfo?.quotedMessage || null;

    if (message.imageMessage) return { mediaType: 'imageMessage', source: 'self' };
    if (message.documentMessage) return { mediaType: 'documentMessage', source: 'self' };
    if (message.videoMessage) return { mediaType: 'videoMessage', source: 'self' };

    if (quoted?.imageMessage) return { mediaType: 'imageMessage', source: 'quoted' };
    if (quoted?.documentMessage) return { mediaType: 'documentMessage', source: 'quoted' };
    if (quoted?.videoMessage) return { mediaType: 'videoMessage', source: 'quoted' };

    return null;
}

async function notifyAdmins(sock, text) {
    const admins = Array.isArray(config.ADMIN_JIDS) ? config.ADMIN_JIDS : [];
    for (const adminJid of admins) {
        try {
            await sock.sendMessage(adminJid, { text });
        } catch (error) {
            console.error('[Aluguel] Falha ao notificar admin:', adminJid, error.message);
        }
    }
}

async function notifyExpiredUsers(sock, expiredIds) {
    if (!Array.isArray(expiredIds) || expiredIds.length === 0) return;

    for (const ticketId of expiredIds) {
        const ticket = rentalCheckoutManager.getTicket(ticketId);
        if (!ticket?.userJid) continue;

        try {
            await sock.sendMessage(ticket.userJid, {
                text: [
                    `⏰ Seu ticket *${ticket.id}* expirou por falta de comprovante.`,
                    `Plano: *${ticket.planDays} dias*`,
                    `Valor: *${formatCurrency(ticket.amountCents)}*`,
                    '',
                    'Se ainda quiser assinar, abra um novo com:',
                    '`/aluguel contratar 30`'
                ].join('\n')
            });
        } catch (error) {
            console.error('[Aluguel] Falha ao notificar ticket expirado:', ticketId, error.message);
        }
    }
}

function formatDatePtBr(timestampMs) {
    if (!Number.isFinite(timestampMs) || timestampMs <= 0) return 'N/A';
    return new Date(timestampMs).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function buildHelpText() {
    return [
        '*Sistema de Aluguel de Grupos*',
        '',
        '*Fluxo no PV (usuários):*',
        '- `/aluguel contratar <30|60|90|180|365>`',
        '- `/aluguel comprovante [obs]` *(envie ou responda a mídia)*',
        '- `/aluguel link <invite_link>` *(após aprovação)*',
        '- `/aluguel status`',
        '- Planos: 30d (0%), 60d (5%), 90d (10%), 180d (15%), 365d (20%)',
        '',
        '*Administração (super admin):*',
        '- `/aluguel status`',
        '- `/aluguel pendentes`',
        '- `/aluguel analisar <ticket> aprovar|reprovar [motivo]`',
        '- `/aluguel listar` *(super admin)*',
        '- `/aluguel add <dias> [grupoJid]` *(super admin)*',
        '- `/aluguel remover [grupoJid]` *(super admin)*',
        '- `/aluguel modo on|off` *(super admin)*'
    ].join('\n');
}

function buildUserTicketStatus(ticket) {
    if (!ticket) {
        return [
            '*Status da Assinatura*',
            '',
            '- Nenhuma solicitação ativa.',
            '- Use `/aluguel contratar 30` para iniciar.'
        ].join('\n');
    }

    const statusText = {
        awaiting_proof: 'Aguardando comprovante',
        pending_human_review: 'Em análise humana',
        approved_waiting_group_link: 'Aprovado, aguardando link do grupo',
        completed: 'Concluído',
        rejected: 'Reprovado',
        expired: 'Expirado'
    };

    return [
        `*Ticket ${ticket.id}*`,
        '',
        `- Status: *${statusText[ticket.status] || ticket.status}*`,
        `- Plano: *${ticket.planDays} dias*`,
        `- Valor: *${formatCurrency(ticket.amountCents)}*`,
        Number(ticket.discountPercent || 0) > 0 ? `- Desconto: *${formatPercent(ticket.discountPercent)}*` : '- Desconto: *0%*',
        `- Criado em: *${formatDatePtBr(ticket.createdAt)}*`,
        ticket.invite?.link ? `- Link enviado: *sim*` : '- Link enviado: *não*',
        ticket.joinedGroupJid ? `- Grupo final: \`${ticket.joinedGroupJid}\`` : '- Grupo final: *pendente*'
    ].join('\n');
}

function buildStatusText(groupJid) {
    const enforce = rentalManager.isEnforcementEnabled();
    const status = rentalManager.getRentalStatus(groupJid);

    const lines = [
        '*Status do Aluguel*',
        '',
        `- Modo fiscalização: *${enforce ? 'ON' : 'OFF'}*`,
        `- Grupo: \`${groupJid}\``
    ];

    if (!status.exists) {
        lines.push('- Assinatura: *não cadastrada*');
        return lines.join('\n');
    }

    lines.push(`- Assinatura: *${status.active ? 'ATIVA' : 'VENCIDA'}*`);
    lines.push(`- Vencimento: *${formatDatePtBr(status.expiresAt)}*`);
    lines.push(`- Tempo restante: *${status.active ? rentalManager.formatRemainingMs(status.remainingMs) : '0min'}*`);
    return lines.join('\n');
}

function buildGroupIntroMessage(planDays) {
    return [
        '👋 Olá! Entrei no grupo e a assinatura foi ativada.',
        `📅 Plano ativo: *${planDays} dias*`,
        '',
        '*Principais capacidades:*',
        '- Administração: boas-vindas, restrições, antidelete e ferramentas de moderação.',
        '- Mídia: sticker, conversões, edição rápida e utilidades de imagem.',
        '- Utilidades: perfil, ranking, lembretes, jogos e comandos sociais.',
        '- IA/assistente: respostas contextuais quando ativada no grupo.',
        '',
        '📌 Para ver tudo: */help*',
        '📌 Para ligar/desligar IA: */ia on* ou */ia off*',
        '📌 Para status da assinatura: */aluguel status*'
    ].join('\n');
}

module.exports = async (sock, msg, msgDetails) => {
    const { sender, isGroup, commandSenderJid, args, pushName } = msgDetails;

    const isSuperAdmin = authManager.isSuperAdmin(commandSenderJid);
    const subcommand = (args[0] || 'status').toLowerCase();
    const targetArg = args[1] || null;
    const targetGroupJid = parseGroupFromArg(args[2]) || parseGroupFromArg(targetArg) || (isGroup ? sender : null);
    const isPrivate = !isGroup;
    const pricePerDayCents = Math.max(1, Math.round((Number(config.RENTAL_PIX_PRICE_PER_DAY || 10) * 100)));
    const ticketExpireHours = Math.max(1, Number(config.RENTAL_TICKET_EXPIRE_HOURS || 24));
    const pixKey = String(config.RENTAL_PIX_KEY || '').trim();
    const pixReceiver = String(config.RENTAL_PIX_RECEIVER_NAME || config.BOT_NAME || 'Recebedor').trim();
    const pixCity = String(config.RENTAL_PIX_CITY || 'Sao Paulo').trim();

    const expiredIds = rentalCheckoutManager.expireStaleTickets(ticketExpireHours);
    if (expiredIds.length > 0) {
        await rentalCheckoutManager.saveState();
        await notifyExpiredUsers(sock, expiredIds);
    }

    if (subcommand === 'status' && isPrivate) {
        const openTicket = rentalCheckoutManager.getOpenTicketByUser(commandSenderJid);
        await sock.sendMessage(sender, { text: buildUserTicketStatus(openTicket) }, { quoted: msg });
        return true;
    }

    if (subcommand === 'status') {
        if (!targetGroupJid) {
            await sock.sendMessage(sender, { text: 'Em conversa privada, informe o JID do grupo: `/aluguel status 123@g.us`.' }, { quoted: msg });
            return true;
        }

        await sock.sendMessage(sender, { text: buildStatusText(targetGroupJid) }, { quoted: msg });
        return true;
    }

    if (subcommand === 'contratar') {
        if (!isPrivate) {
            await sock.sendMessage(sender, { text: 'Para contratar, use este comando no PV comigo.' }, { quoted: msg });
            return true;
        }

        if (!pixKey) {
            await sock.sendMessage(sender, { text: 'PIX indisponível no momento. Fale com a administração.' }, { quoted: msg });
            return true;
        }

        const closedIds = await rentalCheckoutManager.closeOpenTicketsByUser(commandSenderJid, 'user_started_new_checkout');
        if (closedIds.length > 0) {
            await sock.sendMessage(sender, {
                text: `Seu fluxo anterior foi encerrado automaticamente: *${closedIds.join(', ')}*.\nIniciando um novo checkout...`
            }, { quoted: msg });
        }

        const planDays = resolvePlanDays(args[1] || 30);
        if (!planDays) {
            await sock.sendMessage(sender, {
                text: 'Plano inválido. Use exatamente um destes:\n`/aluguel contratar 30`\n`/aluguel contratar 60`\n`/aluguel contratar 90`\n`/aluguel contratar 180`\n`/aluguel contratar 365`'
            }, { quoted: msg });
            return true;
        }

        const pricing = getPlanPricing(planDays, pricePerDayCents);
        // txid do Pix deve ser alfanumérico e curto (sem hífen/caracteres especiais)
        const ticketDraftId = `ALQ${Date.now().toString(36).toUpperCase().slice(0, 20)}`;
        const pixPayload = buildPixPayload({
            key: pixKey,
            receiverName: pixReceiver,
            city: pixCity,
            amountCents: pricing.amountCents,
            txid: ticketDraftId
        });

        const ticket = await rentalCheckoutManager.createTicket({
            userJid: commandSenderJid,
            userPushName: pushName,
            planDays,
            amountCents: pricing.amountCents,
            fullAmountCents: pricing.fullAmountCents,
            discountPercent: pricing.discount,
            pixPayload,
            pixKey,
            pixReceiver
        });

        await sock.sendMessage(sender, {
            text: [
                `*Ticket:* ${ticket.id}`,
                `*Plano:* ${planDays} dias`,
                `*Valor final:* ${formatCurrency(pricing.amountCents)}`,
                `*Valor cheio:* ${formatCurrency(pricing.fullAmountCents)}`,
                `*Desconto:* ${formatPercent(pricing.discount)} (${formatCurrency(pricing.savedCents)})`,
                '',
                '*PIX para pagamento*',
                `- Chave: \`${pixKey}\``,
                `- Favorecido: *${pixReceiver}*`,
                '',
                'Depois do pagamento, envie o comprovante com:',
                '`/aluguel comprovante` (respondendo à mídia).',
                `Aguardamos comprovante por até *${ticketExpireHours}h*.`
            ].join('\n')
        }, { quoted: msg });

        await sock.sendMessage(sender, {
            text: ticket.pixPayload
        }, { quoted: msg });
        return true;
    }

    if (subcommand === 'comprovante') {
        if (!isPrivate) {
            await sock.sendMessage(sender, { text: 'Envie o comprovante no PV comigo.' }, { quoted: msg });
            return true;
        }

        const openTicket = rentalCheckoutManager.getOpenTicketByUser(commandSenderJid);
        if (!openTicket || openTicket.status !== 'awaiting_proof') {
            await sock.sendMessage(sender, {
                text: 'Não encontrei ticket aguardando comprovante. Use `/aluguel contratar <dias>`.'
            }, { quoted: msg });
            return true;
        }

        const proofTarget = resolveProofTarget(msg, sender);
        if (!proofTarget) {
            await sock.sendMessage(sender, {
                text: 'Envie uma imagem/PDF do comprovante com a legenda `/aluguel comprovante` ou responda a mídia com esse comando.'
            }, { quoted: msg });
            return true;
        }

        const note = args.slice(1).join(' ').trim();
        const updated = await rentalCheckoutManager.attachProof(openTicket.id, {
            mediaType: proofTarget.mediaMessage.imageMessage ? 'imageMessage' : proofTarget.mediaMessage.documentMessage ? 'documentMessage' : 'videoMessage',
            sourceMessageId: msg?.key?.id || null,
            sourceChatJid: sender,
            note
        });

        await sock.sendMessage(sender, {
            text: `✅ Comprovante recebido para o ticket *${updated.id}*.\nStatus: *em análise humana*.`
        }, { quoted: msg });

        const adminCaption = [
            '💰 *Novo pagamento para análise*',
            `- Ticket: *${updated.id}*`,
            `- Cliente: \`${updated.userJid}\``,
            `- Nome: *${updated.userPushName || 'N/A'}*`,
            `- Plano: *${updated.planDays} dias*`,
            `- Valor: *${formatCurrency(updated.amountCents)}*`,
            Number(updated.discountPercent || 0) > 0 ? `- Desconto: *${formatPercent(updated.discountPercent)}*` : '- Desconto: *0%*',
            `- Origem da mídia: *${proofTarget.source}*`,
            '',
            'Para aprovar:',
            `\`/aluguel analisar ${updated.id} aprovar\``,
            'Para reprovar:',
            `\`/aluguel analisar ${updated.id} reprovar motivo\``
        ].join('\n');

        await notifyAdmins(sock, adminCaption);
        await forwardProofMediaToAdmins(sock, proofTarget, adminCaption);

        return true;
    }

    if (subcommand === 'link') {
        if (!isPrivate) {
            await sock.sendMessage(sender, { text: 'Envie o link do grupo no PV comigo.' }, { quoted: msg });
            return true;
        }

        const openTicket = rentalCheckoutManager.getOpenTicketByUser(commandSenderJid);
        if (!openTicket || openTicket.status !== 'approved_waiting_group_link') {
            await sock.sendMessage(sender, {
                text: 'Seu pagamento ainda não foi aprovado ou não há ticket pendente de link.'
            }, { quoted: msg });
            return true;
        }

        const inviteRaw = args[1] || '';
        const inviteCode = parseInviteCode(inviteRaw);
        if (!inviteCode) {
            await sock.sendMessage(sender, {
                text: 'Link inválido. Envie algo como: `/aluguel link https://chat.whatsapp.com/SEUCODIGO`'
            }, { quoted: msg });
            return true;
        }

        await rentalCheckoutManager.setGroupInvite(openTicket.id, inviteRaw, inviteCode);

        try {
            const joinedGroupJid = await sock.groupAcceptInvite(inviteCode);
            const rentResult = await rentalManager.addOrExtendRental(joinedGroupJid, openTicket.planDays, commandSenderJid);

            await rentalCheckoutManager.markJoined(openTicket.id, joinedGroupJid);

            if (rentResult?.ok) {
                const groupStatus = rentalManager.getRentalStatus(joinedGroupJid);
                await sock.sendMessage(sender, {
                    text: [
                        '✅ *Pagamento confirmado e grupo ativado!*',
                        `- Grupo: \`${joinedGroupJid}\``,
                        `- Plano aplicado: *${openTicket.planDays} dias*`,
                        `- Vence em: *${formatDatePtBr(groupStatus.expiresAt)}*`
                    ].join('\n')
                }, { quoted: msg });

                await sock.sendMessage(joinedGroupJid, {
                    text: buildGroupIntroMessage(openTicket.planDays)
                }).catch(() => { });
            }
        } catch (error) {
            await sock.sendMessage(sender, {
                text: `Não consegui entrar no grupo automaticamente. Verifique se o link é válido e se ainda há vaga.\n\nErro: ${error.message}`
            }, { quoted: msg });
        }

        return true;
    }

    if (subcommand === 'pendentes') {
        if (!isSuperAdmin) {
            await sock.sendMessage(sender, { text: 'Apenas super admins podem ver pendências.' }, { quoted: msg });
            return true;
        }

        const pending = rentalCheckoutManager.listTicketsByStatus('pending_human_review');
        if (pending.length === 0) {
            await sock.sendMessage(sender, { text: 'Nenhum pagamento pendente de análise.' }, { quoted: msg });
            return true;
        }

        const lines = pending.slice(0, 30).map(item => (
            `- *${item.id}* | ${item.userPushName || item.userJid} | ${item.planDays}d | ${formatCurrency(item.amountCents)}`
        ));

        await sock.sendMessage(sender, {
            text: `*Pagamentos Pendentes*\n\n${lines.join('\n')}`
        }, { quoted: msg });
        return true;
    }

    if (subcommand === 'analisar') {
        if (!isSuperAdmin) {
            await sock.sendMessage(sender, { text: 'Apenas super admins podem analisar pagamentos.' }, { quoted: msg });
            return true;
        }

        const ticketId = (args[1] || '').toUpperCase();
        const decision = (args[2] || '').toLowerCase();
        const note = args.slice(3).join(' ').trim();

        if (!ticketId || !['aprovar', 'reprovar'].includes(decision)) {
            await sock.sendMessage(sender, {
                text: 'Uso: `/aluguel analisar <ticket> aprovar|reprovar [motivo]`'
            }, { quoted: msg });
            return true;
        }

        const ticket = rentalCheckoutManager.getTicket(ticketId);
        if (!ticket) {
            await sock.sendMessage(sender, { text: 'Ticket não encontrado.' }, { quoted: msg });
            return true;
        }

        if (decision === 'aprovar') {
            const updated = await rentalCheckoutManager.approveTicket(ticketId, commandSenderJid, note);
            await sock.sendMessage(sender, { text: `✅ Ticket ${updated.id} aprovado.` }, { quoted: msg });

            await sock.sendMessage(updated.userJid, {
                text: [
                    `✅ Seu pagamento (${updated.id}) foi aprovado!`,
                    'Agora envie o link de convite do grupo para eu entrar automaticamente:',
                    '`/aluguel link https://chat.whatsapp.com/SEUCODIGO`'
                ].join('\n')
            }).catch(() => { });
            return true;
        }

        const updated = await rentalCheckoutManager.rejectTicket(ticketId, commandSenderJid, note || 'Comprovante inválido/inconclusivo.');
        await sock.sendMessage(sender, { text: `✅ Ticket ${updated.id} reprovado.` }, { quoted: msg });

        await sock.sendMessage(updated.userJid, {
            text: [
                `❌ Seu pagamento (${updated.id}) foi reprovado na análise humana.`,
                `Motivo: ${updated.review?.note || 'Não informado.'}`,
                'Se precisar, abra um novo ticket com `/aluguel contratar <dias>`.'
            ].join('\n')
        }).catch(() => { });
        return true;
    }

    if (!isSuperAdmin) {
        await sock.sendMessage(sender, {
            text: 'Use `/aluguel contratar <dias>` no PV para iniciar sua assinatura.'
        }, { quoted: msg });
        return true;
    }

    if (subcommand === 'modo') {
        const modeArg = (args[1] || '').toLowerCase();
        if (!['on', 'off'].includes(modeArg)) {
            await sock.sendMessage(sender, { text: 'Uso: `/aluguel modo on` ou `/aluguel modo off`.' }, { quoted: msg });
            return true;
        }

        const enabled = modeArg === 'on';
        await rentalManager.setEnforcementEnabled(enabled, commandSenderJid);
        await sock.sendMessage(sender, {
            text: `✅ Fiscalização de aluguel *${enabled ? 'ativada' : 'desativada'}*.`
        }, { quoted: msg });
        return true;
    }

    if (subcommand === 'add') {
        const days = Number(args[1]);
        const explicitGroup = parseGroupFromArg(args[2]);
        const groupToAdd = explicitGroup || (isGroup ? sender : null);

        if (!groupToAdd) {
            await sock.sendMessage(sender, { text: 'Uso: `/aluguel add <dias> <grupoJid>`.' }, { quoted: msg });
            return true;
        }

        const result = await rentalManager.addOrExtendRental(groupToAdd, days, commandSenderJid);
        if (!result.ok) {
            await sock.sendMessage(sender, { text: 'Parâmetros inválidos. Exemplo: `/aluguel add 30 123@g.us`.' }, { quoted: msg });
            return true;
        }

        const status = rentalManager.getRentalStatus(groupToAdd);
        const text = [
            `✅ Aluguel ${result.created ? 'cadastrado' : 'estendido'} para \`${groupToAdd}\`.`,
            `- Dias adicionados: *${result.addedDays}*`,
            `- Novo vencimento: *${formatDatePtBr(status.expiresAt)}*`,
            `- Tempo restante: *${rentalManager.formatRemainingMs(status.remainingMs)}*`
        ].join('\n');

        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    if (subcommand === 'remover' || subcommand === 'remove') {
        const explicitGroup = parseGroupFromArg(args[1]);
        const groupToRemove = explicitGroup || (isGroup ? sender : null);
        if (!groupToRemove) {
            await sock.sendMessage(sender, { text: 'Uso: `/aluguel remover <grupoJid>`.' }, { quoted: msg });
            return true;
        }

        const removed = await rentalManager.removeRental(groupToRemove);
        await sock.sendMessage(sender, {
            text: removed
                ? `🗑️ Aluguel removido para \`${groupToRemove}\`.`
                : `Nenhum aluguel encontrado para \`${groupToRemove}\`.`
        }, { quoted: msg });
        return true;
    }

    if (subcommand === 'listar' || subcommand === 'list') {
        const rentals = rentalManager.listRentals({ includeExpired: true });
        if (rentals.length === 0) {
            await sock.sendMessage(sender, { text: 'Nenhum grupo cadastrado no sistema de aluguel.' }, { quoted: msg });
            return true;
        }

        const lines = rentals.slice(0, 40).map((item, index) => {
            const status = item.active ? 'ATIVO' : 'VENCIDO';
            const remaining = item.active ? rentalManager.formatRemainingMs(item.remainingMs) : '0min';
            return `${index + 1}. ${status} | ${item.groupJid}\n   vence: ${formatDatePtBr(item.expiresAt)} | restante: ${remaining}`;
        });

        const suffix = rentals.length > 40
            ? `\n\n... e mais ${rentals.length - 40} grupo(s).`
            : '';

        await sock.sendMessage(sender, {
            text: `*Grupos no Aluguel*\n\n${lines.join('\n\n')}${suffix}`
        }, { quoted: msg });
        return true;
    }

    await sock.sendMessage(sender, { text: buildHelpText() }, { quoted: msg });
    return true;
};

module.exports.commandData = {
    name: 'aluguel',
    description: 'Assinatura por PIX com análise e ativação automática de grupo.',
    category: 'util',
    usage: '/aluguel <contratar|comprovante|link|status|pendentes|analisar|add|remover|listar|modo>',
    aliases: ['/assinatura', '/rent']
};
