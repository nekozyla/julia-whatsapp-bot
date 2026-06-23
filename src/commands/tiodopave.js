const jokes = [
    // ── CLASSICAS ──
    { p: 'O que o pato disse pro outro pato?', r: 'Tamo junto, QUACK QUACK! 🦆' },
    { p: 'Por que o livro de matemática ficou triste?', r: 'Porque tinha muitos problemas. 📚' },
    { p: 'O que a porta disse pra outra porta?', r: 'Estou MAÇANETA com isso! 🚪' },
    { p: 'O que o zero disse pro oito?', r: 'Bonito cinto! 0️⃣' },
    { p: 'Por que o tomate ficou vermelho?', r: 'Porque viu o molho! 🍅' },
    { p: 'O que uma parede disse pra outra?', r: 'A gente se encontra na esquina! 🧱' },
    { p: 'Por que o café foi na delegacia?', r: 'Porque foi assaltado... com açúcar! ☕' },
    { p: 'O que o pintinho disse quando viu a mãe no ninho?', r: 'INCUBADORA! 🐥' },
    { p: 'Qual o queijo mais engraçado?', r: 'O riSotto. 🧀' },
    { p: 'O que uma vaca disse pra outra?', r: 'MUUUUUd de assunto! 🐄' },

    // ── RUINS DE PROPÓSITO ──
    { p: 'Sabe qual o contrário de volvo?', r: 'VolVEM! 🚗' },
    { p: 'O que o nariz disse pro outro nariz?', r: 'Entre nós existe um clima! 👃' },
    { p: 'Como se chama o dinossauro que dorme muito?', r: 'Preguiçassauro Rex! 🦕' },
    { p: 'O que o triângulo disse pro círculo?', r: 'Você não tem ponto! 📐' },
    { p: 'Por que a Coca-Cola e a Fanta foram ao psicólogo?', r: 'Porque uma era sempre REFRIGER-ANTES e a outra PÓS-REFRIGER-ANTES. 🥤' },
    { p: 'O que a água mineral disse pra outra?', r: 'A gente precisa parar de ser tão GASosa. 💧' },
    { p: 'Como o Batman faz pra sair do carro?', r: 'Ele abre a PORTA...MAN! 🦇' },
    { p: 'Sabe por que o gato não joga poker?', r: 'Porque ele tem medo de BLEFE-ar com muitas PATAS na mesa! 🐱' },
    { p: 'O que o sino disse pro outro sino?', r: 'Badalemos juntos! 🔔' },
    { p: 'Qual o cúmulo da preguiça?', r: 'Dar a volta no travesseiro pra não ter que virar a cabeça. 😴' },

    // ── TROCADILHOS FORÇADOS ──
    { p: 'Onde os peixes guardam dinheiro?', r: 'No BANCO de areia! 🐟' },
    { p: 'Qual é o animal mais antigo?', r: 'A ZEBra... porque é em PRETO E BRANCO! 🦓' },
    { p: 'O filósofo ateu tá com problema de quê?', r: 'CRISEtencialismo! 🤔' },
    { p: 'Qual é o vinho preferido dos informatas?', r: 'Tinto! (int o) 🍷' },
    { p: 'Por que o programador usa óculos?', r: 'Porque ele não enxerga C# (cê-sharp)! 💻' },
    { p: 'O que aconteceu quando o sapato pisou na tomada?', r: 'Levou um CHOQUE de realidade! 🔌' },
    { p: 'Como a WiFi terminou com o computador?', r: 'Disse: "não temos mais CONEXÃO!" 📡' },
    { p: 'Qual é o animal mais gente boa?', r: 'O camarão, porque ele é NOTA DEZ e sempre DESCASCA os problemas! 🦐' },
    { p: 'O que dá cruzar um serial killer com um padeiro?', r: 'Um ASSASSINO em MASSA! (desculpa) 🍞' },
    { p: 'Qual o cúmulo da tecnologia?', r: 'Dar print na tela e colar no mural! 🖨️' },

    // ── PESADAS / ABSURDAS ──
    { p: 'O que acontece se jogar um pato no vulcão?', r: 'QUACK-boom. 🌋' },
    { p: 'Qual é o oposto de Fernanda?', r: 'Perto-mole. 😐' },
    { p: 'O que é um ponto azul no céu?', r: 'Um uruBLUE! 🔵' },
    { p: 'O que uma calculadora disse pra outra?', r: 'Pode contar comigo! ➕' },
    { p: 'Qual fruta é a mais atleta?', r: 'A ROMÃ, porque ela sempre tá na GRANADA! 💪' },
    { p: 'Quem é o rei das frutas no escritório?', r: 'O MANGA-ger! 🥭' },
    { p: 'O que a impressora disse pra ficha?', r: 'Sua hora de CAIR chegou! 🖨️' },
    { p: 'Qual o fim da picada?', r: 'Quando o mosquito vai embora! 🦟' },
    { p: 'Sabe por que o cachorro não foi escolhido pro time de futebol?', r: 'Porque ele só queria ser o goleiro... pra poder PEGAR A BOLA! ⚽' },
    { p: 'O que dá quando cruza uma cobra com um castor?', r: 'Um bicho que morde a tora e TRAVA! 🐍' },
];

async function handleTioDoPaveCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    const joke = jokes[Math.floor(Math.random() * jokes.length)];

    const text = `┏━━❪ 🤡 𝗧𝗜𝗢 𝗗𝗢 𝗣𝗔𝗩𝗘 ❫━━\n┃\n┃ ➢ _${joke.p}_\n┃\n┃ ➢ *${joke.r}*\n┃\n┗━━━━━━━━━━━━━━`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
    return true;
}

module.exports = handleTioDoPaveCommand;

module.exports.commandData = {
    name: "tiodopave",
    description: "Piadas do tio do pavê!",
    category: "diversao",
    usage: "/tiodopave",
    aliases: ["/tio", "/pave", "/piada", "/joke", "/piadadodia"]
};
