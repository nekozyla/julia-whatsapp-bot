// main_debug.js
// Este ficheiro serve APENAS para diagnóstico. Ele irá imprimir todos os eventos recebidos.

const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const qrcode = require('qrcode-terminal');
const util = require('util'); // Importa a biblioteca 'util' para formatação

// Caminho para a pasta de autenticação
const AUTH_FILE_PATH = path.join(__dirname, '..', 'auth_info');

async function startDebug() {
    console.log('[DEBUG] A iniciar o modo de depuração...');

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FILE_PATH);
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }), // Silenciamos o logger padrão para focar no nosso
        browser: ['Julia (Modo Debug)', 'Chrome', '20.0.0']
    });

    // Guarda as credenciais sempre que forem atualizadas
    sock.ev.on('creds.update', saveCreds);

    // Monitoriza as atualizações da conexão
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        console.log('--- [EVENTO DE CONEXÃO] ---');
        console.log(util.inspect(update, { showHidden: false, depth: null, colors: true }));
        console.log('--- [FIM DO EVENTO] ---\n');

        if (qr) {
            console.log('POR FAVOR, ESCANEIE O QR CODE ABAIXO:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log('>>> CONEXÃO ESTABELECIDA COM SUCESSO! <<<');
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = (reason !== DisconnectReason.loggedOut);
            console.log(`>>> CONEXÃO FECHADA! Motivo: ${reason}. A tentar reconectar: ${shouldReconnect} <<<`);
            if (shouldReconnect) {
                startDebug();
            }
        }
    });

    // O "ouvinte" principal: captura QUALQUER evento que a biblioteca emita
    sock.ev.on('all', (event) => {
        console.log('--- [EVENTO GERAL RECEBIDO] ---');
        // Usamos 'util.inspect' para garantir que todos os detalhes do objeto sejam impressos
        console.log(util.inspect(event, { showHidden: false, depth: null, colors: true }));
        console.log('--- [FIM DO EVENTO] ---\n');
    });

    console.log('[DEBUG] Logger configurado. A aguardar eventos do WhatsApp...');
}

startDebug().catch(err => {
    console.error("Erro fatal ao iniciar o modo de depuração:", err);
    process.exit(1);
});

