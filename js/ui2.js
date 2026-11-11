// js/ui2.js
const UI2 = {
    renderContasCartoes: async function() {
        const contas = await DB.getAll("contas");
        document.getElementById('contas-list').innerHTML = contas.map(c => `<div class="list-item"><div class="list-item-left"><span class="list-item-title">${c.nome}</span></div></div>`).join('');
    },
    
    renderFaturas: async function() {
        const cartoes = await DB.getAll("cartoes");
        document.getElementById('faturas-list').innerHTML = cartoes.map(c => `<div class="list-item"><div class="list-item-left"><span class="list-item-title">${c.nome}</span><span class="list-item-sub">Limite: ${Services.formatBRL(c.limite_cents)}</span></div></div>`).join('');
    },
    
    renderParcelamentos: async function() {
        const grupos = await DB.getAll("grupos_parc");
        document.getElementById('parcelas-list').innerHTML = grupos.map(g => `<div class="list-item"><div class="list-item-left"><span class="list-item-title">${g.descricao}</span><span class="list-item-sub">${g.n}x - ${g.conta}</span></div><div class="list-item-val des">${Services.formatBRL(g.total_cents)}</div></div>`).join('');
    },

    renderFixas: async function() {
        const fixas = await DB.getAll("fixas");
        document.getElementById('fixas-list').innerHTML = fixas.map(f => `<div class="list-item"><div class="list-item-left"><span class="list-item-title">${f.descricao}</span><span class="list-item-sub">Dia ${f.dia_venc}</span></div><div class="list-item-val des">${Services.formatBRL(f.valor_cents)}</div></div>`).join('');
    },

    gerarFixasMes: async function() {
        const fixas = await DB.getAll("fixas");
        const comp = new Date().toISOString().substring(0, 7);
        let count = 0;
        for (let f of fixas) {
            if (f.ativa) {
                await DB.add("lancamentos", {
                    data: `${comp}-${String(f.dia_venc).padStart(2, '0')}`,
                    competencia: comp,
                    item: f.descricao,
                    tipo: f.tipo || "Despesa",
                    valor_cents: f.valor_cents,
                    categoria: f.categoria,
                    conta: f.conta,
                    status: "pendente",
                    origem: "fixa"
                });
                count++;
            }
        }
        UICommon.alert(`${count} previsões fixas geradas para o mês atual!`);
    }
};
