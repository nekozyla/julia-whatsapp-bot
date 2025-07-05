// commands/help.js

async function handleHelpCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    // Monta a mensagem de ajuda completa usando a formatação do WhatsApp
    const helpText = `
*Guia de Comandos da Julia* ✨

Desenvolvida por: @nekozylajs

Aqui está uma lista de tudo que eu posso fazer!

*--- 🎨 Mídia e Criação ---*

*!sticker*
_Cria uma figurinha a partir de uma imagem ou GIF. Envie na legenda ou responda a uma mídia com o comando._
Ex: (envie uma imagem com a legenda !sticker)

*!patpat*
_Cria um meme 'pat-pat' com uma imagem._
Ex: (envie uma imagem com a legenda !patpat)

*--- 🛠️ Utilidades e Lembretes ---*

*!transcrever*
_Transcreve o conteúdo de uma mensagem de áudio._
Ex: (responda a um áudio com !transcrever)

*!lembrete [data] [mensagem]*
_Agenda um lembrete. Use DD/MM para eventos anuais ou DD/MM/AAAA para eventos únicos._
Ex: \`!lembrete 31/12 Fogos na praia!\`

*!lembretes*
_Mostra os lembretes que estão agendados para este chat._
Ex: \`!lembretes\`

*--- 🎉 Diversão e Interação ---*

*!top10 [assunto]*
_Cria um ranking aleatório com 10 pessoas do grupo sobre um assunto._
Ex: \`!top10 mais legais do grupo\`

*!shipp [@pessoa1] [@pessoa2]*
_Calcula a compatibilidade entre duas pessoas. Se marcar só uma, o 'ship' é com você!_
Ex: \`!shipp @Amigo\` ou \`!shipp @Amigo1 @Amiga2\`

*!gado [@pessoa]*
_Mede o seu nível de 'gado' ou o de alguém que você marcar._
Ex: \`!gado @Amigo\` ou apenas \`!gado\`



*--- 🤖 Interação com a IA ---*

*!pesquisa [pergunta]*
_Envia uma pergunta direta para a IA, sem a persona da Julia, para respostas mais objetivas._
Ex: \`!pesquisa me explique sobre buracos negros\`

*--- 👑 Comandos de Admin ---*
_(Apenas o número definido como admin pode usar)_

*!todos [mensagem]*
_Menciona todos os membros do grupo._
Ex: \`!todos Reunião importante amanhã!\`

*!modotranscricao [on/off]*
_Ativa ou desativa a transcrição automática de todos os áudios neste chat._
Ex: \`!modotranscricao on\`
`;

    try {
        await sock.sendMessage(sender, { text: helpText.trim() });
    } catch (error) {
        console.error("[Help] Erro ao enviar a mensagem de ajuda:", error);
    }

    return true; // Indica que o comando foi processado
}

module.exports = handleHelpCommand;
