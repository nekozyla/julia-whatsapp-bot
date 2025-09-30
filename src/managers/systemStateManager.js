// systemStateManager.js
const fs = require('fs').promises;
const path = require('path');

const STATE_FILE_PATH = path.join(__dirname, '..', '..','data', 'systemState.json');
let stateCache = {
    maintenanceMode: false
};

async function loadState() {
    try {
        const data = await fs.readFile(STATE_FILE_PATH, 'utf-8');
        stateCache = JSON.parse(data);
        console.log('[System State] Estado do sistema carregado.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[System State] Ficheiro de estado não encontrado, a usar valores padrão.');
            await saveState();
        } else {
            console.error('[System State] Erro ao carregar estado:', error);
        }
    }
}

async function saveState() {
    try {
        await fs.writeFile(STATE_FILE_PATH, JSON.stringify(stateCache, null, 2));
    } catch (error) {
        console.error('[System State] Erro ao salvar estado:', error);
    }
}

function isMaintenanceMode() {
    return stateCache.maintenanceMode === true;
}

async function setMaintenanceMode(isActive) {
    stateCache.maintenanceMode = isActive;
    await saveState();
    console.log(`[System State] Modo de Manutenção definido como: ${isActive}`);
}

module.exports = {
    loadState,
    isMaintenanceMode,
    setMaintenanceMode
};

