const { generateImage } = require('../helpers/imageGenerator');
const path = require('path');
const fs = require('fs');
const contactManager = require('../managers/contactManager');
const profileManager = require('../managers/profileManager');
const rpgManager = require('../managers/rpgManager');
const rankManager = require('../managers/rankManager');
const authManager = require('../managers/authManager');

// Template HTML + CSS da Carta de Colecionador
const cardHtmlTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&family=Cinzel:wght@700;900&display=swap');
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            width: 450px;
            height: 700px;
            background: transparent;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Outfit', sans-serif;
            overflow: hidden;
        }

        /* O Card Principal */
        .card-container {
            width: 420px;
            height: 670px;
            background: rgba(10, 10, 15, 0.88);
            border-radius: 24px;
            border: 3px solid var(--neon-color);
            box-shadow: 0 0 25px rgba(0, 0, 0, 0.9),
                        inset 0 0 20px rgba(255, 255, 255, 0.05),
                        0 0 35px var(--neon-blur-color);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            padding: 22px;
            color: #ffffff;
            backdrop-filter: blur(15px);
        }

        /* Efeito de Brilho de Fundo Dinâmico */
        .bg-glow {
            position: absolute;
            top: -100px;
            left: -100px;
            width: 320px;
            height: 320px;
            background: var(--neon-blur-color);
            filter: blur(100px);
            opacity: 0.3;
            z-index: 0;
            pointer-events: none;
        }

        /* Linhas Estilo Holograma */
        .hologram-lines {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.04), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.04));
            background-size: 100% 4px, 6px 100%;
            z-index: 1;
            pointer-events: none;
            opacity: 0.5;
        }

        /* Topo: Raridade e Elemento */
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 2;
            margin-bottom: 12px;
        }

        .rarity-badge {
            font-family: 'Cinzel', serif;
            font-size: 14px;
            font-weight: 900;
            color: var(--neon-color);
            text-shadow: 0 0 10px var(--neon-blur-color);
            letter-spacing: 2.5px;
            text-transform: uppercase;
        }

        .stars-container {
            color: #fbbf24;
            text-shadow: 0 0 8px rgba(251, 191, 36, 0.8);
            font-size: 15px;
            letter-spacing: 2px;
        }

        /* Imagem da Criatura (Foto do Usuário) */
        .image-frame {
            width: 100%;
            height: 230px;
            border-radius: 18px;
            border: 2px solid rgba(255, 255, 255, 0.12);
            position: relative;
            overflow: hidden;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.7);
            z-index: 2;
            margin-bottom: 15px;
            background: #050508;
        }

        .user-photo {
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0.92;
        }

        /* Overlay Brilhante na Imagem */
        .image-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 60%, rgba(0,0,0,0.5) 100%);
            pointer-events: none;
        }

        /* Nome do Jogador e Classe */
        .player-info {
            text-align: center;
            z-index: 2;
            margin-bottom: 12px;
        }

        .player-name {
            font-size: 26px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-shadow: 0 2px 5px rgba(0,0,0,0.9);
            color: #ffffff;
            margin-bottom: 1px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .player-class {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 3px;
            color: #a1a1aa;
            font-weight: 600;
        }

        /* Bio/Descrição do Monstro */
        .player-bio {
            font-size: 12px;
            color: #d4d4d8;
            text-align: center;
            font-style: italic;
            margin-bottom: 15px;
            line-height: 1.4;
            padding: 0 8px;
            z-index: 2;
            min-height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Grade de Atributos */
        .attributes-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            z-index: 2;
            margin-bottom: 15px;
        }

        .attribute-box {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.07);
            border-radius: 12px;
            padding: 8px 4px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }

        .attr-icon {
            font-size: 14px;
            margin-bottom: 4px;
        }

        .attr-label {
            font-size: 9px;
            color: #a1a1aa;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
        }

        .attr-value {
            font-size: 13px;
            font-weight: 700;
        }

        /* Cores dos Ícones de Atributos */
        .attr-hp { color: #f43f5e; }
        .attr-mp { color: #3b82f6; }
        .attr-atk { color: #ef4444; }
        .attr-def { color: #10b981; }
        .attr-spd { color: #eab308; }
        .attr-aura { color: var(--aura-color); }

        /* Habilidade Especial */
        .special-skill {
            background: rgba(255, 255, 255, 0.04);
            border: 1px dashed rgba(255, 255, 255, 0.15);
            border-radius: 16px;
            padding: 12px;
            z-index: 2;
            margin-top: auto; /* Empurra para o rodapé se sobrar espaço */
        }

        .skill-header {
            display: flex;
            align-items: center;
            font-size: 12px;
            font-weight: 700;
            color: var(--neon-color);
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .skill-header i {
            margin-right: 6px;
            font-size: 12px;
        }

        .skill-desc {
            font-size: 11px;
            color: #d4d4d8;
            line-height: 1.4;
        }

        /* Rodapé com Serial */
        .card-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 8px;
            color: #52525b;
            margin-top: 12px;
            z-index: 2;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        /* Variáveis de Cores Temáticas de Raridade */
        .rarity-lendario {
            --neon-color: #fbbf24;
            --neon-blur-color: rgba(251, 191, 36, 0.7);
        }
        .rarity-epico {
            --neon-color: #c084fc;
            --neon-blur-color: rgba(192, 132, 252, 0.7);
        }
        .rarity-raro {
            --neon-color: #60a5fa;
            --neon-blur-color: rgba(96, 165, 250, 0.7);
        }
        .rarity-incomum {
            --neon-color: #34d399;
            --neon-blur-color: rgba(52, 211, 153, 0.7);
        }
        .rarity-comum {
            --neon-color: #d4d4d8;
            --neon-blur-color: rgba(212, 212, 216, 0.4);
        }
    </style>
</head>
<body class="rarity-{{rarityClass}}">
    <div class="card-container">
        <div class="bg-glow"></div>
        <div class="hologram-lines"></div>

        <div class="card-header">
            <span class="rarity-badge">{{rarity}}</span>
            <div class="stars-container">{{{starsHtml}}}</div>
        </div>

        <div class="image-frame">
            <img class="user-photo" src="{{avatarUrl}}" alt="Player Avatar">
            <div class="image-overlay"></div>
        </div>

        <div class="player-info">
            <h1 class="player-name">{{name}}</h1>
            <span class="player-class">{{class}}</span>
        </div>

        <div class="player-bio">
            "{{bio}}"
        </div>

        <div class="attributes-grid">
            <!-- HP -->
            <div class="attribute-box">
                <i class="fa-solid fa-heart attr-icon attr-hp"></i>
                <span class="attr-label">HP</span>
                <span class="attr-value">{{hp}}</span>
            </div>
            <!-- MP -->
            <div class="attribute-box">
                <i class="fa-solid fa-wand-magic-sparkles attr-icon attr-mp"></i>
                <span class="attr-label">MP</span>
                <span class="attr-value">{{mp}}</span>
            </div>
            <!-- ATK -->
            <div class="attribute-box">
                <i class="fa-solid fa-hand-fist attr-icon attr-atk"></i>
                <span class="attr-label">ATK</span>
                <span class="attr-value">{{atk}}</span>
            </div>
            <!-- DEF -->
            <div class="attribute-box">
                <i class="fa-solid fa-shield-halved attr-icon attr-def"></i>
                <span class="attr-label">DEF</span>
                <span class="attr-value">{{def}}</span>
            </div>
            <!-- SPD -->
            <div class="attribute-box">
                <i class="fa-solid fa-gauge-high attr-icon attr-spd"></i>
                <span class="attr-label">SPD</span>
                <span class="attr-value">{{spd}}</span>
            </div>
            <!-- AURA -->
            <div class="attribute-box" style="--aura-color: {{auraColor}}">
                <i class="fa-solid fa-circle-radiation attr-icon attr-aura"></i>
                <span class="attr-label">AURA</span>
                <span class="attr-value" style="color: {{auraColor}}">{{aura}}</span>
            </div>
        </div>

        <div class="special-skill">
            <div class="skill-header">
                <i class="fa-solid fa-bolt"></i>
                <span>Habilidade: {{specialSkillName}}</span>
            </div>
            <p class="skill-desc">
                {{specialSkillDesc}}
            </p>
        </div>

        <div class="card-footer">
            <span>© nekozyla-bot</span>
            <span>{{serialNumber}}</span>
        </div>
    </div>
</body>
</html>
`;

// Habilidades divertidas por classe
const FUNNY_SKILLS = {
    guerreiro: {
        name: "Golpe de Admin",
        desc: "Executa um banimento instantâneo em quem mandar trava-zap. Imune a silenciamentos de grupo."
    },
    mago: {
        name: "Ilusão do Vácuo",
        desc: "Finge que visualizou a mensagem e deixa o emissário falando sozinho por até 8 horas seguidas."
    },
    ladino: {
        name: "Farsa do View-Once",
        desc: "Consegue abrir, printar e salvar mídias de visualização única sem alertar o remetente."
    },
    clerigo: {
        name: "Prece de Calmaria",
        desc: "Envia mensagens fofas de 'bom dia' com gatinhos para apaziguar brigas políticas no grupo."
    },
    necromante: {
        name: "Ressuscitar Chat",
        desc: "Envia uma figurinha proibida de 2020 para reviver o grupo que está morto há mais de 3 dias."
    },
    default: {
        name: "Sonegar Impostos",
        desc: "Ignora silenciosamente marcações com @everyone e finge estar offline nas últimas 48 horas."
    }
};

// Classes divertidas baseadas em JID
const FICTIONAL_CLASSES = [
    { name: "Guerreiro do Zap ⚔️", key: "guerreiro" },
    { name: "Mago do Vácuo 🔮", key: "mago" },
    { name: "Ladino dos Grupos 🗡️", key: "ladino" },
    { name: "Clérigo da Rinha ✨", key: "clerigo" },
    { name: "Necromante de Trava 💀", key: "necromante" }
];

async function handleCardCommand(sock, msg, msgDetails) {
    const { sender, commandSenderJid, isGroup, args } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Reagir para indicar processamento
    await sock.sendMessage(sender, { react: { text: '🃏', key: msg.key } });

    // Determina o alvo do card
    let targetJid = commandSenderJid;
    if (mentionedJids.length > 0) {
        targetJid = mentionedJids[0];
    } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        targetJid = msg.message.extendedTextMessage.contextInfo.participant;
    }

    try {
        // 1. Obter Foto de Perfil
        let ppUrl;
        try {
            ppUrl = await sock.profilePictureUrl(targetJid, 'image');
        } catch (e) {
            ppUrl = 'https://telegra.ph/file/24fa902ead26340f3df2c.png'; // Placeholder padrão
        }

        // 2. Obter Informações do Perfil Geral
        let name = contactManager.getNickname(targetJid) || targetJid.split('@')[0];
        if (name.length > 18) {
            name = name.substring(0, 15) + '...';
        }

        const rep = profileManager.getRep(targetJid);
        const bio = profileManager.getBio(targetJid) || "Um aventureiro misterioso que vaga pelos canais do WhatsApp.";
        const bdayData = profileManager.getBirthday(targetJid);
        const sign = bdayData?.sign || "Sem Signo";

        // 3. Obter Contador de Mensagens no Grupo
        let msgCount = 0;
        let rankPos = "-";
        if (isGroup) {
            msgCount = rankManager.getCount(sender, targetJid);
            const rankInfo = rankManager.getRankInfo(sender, targetJid);
            if (rankInfo) {
                rankPos = rankInfo.rank;
            }
        }

        // 4. Obter Dados de RPG
        const rpgChar = rpgManager.getCharacter(targetJid);
        let charClass = "";
        let charClassKey = "";
        let level = 1;
        let hp = 100;
        let mp = 50;
        let atk = 10;
        let def = 10;
        let spd = 10;

        if (rpgChar) {
            level = rpgChar.level;
            const rpgStats = rpgManager.calculateCharStats(rpgChar);
            hp = rpgStats.maxHp;
            mp = rpgStats.maxMp;
            atk = rpgStats.atk;
            def = rpgStats.def;
            spd = 10 + Math.floor(rpgStats.destreza / 2);

            // Mapear emojis e nomes das classes de RPG
            const classMapping = {
                guerreiro: "Guerreiro ⚔️",
                mago: "Mago 🔮",
                arqueiro: "Arqueiro 🏹",
                ladino: "Ladino 🗡️",
                clerigo: "Clérigo ✨",
                necromante: "Necromante 💀"
            };
            charClass = classMapping[rpgChar.class] || rpgChar.class;
            charClassKey = rpgChar.class;
        } else {
            // Sorteia uma classe de ficção fixa por JID do usuário
            const numericJid = targetJid.replace(/\D/g, '');
            const classIndex = parseInt(numericJid.substring(numericJid.length - 4)) % FICTIONAL_CLASSES.length;
            const fictionalClass = FICTIONAL_CLASSES[classIndex];
            charClass = fictionalClass.name;
            charClassKey = fictionalClass.key;

            // Calcula nível fictício baseado nas mensagens enviadas
            level = Math.min(99, Math.floor(Math.sqrt(msgCount) / 1.5) + 1);

            // Calcula atributos baseados nas mensagens e rep
            hp = 100 + msgCount;
            mp = 50 + (rep * 5);
            atk = 10 + Math.floor(Math.sqrt(msgCount) * 1.2);
            def = 10 + (rep * 2);
            spd = 10 + (parseInt(numericJid.substring(numericJid.length - 2)) % 25);
        }

        // 5. Determinar Raridade
        let rarity = "Comum";
        let rarityClass = "comum";

        const isSuperAdmin = authManager.isSuperAdmin(targetJid);
        
        // Verifica se é administrador do grupo atual
        let isGroupAdmin = false;
        if (isGroup) {
            try {
                const groupMeta = await sock.groupMetadata(sender);
                const participant = groupMeta.participants.find(p => p.id === targetJid);
                if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
                    isGroupAdmin = true;
                }
            } catch (e) { }
        }

        // Verifica doador
        const isDonor = profileManager.getDonation(targetJid) > 0;

        if (isSuperAdmin) {
            rarity = "Lendário";
            rarityClass = "lendario";
        } else if (isGroupAdmin) {
            rarity = "Épico";
            rarityClass = "epico";
        } else if (isDonor) {
            rarity = "Raro";
            rarityClass = "raro";
        } else if (msgCount > 500) {
            rarity = "Incomum";
            rarityClass = "incomum";
        } else {
            rarity = "Comum";
            rarityClass = "comum";
        }

        // 6. Calcular Estrelas do Card (1 a 5)
        const starCount = Math.max(1, Math.min(5, Math.ceil(level / 20) || 1));
        let starsHtml = "";
        for (let i = 0; i < starCount; i++) {
            starsHtml += '<i class="fa-solid fa-star"></i>';
        }

        // 7. Calcular Aura do Dia (Consistente para o dia atual por JID)
        const todayStr = new Date().toISOString().split('T')[0];
        const seedString = targetJid + todayStr;
        let hash = 0;
        for (let i = 0; i < seedString.length; i++) {
            hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
        }
        let aura = Math.floor(((Math.abs(hash) % 20001) - 10000));
        
        if (isSuperAdmin) {
            aura = 10000;
        }

        const auraColor = aura >= 0 ? "#10b981" : "#ef4444";
        const formattedAura = (aura >= 0 ? "+" : "") + aura.toLocaleString('pt-BR');

        // 8. Obter a Habilidade Especial
        const skill = FUNNY_SKILLS[charClassKey] || FUNNY_SKILLS.default;

        // 9. Gerar o número serial único da carta
        const jidHash = Math.abs(hash).toString(16).substring(0, 8).toUpperCase();
        const serialNumber = `#${jidHash}-JULIA`;

        // 10. Paths para salvar a imagem renderizada
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const outputPath = path.join(tempDir, `card_${targetJid.split('@')[0]}_${Date.now()}.png`);

        // 11. Chamar o renderizador Puppeteer local do bot
        await generateImage(cardHtmlTemplate, outputPath, {
            avatarUrl: ppUrl,
            name: name,
            rarity: rarity,
            rarityClass: rarityClass,
            starsHtml: starsHtml,
            class: charClass,
            bio: bio,
            hp: hp.toLocaleString('pt-BR'),
            mp: mp.toLocaleString('pt-BR'),
            atk: atk.toLocaleString('pt-BR'),
            def: def.toLocaleString('pt-BR'),
            spd: spd.toLocaleString('pt-BR'),
            aura: formattedAura,
            auraColor: auraColor,
            specialSkillName: skill.name,
            specialSkillDesc: skill.desc,
            serialNumber: serialNumber
        }, { width: 450, height: 700 });

        // 12. Enviar a imagem no chat
        const targetMention = `@${targetJid.split('@')[0]}`;
        await sock.sendMessage(sender, {
            image: { url: outputPath },
            caption: `🃏 *CARTA COLECIONÁVEL DE BATALHA* 🃏\n\n👤 *Invocado:* ${targetMention}\n⭐ *Nível:* ${level}\n🛡️ *Classe:* ${charClass.split(' ')[0]}\n✨ *Aura do Dia:* ${formattedAura}\n\n🏆 _Carta gerada com sucesso! Compare com os amigos do grupo._`,
            mentions: [targetJid]
        }, { quoted: msg });

        // Limpeza do arquivo gerado após 30 segundos
        setTimeout(() => {
            if (fs.existsSync(outputPath)) {
                fs.unlink(outputPath, (err) => {
                    if (err) console.error('[CARD] Erro ao deletar imagem temporária:', err);
                });
            }
        }, 30000);

    } catch (error) {
        console.error('[CARD] Erro no processamento do card:', error);
        await sock.sendMessage(sender, { text: '❌ Ocorreu um erro ao gerar a sua carta de colecionador.' }, { quoted: msg });
    }
}

module.exports = handleCardCommand;

module.exports.commandData = {
    name: "card",
    description: "Gera uma carta de batalha colecionável premium baseada no usuário.",
    category: "diversao",
    usage: "/card [@usuario]",
    aliases: ["carta", "playercard", "mycard"]
};
