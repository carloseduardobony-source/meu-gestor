// js/ui1.js
const UI1 = {
    renderDashboard: async function() {
        const comp = new Date().toISOString().substring(0, 7);
        const resumo = await Services.resumoMes(comp);
        
        document.getElementById('kpi-saldo').innerText = Services.formatBRL(resumo.saldo_mes);
        document.getElementById('kpi-receitas').innerText = Services.formatBRL(resumo.receitas);
        document.getElementById('kpi-despesas').innerText = Services.formatBRL(resumo.despesas);
        document.getElementById('kpi-acumulado').innerText = Services.formatBRL(resumo.saldo_acumulado);
        document.getElementById('kpi-faturas').innerText = Services.formatBRL(resumo.faturas_abertas);
    },

    renderExtrato: async function() {
        let lancamentos = await DB.getAll("lancamentos");
        lancamentos.sort((a, b) => b.data.localeCompare(a.data));
        document.getElementById('extrato-list').innerHTML = lancamentos.map(l => `
            <div class="list-item">
                <div class="list-item-left">
                    <span class="list-item-title">${l.item}</span>
                    <span class="list-item-sub">${l.data.split('-').reverse().join('/')} • ${l.categoria} • ${l.conta}</span>
                </div>
                <div class="list-item-val ${l.tipo === 'Receita' ? 'rec' : 'des'}">
                    ${l.tipo === 'Receita' ? '+' : '-'}${Services.formatBRL(l.valor_cents)}
                </div>
            </div>
        `).join('');
    },

    populateNovoLancamento: async function() {
        const cats = await DB.getAll("categorias");
        const contas = await DB.getAll("contas");
        const cartoes = await DB.getAll("cartoes");
        
        document.getElementById("novo-categoria").innerHTML = cats.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
        let allAcc = contas.map(c => `<option value="${c.nome}">${c.nome}</option>`).concat(cartoes.map(c => `<option value="${c.nome}">${c.nome}</option>`));
        document.getElementById("novo-conta").innerHTML = allAcc.join('');
        document.getElementById("novo-data").valueAsDate = new Date();
    },

    saveLancamento: async function(e) {
        e.preventDefault();
        const dataIso = document.getElementById('novo-data').value;
        const cents = Math.round(parseFloat(document.getElementById('novo-valor').value) * 100);
        const itemDesc = document.getElementById('novo-item').value;
        const tipo = document.getElementById('novo-tipo').value;
        const categoria = document.getElementById('novo-categoria').value;
        const conta = document.getElementById('novo-conta').value;
        const status = document.getElementById('novo-status').value;
        const isParcela = document.getElementById('novo-is-parcela').checked;
        
        if (isParcela) {
            const n = parseInt(document.getElementById('novo-parcelas').value || 2);
            const parcelasVals = Services.splitParcelas(cents, n);
            
            const grupoId = await DB.add("grupos_parc", { descricao: itemDesc, total_cents: cents, n, data_compra: dataIso, conta, categoria });
            
            let currentDate = new Date(dataIso);
            for(let i=0; i<n; i++) {
                let pDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, currentDate.getDate());
                await DB.add("lancamentos", {
                    data: pDate.toISOString().split('T')[0],
                    competencia: pDate.toISOString().substring(0, 7),
                    item: `${itemDesc} (${i+1} de ${n})`,
                    tipo, valor_cents: parcelasVals[i], categoria, conta, status,
                    origem: 'parcela', grupo_id: grupoId, numero: i+1
                });
            }
            UICommon.alert(`Salvo parcelado em ${n}x!`);
        } else {
            await DB.add("lancamentos", {
                data: dataIso, competencia: dataIso.substring(0, 7), item: itemDesc,
                tipo, valor_cents: cents, categoria, conta, status, origem: 'manual'
            });
            UICommon.alert("Lançamento salvo!");
        }
        document.getElementById('form-novo').reset();
        UI1.populateNovoLancamento();
    }
};
