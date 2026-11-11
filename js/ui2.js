// js/ui2.js - Contas, Cartões (com Logos), Faturas, Parcelamentos (Adiantar/Cancelar) e Contas Fixas (Receita/Despesa)
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
        const limite_cents = Math.abs(Services.parseBRL(document.getElementById('k-lim').value));
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
        const lancamentos = await DB.getAll("lancamentos");
        const pagFaturas = await DB.getAll("pag_faturas");
        
        document.getElementById('k-pagto').innerHTML = contas.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
        
        document.getElementById('contas-list').innerHTML = contas.map(c => `
            <div class="list-item">
                <div class="list-item-left"><span class="list-item-title">${UICommon.esc(c.nome)}</span><span class="list-item-sub">Tipo: ${c.tipo}</span></div>
                <div class="list-item-val">Inicial: ${Services.formatBRL(c.saldo_inicial_cents)}</div>
                <div class="action-buttons">
                    <button class="btn-primary btn-small" onclick="UI5.abrirEdicaoGenerica('contas', ${c.id})">Editar</button>
                    <button class="btn-danger btn-small" onclick="UI5.excluirGenerico('contas', ${c.id}, 'UI2.renderContasCartoes()')">Excluir</button>
                </div>
            </div>
        `).join('');

        document.getElementById('cartoes-list').innerHTML = cartoes.map(c => {
            const gastos = lancamentos.filter(l => l.conta === c.nome && l.tipo === "Despesa").reduce((acc, l) => acc + l.valor_cents, 0);
            const pagos = pagFaturas.filter(p => p.cartao === c.nome).reduce((acc, p) => acc + p.valor_cents, 0);
            const comp = Math.max(0, gastos - pagos);
            const disp = Math.max(0, (c.limite_cents || 0) - comp);
            return `
                <div class="cartao-card" style="flex-wrap:wrap;">
                    <div>${Logos.getLogoHTML(c.nome)}</div>
                    <div style="flex:1;min-width:160px;">
                        <div class="list-item-title">${UICommon.esc(c.nome)}</div>
                        <div class="list-item-sub">Fecha dia ${c.fechamento}${c.vencimento ? ' • Vence dia ' + c.vencimento : ''} • Pagto: ${UICommon.esc(c.conta_pagto)}</div>
                        <div class="list-item-sub">Limite: <b>${Services.formatBRL(c.limite_cents)}</b> • Disp: <b style="color:var(--success)">${Services.formatBRL(disp)}</b></div>
                    </div>
                    <div class="action-buttons">
                        <button class="btn-primary btn-small" onclick="UI5.abrirEdicaoGenerica('cartoes', ${c.id})">Editar</button>
                        <button class="btn-danger btn-small" onclick="UI5.excluirGenerico('cartoes', ${c.id}, 'UI2.renderContasCartoes()')">Excluir</button>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    saveFixa: async function(e) {
        e.preventDefault();
        const descricao = document.getElementById('f-desc').value.trim();
        const tipo = document.getElementById('f-tipo') ? document.getElementById('f-tipo').value : 'Despesa';
        const valor_cents = Math.abs(Services.parseBRL(document.getElementById('f-val').value));
        const dia_venc = parseInt(document.getElementById('f-dia').value);
        const categoria = document.getElementById('f-cat').value;
        const conta = document.getElementById('f-conta').value;
        const data_ini = new Date().toISOString().substring(0, 7) + '-01'; 
        
        await DB.add("fixas", { descricao, tipo, categoria, valor_cents, dia_venc, data_ini, conta, ativa: 1 });
        UICommon.alert(`Conta Fixa '${descricao}' (${tipo}) salva!`);
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
            <div class="list-item">
                <div class="list-item-left">
                    <span class="list-item-title">${UICommon.esc(f.descricao)} <span class="st ${f.tipo === 'Receita' ? 'pago' : 'pendente'}">${f.tipo || 'Despesa'}</span></span>
                    <span class="list-item-sub">Todo dia ${f.dia_venc} • ${UICommon.esc(f.categoria)} • ${UICommon.esc(f.conta)}</span>
                </div>
                <div class="list-item-val ${f.tipo === 'Receita' ? 'rec' : 'des'}">${Services.formatBRL(f.valor_cents)}</div>
                <div class="action-buttons">
                    <button class="btn-primary btn-small" onclick="UI5.abrirEdicaoGenerica('fixas', ${f.id})">Editar</button>
                    <button class="btn-danger btn-small" onclick="UI5.excluirGenerico('fixas', ${f.id}, 'UI2.renderFixas()')">Excluir</button>
                </div>
            </div>
        `).join('') || '<div style="color:var(--text-muted);font-size:0.85rem;">Nenhuma conta fixa cadastrada.</div>';
    },

    gerarFixasMes: async function() {
        const fixas = await DB.getAll("fixas");
        const lancamentos = await DB.getAll("lancamentos");
        const comp = new Date().toISOString().substring(0, 7);
        let count = 0;
        for (let f of fixas) {
            if (f.ativa) {
                const dataVenc = `${comp}-${String(f.dia_venc).padStart(2, '0')}`;
                const jaExiste = lancamentos.some(l => l.competencia === comp && l.item === f.descricao && l.origem === "fixa");
                if (!jaExiste) {
                    await DB.add("lancamentos", {
                        data: dataVenc, competencia: comp, item: f.descricao,
                        tipo: f.tipo || "Despesa", valor_cents: f.valor_cents,
                        categoria: f.categoria, conta: f.conta, status: "pendente", origem: "fixa",
                        hash: Services.contentHash(dataVenc, f.descricao, f.tipo || "Despesa", f.categoria, f.conta, f.valor_cents)
                    });
                    count++;
                }
            }
        }
        UICommon.alert(`${count} nova(s) previsão(ões) fixa(s) gerada(s) para ${comp}!`);
    },

    renderFaturas: async function() {
        const mes = document.getElementById('faturas-mes').value;
        if (!mes) return;

        const cartoes = await DB.getAll("cartoes");
        const lancamentos = await DB.getAll("lancamentos");
        const pagFaturas = await DB.getAll("pag_faturas");
        
        let html = '';
        for (const c of cartoes) {
            const gastos = lancamentos.filter(l => l.conta === c.nome && (l.competencia || Services.getCompetencia(l.data)) === mes && l.tipo === 'Despesa');
            const totalCents = gastos.reduce((acc, l) => acc + l.valor_cents, 0);
            const pagosCents = pagFaturas.filter(p => p.cartao === c.nome && p.fechamento === mes).reduce((acc, p) => acc + p.valor_cents, 0);
            const restante = Math.max(0, totalCents - pagosCents);

            const itensHTML = gastos.map(g => `
                <div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:4px 0;border-bottom:1px solid #f4f4f5;">
                    <span>${Services.fmtData(g.data)} • ${UICommon.esc(g.item)}</span>
                    <b>${Services.formatBRL(g.valor_cents)} <span class="st ${g.status}">${g.status}</span></b>
                </div>
            `).join('');

            html += `
                <div class="card">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="display:flex;align-items:center;gap:10px;">
                            ${Logos.getLogoHTML(c.nome)}
                            <div>
                                <div class="list-item-title">${UICommon.esc(c.nome)} (${mes})</div>
                                <div class="list-item-sub">Total: <b>${Services.formatBRL(totalCents)}</b> • Pago: <b style="color:var(--success)">${Services.formatBRL(pagosCents)}</b></div>
                            </div>
                        </div>
                        <div class="list-item-val des">${Services.formatBRL(restante)}</div>
                    </div>
                    <details class="det" style="margin-top:10px;">
                        <summary style="font-size:0.8rem;font-weight:600;color:var(--primary);">Ver ${gastos.length} lançamento(s) desta fatura</summary>
                        <div style="margin-top:8px;">${itensHTML || 'Sem compras neste mês.'}</div>
                    </details>
                    <div class="action-buttons">
                        <button class="btn-primary btn-small" onclick="UI5.pagarFatura('${c.nome}', '${mes}', ${restante})">Pagar Total (${Services.formatBRL(restante)})</button>
                        <button class="btn-secondary btn-small" onclick="UI2.pagarFaturaParcial('${c.nome}', '${mes}')">Pagamento Parcial</button>
                    </div>
                </div>
            `;
        }
        document.getElementById('faturas-list').innerHTML = html || '<div style="color:var(--text-muted);">Nenhum cartão cadastrado.</div>';
    },

    pagarFaturaParcial: async function(cartao, mes) {
        const valStr = prompt(`Digite o valor parcial pago na fatura de ${cartao} (${mes}):`, "0,00");
        if (!valStr) return;
        const cents = Math.abs(Services.parseBRL(valStr));
        if (cents <= 0) return UICommon.alert("Valor inválido.");
        await DB.add("pag_faturas", { cartao, fechamento: mes, valor_cents: cents, data_pagto: new Date().toISOString().split('T')[0], conta_origem: "Conta Corrente" });
        UICommon.alert(`Pagamento parcial de ${Services.formatBRL(cents)} registrado!`);
        this.renderFaturas();
    },
    
    renderParcelamentos: async function() {
        const grupos = await DB.getAll("grupos_parc");
        const lancamentos = await DB.getAll("lancamentos");

        // Também agrupa parcelamentos vindos de importação (ex: Roupas (3/4)) que não tinham grupo_id
        document.getElementById('parcelas-list').innerHTML = grupos.map(g => {
            const parcs = lancamentos.filter(l => Number(l.grupo_id) === Number(g.id)).sort((a,b) => (a.numero||0) - (b.numero||0));
            const pendentes = parcs.filter(p => p.status !== 'pago');
            const somaPend = pendentes.reduce((acc, p) => acc + p.valor_cents, 0);
            const listaP = parcs.map(p => `<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0;border-bottom:1px solid #f4f4f5;"><span>Parcela ${p.numero}/${g.n} (${Services.fmtData(p.data)})</span><span><b>${Services.formatBRL(p.valor_cents)}</b> <span class="st ${p.status}">${p.status}</span></span></div>`).join('');

            return `
                <div class="card">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div class="list-item-title">${UICommon.esc(g.descricao)} (${g.n}x)</div>
                            <div class="list-item-sub">${UICommon.esc(g.conta)} • Restam ${pendentes.length} parcela(s): <b>${Services.formatBRL(somaPend)}</b></div>
                        </div>
                        <div class="list-item-val des">${Services.formatBRL(g.total_cents)}</div>
                    </div>
                    <details class="det" style="margin-top:8px;">
                        <summary style="font-size:0.8rem;font-weight:600;color:var(--primary);">Ver cronograma de parcelas</summary>
                        <div style="margin-top:6px;">${listaP}</div>
                    </details>
                    <div class="action-buttons">
                        <button class="btn-success btn-small" onclick="UI2.adiantarParcelas(${g.id})">Adiantar Pendentes (Dar Baixa)</button>
                        <button class="btn-warning btn-small" onclick="UI2.cancelarParcelasFuturas(${g.id})">Cancelar Futuras</button>
                        <button class="btn-danger btn-small" onclick="UI5.excluirGenerico('grupos_parc', ${g.id}, 'UI2.renderParcelamentos()')">Excluir Grupo</button>
                    </div>
                </div>
            `;
        }).join('') || '<div style="color:var(--text-muted);font-size:0.85rem;">Nenhum grupo de parcelamento ativo.</div>';
    },

    adiantarParcelas: async function(grupoId) {
        if (!confirm("Deseja quitar/adiantar todas as parcelas pendentes deste parcelamento?")) return;
        const lancamentos = await DB.getAll("lancamentos");
        const parcs = lancamentos.filter(l => Number(l.grupo_id) === Number(grupoId) && l.status !== 'pago');
        for (const p of parcs) {
            await DB.update("lancamentos", p.id, { status: 'pago' });
        }
        UICommon.alert(`${parcs.length} parcela(s) marcada(s) como pagas!`);
        this.renderParcelamentos();
    },

    cancelarParcelasFuturas: async function(grupoId) {
        if (!confirm("Deseja cancelar e remover do extrato todas as parcelas ainda pendentes deste grupo?")) return;
        const lancamentos = await DB.getAll("lancamentos");
        const parcs = lancamentos.filter(l => Number(l.grupo_id) === Number(grupoId) && l.status !== 'pago');
        for (const p of parcs) {
            await DB.delete("lancamentos", p.id);
        }
        UICommon.alert(`${parcs.length} parcela(s) futura(s) cancelada(s) e excluída(s)!`);
        this.renderParcelamentos();
    }
};
