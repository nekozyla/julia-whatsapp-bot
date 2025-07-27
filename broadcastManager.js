// broadcastManager.js
const fs = require('fs').promises;
const path = require('path');
const { ADMIN_JID } = require('./config');

const STATE_FILE_PATH = path.join(__dirname, 'broadcastState.json');
const SEND_INTERVAL_MIN = 15 * 1000; // 15 segundos
const SEND_INTERVAL_MAX = 30 * 1000; // 30 segundos

let state = {
    status: 'idle', // idle, running, paused
    message: '',
    contacts: [],
    currentIndex: 0,
    successCount: 0,
    errorCount: 0
};

let intervalId = null;
let sockInstance = null;

async function loadState() {
    try {
        const data = await fs.readFile(STATE_FILE_PATH, 'utf-8');
        state = JSON.parse(data);
        console.log('[Broadcast Manager] Estado de transmissão anterior carregado.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Broadcast Manager] Nenhum estado de transmissão anterior encontrado.');
        } else {
            console.error('[Broadcast Manager] Erro ao carregar estado da transmissão:', error);
        }
    }
}

async function saveState() {
    try {
        await fs.writeFile(STATE_FILE_PATH, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('[Broadcast Manager] Erro ao salvar estado da transmissão:', error);
    }
}

async function sendNextMessage() {
    if (state.status !== 'running' || !sockInstance) return;

    if (state.currentIndex >= state.contacts.length) {
        console.log('[Broadcast Manager] Transmissão concluída.');
        const reportText = `🏁 Transmissão concluída!\n\n- *Enviadas com sucesso:* ${state.successCount}\n- *Falhas:* ${state.errorCount}`;
        await sockInstance.sendMessage(ADMIN_JID, { text: reportText });
        await cancelBroadcast(); // Limpa o estado
        return;
    }

    const jid = state.contacts[state.currentIndex];
    try {
        console.log(`[Broadcast Manager] Enviando para ${jid} (${state.currentIndex + 1}/${state.contacts.length})`);
        await sockInstance.sendMessage(jid, { text: state.message });
        state.successCount++;
    } catch (error) {
        console.error(`[Broadcast Manager] Falha ao enviar para ${jid}:`, error);
        state.errorCount++;
    }

    state.currentIndex++;
    await saveState();
    scheduleNextSend(); // Agenda o próximo envio após o atual ser concluído
}

function scheduleNextSend() {
    if (state.status !== 'running') {
        if (intervalId) clearTimeout(intervalId);
        intervalId = null;
        return;
    }

    const randomDelay = Math.floor(Math.random() * (SEND_INTERVAL_MAX - SEND_INTERVAL_MIN + 1) + SEND_INTERVAL_MIN);
    console.log(`[Broadcast Manager] Próximo envio em ${randomDelay / 1000} segundos.`);
    intervalId = setTimeout(sendNextMessage, randomDelay);
}

async function startBroadcast(message, contactsToBroadcast) {
    if (state.status !== 'idle') {
        throw new Error('Uma transmissão já está em andamento ou pausada. Use `!broadcast cancelar` primeiro.');
    }
    state = {
        status: 'running',
        message,
        contacts: contactsToBroadcast,
        currentIndex: 0,
        successCount: 0,
        errorCount: 0
    };
    await saveState();
    console.log(`[Broadcast Manager] Nova transmissão iniciada para ${contactsToBroadcast.length} contatos.`);
    scheduleNextSend(); // Inicia o ciclo de envio
    return contactsToBroadcast.length;
}

async function pauseBroadcast() {
    if (state.status !== 'running') return false;
    state.status = 'paused';
    if (intervalId) {
        clearTimeout(intervalId);
        intervalId = null;
    }
    await saveState();
    console.log('[Broadcast Manager] Transmissão pausada.');
    return true;
}

async function resumeBroadcast() {
    if (state.status !== 'paused') return false;
    state.status = 'running';
    await saveState();
    console.log('[Broadcast Manager] Transmissão retomada.');
    scheduleNextSend();
    return true;
}

async function cancelBroadcast() {
    state = { status: 'idle', message: '', contacts: [], currentIndex: 0, successCount: 0, errorCount: 0 };
    if (intervalId) {
        clearTimeout(intervalId);
        intervalId = null;
    }
    await saveState();
    console.log('[Broadcast Manager] Transmissão cancelada e estado limpo.');
    return true;
}

function getStatus() {
    return state;
}

async function initialize(sock) {
    sockInstance = sock;
    await loadState();
    if (state.status === 'running') {
        console.log('[Broadcast Manager] Retomando transmissão interrompida...');
        scheduleNextSend();
    } else if (state.status === 'paused') {
        console.log('[Broadcast Manager] Uma transmissão está pausada. Use `!broadcast continuar` para retomar.');
    }
}

module.exports = {
    initialize,
    startBroadcast,
    pauseBroadcast,
    resumeBroadcast,
    cancelBroadcast,
    getStatus
};
