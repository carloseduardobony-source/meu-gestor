// js/ui5.js - Pesquisa Global (8 Filtros de ui5.py), Planejamento 12 Meses, Relatórios Completos e Editor Universal
const UI5 = {
    currentEditStore: null,
    currentEditId: null,

    // ---- EDITOR UNIVERSAL ----
    excluirGenerico: async function(storeName, id, callbackString) {
        if (confirm(`Tem certeza que deseja excluir permanentemente este registro?`)) {
            await DB.delete(storeName, id);
            if (storeName === "quem_me_deve") {
                const parcs = (await DB.getAll("qmd_parc")).filter(p => Number(p.qmd_id) === Number(id));
                for (const p of parcs) await DB.delete("qmd_parc", p.id);
            }
            eval(callbackString);
        }
    },

    abrirEdicaoGenerica: async function(storeName, id) {
        const item = (await DB.getAll(storeName)).find(i => Number(i.id) === Number(id));
        if (!item) return;

        this.currentEditStore = storeName;
        this.currentEditId = id;

        const fieldsContainer = document.getElementById('generic-edit-fields');
        fieldsContainer.innerHTML = '';
        const ignored = ['id', 'ativa', 'ativo', 'status', 'hash', 'grupo_id', 'numero', 'created_at'];

        for (const [key, value] of Object.entries(item)) {
            if (ignored.includes(key)) continue;

            let type = 'text';
            let val = value !== null && value !== undefined ? value : '';
            let label = key.toUpperCase().replace(/_/g, ' ');

            if (key.includes('cents')) {
                type = 'number';
                val = (parseInt(value || 0) / 100).toFixed(2);
                label = label.replace(' CENTS', ' (R$)');
            } else if (key.includes('data') || key.includes('prazo') || key.includes('ini')) {
                type = 'date';
            } else if (typeof value === 'number') {
                type = 'number';
            }

            fieldsContainer.innerHTML += `
                <div class="input-group">
                    <label>${label}</label>
                    <input type="${type}" id="gen-edit-${key}" value="${val}" ${type === 'number' ? 'step="0.01"' : ''}>
                </div>
            `;
        }

        document.getElementById('generic-edit-title').innerText = `Editar Registro (${storeName.toUpperCase()})`;
        document.getElementById('generic-edit-modal').style.display = 'flex';
    },

    salvarEdicaoGenerica: async function(e) {
        e.preventDefault();
        const storeName = this.currentEditStore;
        const id = this.currentEditId;
        const item = (await DB.getAll(storeName)).find(i => Number(i.id) === Number(id));
        if (!item) return;

        const newData = {};
        const ignored = ['id', 'ativa', 'ativo', 'status', 'hash', 'grupo_id', 'numero', 'created_at'];

        for (const key of Object.keys(item)) {
            if (ignored.includes(key)) continue;
            const input = document.getElementById(`gen-edit-${key}`);
            if (input) {
                if (key.includes('cents')) {
                    newData[key] = Math.abs(Services.parseBRL(input.value));
                } else if (input.type === 'number') {
                    newData[key] = parseInt(input.value) || 0;
                } else {
                    newData[key] = input.value;
                }
            }
        }

        await DB.update(storeName, id, newData);
        document.getElementById('generic-edit-modal').style.display = 'none';

        if (storeName === 'categorias') UI3.renderCategorias();
        if (storeName === 'metas') UI3.renderMetas();
        if (storeName === 'quem_me_deve') UI3.renderQuemMeDeve();
        if (storeName === 'transferencias') UI3.renderTransferencias();
        if (storeName === 'contas' || storeName === 'cartoes') UI2.renderContasCartoes();
        if (storeName === 'fixas') UI2.renderFixas();
        UI1.renderDashboard();
    },

    // ---- EDIÇÃO E EXCLUSÃO DE LANÇAMENTOS ----
    excluirLancamento: async function(id) {
        if (confirm("Tem certeza que deseja excluir este lançamento permanentemente?")) {
            await DB.delete("lancamentos", id);
            UI1.renderExtrato();
            this.pesquisar();
            UI1.renderDashboard();
        }
    },

    abrirEdicao: async function(id) {
        const lancamentos = await DB.getAll("lancamentos");
        const lan = lancamentos.find(l => Number(l.id) === Number(id));
        if (!lan) return;

        const cats = await DB.getAll("categorias");
        const contas = await DB.getAll("contas");
        const cartoes = await DB.getAll("cartoes");

        const selCat = document.getElementById('edit-categoria');
        if (selCat) {
            selCat.innerHTML = cats.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
            if (lan.categoria && !cats.some(c => c.nome === lan.categoria)) {
                selCat.innerHTML += `<option value="${lan.categoria}">${lan.categoria}</option>`;
            }
            selCat.value = lan.categoria || '';
        }

        const selConta = document.getElementById('edit-conta');
        if (selConta) {
            selConta.innerHTML = contas.map(c => `<option value="${c.nome}">${c.nome}</option>`)
                .concat(cartoes.map(c => `<option value="${c.nome}">${c.nome}</option>`)).join('');
            if (lan.conta && !contas.some(c => c.nome === lan.conta) && !cartoes.some(c => c.nome === lan.conta)) {
                selConta.innerHTML += `<option value="${lan.conta}">${lan.conta}</option>`;
            }
            selConta.value = lan.conta || '';
        }

        document.getElementById('edit-id').value = lan.id;
        document.getElementById('edit-data').value = lan.data;
        document.getElementById('edit-item').value = lan.item;
        if (document.getElementById('edit-tipo')) document.getElementById('edit-tipo').value = lan.tipo || 'Despesa';
        document.getElementById('edit-valor').value = (lan.valor_cents / 100).toFixed(2);
        document.getElementById('edit-status').value = lan.status;
        if (document.getElementById('edit-competencia')) {
            document.getElementById('edit-competencia').value = lan.competencia || lan.data.substring(0, 7);
        }
        
        document.getElementById('edit-modal').style.display = 'flex';
    },

    salvarEdicao: async function() {
        const id = parseInt(document.getElementById('edit-id').value);
        const novaData = document.getElementById('edit-data').value;
        const elComp = document.getElementById('edit-competencia');
        const novaComp = (elComp && elComp.value) ? elComp.value : novaData.substring(0, 7);
        const novoTipo = document.getElementById('edit-tipo') ? document.getElementById('edit-tipo').value : 'Despesa';
        const novaCat = document.getElementById('edit-categoria') ? document.getElementById('edit-categoria').value : '';
        const novaConta = document.getElementById('edit-conta') ? document.getElementById('edit-conta').value : '';
        const novoValor = Math.abs(Services.parseBRL(document.getElementById('edit-valor').value));
        const novoStatus = document.getElementById('edit-status').value;
        const novoItem = document.getElementById('edit-item').value;

        const lancamentos = await DB.getAll("lancamentos");
        const lanAtual = lancamentos.find(l => Number(l.id) === Number(id));

        const compAntiga = lanAtual ? (lanAtual.competencia || lanAtual.data.substring(0, 7)) : novaComp;
        const isParcela = lanAtual && (lanAtual.grupo_id || /\(\d+\s*(?:de|\/)\s*\d+\)/i.test(lanAtual.item || ''));

        let moverFuturas = false;
        if (isParcela && compAntiga !== novaComp) {
            moverFuturas = confirm("Este lançamento faz parte de uma compra parcelada. Deseja mover também todas as parcelas FUTURAS para acompanhar a nova fatura (" + novaComp.slice(5,7) + "/" + novaComp.slice(0,4) + ")?");
        }

        // Atualiza o lançamento atual preservando todos os campos
        await DB.update("lancamentos", id, {
            data: novaData,
            competencia: novaComp,
            item: novoItem,
            tipo: novoTipo,
            categoria: novaCat,
            conta: novaConta,
            valor_cents: novoValor,
            status: novoStatus
        });

        // Se o usuário optou por mover as parcelas futuras em cascata
        if (moverFuturas && lanAtual) {
            let [yVelho, mVelho] = compAntiga.split('-').map(Number);
            let [yNovo, mNovo] = novaComp.split('-').map(Number);
            let diffMeses = (yNovo - yVelho) * 12 + (mNovo - mVelho);

            let futuras = [];
            if (lanAtual.grupo_id) {
                const numAtual = lanAtual.numero || 1;
                futuras = lancamentos.filter(l => l.grupo_id === lanAtual.grupo_id && (l.numero || 0) > numAtual);
            } else {
                // Caso tenha vindo de importação sem grupo_id, identifica pelo padrão "Descrição (X de N)" ou "(X/N)"
                const m = (lanAtual.item || '').match(/^(.*?)\s*\((\d+)\s*(de|\/)\s*(\d+)\)\s*$/i);
                if (m) {
                    const prefixo = m[1].trim().toLowerCase();
                    const numAtual = parseInt(m[2]);
                    const totalParc = parseInt(m[4]);
                    futuras = lancamentos.filter(l => {
                        if (l.conta !== lanAtual.conta) return false;
                        const ml = (l.item || '').match(/^(.*?)\s*\((\d+)\s*(de|\/)\s*(\d+)\)\s*$/i);
                        return ml && ml[1].trim().toLowerCase() === prefixo && parseInt(ml[4]) === totalParc && parseInt(ml[2]) > numAtual;
                    });
                }
            }

            for (let f of futuras) {
                const compF = f.competencia || f.data.substring(0, 7);
                const novaCompFutura = Services.addMonths(compF, diffMeses);
                await DB.update("lancamentos", f.id, {
                    competencia: novaCompFutura
                });
            }
        }

        document.getElementById('edit-modal').style.display = 'none';
        UICommon.alert("Lançamento atualizado com sucesso!");
        UI1.renderExtrato();
        this.pesquisar();
        UI1.renderDashboard();
    },

    recalcularFaturasFechamento: async function() {
        const cartoes = await DB.getAll("cartoes");
        if (!cartoes.length) return UICommon.alert("Cadastre seus cartões e os dias de fechamento primeiro.");
        if (!confirm("Isso atualizará a fatura (competência) apenas das despesas de Cartão de Crédito aplicando o Dia de Fechamento cadastrado em cada cartão (contas correntes não serão alteradas). Deseja continuar?")) return;

        const lancamentos = await DB.getAll("lancamentos");
        let alterados = 0;

        for (const l of lancamentos) {
            if (l.tipo !== "Despesa") continue;
            const matchCard = cartoes.find(c => c.nome.toLowerCase() === String(l.conta || "").toLowerCase());
            if (!matchCard) continue;

            const novaComp = Services.calcularCompetenciaCartao(l.data, matchCard.nome, cartoes, "Despesa");
            if (l.competencia !== novaComp) {
                await DB.update("lancamentos", l.id, { competencia: novaComp });
                alterados++;
            }
        }

        UICommon.alert(`Pronto! ${alterados} lançamento(s) de cartão tiveram a fatura ajustada conforme o dia de fechamento.`);
        UI2.renderFaturas();
        UI1.renderExtrato();
        UI1.renderDashboard();
    },

    pagarFatura: async function(cartao, mes, restanteCents) {
        if (restanteCents <= 0) return UICommon.alert("Esta fatura já consta como integralmente paga!");
        if (confirm(`Confirmar o pagamento integral da fatura de ${cartao} (${mes}) no valor de ${Services.formatBRL(restanteCents)}?`)) {
            const lancamentos = await DB.getAll("lancamentos");
            const gastos = lancamentos.filter(l => l.conta === cartao && (l.competencia || Services.getCompetencia(l.data)) === mes && l.tipo === 'Despesa');
            
            for (let l of gastos) {
                if (l.status === 'pendente') {
                    await DB.update("lancamentos", l.id, { status: 'pago' });
                }
            }
            await DB.add("pag_faturas", { cartao, fechamento: mes, valor_cents: restanteCents, data_pagto: new Date().toISOString().split('T')[0], conta_origem: "Conta Corrente" });
            UICommon.alert("Fatura liquidada com sucesso!");
            UI2.renderFaturas();
            UI1.renderDashboard();
        }
    },

    // ---- PESQUISA GLOBAL COMPLETA (8 FILTROS DE ui5.py) ----
    initPesquisa: async function() {
        const cats = await DB.getAll("categorias");
        const contas = await DB.getAll("contas");
        const cartoes = await DB.getAll("cartoes");

        document.getElementById('p-cat').innerHTML = '<option value="todas">Todas as Categorias</option>' + cats.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
        document.getElementById('p-conta').innerHTML = '<option value="todas">Todas as Contas/Cartões</option>' + contas.map(c => `<option value="${c.nome}">${c.nome}</option>`).concat(cartoes.map(c => `<option value="${c.nome}">${c.nome}</option>`)).join('');
        this.pesquisar();
    },

    limparPesquisa: function() {
        document.getElementById('p-q').value = '';
        document.getElementById('p-de').value = '';
        document.getElementById('p-ate').value = '';
        document.getElementById('p-val').value = '';
        document.getElementById('p-cat').value = 'todas';
        document.getElementById('p-conta').value = 'todas';
        document.getElementById('p-status').value = 'todos';
        document.getElementById('p-parc').value = 'todas';
        this.pesquisar();
    },

    pesquisar: async function() {
        const q = (document.getElementById('p-q') ? document.getElementById('p-q').value : '').toLowerCase().trim();
        const de = (document.getElementById('p-de') ? document.getElementById('p-de').value : '') || '0000-00-00';
        const ate = (document.getElementById('p-ate') ? document.getElementById('p-ate').value : '') || '9999-99-99';
        const valStr = document.getElementById('p-val') ? document.getElementById('p-val').value.trim() : '';
        const valExato = valStr ? Math.abs(Services.parseBRL(valStr)) : null;
        const cat = document.getElementById('p-cat') ? document.getElementById('p-cat').value : 'todas';
        const conta = document.getElementById('p-conta') ? document.getElementById('p-conta').value : 'todas';
        const status = document.getElementById('p-status') ? document.getElementById('p-status').value : 'todos';
        const parc = document.getElementById('p-parc') ? document.getElementById('p-parc').value : 'todas';

        const lancamentos = await DB.getAll("lancamentos");
        const hits = lancamentos.filter(l => {
            if (l.data < de || l.data > ate) return false;
            if (valExato !== null && l.valor_cents !== valExato) return false;
            if (cat !== 'todas' && l.categoria !== cat) return false;
            if (conta !== 'todas' && l.conta !== conta) return false;
            if (status !== 'todos' && l.status !== status) return false;
            if (parc === 'somente') {
                const isP = l.origem === 'parcela' || /\(\d+\s*(?:de|\/)\s*\d+\)/i.test(l.item);
                if (!isP) return false;
            }
            if (q) {
                const matchTxt = (l.item || '').toLowerCase().includes(q) || (l.categoria || '').toLowerCase().includes(q) || (l.conta || '').toLowerCase().includes(q);
                if (!matchTxt) return false;
            }
            return true;
        }).sort((a,b) => b.data.localeCompare(a.data));

        const total = hits.reduce((acc, l) => acc + l.valor_cents, 0);
        const lbl = document.getElementById('search-summary');
        if (lbl) lbl.innerText = `${hits.length} resultado(s) • Total somado: ${Services.formatBRL(total)}`;

        const resultsDiv = document.getElementById('search-results');
        if (!resultsDiv) return;
        resultsDiv.innerHTML = hits.slice(0, 200).map(l => `
            <div class="list-item">
                <div class="list-item-left">
                    <span class="list-item-title">${UICommon.esc(l.item)}</span>
                    <span class="list-item-sub">${Services.fmtData(l.data)} • ${UICommon.esc(l.categoria)} • ${UICommon.esc(l.conta)} • <span class="st ${l.status}">${l.status}</span></span>
                </div>
                <div class="list-item-val ${l.tipo === 'Receita' ? 'rec' : 'des'}">${Services.formatBRL(l.valor_cents)}</div>
                <div class="action-buttons">
                    <button class="btn-secondary btn-small" onclick="UI5.abrirNoExtrato('${l.data}')">Abrir no Extrato</button>
                    <button class="btn-primary btn-small" onclick="UI5.abrirEdicao(${l.id})">Editar</button>
                    <button class="btn-danger btn-small" onclick="UI5.excluirLancamento(${l.id})">Excluir</button>
                </div>
            </div>
        `).join('');
    },

    abrirNoExtrato: function(dataIso) {
        const comp = dataIso.substring(0, 7);
        document.getElementById('extrato-mes').value = comp;
        UICommon.showView('view-Extrato', 'Extrato');
        UI1.renderExtrato();
    },

    // ---- PLANEJAMENTO MENSAL (PROJEÇÃO DE 12 MESES) ----
    renderPlanejamento: async function() {
        const compAtual = new Date().toISOString().substring(0, 7);
        const fixas = (await DB.getAll("fixas")).filter(f => f.ativa);
        const fixasRecMes = fixas.filter(f => f.tipo === 'Receita').reduce((acc, f) => acc + f.valor_cents, 0);
        const fixasDesMes = fixas.filter(f => f.tipo !== 'Receita').reduce((acc, f) => acc + f.valor_cents, 0);

        const dZero = await Services.dadosCompletosMes(compAtual);
        let caixaAcumulado = dZero.disponivelGastar;

        let html = '';
        for (let i = 0; i < 12; i++) {
            let pMes = Services.addMonths(compAtual, i);
            let d = await Services.dadosCompletosMes(pMes);
            
            // Soma fixas ainda não geradas nos meses futuros
            let recProj = d.receitasMes + (i > 0 && d.fixasQtd === 0 ? fixasRecMes : 0);
            let desProj = d.despesasMes + (i > 0 && d.fixasQtd === 0 ? fixasDesMes : 0);
            let saldoMesProj = recProj - desProj;
            if (i > 0) caixaAcumulado += saldoMesProj;

            html += `
                <div class="list-item">
                    <div class="list-item-left">
                        <span class="list-item-title">Competência ${pMes.slice(5,7)}/${pMes.slice(0,4)}</span>
                        <span class="list-item-sub">Receitas Prev: <b style="color:var(--success)">${Services.formatBRL(recProj)}</b> • Despesas/Parcelas: <b style="color:var(--danger)">${Services.formatBRL(desProj)}</b></span>
                        <span class="list-item-sub">Saldo projetado acumulado: <b>${Services.formatBRL(caixaAcumulado)}</b></span>
                    </div>
                    <div class="list-item-val ${saldoMesProj >= 0 ? 'rec' : 'des'}">
                        ${saldoMesProj >= 0 ? '+' : ''}${Services.formatBRL(saldoMesProj)}
                    </div>
                </div>
            `;
        }
        document.getElementById('plan-list').innerHTML = html;
    },

    // ---- RELATÓRIOS CONSOLIDADOS ----
    gerarRelatorio: async function() {
        const tipo = document.getElementById('rel-tipo').value;
        const ano = document.getElementById('rel-ano').value || new Date().getFullYear();
        const lancamentos = await DB.getAll("lancamentos");
        const categorias = await DB.getAll("categorias");
        
        let html = '';
        if (tipo === 'anual') {
            let totRecAno = 0, totDesAno = 0;
            for (let m = 1; m <= 12; m++) {
                let comp = `${ano}-${String(m).padStart(2, '0')}`;
                let rec = 0, des = 0;
                lancamentos.forEach(l => {
                    if ((l.competencia || Services.getCompetencia(l.data)) === comp) {
                        if (l.tipo === 'Receita') rec += l.valor_cents;
                        else des += l.valor_cents;
                    }
                });
                totRecAno += rec; totDesAno += des;
                const saldo = rec - des;
                html += `
                    <div class="list-item">
                        <div class="list-item-left">
                            <span class="list-item-title">Mês ${String(m).padStart(2, '0')}/${ano}</span>
                            <span class="list-item-sub">Receitas: ${Services.formatBRL(rec)} • Despesas: ${Services.formatBRL(des)}</span>
                        </div>
                        <div class="list-item-val ${saldo >= 0 ? 'rec' : 'des'}">${Services.formatBRL(saldo)}</div>
                    </div>
                `;
            }
            html = `<div class="card" style="background:#f8fafc;"><b>Consolidado ${ano}:</b> Receitas: <span style="color:var(--success)">${Services.formatBRL(totRecAno)}</span> | Despesas: <span style="color:var(--danger)">${Services.formatBRL(totDesAno)}</span> | Líquido: <b>${Services.formatBRL(totRecAno - totDesAno)}</b></div>` + html;
        } else if (tipo === 'mensal') {
            const comp = new Date().toISOString().substring(0, 7);
            const d = await Services.dadosCompletosMes(comp);
            html = `
                <div class="card">
                    <h4>Resumo Inteligente (${comp})</h4>
                    <p style="font-size:0.88rem;line-height:1.6;">
                        • <b>Receitas Totais:</b> ${Services.formatBRL(d.receitasMes)}<br>
                        • <b>Despesas Totais:</b> ${Services.formatBRL(d.despesasMes)} (Pagas: ${Services.formatBRL(d.desPagasMes)} / Pendentes: ${Services.formatBRL(d.desPendentesMes)})<br>
                        • <b>Comprometimento em Parcelas:</b> ${d.parcQtd} parcela(s) somando ${Services.formatBRL(d.parcTotal)}<br>
                        • <b>Custos Fixos no Mês:</b> ${d.fixasQtd} conta(s) somando ${Services.formatBRL(d.fixasTotal)}
                    </p>
                </div>
            `;
        } else if (tipo === 'limites') {
            const comp = new Date().toISOString().substring(0, 7);
            const d = await Services.dadosCompletosMes(comp);
            const estouradas = d.catsList.filter(c => c.limite > 0 && c.gasto > c.limite);
            html = estouradas.map(c => `
                <div class="list-item" style="border-left:4px solid var(--danger);">
                    <div class="list-item-left">
                        <span class="list-item-title">${UICommon.esc(c.nome)}</span>
                        <span class="list-item-sub">Limite estipulado: ${Services.formatBRL(c.limite)} • Excesso: +${Services.formatBRL(c.gasto - c.limite)}</span>
                    </div>
                    <div class="list-item-val des">${Services.formatBRL(c.gasto)}</div>
                </div>
            `).join('') || '<div class="card" style="color:var(--success);font-weight:600;">✓ Nenhuma categoria ultrapassou o limite neste mês!</div>';
        }
        document.getElementById('rel-list').innerHTML = html;
    }
};
