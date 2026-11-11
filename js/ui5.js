// js/ui5.js - Ações de Modificação (Edit/Delete), Planejamento e Relatórios
const UI5 = {
    // ---- AÇÕES DIRETAS (EDITAR / DELETAR) ----
    excluirLancamento: async function(id) {
        if(confirm("Tem certeza que deseja excluir este lançamento permanentemente?")) {
            await DB.delete("lancamentos", id);
            UICommon.alert("Lançamento excluído.");
            UI1.renderExtrato(); // Atualiza a tela
        }
    },

    abrirEdicao: async function(id) {
        const lancamentos = await DB.getAll("lancamentos");
        const lan = lancamentos.find(l => l.id === id);
        if(lan) {
            document.getElementById('edit-id').value = lan.id;
            document.getElementById('edit-data').value = lan.data;
            document.getElementById('edit-item').value = lan.item;
            document.getElementById('edit-valor').value = (lan.valor_cents / 100).toFixed(2);
            document.getElementById('edit-status').value = lan.status;
            
            document.getElementById('edit-modal').style.display = 'flex';
        }
    },

    salvarEdicao: async function() {
        const id = parseInt(document.getElementById('edit-id').value);
        const newData = {
            data: document.getElementById('edit-data').value,
            item: document.getElementById('edit-item').value,
            valor_cents: Services.parseBRL(document.getElementById('edit-valor').value),
            status: document.getElementById('edit-status').value
        };
        
        await DB.update("lancamentos", id, newData);
        document.getElementById('edit-modal').style.display = 'none';
        UICommon.alert("Lançamento atualizado com sucesso!");
        UI1.renderExtrato();
    },

    pagarFatura: async function(cartao, mes) {
        if(confirm(`Confirmar o pagamento de todos os lançamentos do ${cartao} em ${mes}? Eles serão marcados como pagos e abaterão seu saldo.`)){
            const lancamentos = await DB.getAll("lancamentos");
            const gastos = lancamentos.filter(l => l.conta === cartao && l.competencia === mes && l.tipo === 'Despesa');
            
            for(let l of gastos) {
                if(l.status === 'pendente') {
                    await DB.update("lancamentos", l.id, { status: 'pago' });
                }
            }
            
            // Registrando pagamento no pag_faturas (para conciliação matemática)
            const totalCents = gastos.reduce((acc, l) => acc + l.valor_cents, 0);
            await DB.add("pag_faturas", { cartao: cartao, fechamento: mes, valor_cents: totalCents, data_pagto: new Date().toISOString().split('T')[0], conta_origem: "Conta Corrente" });
            
            UICommon.alert("Fatura liquidada!");
            UI2.renderFaturas();
        }
    },

    // ---- PESQUISA GLOBAL ----
    pesquisar: async function() {
        const query = document.getElementById('search-input').value.toLowerCase().trim();
        const resultsDiv = document.getElementById('search-results');
        
        if (query.length < 2) {
            resultsDiv.innerHTML = '';
            return;
        }

        const lancamentos = await DB.getAll("lancamentos");
        const hits = lancamentos.filter(l => l.item.toLowerCase().includes(query) || l.categoria.toLowerCase().includes(query));
        
        resultsDiv.innerHTML = hits.map(l => `
            <div class="list-item">
                <div class="list-item-left"><span class="list-item-title">${l.item}</span><span class="list-item-sub">${l.data.split('-').reverse().join('/')} • ${l.conta}</span></div>
                <div class="list-item-val ${l.tipo === 'Receita' ? 'rec' : 'des'}">${Services.formatBRL(l.valor_cents)}</div>
            </div>
        `).join('');
    },

    // ---- RELATÓRIOS E PLANEJAMENTO ----
    renderPlanejamento: async function() {
        const compAtual = new Date().toISOString().substring(0, 7);
        let html = '';
        
        // Simula 12 meses para frente
        for(let i=0; i<12; i++) {
            let pMes = Services.addMonths(compAtual, i);
            let r = await Services.resumoMes(pMes);
            
            html += `
                <div class="list-item">
                    <div class="list-item-left">
                        <span class="list-item-title">Mês ${pMes}</span>
                        <span class="list-item-sub">Rec Prev: ${Services.formatBRL(r.receitas)} • Faturas: ${Services.formatBRL(r.faturas_abertas)}</span>
                    </div>
                    <div class="list-item-val ${r.saldo_mes >= 0 ? 'rec' : 'des'}">
                        Projetado: ${Services.formatBRL(r.saldo_mes)}
                    </div>
                </div>
            `;
        }
        document.getElementById('plan-list').innerHTML = html;
    },

    gerarRelatorio: async function() {
        const tipo = document.getElementById('rel-tipo').value;
        const ano = document.getElementById('rel-ano').value || new Date().getFullYear();
        const lancamentos = await DB.getAll("lancamentos");
        
        let html = '';
        if(tipo === 'anual') {
            for(let m=1; m<=12; m++) {
                let comp = `${ano}-${String(m).padStart(2, '0')}`;
                let rec = 0, des = 0;
                
                lancamentos.forEach(l => {
                    if(l.competencia === comp) {
                        if(l.tipo === 'Receita') rec += l.valor_cents;
                        else des += l.valor_cents;
                    }
                });

                html += `<div class="list-item"><div class="list-item-left"><span class="list-item-title">${comp}</span></div><div class="list-item-val">Rec: ${Services.formatBRL(rec)} <br> Des: ${Services.formatBRL(des)}</div></div>`;
            }
        }
        document.getElementById('rel-list').innerHTML = html;
    }
};
