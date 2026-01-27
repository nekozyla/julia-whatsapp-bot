module.exports = [
    
    { id: 'primeiros_passos', name: 'Primeiros Passos', desc: 'Tenha J$1.000 na carteira.', reward: { type: 'money', value: 100 }, condition: (stats) => stats.balance >= 1000 },
    { id: 'acumulador', name: 'Acumulador', desc: 'Tenha J$10.000 no banco.', reward: { type: 'money', value: 1000 }, condition: (stats) => stats.bank >= 10000 },
    { id: 'rico', name: 'Rico', desc: 'Tenha J$100.000 de patrimônio.', reward: { type: 'money', value: 5000 }, condition: (stats) => (stats.balance + stats.bank) >= 100000 },
    { id: 'milionario', name: 'Milionário', desc: 'Tenha J$1.000.000 de patrimônio.', reward: { type: 'item', value: 'titulo', quantity: 1 }, condition: (stats) => (stats.balance + stats.bank) >= 1000000 },
    { id: 'bilionario', name: 'Bilionário', desc: 'Tenha J$1.000.000.000 de patrimônio.', reward: { type: 'item', value: 'carta_ouro', quantity: 1 }, condition: (stats) => (stats.balance + stats.bank) >= 1000000000 },
    { id: 'trabalhador', name: 'Trabalhador Braçal', desc: 'Trabalhe 10 vezes.', reward: { type: 'money', value: 500 }, condition: (stats) => stats.workCount >= 10 },
    { id: 'workaholic', name: 'Workaholic', desc: 'Trabalhe 100 vezes.', reward: { type: 'item', value: 'energetico', quantity: 1 }, condition: (stats) => stats.workCount >= 100 },
    { id: 'mendigo_pro', name: 'Mendigo Profissional', desc: 'Peça esmola 50 vezes.', reward: { type: 'money', value: 200 }, condition: (stats) => stats.begCount >= 50 },

    
    { id: 'trombadinha', name: 'Trombadinha', desc: 'Realize 5 roubos com sucesso.', reward: { type: 'money', value: 1000 }, condition: (stats) => stats.robSuccess >= 5 },
    { id: 'ladrao_mestre', name: 'Ladrão Mestre', desc: 'Realize 50 roubos com sucesso.', reward: { type: 'item', value: 'mascara', quantity: 3 }, condition: (stats) => stats.robSuccess >= 50 },
    { id: 'procurado', name: 'Mais Procurado', desc: 'Falhe em 20 roubos.', reward: { type: 'item', value: 'escudo', quantity: 1 }, condition: (stats) => stats.robFail >= 20 },
    { id: 'la_casa_de_papel', name: 'La Casa de Papel', desc: 'Complete o Heist (Assalto ao Banco) com sucesso.', reward: { type: 'item', value: 'carro_fuga', quantity: 1 }, condition: (stats) => stats.heistSuccess >= 1 },
    { id: 'heist_master', name: 'O Professor', desc: 'Complete 10 Heists.', reward: { type: 'item', value: 'laptop', quantity: 2 }, condition: (stats) => stats.heistSuccess >= 10 },

    
    { id: 'apostador', name: 'Apostador', desc: 'Jogue no Níquel 10 vezes.', reward: { type: 'money', value: 500 }, condition: (stats) => stats.slotPlays >= 10 },
    { id: 'viciado', name: 'Viciado em Jogos', desc: 'Jogue no Níquel 100 vezes.', reward: { type: 'item', value: 'trevo', quantity: 1 }, condition: (stats) => stats.slotPlays >= 100 },
    { id: 'sortudo', name: 'Sortudo', desc: 'Ganhe um Jackpot (Tigre) no Níquel.', reward: { type: 'money', value: 10000 }, condition: (stats) => stats.slotJackpots >= 1 },
    { id: 'azarado', name: 'Pé Frio', desc: 'Perca 50 vezes no Níquel.', reward: { type: 'item', value: 'amuleto_bronze', quantity: 1 }, condition: (stats) => stats.slotLosses >= 50 },
    { id: 'rinheiro', name: 'Rinheiro', desc: 'Aposte em 10 Rinhas.', reward: { type: 'item', value: 'amuleto', quantity: 1 }, condition: (stats) => stats.cockfightBets >= 10 },
    { id: 'campeao_rinha', name: 'Rei do Galinheiro', desc: 'Ganhe 20 apostas em Rinha.', reward: { type: 'item', value: 'amuleto_prata', quantity: 1 }, condition: (stats) => stats.cockfightWins >= 20 },
    { id: 'fanatico_rinha', name: 'Fanático por Galo', desc: 'Aposte em 100 Rinhas.', reward: { type: 'item', value: 'amuleto_ouro', quantity: 1 }, condition: (stats) => stats.cockfightBets >= 100 },

    
    { id: 'minerador_iniciante', name: 'Minerador Iniciante', desc: 'Mine 1.0 JBC no total.', reward: { type: 'money', value: 500 }, condition: (stats) => stats.totalMined >= 1.0 },
    { id: 'minerador_avancado', name: 'Minerador Avançado', desc: 'Mine 10.0 JBC no total.', reward: { type: 'item', value: 'gpu', quantity: 1 }, condition: (stats) => stats.totalMined >= 10.0 },
    { id: 'baleia', name: 'Baleia Crypto', desc: 'Tenha 100 JBC na carteira.', reward: { type: 'item', value: 'titulo', quantity: 1 }, condition: (stats) => stats.juliacoins >= 100 },
    { id: 'trader', name: 'Day Trader', desc: 'Venda moedas 10 vezes.', reward: { type: 'money', value: 1000 }, condition: (stats) => stats.coinSells >= 10 },

    
    { id: 'primeira_luta', name: 'Primeira Luta', desc: 'Participe de uma luta PvP.', reward: { type: 'money', value: 200 }, condition: (stats) => stats.fights >= 1 },
    { id: 'vencedor', name: 'Vencedor', desc: 'Vença 5 lutas PvP.', reward: { type: 'item', value: 'energetico', quantity: 1 }, condition: (stats) => stats.fightWins >= 5 },
    { id: 'lenda_urbana', name: 'Lenda Urbana', desc: 'Vença 20 lutas PvP.', reward: { type: 'item', value: 'titulo', quantity: 1 }, condition: (stats) => stats.fightWins >= 20 },

    
    { id: 'consumista', name: 'Consumista', desc: 'Compre 10 itens na loja.', reward: { type: 'money', value: 1000 }, condition: (stats) => stats.itemsBought >= 10 },
    { id: 'colecionador', name: 'Colecionador', desc: 'Tenha 5 tipos diferentes de itens no inventário.', reward: { type: 'item', value: 'titulo', quantity: 1 }, condition: (stats) => Object.keys(stats.inventory || {}).length >= 5 },
    { id: 'rank_s', name: 'Elite', desc: 'Alcance o Rank C.', reward: { type: 'money', value: 5000 }, condition: (stats) => stats.rankIndex >= 3 } 
];
