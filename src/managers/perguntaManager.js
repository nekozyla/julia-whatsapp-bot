class PerguntaManager {
    constructor() {
        this.activeQuestions = new Map(); // msgId -> questionData
    }

    createQuestion(msgId, chatJid, creatorJid, question) {
        this.activeQuestions.set(msgId, {
            chatJid,
            creatorJid,
            question,
            answers: new Map(), // userJid -> answerText
            createdAt: Date.now()
        });
    }

    getQuestion(msgId) {
        return this.activeQuestions.get(msgId);
    }

    deleteQuestion(msgId) {
        this.activeQuestions.delete(msgId);
    }

    /**
     * Encontra a pergunta ativa mais recente em um chat.
     */
    findActiveByChat(chatJid) {
        let best = null;
        for (const [msgId, q] of this.activeQuestions.entries()) {
            if (q.chatJid === chatJid) {
                if (!best || q.createdAt > best.q.createdAt) {
                    best = { msgId, q };
                }
            }
        }
        return best;
    }

    /**
     * Armazena a resposta textual de um usuário para uma pergunta.
     */
    addAnswer(msgId, userJid, answerText) {
        const question = this.activeQuestions.get(msgId);
        if (!question) return false;
        question.answers.set(userJid, answerText);
        return true;
    }

    /**
     * Remove a resposta de um usuário (caso apague a mensagem).
     */
    removeAnswer(msgId, userJid) {
        const question = this.activeQuestions.get(msgId);
        if (!question) return;
        question.answers.delete(userJid);
    }

    /**
     * Retorna todas as respostas de uma pergunta.
     */
    getAnswers(msgId) {
        const question = this.activeQuestions.get(msgId);
        if (!question) return [];
        return [...question.answers.entries()].map(([jid, text]) => ({ jid, text }));
    }
}

module.exports = new PerguntaManager();
