
const vm = require('vm');

// Padrões proibidos no código — qualquer match rejeita o código
const BLOCKED_PATTERNS = [
    // Acesso ao filesystem
    /\brequire\s*\(\s*['"`]fs['"`]\s*\)/,
    /\brequire\s*\(\s*['"`]fs\/promises['"`]\s*\)/,
    /\brequire\s*\(\s*['"`]path['"`]\s*\)/,
    // Execução de processos
    /\brequire\s*\(\s*['"`]child_process['"`]\s*\)/,
    /\bexecSync\b/,
    /\bexecFile\b/,
    /\bspawnSync\b/,
    /\bspawn\b/,
    /\bexec\s*\(/,
    // Rede
    /\brequire\s*\(\s*['"`]http['"`]\s*\)/,
    /\brequire\s*\(\s*['"`]https['"`]\s*\)/,
    /\brequire\s*\(\s*['"`]net['"`]\s*\)/,
    /\brequire\s*\(\s*['"`]dgram['"`]\s*\)/,
    /\brequire\s*\(\s*['"`]axios['"`]\s*\)/,
    /\brequire\s*\(\s*['"`]node-fetch['"`]\s*\)/,
    /\bfetch\s*\(/,
    // Manipulação de processo
    /\bprocess\.exit/,
    /\bprocess\.kill/,
    /\bprocess\.env/,
    // Eval e código dinâmico perigoso
    /\beval\s*\(/,
    /\bFunction\s*\(/,
    /\brequire\s*\(\s*['"`]vm['"`]\s*\)/,
    /\brequire\s*\(\s*['"`]worker_threads['"`]\s*\)/,
    /\brequire\s*\(\s*['"`]cluster['"`]\s*\)/,
    // Acesso ao módulo/sistema de require
    /\brequire\.resolve/,
    /\brequire\.cache/,
    /\bmodule\.constructor/,
    /\bglobal\b/,
    /\bglobalThis\b/,
    // Import dinâmico
    /\bimport\s*\(/,
];

const BLOCKED_DESCRIPTIONS = {
    'fs': 'Sistema de arquivos (fs)',
    'child_process': 'Execução de processos (child_process)',
    'exec': 'Execução de comandos (exec)',
    'http': 'Acesso à rede (http/https)',
    'process': 'Manipulação de processo',
    'eval': 'Código dinâmico (eval)',
    'global': 'Acesso global',
    'require': 'Require perigoso',
};

/**
 * Valida o código gerado contra padrões perigosos.
 * @param {string} code - Código JS a validar
 * @returns {{ safe: boolean, reason?: string }}
 */
function validateCode(code) {
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(code)) {
            return {
                safe: false,
                reason: `Código contém padrão proibido: ${pattern.toString()}`
            };
        }
    }

    // Verificar require genérico — só permitimos require para o módulo do próprio bot
    const requireMatches = code.matchAll(/require\s*\(\s*['"`]([^'"]+)['"`]\s*\)/g);
    for (const match of requireMatches) {
        const modName = match[1];
        // Nenhum require é permitido em comandos IA
        return {
            safe: false,
            reason: `require("${modName}") não é permitido em comandos IA.`
        };
    }

    return { safe: true };
}

/**
 * Cria um wrapper sandboxed para um comando IA.
 * O comando só tem acesso a sock, msg, msgDetails e APIs seguras (Math, Date, JSON, etc).
 * @param {string} filePath - Caminho do arquivo do comando
 * @returns {Function|null} - Função handler sandboxed ou null se falhar
 */
function createSandboxedHandler(filePath) {
    const fs = require('fs');
    const code = fs.readFileSync(filePath, 'utf-8');

    // Validar segurança
    const validation = validateCode(code);
    if (!validation.safe) {
        console.error(`[Sandbox] Comando IA bloqueado (${filePath}): ${validation.reason}`);
        return null;
    }

    // Extrair commandData antes de sandboxar (precisa estar acessível)
    let commandData = null;
    const cmdDataMatch = code.match(/module\.exports\.commandData\s*=\s*(\{[\s\S]*?\});/);
    if (cmdDataMatch) {
        try {
            commandData = eval(`(${cmdDataMatch[1]})`);
        } catch (e) {
            console.error(`[Sandbox] Erro ao extrair commandData: ${e.message}`);
        }
    }

    // Criar handler sandboxed
    const wrappedHandler = async function sandboxedCommand(sock, msg, msgDetails) {
        const sandbox = {
            // APIs seguras
            console: {
                log: (...args) => console.log(`[AI-CMD]`, ...args),
                error: (...args) => console.error(`[AI-CMD]`, ...args),
                warn: (...args) => console.warn(`[AI-CMD]`, ...args),
            },
            Math,
            Date,
            JSON,
            parseInt,
            parseFloat,
            isNaN,
            isFinite,
            String,
            Number,
            Boolean,
            Array,
            Object,
            Map,
            Set,
            RegExp,
            Error,
            Promise,
            setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 30000)), // Max 30s
            clearTimeout,
            Buffer,
            encodeURIComponent,
            decodeURIComponent,
            encodeURI,
            decodeURI,

            // Variáveis do comando
            sock,
            msg,
            msgDetails,

            // module.exports stub
            module: { exports: {} },
            exports: {},
            require: () => { throw new Error('require() não é permitido em comandos IA.'); },
        };

        try {
            const context = vm.createContext(sandbox);
            const script = new vm.Script(code, {
                filename: filePath,
                timeout: 15000, // 15 segundos máximo de execução
            });
            script.runInContext(context);

            // Executar a função exportada
            const handler = sandbox.module.exports;
            if (typeof handler === 'function') {
                await handler(sock, msg, msgDetails);
            } else {
                throw new Error('Comando IA não exportou uma função válida.');
            }
        } catch (error) {
            console.error(`[Sandbox] Erro ao executar comando IA:`, error.message);
            await sock.sendMessage(msgDetails.sender, {
                text: `❌ Erro no comando IA: ${error.message}`
            }, { quoted: msg }).catch(() => { });
        }
    };

    // Anexar commandData ao wrapper
    wrappedHandler.commandData = commandData;

    return wrappedHandler;
}

module.exports = { validateCode, createSandboxedHandler, BLOCKED_PATTERNS };
