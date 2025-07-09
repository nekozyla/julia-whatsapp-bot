// commands/help.js

async function handleHelpCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    // Monta a mensagem de ajuda completa usando a formatação do WhatsApp
    const helpText = `
*Guia de Comandos da Julia* ✨

Desenvolvido por: 

Instagram: @nekozyla
Twitter:@nekozylajs

Aqui está uma lista de tudo que eu posso fazer!

*--- 🎨 Mídia e Criação ---*

*!sticker*
_Cria uma figurinha a partir de uma imagem ou GIF. Envie na legenda ou responda a uma mídia com o comando._
Se quiser uma figurinha quadrada, use "quadrado" após o comando
Ex: (envie uma imagem com a legenda !sticker, ou responda uma imagem)

*!toimage*
_Converte uma figurinha (sticker) de volta para uma imagem._
Ex: (responda a uma figurinha com !toimage)

*!patpat*
_Cria um meme 'pat-pat' com uma imagem._
Ex: (envie uma imagem com a legenda !patpat)

*--- 🎉 Diversão e Interação ---*

*!top10 [assunto]*
_Cria um ranking aleatório com 10 pessoas do grupo sobre um assunto._
Ex: \`!top10 mais legais do grupo\`

*!shipp [@pessoa1] [@pessoa2]*
_Calcula a compatibilidade entre duas pessoas. Se marcar só uma, o 'ship' é com você!_
Ex: \`!shipp @Amigo\` ou \`!shipp @Amigo1 @Amiga2\`

*!gadometro [@pessoa]*
_Mede o seu nível de 'gado' ou o de alguém que você marcar._
Ex: \`!gado @Amigo\` ou apenas \`!gado\`


*--- ⚙️ Configurações e Modos ---*

*!ia [on/off]*
_Ativa ou desativa minhas funções de conversa com Inteligência Artificial neste chat._
Ex: \`!ia on\`

*!modosticker [on/off]*
_No privado, ativa/desativa a conversão automática de toda imagem para figurinha._
Ex: \`!modosticker off\`

*!modotranscricao [on/off]*
_Em grupos, ativa/desativa a transcrição automática de todos os áudios._
Ex: \`!modotranscricao on\`

*!chato*
_Bloqueia você das brincadeiras e do uso de comandos neste grupo._

*!voltar*
_Remove seu bloqueio das brincadeiras e comandos do grupo._


*--- 🛠️ Utilidades ---*

*!transcrever*
_Transcreve o conteúdo de uma mensagem de áudio respondida._
Ex: (responda a um áudio com !transcrever)

*!pesquisa [pergunta]*
_Realiza uma busca na internet e resume o resultado de forma objetiva._
Ex: \`!pesquisa me explique sobre buracos negros\`


*--- 👑 Comandos de Admin ---*
_(Apenas o número definido como admin pode usar)_

*!todos [mensagem]*
_Menciona todos os membros do grupo._
Ex: \`!todos Reunião importante amanhã!\`
`;

    try {
        await sock.sendMessage(sender, { text: helpText.trim() });
    } catch (error) {
        console.error("[Help] Erro ao enviar a mensagem de ajuda:", error);
    }

    return true; // Indica que o comando foi processado
}

module.exports = handleHelpCommand;
