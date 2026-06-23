/**
 * PollManager — Gerenciador de enquetes ativas do bot.
 * 
 * Rastreia enquetes criadas pelo bot (ex: banvote) e acumula 
 * os votos descriptografados para avaliação em tempo real.
 */

const crypto = require('crypto');

class PollManager {
    constructor() {
        // Map<pollMsgId, PollState>
        // PollState = {
        //   chatJid, targetJid, options: string[], optionHashes: Map<hash, optionName>,
        //   votes: Map<voterJid, selectedOptionNames[]>,
        //   messageSecret: Buffer, onUpdate: function|null, createdAt: number
        // }
        this.activePolls = new Map();
    }

    /**
     * Registra uma nova enquete para rastreamento.
     * @param {string} pollMsgId - ID da mensagem da enquete
     * @param {object} data - Dados da enquete
     * @param {string} data.chatJid - JID do chat
     * @param {string} data.targetJid - JID do alvo (ex: membro a ser banido)
     * @param {string[]} data.options - Lista de opções da enquete
     * @param {Buffer} data.messageSecret - Secret para descriptografar votos
     * @param {string} data.creatorJid - JID de quem criou a enquete (o bot)
     * @param {function} [data.onUpdate] - Callback chamado a cada atualização de voto
     */
    registerPoll(pollMsgId, data) {
        const optionHashes = new Map();
        for (const optName of data.options) {
            const hash = crypto.createHash('sha256').update(optName).digest().toString();
            optionHashes.set(hash, optName);
        }

        this.activePolls.set(pollMsgId, {
            chatJid: data.chatJid,
            targetJid: data.targetJid || null,
            options: data.options,
            optionHashes,
            messageSecret: data.messageSecret,
            creatorJid: data.creatorJid,
            votes: new Map(), // voterJid => [optionName, ...]
            onUpdate: data.onUpdate || null,
            createdAt: Date.now()
        });

        console.log(`[PollManager] Enquete registrada: ${pollMsgId} com ${data.options.length} opções`);
    }

    /**
     * Processa um voto descriptografado.
     * @param {string} pollMsgId - ID da mensagem da enquete
     * @param {string} voterJid - JID do votante
     * @param {Buffer[]} selectedOptionHashes - Hashes SHA256 das opções selecionadas
     */
    processVote(pollMsgId, voterJid, selectedOptionHashes) {
        const poll = this.activePolls.get(pollMsgId);
        if (!poll) return;

        // Mapeia hashes para nomes de opções
        const selectedNames = [];
        for (const hashBuf of selectedOptionHashes) {
            const hashStr = hashBuf.toString();
            const name = poll.optionHashes.get(hashStr);
            if (name) {
                selectedNames.push(name);
            } else {
                selectedNames.push('???');
            }
        }

        // Se nenhuma opção foi selecionada, o usuário removeu seu voto
        if (selectedNames.length === 0) {
            poll.votes.delete(voterJid);
        } else {
            poll.votes.set(voterJid, selectedNames);
        }

        console.log(`[PollManager] Voto de ${voterJid.split('@')[0]} na enquete ${pollMsgId}: [${selectedNames.join(', ')}]`);

        // Chama callback de atualização se existir
        if (poll.onUpdate) {
            try {
                poll.onUpdate(poll, voterJid, selectedNames);
            } catch(e) {
                console.error('[PollManager] Erro no callback onUpdate:', e);
            }
        }
    }

    /**
     * Retorna a contagem de votos por opção.
     * @param {string} pollMsgId 
     * @returns {Object.<string, string[]>} - { optionName: [voterJid, ...] }
     */
    getTally(pollMsgId) {
        const poll = this.activePolls.get(pollMsgId);
        if (!poll) return {};

        const tally = {};
        for (const opt of poll.options) {
            tally[opt] = [];
        }

        for (const [voterJid, selectedNames] of poll.votes.entries()) {
            for (const name of selectedNames) {
                if (!tally[name]) tally[name] = [];
                tally[name].push(voterJid);
            }
        }

        return tally;
    }

    /**
     * Obtém os dados de uma enquete ativa.
     */
    getPoll(pollMsgId) {
        return this.activePolls.get(pollMsgId);
    }

    /**
     * Remove uma enquete do rastreamento.
     */
    removePoll(pollMsgId) {
        this.activePolls.delete(pollMsgId);
        console.log(`[PollManager] Enquete removida: ${pollMsgId}`);
    }

    /**
     * Busca uma enquete ativa pelo chatJid.
     */
    findPollByChat(chatJid) {
        for (const [msgId, poll] of this.activePolls.entries()) {
            if (poll.chatJid === chatJid) return { msgId, poll };
        }
        return null;
    }
}

module.exports = new PollManager();
