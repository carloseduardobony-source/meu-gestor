// js/ui1.js - Dashboard Completo (Logos, Gráficos, Barras, Alertas), Extrato e Novo Lançamento
const UI1 = {
    dashMesAtual: new Date().toISOString().substring(0, 7),

    renderDashboard: async function(compOverride) {
        if (compOverride) this.dashMesAtual = compOverride;
        const comp = this.dashMesAtual;

        // Gera pílulas de meses (últimos 4, atual e próximos 3)
        const baseComp = new Date().toISOString().substring(0, 7);
        const mesesPills = [];
        for (let k = -4; k <= 3; k++) mesesPills.push(Services.addMonths(baseComp, k));
        if (!mesesPills.includes(comp)) mesesPills.push(comp);
        mesesPills.sort();

        const pillsEl = document.getElementById('dash-pills');
        if (pillsEl) {
            pillsEl.innerHTML = mesesPills.map(m => `<button class="pill ${m === comp ? 'on' : ''}" onclick="UI1.renderDashboard('${m}')">${m.slice(5,7)}/${m.slice(0,4)}</button>`).join('');
        }

        const d = await Services.dadosCompletosMes(comp);

        // Topo: Disponível, Realizado em Caixa, Reservado em Metas
        document.getElementById('h-disp').innerText = Services.formatBRL(d.disponivelGastar);
        document.getElementById('h-disp').className = 'kpi-value lg ' + (d.disponivelGastar >= 0 ? 'rec' : 'des');
        document.getElementById('h-real').innerText = Services.formatBRL(d.realizadoCaixa);
        document.getElementById('h-res').innerText = Services.formatBRL(d.reservadoMetas);

        // 8 KPIs da Grade Principal
        document.getElementById('kpi-receitas').innerText = Services.formatBRL(d.receitasMes);
        document.getElementById('kpi-despesas').innerText = Services.formatBRL(d.despesasMes);
        document.getElementById('kpi-saldo').innerText = Services.formatBRL(d.saldoMes);
        document.getElementById('kpi-pagas').innerText = Services.formatBRL(d.desPagasMes);
        document.getElementById('kpi-pendentes').innerText = Services.formatBRL(d.desPendentesMes);
        document.getElementById('kpi-faturas').innerText = Services.formatBRL(d.fatPendenteMes);
        document.getElementById('kpi-fixas').innerText = `${d.fixasQtd} • ${Services.formatBRL(d.fixasTotal)}`;
        document.getElementById('kpi-parcelas').innerText = `${d.parcQtd} • ${Services.formatBRL(d.parcTotal)}`;

        // A Pagar e A Receber
        document.getElementById('dash-pagar').innerHTML = d.aPagar.slice(0, 8).map(l => `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;padding:6px 0;border-bottom:1px solid #f4f4f5;">
                <span><b>${UICommon.esc(l.item)}</b> <span style="color:var(--text-muted)">(${Services.fmtData(l.data)})</span></span>
                <span style="display:flex;align-items:center;gap:6px;">
                    <b style="color:var(--danger)">${Services.formatBRL(l.valor_cents)}</b>
                    <button class="btn-success btn-small" style="padding:3px 7px;font-size:0.7rem;" onclick="UI1.darBaixaRapida(${l.id})">✓</button>
                </span>
            </div>
        `).join('') || '<span style="color:var(--text-muted);font-size:0.82rem;">Nada pendente a pagar neste mês.</span>';

        document.getElementById('dash-receber').innerHTML = d.aReceber.slice(0, 8).map(r => `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;padding:6px 0;border-bottom:1px solid #f4f4f5;">
                <span><b>${UICommon.esc(r.desc)}</b> <span style="color:var(--text-muted)">(${Services.fmtData(r.data)})</span></span>
                <b style="color:var(--success)">${Services.formatBRL(r.valor_cents)}</b>
            </div>
        `).join('') || '<span style="color:var(--text-muted);font-size:0.82rem;">Nada pendente a receber neste mês.</span>';

        // Gráfico de Evolução Suave (Catmull-Rom)
        Charts.renderTendenciaSVG('dash-evo-chart', d.evo);

        // Despesas por Categoria com Barra de Progresso e Expansão (Details)
        const catsActive = d.catsList.filter(c => c.gasto > 0 || c.limite > 0);
        document.getElementById('dash-cats').innerHTML = catsActive.map(c => {
            const pct = c.limite > 0 ? Math.min(100, Math.round((c.gasto / c.limite) * 100)) : (c.gasto > 0 ? 100 : 0);
            const estourou = c.limite > 0 && c.gasto > c.limite;
            const detRows = c.itens.map(it => `<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0;border-top:1px solid #f4f4f5;"><span>${Services.fmtData(it.data)} • ${UICommon.esc(it.item)}</span><b>${Services.formatBRL(it.valor_cents)}</b></div>`).join('');
            return `
                <details class="det">
                    <summary>
                        <div style="display:flex;justify-content:space-between;font-size:0.85rem;font-weight:600;">
                            <span>${UICommon.esc(c.nome)}</span>
                            <span style="color:${estourou ? 'var(--danger)' : 'var(--text-main)'}">${Services.formatBRL(c.gasto)}</span>
                        </div>
                        <div class="bar"><i class="${estourou ? 'danger' : ''}" style="width:${pct}%"></i></div>
                        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px;display:flex;justify-content:space-between;">
                            <span>${c.limite > 0 ? 'Limite: ' + Services.formatBRL(c.limite) : 'Sem limite definido'}</span>
                            <span>${c.limite > 0 ? pct + '%' : ''}</span>
                        </div>
                    </summary>
                    <div style="margin-top:8px;">${detRows || '<span style="font-size:0.75rem;color:var(--text-muted);">Sem lançamentos no mês.</span>'}</div>
                </details>
            `;
        }).join('') || '<span style="color:var(--text-muted);font-size:0.82rem;">Sem despesas registradas no mês.</span>';

        // Alertas
        const ic = { erro: '⛔', atencao: '⚠️', info: 'ℹ️' };
        document.getElementById('dash-alertas').innerHTML = d.alertas.map(a => `
            <div class="al ${a.nivel}">${ic[a.nivel] || '•'} ${UICommon.esc(a.msg)}</div>
        `).join('') || '<span style="color:var(--success);font-size:0.85rem;font-weight:600;">✓ Tudo sob controle neste mês!</span>';

        // Metas no Dashboard
        document.getElementById('dash-metas').innerHTML = d.metasCalc.map(m => {
            const pct = m.objetivo_cents > 0 ? Math.min(100, Math.round((m.acumulado_cents / m.objetivo_cents) * 100)) : 0;
            return `
                <div style="margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;font-size:0.84rem;font-weight:600;">
                        <span>${UICommon.esc(m.nome)}</span>
                        <span>${Services.formatBRL(m.acumulado_cents)} de ${Services.formatBRL(m.objetivo_cents)} (${pct}%)</span>
                    </div>
                    <div class="bar"><i class="success" style="width:${pct}%"></i></div>
                </div>
            `;
        }).join('') || '<span style="color:var(--text-muted);font-size:0.82rem;">Nenhuma meta cadastrada.</span>';

        // Cartões de Crédito com Logos SVG
        document.getElementById('dash-cartoes').innerHTML = d.cartoesDetalhe.map(k => `
            <div class="cartao-card">
                <div>${k.logo}</div>
                <div style="flex:1;">
                    <div style="font-weight:700;font-size:0.95rem;">${UICommon.esc(k.nome)}</div>
                    <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">
                        ${k.limite_cents ? `Disponível: <b style="color:var(--success)">${Services.formatBRL(k.disponivel)}</b> de ${Services.formatBRL(k.limite_cents)} • Comprometido: <b style="color:var(--danger)">${Services.formatBRL(k.comprometido)}</b>` : `Comprometido total: <b>${Services.formatBRL(k.comprometido)}</b>`}
                    </div>
                    <div style="font-size:0.8rem;margin-top:3px;">
                        Fatura (${comp}): <b style="color:var(--danger)">${Services.formatBRL(k.faturaMes.total)}</b> 
                        <span class="st ${k.faturaMes.status === 'paga' ? 'pago' : 'pendente'}">${k.faturaMes.status}</span>
                        <span style="color:var(--text-muted);font-size:0.75rem;"> • Fecha dia ${k.fechamento}${k.vencimento ? ' / Vence dia ' + k.vencimento : ''}</span>
                    </div>
                </div>
            </div>
        `).join('') || '<span style="color:var(--text-muted);font-size:0.82rem;">Nenhum cartão cadastrado.</span>';
    },

    darBaixaRapida: async function(id) {
        await DB.update("lancamentos", id, { status: "pago" });
        this.renderDashboard();
    },

    renderExtrato: async function() {
        let lancamentos = await DB.getAll("lancamentos");
        let mesExtrato = document.getElementById('extrato-mes').value;
        if (!mesExtrato) {
            mesExtrato = new Date().toISOString().substring(0, 7);
            document.getElementById('extrato-mes').value = mesExtrato;
        }
        const filtroConta = document.getElementById('extrato-conta') ? document.getElementById('extrato-conta').value : 'todas';

        // Popula filtro de contas no extrato
        const contas = await DB.getAll("contas");
        const cartoes = await DB.getAll("cartoes");
        const selConta = document.getElementById('extrato-conta');
        if (selConta && selConta.options.length <= 1) {
            const opts = ['<option value="todas">Todas as Contas/Cartões</option>']
                .concat(contas.map(c => `<option value="${c.nome}">${c.nome}</option>`))
                .concat(cartoes.map(c => `<option value="${c.nome}">${c.nome}</option>`));
            selConta.innerHTML = opts.join('');
            selConta.value = filtroConta;
        }

        lancamentos = lancamentos.filter(l => (l.competencia || Services.getCompetencia(l.data)) === mesExtrato && (filtroConta === 'todas' || l.conta === filtroConta));
        lancamentos.sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);

        const totalMes = lancamentos.reduce((acc, l) => acc + (l.tipo === 'Receita' ? l.valor_cents : -l.valor_cents), 0);
        document.getElementById('extrato-resumo').innerText = `${lancamentos.length} lançamento(s) • Resultado líquido: ${Services.formatBRL(totalMes)}`;

        document.getElementById('extrato-list').innerHTML = lancamentos.map(l => `
            <div class="list-item">
                <div class="list-item-left">
                    <span class="list-item-title">${UICommon.esc(l.item)}</span>
                    <span class="list-item-sub">${Services.fmtData(l.data)} • ${UICommon.esc(l.categoria)} • ${UICommon.esc(l.conta)}</span>
                    <div style="margin-top:4px;"><span class="st ${l.status}">${l.status}</span> ${l.origem ? `<span class="st">${l.origem}</span>` : ''}</div>
                </div>
                <div class="list-item-val ${l.tipo === 'Receita' ? 'rec' : 'des'}">
                    ${l.tipo === 'Receita' ? '+' : '-'}${Services.formatBRL(l.valor_cents)}
                </div>
                <div class="action-buttons">
                    <button class="btn-success btn-small" onclick="UI1.alternarStatus(${l.id}, '${l.status}')">${l.status === 'pago' ? 'Marcar Pendente' : 'Dar Baixa (Pago)'}</button>
                    <button class="btn-primary btn-small" onclick="UI5.abrirEdicao(${l.id})">Editar</button>
                    <button class="btn-danger btn-small" onclick="UI5.excluirLancamento(${l.id})">Excluir</button>
                </div>
            </div>
        `).join('') || '<div class="card" style="text-align:center;color:var(--text-muted);">Nenhum lançamento neste mês.</div>';
    },

    alternarStatus: async function(id, statusAtual) {
        const novo = statusAtual === 'pago' ? 'pendente' : 'pago';
        await DB.update("lancamentos", id, { status: novo });
        this.renderExtrato();
    },

    populateNovoLancamento: async function() {
        const cats = await DB.getAll("categorias");
        const contas = await DB.getAll("contas");
        const cartoes = await DB.getAll("cartoes");
        
        document.getElementById("novo-categoria").innerHTML = cats.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
        let allAcc = contas.map(c => `<option value="${c.nome}">${c.nome}</option>`).concat(cartoes.map(c => `<option value="${c.nome}">${c.nome}</option>`));
        document.getElementById("novo-conta").innerHTML = allAcc.join('');
        if (!document.getElementById("novo-data").value) {
            document.getElementById("novo-data").valueAsDate = new Date();
        }
        const elComp = document.getElementById("novo-competencia");
        if (elComp) elComp.value = '';
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
        const elComp = document.getElementById('novo-competencia');
        const compManual = elComp ? elComp.value : '';
        const isParcela = document.getElementById('novo-is-parcela').checked;
        
        // Base da competência (se o usuário escolheu manual, usa ela; senão pega o ano-mês da data)
        let baseComp = compManual ? compManual : dataIso.substring(0, 7);
        
        if (isParcela) {
            const n = parseInt(document.getElementById('novo-parcelas').value || 2);
            const parcelasVals = Services.splitParcelas(cents, n);
            
            const grupoId = await DB.add("grupos_parc", { descricao: itemDesc, total_cents: cents, n, data_compra: dataIso, conta, categoria });
            
            let [anoData, mesData, diaData] = dataIso.split('-').map(Number);
            for (let i = 0; i < n; i++) {
                let pDate = new Date(anoData, (mesData - 1) + i, diaData);
                let pDateIso = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
                
                // Calcula competências incrementais mês a mês para as parcelas futuras
                let compParcela = Services.addMonths(baseComp, i);

                await DB.add("lancamentos", {
                    data: pDateIso,
                    competencia: compParcela,
                    item: `${itemDesc} (${i+1} de ${n})`,
                    tipo, valor_cents: parcelasVals[i], categoria, conta, status,
                    origem: 'parcela', grupo_id: grupoId, numero: i+1
                });
            }
            UICommon.alert(`Salvo parcelado em ${n}x! (1ª fatura em ${baseComp.slice(5,7)}/${baseComp.slice(0,4)})`);
        } else {
            await DB.add("lancamentos", {
                data: dataIso, competencia: baseComp, item: itemDesc,
                tipo, valor_cents: cents, categoria, conta, status, origem: 'manual'
            });
            UICommon.alert("Lançamento salvo!");
        }
        document.getElementById('form-novo').reset();
        document.getElementById('novo-parcelas-container').style.display = 'none';
        UI1.populateNovoLancamento();
        UI1.renderDashboard();
    }
};
