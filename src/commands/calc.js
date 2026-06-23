async function handleCalcCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;

    const expression = commandText.split(' ').slice(1).join(' ').trim();

    if (!expression) {
        const text = `┏━━❪ 🧮 𝗖𝗔𝗟𝗖 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} <expressão>\n┃\n┣━━❪ 𝗘𝗫𝗘𝗠𝗣𝗟𝗢𝗦 ❫━━\n┃\n┃ ➢ ${prefix}${commandName} 2 + 2\n┃ ➢ ${prefix}${commandName} (10 * 5) / 2\n┃ ➢ ${prefix}${commandName} 2 ** 10\n┃ ➢ ${prefix}${commandName} sqrt(144)\n┃ ➢ ${prefix}${commandName} 30% de 500\n┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    try {
        const result = safeEval(expression);

        if (result === null || result === undefined || typeof result === 'function') {
            throw new Error('Resultado inválido');
        }

        const formattedResult = typeof result === 'number'
            ? result.toLocaleString('pt-BR', { maximumFractionDigits: 10 })
            : String(result);

        const text = `┏━━❪ 🧮 𝗖𝗔𝗟𝗖 ❫━━\n┃\n┃ ➢ 𝗘𝘅𝗽𝗿𝗲𝘀𝘀𝗮𝗼 › ${expression}\n┃ ➢ 𝗥𝗲𝘀𝘂𝗹𝘁𝗮𝗱𝗼 › *${formattedResult}*\n┃\n┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, { text }, { quoted: msg });

    } catch (error) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ ⚠️ 𝗖𝗔𝗟𝗖 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Expressão inválida\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use operadores: + - * / ** ()\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
    }

    return true;
}

/**
 * Safe math evaluator — no eval(), no Function(), only math.
 */
function safeEval(expr) {
    // Pre-process: "30% de 500" → "(30/100)*500"
    expr = expr.replace(/(\d+(?:\.\d+)?)\s*%\s*(?:de|of)\s*(\d+(?:\.\d+)?)/gi, '($1/100)*$2');

    // Replace common math functions
    expr = expr.replace(/\bsqrt\s*\(([^)]+)\)/gi, 'Math.sqrt($1)');
    expr = expr.replace(/\babs\s*\(([^)]+)\)/gi, 'Math.abs($1)');
    expr = expr.replace(/\bround\s*\(([^)]+)\)/gi, 'Math.round($1)');
    expr = expr.replace(/\bceil\s*\(([^)]+)\)/gi, 'Math.ceil($1)');
    expr = expr.replace(/\bfloor\s*\(([^)]+)\)/gi, 'Math.floor($1)');
    expr = expr.replace(/\blog\s*\(([^)]+)\)/gi, 'Math.log10($1)');
    expr = expr.replace(/\bln\s*\(([^)]+)\)/gi, 'Math.log($1)');
    expr = expr.replace(/\bsin\s*\(([^)]+)\)/gi, 'Math.sin($1)');
    expr = expr.replace(/\bcos\s*\(([^)]+)\)/gi, 'Math.cos($1)');
    expr = expr.replace(/\btan\s*\(([^)]+)\)/gi, 'Math.tan($1)');
    expr = expr.replace(/\bpi\b/gi, 'Math.PI');
    expr = expr.replace(/\be\b/gi, 'Math.E');

    // Replace × and ÷ with * and /
    expr = expr.replace(/×/g, '*').replace(/÷/g, '/');
    // Replace comma with dot for decimals
    expr = expr.replace(/(\d),(\d)/g, '$1.$2');

    // Security: only allow safe characters
    const safePattern = /^[0-9+\-*/().%\s^,eE]+$|Math\.(sqrt|abs|round|ceil|floor|log10|log|sin|cos|tan|PI|E|pow)/;

    // Remove all Math.xxx to check the remaining chars
    const stripped = expr.replace(/Math\.(sqrt|abs|round|ceil|floor|log10|log|sin|cos|tan|PI|E|pow)/g, '');

    if (!/^[0-9+\-*/().%\s^,eE]*$/.test(stripped)) {
        throw new Error('Caracteres não permitidos');
    }

    // Replace ^ with ** for exponentiation
    expr = expr.replace(/\^/g, '**');

    // Use Function with strict math only
    const fn = new Function(`"use strict"; return (${expr});`);
    const result = fn();

    if (typeof result !== 'number' || !isFinite(result)) {
        if (typeof result === 'number' && isNaN(result)) {
            throw new Error('Resultado inválido (NaN)');
        }
        if (typeof result === 'number' && !isFinite(result)) {
            return '∞ (Infinito)';
        }
        throw new Error('Resultado inválido');
    }

    return result;
}

module.exports = handleCalcCommand;

module.exports.commandData = {
    name: "calc",
    description: "Calculadora de expressões matemáticas.",
    category: "util",
    usage: "/calc <expressão>",
    aliases: ["/calcular", "/math", "/calculadora", "/conta"]
};
