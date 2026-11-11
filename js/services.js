// js/services.js
const Services = {
    formatBRL: (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    
    parseBRL: (valueStr) => {
        if(!valueStr) return 0;
        const clean = String(valueStr).replace(/\./g, '').replace(',', '.');
        return Math.round(parseFloat(clean) * 100);
    },

    getCompetencia: (dateIso) => dateIso.substring(0, 7),
    
    addMonths: (isoComp, k) => {
        let [y, m] = isoComp.split('-').map(Number);
        m += k;
        y += Math.floor((m - 1) / 12);
        m = ((m - 1) % 12) + 1;
        return `${y}-${String(m).padStart(2, '0')}`;
    },

    resumoMes: async function(comp) {
        const lancamentos = await DB.getAll("lancamentos");
        const cartoes = await DB.getAll("cartoes");
        const pagFaturas = await DB.getAll("pag_faturas");
        
        let recMes = 0, desMes = 0, saldoAcumulado = 0;
        let totalCartao = 0, totalPagoFatura = 0;
        
        const cartaoNames = cartoes.map(c => c.nome);
        
        lancamentos.forEach(l => {
            if (cartaoNames.includes(l.conta) && l.tipo === 'Despesa') {
                totalCartao += l.valor_cents;
            }
            if (l.status === 'pago') {
                if (l.tipo === 'Receita') saldoAcumulado += l.valor_cents;
                else if (!cartaoNames.includes(l.conta)) saldoAcumulado -= l.valor_cents;
            }
            if (l.competencia === comp) {
                if (l.tipo === 'Receita') recMes += l.valor_cents;
                else desMes += l.valor_cents;
            }
        });

        pagFaturas.forEach(pf => {
            saldoAcumulado -= pf.valor_cents;
            totalPagoFatura += pf.valor_cents;
        });

        return {
            receitas: recMes,
            despesas: desMes,
            saldo_mes: recMes - desMes,
            saldo_acumulado: saldoAcumulado,
            faturas_abertas: totalCartao - totalPagoFatura
        };
    },

    splitParcelas: (totalCents, n) => {
        const base = Math.floor(totalCents / n);
        const resto = totalCents % n;
        const parcelas = [];
        for(let i=0; i<n; i++) parcelas.push(base + (i < resto ? 1 : 0));
        return parcelas;
    }
};
