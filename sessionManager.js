// sessionManager.js
const fs = require('fs').promises;
const path = require('path');
const { SESSIONS_DIR, JULIA_INITIAL_GREETING, DEFAULT_MAX_OUTPUT_TOKENS } = require('./config');
const { textModel } = require('./geminiClient'); 
const settingsManager = require('./groupSettingsManager');
const personalities = require('./personalities');

const sessions = {}; 

async function saveSessionHistory(sessionKey, history) {
    try {
        if (!history) return;
        await fs.mkdir(SESSIONS_DIR, { recursive: true }); 
        const filePath = path.join(SESSIONS_DIR, `${sessionKey}.json`);
        await fs.writeFile(filePath, JSON.stringify(history, null, 2)); 
    } catch (error) { console.error(`[Persistência] Erro ao salvar histórico para ${sessionKey}:`, error); }
}

async function loadSessionHistory(sessionKey) {
    try {
        const filePath = path.join(SESSIONS_DIR, `${sessionKey}.json`);
        const fileData = await fs.readFile(filePath, 'utf-8');
        const history = JSON.parse(fileData);
        
        if (Array.isArray(history) && history.length > 0 && history[0].role === 'user') {
            return history;
        }
        console.warn(`[Persistência] Histórico inválido descartado para ${sessionKey}.`);
        return null; 

    } catch (error) {
        if (error.code === 'ENOENT') { return null; }
        console.error(`[Persistência] Erro ao carregar histórico para ${sessionKey}:`, error);
        return null; 
    }
}

async function getOrCreateChatForSession(sessionKey) {
    if (!sessions[sessionKey]) {
        // 1. Determina a personalidade para este chat
        const personalityName = settingsManager.getSetting(sessionKey, 'personality', 'julia'); // Padrão é 'julia'
        const systemPrompt = personalities[personalityName] || personalities.julia;
        console.log(`[Sessão] A criar nova sessão para ${sessionKey} com a personalidade: ${personalityName}`);

        // 2. Constrói o contexto inicial com a personalidade correta
        const dynamicInitialContext = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: JULIA_INITIAL_GREETING }] }
        ];

        const loadedHistory = await loadSessionHistory(sessionKey);
        const historyToUse = loadedHistory || JSON.parse(JSON.stringify(dynamicInitialContext));
        
        sessions[sessionKey] = textModel.startChat({
            history: historyToUse, 
            generationConfig: { maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS },
        });

        if (!loadedHistory) {
            await saveSessionHistory(sessionKey, historyToUse); 
            console.log(`[Persistência] Novo histórico com personalidade '${personalityName}' iniciado e salvo para ${sessionKey}.`);
        }
    }
    return sessions[sessionKey];
}

async function loadAllPersistedSessions() {
    try {
        await fs.mkdir(SESSIONS_DIR, { recursive: true });
        const files = await fs.readdir(SESSIONS_DIR);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const sessionKeyFromFile = file.replace('.json', '');
                await getOrCreateChatForSession(sessionKeyFromFile);
            }
        }
        console.log("[Persistência] Todas as sessões válidas foram carregadas na inicialização.");
    } catch (error) { console.error('[Persistência] Erro ao carregar sessões na inicialização:', error); }
}

async function clearSession(sessionKey) {
    console.log(`[Sessão] A limpar sessão para ${sessionKey}`);
    delete sessions[sessionKey];
    try {
        const filePath = path.join(SESSIONS_DIR, `${sessionKey}.json`);
        await fs.unlink(filePath).catch(e => { if (e.code !== 'ENOENT') throw e; });
        console.log(`[Persistência] Histórico persistente removido para ${sessionKey}.`);
    } catch (e) { console.error(`[Persistência] Erro ao remover arquivo de histórico para ${sessionKey}:`, e); }
}

module.exports = { 
    saveSessionHistory, 
    getOrCreateChatForSession, 
    loadAllPersistedSessions, 
    clearSession 
};
