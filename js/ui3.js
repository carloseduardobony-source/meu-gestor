// js/ui3.js - Categorias (Barras de Limite), Metas (Aportes/Retiradas), Quem Me Deve (Parcelas/Baixas), Transferências, Importação Kontto e Exportações
const UI3 = {
    setupListeners: function() {
        document.getElementById('form-cat').addEventListener('submit', this.saveCategoria.bind(this));
        document.getElementById('form-meta').addEventListener('submit', this.saveMeta.bind(this));
        document.getElementById('form-transf').addEventListener('submit', this.saveTransferencia.bind(this));
        document.getElementById('form-qmd').addEventListener('submit', this.saveDivida.bind(this));
        
        document.getElementById('t-data').valueAsDate = new Date();
        document.getElementById('q-ini').valueAsDate = new Date();
    },

    // CATEGORIAS E LIMITES COM BARRA DE PROGRESSO MENSAL
    saveCategoria: async function(e) {
        e.preventDefault();
        const nome = document.getElementById('cat-nome').value.trim();
        const limiteStr = document.getElementById('cat-lim').value;
        const limite_cents = limiteStr ? Math.abs(Services.parseBRL(limiteStr)) : 0;
        
        await DB.add("categorias", { nome, limite_cents });
        UICommon.alert(`Categoria '${nome}' salva!`);
        document.getElementById('form-cat').reset();
        this.renderCategorias();
    },

    renderCategorias: async function() {
        const cats = await DB.getAll("categorias");
        const lancamentos = await DB.getAll("lancamentos");
        const compAtual = new Date().toISOString().substring(0, 7);

        document.getElementById('cats-list').innerHTML = cats.map(c => {
            const gastoMes = lancamentos
                .filter(l => (l.competencia || Services.getCompetencia(l.data)) === compAtual && l.tipo === "Despesa" && l.categoria === c.nome)
                .reduce((acc, l) => acc + l.valor_cents, 0);
            const lim = c.limite_cents || 0;
            const pct = lim > 0 ? Math.min(100, Math.round((gastoMes / lim) * 100)) : 0;
            const estourou = lim > 0 && gastoMes > lim;

            return `
                <div class="list-item">
                    <div class="list-item-left" style="width:100%;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span class="list-item-title">${UICommon.esc(c.nome)}</span>
                            <span class="list-item-val ${estourou ? 'des' : ''}">${Services.formatBRL(gastoMes)} / ${lim > 0 ? Services.formatBRL(lim) : 'Sem limite'}</span>
                        </div>
                        <div class="bar"><i class="${estourou ? 'danger' : ''}" style="width:${pct}%"></i></div>
                        <span class="list-item-sub">${lim > 0 ? `${pct}% utilizado no mês (${compAtual}) ${estourou ? '• LIMITE EXCEDIDO!' : ''}` : `Gasto no mês: ${Services.formatBRL(gastoMes)}`}</span>
                    </div>
                    <div class="action-buttons">
                        <button class="btn-primary btn-small" onclick="UI5.abrirEdicaoGenerica('categorias', ${c.id})">Editar Limite</button>
                        <button class="btn-danger btn-small" onclick="UI5.excluirGenerico('categorias', ${c.id}, 'UI3.renderCategorias()')">Excluir</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // METAS FINANCEIRAS COM APORTES, RETIRADAS E VALOR EXTERNO (mov_metas)
    saveMeta: async function(e) {
        e.preventDefault();
        const nome = document.getElementById('m-nome').value.trim();
        const objetivo_cents = Math.abs(Services.parseBRL(document.getElementById('m-obj').value));
        const extStr = document.getElementById('m-ext') ? document.getElementById('m-ext').value : "0";
        const valor_externo_cents = extStr ? Math.abs(Services.parseBRL(extStr)) : 0;
        const prazo = document.getElementById('m-prazo').value || null;
        
        await DB.add("metas", { nome, objetivo_cents, prazo, valor_externo_cents, ativa: 1 });
        UICommon.alert(`Meta '${nome}' criada!`);
        document.getElementById('form-meta').reset();
        this.renderMetas();
    },

    renderMetas: async function() {
        const metas = await DB.getAll("metas");
        const movMetas = await DB.getAll("mov_metas");

        document.getElementById('metas-list').innerHTML = metas.map(m => {
            const movs = movMetas.filter(mv => Number(mv.meta_id) === Number(m.id));
            const saldoInterno = movs.reduce((acc, mv) => acc + (mv.tipo === 'retirada' ? -mv.valor_cents : mv.valor_cents), 0);
            const totalAcumulado = Math.max(0, (parseInt(m.valor_externo_cents) || 0) + saldoInterno);
            const pct = m.objetivo_cents > 0 ? Math.min(100, Math.round((totalAcumulado / m.objetivo_cents) * 100)) : 0;

            const histHTML = movs.map(mv => `
                <div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:4px 0;border-bottom:1px solid #f4f4f5;">
                    <span>${Services.fmtData(mv.data)} • ${mv.tipo.toUpperCase()} ${mv.obs ? '('+UICommon.esc(mv.obs)+')' : ''}</span>
                    <b style="color:${mv.tipo === 'retirada' ? 'var(--danger)' : 'var(--success)'}">${mv.tipo === 'retirada' ? '-' : '+'}${Services.formatBRL(mv.valor_cents)}</b>
                </div>
            `).join('');

            return `
                <div class="card">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div class="list-item-title">${UICommon.esc(m.nome)}</div>
                            <div class="list-item-sub">Prazo: ${m.prazo ? Services.fmtData(m.prazo) : 'Sem prazo'} • Reserva em caixa: <b>${Services.formatBRL(Math.max(0, saldoInterno))}</b></div>
                        </div>
                        <div class="list-item-val" style="color:var(--purple)">${Services.formatBRL(totalAcumulado)} / ${Services.formatBRL(m.objetivo_cents)}</div>
                    </div>
                    <div class="bar"><i class="success" style="width:${pct}%"></i></div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">Progresso: ${pct}% concluído ${m.valor_externo_cents ? `(Inclui ${Services.formatBRL(m.valor_externo_cents)} externo)` : ''}</div>
                    <details class="det" style="margin-top:8px;">
                        <summary style="font-size:0.78rem;font-weight:600;color:var(--primary);">Histórico de Aportes e Retiradas (${movs.length})</summary>
                        <div style="margin-top:6px;">${histHTML || 'Nenhuma movimentação ainda.'}</div>
                    </details>
                    <div class="action-buttons">
                        <button class="btn-success btn-small" onclick="UI3.movimentarMeta(${m.id}, 'aporte')">+ Aportar</button>
                        <button class="btn-warning btn-small" onclick="UI3.movimentarMeta(${m.id}, 'retirada')">- Retirar</button>
                        <button class="btn-primary btn-small" onclick="UI5.abrirEdicaoGenerica('metas', ${m.id})">Editar</button>
                        <button class="btn-danger btn-small" onclick="UI5.excluirGenerico('metas', ${m.id}, 'UI3.renderMetas()')">Excluir</button>
                    </div>
                </div>
            `;
        }).join('') || '<div style="color:var(--text-muted);font-size:0.85rem;">Nenhuma meta financeira cadastrada.</div>';
    },

    movimentarMeta: async function(metaId, tipo) {
        const valStr = prompt(`Digite o valor em R$ para ${tipo.toUpperCase()} nesta meta:`, "100,00");
        if (!valStr) return;
        const cents = Math.abs(Services.parseBRL(valStr));
        if (cents <= 0) return UICommon.alert("Valor inválido.");
        const obs = prompt("Observação (opcional):", "") || "";
        await DB.add("mov_metas", {
            meta_id: Number(metaId),
            data: new Date().toISOString().split('T')[0],
            tipo,
            valor_cents: cents,
            obs
        });
        UICommon.alert(`${tipo.toUpperCase()} de ${Services.formatBRL(cents)} registrado com sucesso!`);
        this.renderMetas();
    },

    // TRANSFERÊNCIAS ENTRE CONTAS
    saveTransferencia: async function(e) {
        e.preventDefault();
        const data = document.getElementById('t-data').value;
        const origem = document.getElementById('t-orig').value;
        const destino = document.getElementById('t-dest').value;
        const valor_cents = Math.abs(Services.parseBRL(document.getElementById('t-val').value));
        const descricao = document.getElementById('t-desc').value.trim();
        
        if (origem === destino) return UICommon.alert("Origem e destino não podem ser iguais.");
        
        await DB.add("transferencias", { data, origem, destino, valor_cents, descricao });
        UICommon.alert(`Transferência salva!`);
        document.getElementById('form-transf').reset();
        document.getElementById('t-data').valueAsDate = new Date();
        this.renderTransferencias();
    },

    renderTransferencias: async function() {
        const contas = await DB.getAll("contas");
        const options = contas.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
        document.getElementById('t-orig').innerHTML = options;
        document.getElementById('t-dest').innerHTML = options;

        const transfs = await DB.getAll("transferencias");
        transfs.sort((a,b) => b.data.localeCompare(a.data)); 
        
        document.getElementById('transf-list').innerHTML = transfs.map(t => `
            <div class="list-item">
                <div class="list-item-left"><span class="list-item-title">${UICommon.esc(t.origem)} ➔ ${UICommon.esc(t.destino)}</span><span class="list-item-sub">${Services.fmtData(t.data)} • ${UICommon.esc(t.descricao)}</span></div>
                <div class="list-item-val" style="color:var(--primary)">${Services.formatBRL(t.valor_cents)}</div>
                <div class="action-buttons">
                    <button class="btn-primary btn-small" onclick="UI5.abrirEdicaoGenerica('transferencias', ${t.id})">Editar</button>
                    <button class="btn-danger btn-small" onclick="UI5.excluirGenerico('transferencias', ${t.id}, 'UI3.renderTransferencias()')">Excluir</button>
                </div>
            </div>
        `).join('') || '<div style="color:var(--text-muted);font-size:0.85rem;">Nenhuma transferência registrada.</div>';
    },

    // QUEM ME DEVE COM GERAÇÃO DE PARCELAS (qmd_parc) E BAIXA INDIVIDUAL
    saveDivida: async function(e) {
        e.preventDefault();
        const devedor = document.getElementById('q-dev').value.trim();
        const descricao = document.getElementById('q-desc').value.trim();
        const total_cents = Math.abs(Services.parseBRL(document.getElementById('q-val').value));
        const n = parseInt(document.getElementById('q-n').value) || 1;
        const data_ini = document.getElementById('q-ini').value;
        
        const qmdId = await DB.add("quem_me_deve", { devedor, descricao, valor_total_cents: total_cents, n, data_ini, status: 'aberta' });
        const vals = Services.splitParcelas(total_cents, n);
        let [y, m, d] = data_ini.split('-').map(Number);

        for (let i = 0; i < n; i++) {
            const compVenc = Services.addMonths(`${y}-${String(m).padStart(2, '0')}`, i);
            const vData = `${compVenc}-${String(d).padStart(2, '0')}`;
            await DB.add("qmd_parc", {
                qmd_id: qmdId, devedor, descricao, numero: i + 1, total_n: n,
                vencimento: vData, valor_cents: vals[i], status: 'pendente', data_pagto: null
            });
        }

        UICommon.alert(`Dívida de '${devedor}' registrada em ${n} parcela(s)!`);
        document.getElementById('form-qmd').reset();
        document.getElementById('q-ini').valueAsDate = new Date();
        this.renderQuemMeDeve();
    },

    renderQuemMeDeve: async function() {
        const qmd = await DB.getAll("quem_me_deve");
        const qmdParc = await DB.getAll("qmd_parc");

        document.getElementById('qmd-list').innerHTML = qmd.map(q => {
            const parcs = qmdParc.filter(p => Number(p.qmd_id) === Number(q.id)).sort((a,b) => a.numero - b.numero);
            const recebido = parcs.filter(p => p.status === 'pago').reduce((acc, p) => acc + p.valor_cents, 0);
            const faltam = Math.max(0, q.valor_total_cents - recebido);

            const parcsHTML = parcs.map(p => `
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.8rem;padding:6px 0;border-bottom:1px solid #f4f4f5;">
                    <span>Parc ${p.numero}/${q.n} (${Services.fmtData(p.vencimento)}) • <b>${Services.formatBRL(p.valor_cents)}</b></span>
                    <span>
                        <span class="st ${p.status}">${p.status}</span>
                        ${p.status !== 'pago' ? `<button class="btn-success btn-small" style="padding:3px 8px;margin-left:6px;" onclick="UI3.receberParcelaQMD(${p.id})">Receber</button>` : ''}
                    </span>
                </div>
            `).join('');

            return `
                <div class="card">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div class="list-item-title">${UICommon.esc(q.devedor)} — ${UICommon.esc(q.descricao)}</div>
                            <div class="list-item-sub">Total: ${Services.formatBRL(q.valor_total_cents)} (${q.n}x) • Recebido: <b style="color:var(--success)">${Services.formatBRL(recebido)}</b></div>
                        </div>
                        <div class="list-item-val rec">Falta: ${Services.formatBRL(faltam)}</div>
                    </div>
                    <details class="det" style="margin-top:8px;">
                        <summary style="font-size:0.8rem;font-weight:600;color:var(--primary);">Gerenciar Parcelas (${parcs.length})</summary>
                        <div style="margin-top:6px;">${parcsHTML || 'Sem parcelas detalhadas.'}</div>
                    </details>
                    <div class="action-buttons">
                        <button class="btn-primary btn-small" onclick="UI5.abrirEdicaoGenerica('quem_me_deve', ${q.id})">Editar</button>
                        <button class="btn-danger btn-small" onclick="UI5.excluirGenerico('quem_me_deve', ${q.id}, 'UI3.renderQuemMeDeve()')">Excluir</button>
                    </div>
                </div>
            `;
        }).join('') || '<div style="color:var(--text-muted);font-size:0.85rem;">Nenhum empréstimo a receber cadastrado.</div>';
    },

    receberParcelaQMD: async function(parcId) {
        const parcs = await DB.getAll("qmd_parc");
        const p = parcs.find(x => Number(x.id) === Number(parcId));
        if (!p) return;
        const hoje = new Date().toISOString().split('T')[0];
        await DB.update("qmd_parc", parcId, { status: 'pago', data_pagto: hoje });

        if (confirm(`Parcela ${p.numero}/${p.total_n} de ${p.devedor} (${Services.formatBRL(p.valor_cents)}) marcada como recebida! Deseja também lançar essa entrada como Receita no seu Extrato?`)) {
            await DB.add("lancamentos", {
                data: hoje, competencia: hoje.substring(0, 7),
                item: `Reembolso ${p.devedor} - ${p.descricao} (${p.numero}/${p.total_n})`,
                tipo: 'Receita', categoria: 'Reembolso', conta: 'Conta Corrente',
                valor_cents: p.valor_cents, status: 'pago', origem: 'qmd'
            });
        }
        this.renderQuemMeDeve();
    },

    // IMPORTAÇÃO DIRETA KONTTO / MINHAS FINANÇAS (importer.py) + EXPORTAÇÕES (exports.py)
    importarPlanilhaDireta: function() {
        const fileInput = document.getElementById('imp-file');
        const modo = document.getElementById('imp-modo').value;
        if (!fileInput.files.length) return UICommon.alert("Selecione o arquivo CSV para importar.");

        const reader = new FileReader();
        reader.onload = async function(e) {
            const texto = e.target.result.replace(/^\uFEFF/, '');
            const linhas = texto.split(/\r?\n/).filter(l => l.trim().length > 0);
            if (linhas.length < 2) return UICommon.alert("Arquivo vazio ou inválido.");

            const lancamentosExistentes = await DB.getAll("lancamentos");
            const hashesSet = new Set(lancamentosExistentes.map(l => l.hash).filter(Boolean));
            const cartoesExistentes = await DB.getAll("cartoes");
            const contasSet = new Set((await DB.getAll("contas")).map(c => c.nome));
            const cartoesSet = new Set(cartoesExistentes.map(c => c.nome));
            const catsSet = new Set((await DB.getAll("categorias")).map(c => c.nome));

            let novos = 0, repetidos = 0, rejeitados = 0;

            for (let i = 1; i < linhas.length; i++) {
                const cols = linhas[i].split(';').map(x => x.trim().replace(/^["']|["']$/g, ''));
                let data = "", item = "", tipo = "Despesa", valorCents = 0, categoria = "Outros", conta = "Conta Corrente", obs = "";

                if (modo === "kontto" && cols.length >= 9) {
                    // Padrão Kontto: Data(0);Hora(1);Tipo(2);Valor(3);Descrição(4);Categoria(5);Subcategoria(6);Conta(7);Cartão(8);Observações(9)
                    data = cols[0].substring(0, 10);
                    tipo = cols[2].toLowerCase().includes("receit") ? "Receita" : "Despesa";
                    valorCents = Math.abs(Services.parseBRL(cols[3]));
                    item = Services.normalizaCaso(cols[4]);
                    categoria = Services.normalizaCaso(cols[5] || cols[6] || "Outros");
                    const cartaoRaw = Services.normalizaCaso(cols[8]);
                    const contaRaw = Services.normalizaCaso(cols[7]);
                    if (cartaoRaw) {
                        conta = cartaoRaw.toLowerCase().startsWith("cart") ? cartaoRaw : `Cartão ${cartaoRaw}`;
                    } else if (contaRaw) {
                        conta = contaRaw;
                    }
                    obs = cols[9] || "Importado do Kontto";
                } else if (cols.length >= 6) {
                    // Padrão 6 Campos (DATA;ITEM;TIPO;CATEGORIA;CONTA;VALOR)
                    const rawD = cols[0];
                    if (rawD.includes('/')) {
                        const [d, m, y] = rawD.split('/');
                        data = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                    } else {
                        data = rawD.substring(0, 10);
                    }
                    item = Services.normalizaCaso(cols[1]);
                    tipo = cols[2].toLowerCase().includes("receit") ? "Receita" : "Despesa";
                    categoria = Services.normalizaCaso(cols[3] || "Outros");
                    conta = Services.normalizaCaso(cols[4] || "Conta Corrente");
                    valorCents = Math.abs(Services.parseBRL(cols[5]));
                } else {
                    rejeitados++;
                    continue;
                }

                if (!data || data.length !== 10 || !item || valorCents <= 0) {
                    rejeitados++;
                    continue;
                }

                const h = Services.contentHash(data, item, tipo, categoria, conta, valorCents);
                if (hashesSet.has(h)) {
                    repetidos++;
                    continue;
                }
                hashesSet.add(h);

                // Cria categoria, conta ou cartão automaticamente se não existir (como no importer.py)
                if (categoria && !catsSet.has(categoria)) {
                    await DB.add("categorias", { nome: categoria, limite_cents: 30000 });
                    catsSet.add(categoria);
                }
                if (conta.toLowerCase().startsWith("cartão") || conta.toLowerCase().startsWith("cartao")) {
                    if (!cartoesSet.has(conta)) {
                        const novoCartao = { nome: conta, conta_pagto: "Conta Corrente", limite_cents: 500000, fechamento: 10, vencimento: 17, ativo: 1 };
                        await DB.add("cartoes", novoCartao);
                        cartoesSet.add(conta);
                        cartoesExistentes.push(novoCartao);
                    }
                } else if (conta && !contasSet.has(conta)) {
                    await DB.add("contas", { nome: conta, tipo: "Conta", saldo_inicial_cents: 0, ativa: 1 });
                    contasSet.add(conta);
                }

                const compCalc = Services.calcularCompetenciaCartao(data, conta, cartoesExistentes, tipo);

                await DB.add("lancamentos", {
                    data, competencia: compCalc, item, tipo, categoria, conta,
                    valor_cents: valorCents, status: "pago", origem: "import", obs, hash: h
                });
                novos++;
            }

            document.getElementById('imp-resultado').innerHTML = `
                <div class="al" style="border-left-color:var(--success);background:#f0fdf4;">
                    <b>Importação Concluída!</b><br>
                    • <b>${novos}</b> novos lançamentos adicionados.<br>
                    • <b>${repetidos}</b> repetidos ignorados (idempotente).<br>
                    • <b>${rejeitados}</b> linhas inválidas descartadas.
                </div>
            `;
            UI1.renderDashboard();
        };
        reader.readAsText(fileInput.files[0]);
    },

    exportBackup: async function() {
        const lancamentos = await DB.getAll("lancamentos");
        if (lancamentos.length === 0) return UICommon.alert("Nenhum dado para exportar.");
        
        // Formato 6 campos originais preservados (DATA;ITEM;TIPO;CATEGORIA;CONTA;VALOR) conforme exports.py
        const header = "\uFEFFDATA;ITEM;TIPO;CATEGORIA;CONTA;VALOR\n";
        const csv = lancamentos.map(l => {
            const v = (l.valor_cents / 100).toFixed(2).replace('.', ',');
            return `${l.data};"${l.item.replace(/"/g, '""')}";${l.tipo};"${l.categoria}";"${l.conta}";${v}`;
        }).join("\n");
        
        const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `extrato_6campos_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    },

    exportDashboardHTML: async function() {
        const comp = new Date().toISOString().substring(0, 7);
        const d = await Services.dadosCompletosMes(comp);
        const htmlContent = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório Dashboard — ${comp}</title><style>${document.querySelector('style') ? document.querySelector('style').innerHTML : ''}</style></head><body style="padding:20px;font-family:sans-serif;background:#f4f4f5;"><h2>Gestor Financeiro — Resumo (${comp})</h2><p><b>Saldo Disponível:</b> ${Services.formatBRL(d.disponivelGastar)} | <b>Realizado em Caixa:</b> ${Services.formatBRL(d.realizadoCaixa)} | <b>Reservado em Metas:</b> ${Services.formatBRL(d.reservadoMetas)}</p><hr style="margin:15px 0;"><p><b>Receitas do Mês:</b> ${Services.formatBRL(d.receitasMes)} | <b>Despesas do Mês:</b> ${Services.formatBRL(d.despesasMes)} | <b>Faturas Pendentes:</b> ${Services.formatBRL(d.fatPendenteMes)}</p></body></html>`;
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard_autonomo_${comp}.html`;
        a.click();
    }
};
