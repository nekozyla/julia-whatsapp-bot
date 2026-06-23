const path = require('path');
const fsSync = require('fs');
const fs = require('fs').promises;
const { spawn } = require('child_process');

const OUTPUT_DIR = process.env.GEMINI_OUTPUT_DIR || path.join(__dirname, '..', '..', 'temp', 'generated_images');
const SCRIPT_PATH = path.join(__dirname, '..', 'utils', 'gemini_image_gen.py');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3.11';
const PROJECT_ROOT = path.join(__dirname, '..', '..');

function resolveFirstExisting(paths) {
    for (const p of paths) {
        if (p && fsSync.existsSync(p)) return p;
    }
    return null;
}

function buildGeneratorEnv() {
    const env = { ...process.env };

    if (!env.CHROMEDRIVER_PATH) {
        const autoDriver = resolveFirstExisting([
            path.join(PROJECT_ROOT, 'node_modules', 'chromedriver', 'lib', 'chromedriver', 'chromedriver'),
            path.join(PROJECT_ROOT, 'node_modules', 'chromedriver', 'bin', 'chromedriver'),
            path.join(PROJECT_ROOT, 'node_modules', '.bin', 'chromedriver'),
            path.join(PROJECT_ROOT, 'bin', 'chromedriver')
        ]);
        if (autoDriver) env.CHROMEDRIVER_PATH = autoDriver;
    }

    if (!env.CHROME_BINARY_PATH) {
        const autoChrome = resolveFirstExisting([
            path.join(PROJECT_ROOT, 'chromium_arm_final', 'chrome-linux', 'chrome'),
            path.join(PROJECT_ROOT, 'bin', 'chrome')
        ]);
        if (autoChrome) env.CHROME_BINARY_PATH = autoChrome;
    }

    return env;
}

function runGenerator(promptText) {
    return new Promise((resolve, reject) => {
        const child = spawn(PYTHON_BIN, [SCRIPT_PATH, promptText], {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: buildGeneratorEnv()
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        child.on('error', (error) => {
            reject(new Error(`Falha ao iniciar gerador: ${error.message}`));
        });

        child.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(stderr || stdout || `Processo finalizou com código ${code}`));
            }

            resolve({ stdout, stderr });
        });
    });
}

function extractGeneratedPath(stdout) {
    const lines = stdout
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    const directPath = lines.find(line => line.startsWith('/'));
    if (directPath) return directPath;

    const pathMatch = stdout.match(/\/(?:[^\s]+\/)*gemini_[^\s]+\.(png|jpg|jpeg|webp|gif)/i);
    if (pathMatch) return pathMatch[0];

    return null;
}

async function findLatestOutputFile() {
    const files = await fs.readdir(OUTPUT_DIR);
    const candidates = files
        .filter(name => /^gemini_.*\.(png|jpg|jpeg|webp|gif)$/i.test(name))
        .map(name => path.join(OUTPUT_DIR, name));

    if (candidates.length === 0) return null;

    const withStats = await Promise.all(
        candidates.map(async (filePath) => ({
            filePath,
            stat: await fs.stat(filePath)
        }))
    );

    withStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    return withStats[0].filePath;
}

async function handleGeminiImgCommand(sock, msg, msgDetails) {
    const { sender, commandText } = msgDetails;
    const promptText = commandText.split(' ').slice(1).join(' ').trim();

    if (!promptText) {
        await sock.sendMessage(sender, {
            text: 'Uso: /geminiimg <descrição da imagem>\nExemplo: /geminiimg foto de gatinho astronauta'
        }, { quoted: msg });
        return true;
    }

    try {
        await sock.sendMessage(sender, { react: { text: '🎨', key: msg.key } });

        const { stdout } = await runGenerator(promptText);
        let imagePath = extractGeneratedPath(stdout);

        if (!imagePath) {
            imagePath = await findLatestOutputFile();
        }

        if (!imagePath) {
            throw new Error('Não encontrei a imagem gerada no disco.');
        }

        const imageBuffer = await fs.readFile(imagePath);
        await sock.sendMessage(sender, {
            image: imageBuffer,
            caption: `🎨 Gemini\n📝 ${promptText}`
        }, { quoted: msg });

        await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (error) {
        console.error('[GeminiImg] Erro:', error);
        await sock.sendMessage(sender, {
            text: `😕 Não consegui gerar a imagem agora.\n\n_Motivo: ${error.message}_`
        }, { quoted: msg });
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }

    return true;
}

module.exports = handleGeminiImgCommand;

module.exports.commandData = {
    name: 'geminiimg',
    description: 'Gera imagem com Gemini local.',
    category: 'midia',
    usage: '/geminiimg <descrição>',
    aliases: ['/imggemini', '/imagine']
};
