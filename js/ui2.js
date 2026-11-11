// js/ui2.js
const UI2 = {
    setupListeners: function() {
        document.getElementById('form-conta').addEventListener('submit', this.saveConta.bind(this));
        document.getElementById('form-cartao').addEventListener('submit', this.saveCartao.bind(this));
        document.getElementById('form-fixa').addEventListener('submit', this.saveFixa.bind(this));
        
        const d = new Date();
        document.getElementById('faturas-mes').value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
    },

    saveConta: async function(e) {
        e.preventDefault();
        const nome = document.getElementById('c-nome').value.trim();
        const tipo = document.getElementById('c-tipo').value;
        const saldoStr = document.getElementById('c-saldo').value;
        const saldo_inicial_cents = saldoStr ? Services.parseBRL(saldoStr) : 0;
        
        await DB.add("contas", { nome, tipo, saldo_inicial_cents, ativa: 1 });
        UICommon.alert(`Conta '${nome}' salva!`);
        document.getElementById('form-conta').reset();
        this.renderContasCartoes();
    },

    saveCartao: async function(e) {
        e.preventDefault();
        const nome = document.getElementById('k-nome').value.trim();
        const conta_pagto = document.getElementById('k-pagto').value;
        const limite_cents = Services.parseBRL(document.getElementById('k-lim').value);
        const fechamento = parseInt(document.getElementById('k-fech').value);
        const vencimento = parseInt(document.getElementById('k-venc').value) || null;
        
        await DB.add("cartoes", { nome, conta_pagto, limite_cents, fechamento, vencimento, ativo: 1 });
        UICommon.alert(`Cartão '${nome}' salvo!`);
        document.getElementById('form-cartao').reset();
        this.renderContasCartoes();
    },

    renderContasCartoes: async function() {
        const contas = await DB.getAll("contas");
        const cartoes = await DB.getAll("cartoes");
        
        document.getElementById('k-pagto').innerHTML = contas.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
        
        document.getElementById('contas-list').innerHTML = contas.map(c => `
            <div class="list-item"><div class="list-item-left"><span class="list-item-title">${c.nome}</span><span class="list-item-sub">Tipo: ${c.tipo}</span></div><div class="list-item-val">Inicial: ${Services.formatBRL(c.saldo_inicial_cents)}</div></div>
        `).join('');

        document.getElementById('cartoes-list').innerHTML = cartoes.map(c => `
            <div class="list-item"><div class="list-item-left"><span class="list-item-title">${c.nome}</span><span class="list-item-sub">Fecha dia ${c.fechamento} • Pagto via ${c.conta_pagto}</span></div><div class="list-item-val des">Limite: ${Services.formatBRL(c.limite_cents)}</div></div>
        `).join('');
    },
    
    saveFixa: async function(e) {
        e.preventDefault();
        const descricao = document.getElementById('f-desc').value.trim();
        const valor_cents = Services.parseBRL(document.getElementById('f-val').value);
        const dia_venc = parseInt(document.getElementById('f-dia').value);
        const categoria = document.getElementById('f-cat').value;
        const conta = document.getElementById('f-conta').value;
        const data_ini = new Date().toISOString().substring(0, 7) + '-01'; 
        
        await DB.add("fixas", { descricao, tipo: 'Despesa', categoria, valor_cents, dia_venc, data_ini, conta, ativa: 1 });
        UICommon.alert(`Conta Fixa '${descricao}' salva!`);
        document.getElementById('form-fixa').reset();
        this.renderFixas();
    },

    renderFixas: async function() {
        const fixas = await DB.getAll("fixas");
        const cats = await DB.getAll("categorias");
        const contas = await DB.getAll("contas");
        const cartoes = await DB.getAll("cartoes");

        document.getElementById('f-cat').innerHTML = cats.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
        document.getElementById('f-conta').innerHTML = contas.map(c => `<option value="${c.nome}">${c.nome}</option>`).concat(cartoes.map(c => `<option value="${c.nome}">${c.nome}</option>`)).join('');

        document.getElementById('fixas-list').innerHTML = fixas.map(f => `
            <div class="list-item"><div class="list-item-left"><span class="list-item-title">${f.descricao}</span><span class="list-item-sub">Todo dia ${f.dia_venc} • ${f.conta}</span></div><div class="list-item-val des">${Services.formatBRL(f.valor_cents)}</div></div>
        `).join('');
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
        UICommon.alert(`${count} previsões fixas geradas para o mês atual! Vá ao Extrato para dar baixa.`);
    },

    renderFaturas: async function() {
        const mes = document.getElementById('faturas-mes').value;
        if(!mes) return;

        const cartoes = await DB.getAll("cartoes");
        const lancamentos = await DB.getAll("lancamentos");
        
        let html = '';
        for (const c of cartoes) {
            const gastos = lancamentos.filter(l => l.conta === c.nome && l.competencia === mes && l.tipo === 'Despesa');
            const totalCents = gastos.reduce((acc, l) => acc + l.valor_cents, 0);
            const pagas = gastos.filter(l => l.status === 'pago').reduce((acc, l) => acc + l.valor_cents, 0);
            
            html += `<div class="list-item">
                        <div class="list-item-left"><span class="list-item-title">${c.nome}</span><span class="list-item-sub">Fatura do mês ${mes}</span></div>
                        <div class="list-item-val des">${Services.formatBRL(totalCents)}</div>
                        <div class="action-buttons"><button class="btn-primary btn-small" onclick="UI5.pagarFatura('${c.nome}', '${mes}')">Pagar Fatura Completa</button></div>
                    </div>`;
        }
        document.getElementById('faturas-list').innerHTML = html;
    },
    
    renderParcelamentos: async function() {
        const grupos = await DB.getAll("grupos_parc");
        document.getElementById('parcelas-list').innerHTML = grupos.map(g => `<div class="list-item"><div class="list-item-left"><span class="list-item-title">${g.descricao}</span><span class="list-item-sub">${g.n}x - ${g.conta}</span></div><div class="list-item-val des">${Services.formatBRL(g.total_cents)}</div></div>`).join('');
    }
};
