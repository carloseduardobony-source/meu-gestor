// js/ui5.js - Ações e Edição em Cascata
const UI5 = {
    currentEditStore: null,
    currentEditId: null,

    excluirGenerico: async function(storeName, id, callbackString) {
        if(confirm(`Tem certeza que deseja excluir permanentemente este item de ${storeName.toUpperCase()}?`)) {
            await DB.delete(storeName, id);
            UICommon.alert("Item excluído com sucesso!");
            eval(callbackString);
        }
    },

    abrirEdicaoGenerica: async function(storeName, id) {
        const item = (await DB.getAll(storeName)).find(i => i.id === id);
        if(!item) return;

        this.currentEditStore = storeName;
        this.currentEditId = id;

        const fieldsContainer = document.getElementById('generic-edit-fields');
        fieldsContainer.innerHTML = '';
        const ignored = ['id', 'ativa', 'ativo', 'status'];

        for (const [key, value] of Object.entries(item)) {
            if (ignored.includes(key)) continue;
            let type = 'text';
            let val = value || '';
            let label = key.toUpperCase().replace(/_/g, ' ');

            if (key.includes('cents')) {
                type = 'number';
                val = (parseInt(value || 0) / 100).toFixed(2);
                label = label.replace(' CENTS', ' (R$)');
            } else if (key.includes('data') || key.includes('prazo') || key.includes('ini') || key.includes('vencimento')) {
                type = 'date';
            } else if (typeof value === 'number') {
                type = 'number';
            }

            fieldsContainer.innerHTML += `
                <div class="input-group">
                    <label>${label}</label>
                    <input type="${type}" id="gen-edit-${key}" value="${val}" ${type === 'number' ? 'step="0.01"' : ''} required>
                </div>
            `;
        }

        document.getElementById('generic-edit-title').innerText = `Editando: ${storeName.toUpperCase()}`;
        document.getElementById('generic-edit-modal').style.display = 'flex';
    },

    salvarEdicaoGenerica: async function(e) {
        e.preventDefault();
        const storeName = this.currentEditStore;
        const id = this.currentEditId;
        const item = (await DB.getAll(storeName)).find(i => i.id === id);
        const newData = {};
        const ignored = ['id', 'ativa', 'ativo', 'status'];

        for (const key of Object.keys(item)) {
            if (ignored.includes(key)) continue;
            const input = document.getElementById(`gen-edit-${key}`);
            if(input) {
                if (key.includes('cents')) {
                    newData[key] = Services.parseBRL(input.value);
                } else if (input.type === 'number') {
                    newData[key] = parseInt(input.value) || 0;
                } else {
                    newData[key] = input.value;
                }
            }
        }

        await DB.update(storeName, id, newData);
        document.getElementById('generic-edit-modal').style.display = 'none';
        UICommon.alert("Atualizado com sucesso!");

        if(storeName === 'categorias') UI3.renderCategorias();
        if(storeName === 'metas') UI3.renderMetas();
        if(storeName === 'quem_me_deve') UI3.renderQuemMeDeve();
        if(storeName === 'transferencias') UI3.renderTransferencias();
        if(storeName === 'contas' || storeName === 'cartoes') UI2.renderContasCartoes();
        if(storeName === 'fixas') UI2.renderFixas();
    },

    excluirLancamento: async function(id) {
        if(confirm("Tem certeza que deseja excluir este lançamento permanentemente?")) {
            await DB.delete("lancamentos", id);
            UICommon.alert("Lançamento excluído.");
            UI1.renderExtrato();
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
            document.getElementById('edit-competencia').value = lan.competencia || lan.data.substring(0, 7);
            
            document.getElementById('edit-modal').style.display = 'flex';
        }
    },

    salvarEdicao: async function() {
        const id = parseInt(document.getElementById('edit-id').value);
        const novaData = document.getElementById('edit-data').value;
        const novaComp = document.getElementById('edit-competencia').value;
        const novoValor = Services.parseBRL(document.getElementById('edit-valor').value);
        const novoStatus = document.getElementById('edit-status').value;
        const novoItem = document.getElementById('edit-item').value;

        const lancamentos = await DB.getAll("lancamentos");
        const lanAtual = lancamentos.find(l => l.id === id);

        let moverFuturas = false;
        if (lanAtual && lanAtual.grupo_id && (lanAtual.competencia !== novaComp || lanAtual.data !== novaData)) {
            moverFuturas = confirm("Este lançamento faz parte de uma compra parcelada. Deseja mover também todas as parcelas FUTURAS deste grupo para acompanhar a nova data/competência?");
        }

        await DB.update("lancamentos", id, {
            data: novaData,
            competencia: novaComp,
            item: novoItem,
            valor_cents: novoValor,
            status: novoStatus
        });

        if (moverFuturas && lanAtual.grupo_id) {
            const numAtual = lanAtual.numero || 1;
            const futuras = lancamentos.filter(l => l.grupo_id === lanAtual.grupo_id && l.numero > numAtual);
            
            let [yVelho, mVelho] = lanAtual.competencia.split('-').map(Number);
            let [yNovo, mNovo] = novaComp.split('-').map(Number);
            let diffMeses = (yNovo - yVelho) * 12 + (mNovo - mVelho);

            for (let f of futuras) {
                let [yf, mf] = f.competencia.split('-').map(Number);
                mf += diffMeses;
                yf += Math.floor((mf - 1) / 12);
                mf = ((mf - 1) % 12) + 1;
                let novaCompFutura = `${yf}-${String(mf).padStart(2, '0')}`;

                await DB.update("lancamentos", f.id, {
                    competencia: novaCompFutura
                });
            }
        }

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
            const totalCents = gastos.reduce((acc, l) => acc + l.valor_cents, 0);
            await DB.add("pag_faturas", { cartao: cartao, fechamento: mes, valor_cents: totalCents, data_pagto: new Date().toISOString().split('T')[0], conta_origem: "Conta Corrente" });
            
            UICommon.alert("Fatura liquidada!");
            UI2.renderFaturas();
        }
    },

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

    renderPlanejamento: async function() {
        const compAtual = new Date().toISOString().substring(0, 7);
        let html = '';
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
