
/**
 * Gerenciador de memória de conversa para o assistente.
 * Mantém histórico de mensagens por chat (grupo ou PV) em memória.
 */

const MAX_MESSAGES_PER_CHAT = 20;
const chatHistories = new Map();

/**
 * Adiciona uma mensagem ao histórico de um chat.
 * @param {string} chatId - JID do chat (grupo ou PV)
 * @param {string} role - 'user' ou 'assistant'
 * @param {string} content - Conteúdo da mensagem
 * @param {string} [name] - Nome do remetente (para contexto em grupos)
 */
function addMessage(chatId, role, content, name = null) {
    if (!chatHistories.has(chatId)) {
        chatHistories.set(chatId, []);
    }

    const history = chatHistories.get(chatId);
    const message = { role, content };

    // Em grupos, incluir o nome do remetente para a IA saber quem falou
    if (name && role === 'user') {
        message.content = `[${name}]: ${content}`;
    }

    history.push(message);

    // Manter apenas as últimas MAX_MESSAGES_PER_CHAT
    while (history.length > MAX_MESSAGES_PER_CHAT) {
        history.shift();
    }
}

/**
 * Retorna o histórico de um chat.
 * @param {string} chatId
 * @returns {Array<{role: string, content: string}>}
 */
function getHistory(chatId) {
    return chatHistories.get(chatId) || [];
}

/**
 * Limpa o histórico de um chat.
 * @param {string} chatId
 */
function clearHistory(chatId) {
    chatHistories.delete(chatId);
}

module.exports = { addMessage, getHistory, clearHistory };
