// js/ui1.js - Dashboard Completo (Layout Fintech Moderno, Logos, Gráficos, Barras, Alertas), Extrato Agrupado e Menu Radial (+)
const UI1 = {
    dashMesAtual: new Date().toISOString().substring(0, 7),
    _autoProcessado: false,
    filtroTipoExtrato: 'todas',
    ultimaViewPrincipal: 'view-Dashboard',

    MESES_NOMES: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],

    formatarMesExtenso: function(compIso) {
        if (!compIso || compIso.length < 7) return '';
        const [y, m] = compIso.split('-').map(Number);
        const nome = this.MESES_NOMES[(m - 1) % 12] || '';
        return `${nome} ${y}`;
    },

    formatarDataCurta: function(dataIso) {
        if (!dataIso || dataIso.length < 10) return '';
        const [y, m, d] = dataIso.substring(0, 10).split('-').map(Number);
        const mesesCurtos = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        const hoje = new Date().toISOString().split('T')[0];
        if (dataIso === hoje) return `Hoje • ${String(d).padStart(2, '0')} de ${mesesCurtos[(m - 1) % 12]}`;
        return `${String(d).padStart(2, '0')} de ${mesesCurtos[(m - 1) % 12]}`;
    },

    iconeCategoria: function(catNome, tipo) {
        const c = String(catNome || '').toLowerCase();
        if (tipo === 'Receita') return '💰';
        if (c.includes('aliment') || c.includes('mercad') || c.includes('ifd') || c.includes('restaur') || c.includes('lanch')) return '🍴';
        if (c.includes('transp') || c.includes('uber') || c.includes('combust') || c.includes('gasol') || c.includes('pedag')) return '🚗';
        if (c.includes('morad') || c.includes('alug') || c.includes('casa') || c.includes('luz') || c.includes('agua') || c.includes('internet')) return '🏠';
        if (c.includes('saud') || c.includes('saúd') || c.includes('farm') || c.includes('med')) return '🩺';
        if (c.includes('lazer') || c.includes('viag') || c.includes('bar') || c.includes('passeio')) return '⭐';
        if (c.includes('educ') || c.includes('curso') || c.includes('facul')) return '📚';
        if (c.includes('assinat') || c.includes('stream') || c.includes('apple') || c.includes('spotify')) return '📱';
        if (c.includes('roupa') || c.includes('vestu')) return '👕';
        return '🛍️';
    },

    togglePrivacy: function() {
        document.body.classList.toggle('privacy-mode');
        const eye = document.getElementById('eye-icon');
        if (eye) {
            eye.innerText = document.body.classList.contains('privacy-mode') ? '🙈' : '👁️';
        }
    },

    mudarMesDash: function(delta) {
        const novoMes = Services.addMonths(this.dashMesAtual, delta);
        this.renderDashboard(novoMes);
    },

    mudarMesExtrato: function(delta) {
        const el = document.getElementById('extrato-mes');
        const atual = (el && el.value) ? el.value : this.dashMesAtual;
        const novo = Services.addMonths(atual, delta);
        if (el) el.value = novo;
        this.renderExtrato();
    },

    filtrarTipoExtrato: function(filtro, btnEl) {
        this.filtroTipoExtrato = filtro;
        document.querySelectorAll('.extrato-tab').forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');
        this.renderExtrato();
    },

    irParaExtratoFiltro: function(tipo) {
        this.filtroTipoExtrato = tipo;
        document.querySelectorAll('.extrato-tab').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-flt') === tipo);
        });
        const elMes = document.getElementById('extrato-mes');
        if (elMes) elMes.value = this.dashMesAtual;
        this.navegarPara('view-Extrato', 'Transações');
    },

    // ---- MENU RADIAL FLUTUANTE (+) ----
    abrirMenuRapido: function() {
        const ov = document.getElementById('fab-overlay');
        if (ov) ov.classList.add('open');
    },

    fecharMenuRapido: function() {
        const ov = document.getElementById('fab-overlay');
        if (ov) ov.classList.remove('open');
    },

    acaoRapidaFab: async function(acao) {
        this.fecharMenuRapido();
        if (acao === 'transferir') {
            this.navegarPara('view-Transferencias', 'Transferências');
            return;
        }
        if (acao === 'caixinha') {
            this.navegarPara('view-Metas', 'Metas e Caixinhas');
            return;
        }

        // Abre Novo Lançamento pré-configurado
        await this.populateNovoLancamento();
        const elTipo = document.getElementById('novo-tipo');
        const elConta = document.getElementById('novo-conta');
        const elStatus = document.getElementById('novo-status');

        if (acao === 'receita') {
            if (elTipo) elTipo.value = 'Receita';
            if (elStatus) elStatus.value = 'pago';
            this.navegarPara('view-Novo_lancamento', 'Nova Receita');
        } else if (acao === 'cartao') {
            if (elTipo) elTipo.value = 'Despesa';
            if (elStatus) elStatus.value = 'pendente';
            const cartoes = await DB.getAll('cartoes');
            if (cartoes.length && elConta) {
                elConta.value = cartoes[0].nome;
            }
            this.navegarPara('view-Novo_lancamento', 'Despesa Cartão');
        } else {
            if (elTipo) elTipo.value = 'Despesa';
            if (elStatus) elStatus.value = 'pago';
            const contas = await DB.getAll('contas');
            if (contas.length && elConta) {
                elConta.value = contas[0].nome;
            }
            this.navegarPara('view-Novo_lancamento', 'Nova Despesa');
        }
    },

    // ---- NAVEGAÇÃO FLUIDA E BOTÃO VOLTAR ----
    onNavClick: function(viewId, titulo, navEl) {
        this.ultimaViewPrincipal = viewId;
        this.navegarPara(viewId, titulo, navEl);
    },

    voltarNavegacao: function() {
        const destino = this.ultimaViewPrincipal || 'view-Menu';
        const titulos = {
            'view-Dashboard': 'Início',
            'view-Extrato': 'Transações',
            'view-Relatorios': 'Análise',
            'view-Menu': 'Mais'
        };
        this.navegarPara(destino, titulos[destino] || 'Início');
    },

    navegarPara: function(viewId, titulo, navEl) {
        if (typeof UICommon !== 'undefined' && UICommon.showView) {
            UICommon.showView(viewId, titulo);
        } else {
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            const target = document.getElementById(viewId);
            if (target) target.classList.add('active');
            const hTitle = document.getElementById('header-title');
            if (hTitle && titulo) hTitle.innerText = titulo;
        }

        const hTitle = document.getElementById('header-title');
        if (hTitle && titulo) hTitle.innerText = titulo;

        // Atualiza destaque na barra inferior
        const principais = ['view-Dashboard', 'view-Extrato', 'view-Relatorios', 'view-Menu'];
        document.querySelectorAll('#bottom-nav .nav-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-target') === viewId);
        });

        // Exibe botão voltar (‹) se estiver em uma sub-tela
        const btnBack = document.getElementById('btn-header-back');
        if (btnBack) {
            btnBack.style.display = principais.includes(viewId) ? 'none' : 'inline-flex';
        }

        // Aciona o renderizador correspondente da view
        if (viewId === 'view-Dashboard') this.renderDashboard();
        else if (viewId === 'view-Extrato') this.renderExtrato();
        else if (viewId === 'view-Novo_lancamento') this.populateNovoLancamento();
        else if (viewId === 'view-ContasCartoes' && typeof UI2 !== 'undefined') UI2.renderContasCartoes();
        else if (viewId === 'view-Faturas' && typeof UI2 !== 'undefined') UI2.renderFaturas();
        else if (viewId === 'view-Parcelamentos' && typeof UI2 !== 'undefined') UI2.renderParcelamentos();
        else if (viewId === 'view-ContasFixas' && typeof UI2 !== 'undefined') UI2.renderFixas();
        else if (viewId === 'view-Categorias' && typeof UI3 !== 'undefined') UI3.renderCategorias();
        else if (viewId === 'view-Metas' && typeof UI3 !== 'undefined') UI3.renderMetas();
        else if (viewId === 'view-QuemMeDeve' && typeof UI3 !== 'undefined') UI3.renderQuemMeDeve();
        else if (viewId === 'view-Transferencias' && typeof UI3 !== 'undefined') UI3.renderTransferencias();
        else if (viewId === 'view-Pesquisar' && typeof UI5 !== 'undefined') UI5.initPesquisa();
        else if (viewId === 'view-Planejamento' && typeof UI5 !== 'undefined') UI5.renderPlanejamento();
        else if (viewId === 'view-Relatorios' && typeof UI5 !== 'undefined') {
            const rAno = document.getElementById('rel-ano');
            if (rAno && !rAno.value) rAno.value = new Date().getFullYear();
            UI5.gerarRelatorio();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // Processa linhas no formato: DataBR|Valor|Tipo|Conta|Descricao|Categoria (ou texto direto da notificação do Santander)
    processarTextoFila: async function(textoBruto, limparClipboard = false) {
        if (!textoBruto || !String(textoBruto).trim()) return 0;
        const linhas = String(textoBruto).replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (!linhas.length) return 0;

        const lancamentosExistentes = await DB.getAll("lancamentos");
        const hashesSet = new Set(lancamentosExistentes.map(l => l.hash).filter(Boolean));
        let cartoes = await DB.getAll("cartoes");
        const contas = await DB.getAll("contas");
        const cats = await DB.getAll("categorias");

        let adicionados = 0;
        let repetidos = 0;
        let ultimaComp = null;

        for (const linha of linhas) {
            let rawData = "", valorStr = "", tipoRaw = "Despesa", conta = "Santander", item = "", categoria = "";

            if (linha.includes('|')) {
                const partes = linha.split('|').map(p => p.trim().replace(/^[\[\]"']+|\[\]"']+$/g, '').replace(/^\[|\]$/g, '').trim());
                if (partes.length < 5) continue;
                const p0 = partes[0] === 'AUTO_FIN' ? partes.slice(1) : partes;
                rawData = p0[0] || '';
                valorStr = p0[1] || '0';
                tipoRaw = p0[2] || 'Despesa';
                conta = p0[3] || 'Santander';
                item = p0[4] || 'Notificação Santander';
                categoria = p0[5] || '';
            } else {
                const mPixEnv = linha.match(/PIX enviado em (\d{2}\/\d{2}\/\d{4}) [àa]s \d{2}:\d{2} no valor de R\$\s*([\d\.,]+)/i);
                const mPixRec = linha.match(/PIX recebido em (\d{2}\/\d{2}\/\d{4}) [àa]s \d{2}:\d{2} no valor de R\$\s*([\d\.,]+)/i);
                const mCompra = linha.match(/Compra no cart[ãa]o final \d{4}, de R\$\s*([\d\.,]+), em (\d{2}\/\d{2}\/\d{2,4}), [àa]s \d{2}:\d{2}, em (.+?), aprovada/i);

                if (mPixEnv) {
                    rawData = mPixEnv[1]; valorStr = mPixEnv[2]; tipoRaw = 'Despesa'; conta = 'Santander'; item = 'PIX Enviado'; categoria = 'Outros';
                } else if (mPixRec) {
                    rawData = mPixRec[1]; valorStr = mPixRec[2]; tipoRaw = 'Receita'; conta = 'Santander'; item = 'PIX Recebido'; categoria = 'Outras Receitas';
                } else if (mCompra) {
                    valorStr = mCompra[1]; rawData = mCompra[2]; item = mCompra[3].trim(); tipoRaw = 'Despesa'; conta = 'Cartão Santander'; categoria = 'Outros';
                } else {
                    continue;
                }
            }

            let dataIso = "";
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawData)) {
                const [d, m, y] = rawData.split('/');
                dataIso = `${y}-${m}-${d}`;
            } else if (/^\d{2}\/\d{2}\/\d{2}$/.test(rawData)) {
                const [d, m, y] = rawData.split('/');
                dataIso = `20${y}-${m}-${d}`;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawData)) {
                dataIso = rawData;
            } else {
                continue;
            }

            const valorCents = Math.abs(Services.parseBRL(valorStr));
            if (valorCents <= 0) continue;

            const tipo = tipoRaw.toLowerCase().includes('receit') ? 'Receita' : 'Despesa';
            if (!categoria) categoria = tipo === 'Receita' ? 'Outras Receitas' : 'Outros';

            const h = Services.contentHash(dataIso, item, tipo, categoria, conta, valorCents);
            if (hashesSet.has(h)) {
                repetidos++;
                continue;
            }
            hashesSet.add(h);

            if (categoria && !cats.some(c => c.nome.toLowerCase() === categoria.toLowerCase())) {
                const novaCat = { nome: categoria, limite_cents: 30000 };
                await DB.add("categorias", novaCat);
                cats.push(novaCat);
            }

            if (/^cart[aã]o/i.test(conta)) {
                if (!cartoes.some(c => c.nome.toLowerCase() === conta.toLowerCase())) {
                    const novoC = { nome: conta, conta_pagto: "Santander", limite_cents: 500000, fechamento: 2, vencimento: 9, ativo: 1 };
                    await DB.add("cartoes", novoC);
                    cartoes.push(novoC);
                }
            } else if (conta && !contas.some(c => c.nome.toLowerCase() === conta.toLowerCase())) {
                const novaConta = { nome: conta, tipo: "Conta", saldo_inicial_cents: 0, ativa: 1 };
                await DB.add("contas", novaConta);
                contas.push(novaConta);
            }

            const compCalc = Services.calcularCompetenciaCartao(dataIso, conta, cartoes, tipo);
            ultimaComp = compCalc;
            const isCard = cartoes.some(c => c.nome.toLowerCase() === conta.toLowerCase()) || /^cart[aã]o/i.test(conta);
            const statusPadrao = isCard ? 'pendente' : 'pago';

            await DB.add("lancamentos", {
                data: dataIso,
                competencia: compCalc,
                item: item,
                tipo: tipo,
                categoria: categoria,
                conta: conta,
                valor_cents: valorCents,
                status: statusPadrao,
                origem: 'auto',
                hash: h
            });
            adicionados++;
        }

        if (adicionados > 0) {
            if (limparClipboard && navigator.clipboard && navigator.clipboard.writeText) {
                try { await navigator.clipboard.writeText(""); } catch (e) {}
            }
            UICommon.alert(`✅ ${adicionados} lançamento(s) da fila importado(s) com sucesso!${repetidos > 0 ? ` (${repetidos} já existente(s) ignorado(s))` : ''}`);
            if (ultimaComp) {
                const elExtratoMes = document.getElementById('extrato-mes');
                if (elExtratoMes) elExtratoMes.value = ultimaComp;
            }
            await this.renderDashboard(ultimaComp || this.dashMesAtual);
            await this.renderExtrato();
        } else if (repetidos > 0) {
            UICommon.alert(`ℹ️ Todos os ${repetidos} lançamento(s) da fila já estavam salvos no app.`);
        } else {
            UICommon.alert("Nenhum lançamento válido encontrado na fila.");
        }
        return adicionados;
    },

    colarFilaAreaTransferencia: async function() {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const txt = await navigator.clipboard.readText();
                if (txt && txt.trim()) {
                    await this.processarTextoFila(txt, true);
                    return;
                }
            }
        } catch (e) {}
        const manual = prompt("Cole aqui o conteúdo da fila ou notificação do Santander:");
        if (manual && manual.trim()) {
            await this.processarTextoFila(manual, false);
        }
    },

    importarArquivoFila: function(inputEl) {
        if (!inputEl.files || !inputEl.files.length) return;
        const file = inputEl.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            await this.processarTextoFila(e.target.result, false);
            inputEl.value = '';
        };
        reader.readAsText(file);
    },

    processarUrlAuto: async function() {
        if (this._autoProcessado) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('auto') !== '1') return;
        this._autoProcessado = true;

        try {
            const rawData = (params.get('data') || '').trim();
            let dataIso = new Date().toISOString().split('T')[0];
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawData)) {
                const [d, m, y] = rawData.split('/');
                dataIso = `${y}-${m}-${d}`;
            } else if (/^\d{2}\/\d{2}\/\d{2}$/.test(rawData)) {
                const [d, m, y] = rawData.split('/');
                dataIso = `20${y}-${m}-${d}`;
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawData)) {
                dataIso = rawData;
            }

            const valorStr = params.get('valor') || '0';
            const valorCents = Math.abs(Services.parseBRL(valorStr));
            if (valorCents <= 0) return;

            const tipoRaw = (params.get('tipo') || 'Despesa').trim();
            const tipo = tipoRaw.toLowerCase().includes('receit') ? 'Receita' : 'Despesa';
            const conta = (params.get('conta') || 'Santander').trim();
            const item = (params.get('item') || 'Notificação Santander').trim();
            const categoria = (params.get('cat') || (tipo === 'Receita' ? 'Outras Receitas' : 'Outros')).trim();

            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);

            const cats = await DB.getAll("categorias");
            if (categoria && !cats.some(c => c.nome.toLowerCase() === categoria.toLowerCase())) {
                await DB.add("categorias", { nome: categoria, limite_cents: 30000 });
            }

            let cartoes = await DB.getAll("cartoes");
            const contas = await DB.getAll("contas");
            if (/^cart[aã]o/i.test(conta)) {
                if (!cartoes.some(c => c.nome.toLowerCase() === conta.toLowerCase())) {
                    const novoC = { nome: conta, conta_pagto: "Santander", limite_cents: 500000, fechamento: 2, vencimento: 9, ativo: 1 };
                    await DB.add("cartoes", novoC);
                    cartoes.push(novoC);
                }
            } else if (conta && !contas.some(c => c.nome.toLowerCase() === conta.toLowerCase())) {
                await DB.add("contas", { nome: conta, tipo: "Conta", saldo_inicial_cents: 0, ativa: 1 });
            }

            const compCalc = Services.calcularCompetenciaCartao(dataIso, conta, cartoes, tipo);
            const isCard = cartoes.some(c => c.nome.toLowerCase() === conta.toLowerCase()) || /^cart[aã]o/i.test(conta);
            const statusPadrao = isCard ? 'pendente' : 'pago';

            await DB.add("lancamentos", {
                data: dataIso,
                competencia: compCalc,
                item: item,
                tipo: tipo,
                categoria: categoria,
                conta: conta,
                valor_cents: valorCents,
                status: statusPadrao,
                origem: 'auto'
            });

            UICommon.alert(`✅ Lançamento automático salvo: ${item} (${Services.formatBRL(valorCents)}) em ${Services.fmtData(dataIso)}!`);

            const elExtratoMes = document.getElementById('extrato-mes');
            if (elExtratoMes) elExtratoMes.value = compCalc;
            await this.renderDashboard(compCalc);
            await this.renderExtrato();
        } catch (err) {
            console.error("Erro ao processar lançamento automático:", err);
        }
    },

    renderDashboard: async function(compOverride) {
        if (!this._autoProcessado && window.location.search.includes('auto=1')) {
            await this.processarUrlAuto();
            return;
        }
        if (compOverride) this.dashMesAtual = compOverride;
        const comp = this.dashMesAtual;

        // Atualiza título do mês por extenso (< Novembro 2026 >)
        const monthLbl = document.getElementById('dash-month-label');
        if (monthLbl) monthLbl.innerText = this.formatarMesExtenso(comp);

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

        // Seção Contas no Dashboard (Estilo Vídeo)
        const elDashContas = document.getElementById('dash-contas');
        if (elDashContas) {
            const contasList = await DB.getAll("contas");
            if (contasList.length > 0) {
                elDashContas.innerHTML = contasList.map((c, idx) => {
                    const logoHtml = (typeof Logos !== 'undefined' && Logos.getLogoHTML) ? Logos.getLogoHTML(c.nome) : '🏦';
                    const saldoExibido = idx === 0 ? d.disponivelGastar : (parseInt(c.saldo_inicial_cents) || 0);
                    return `
                        <div class="fintech-row">
                            <div class="fintech-row-left">
                                <div>
                                    <div class="fintech-row-title">${UICommon.esc(c.nome)}</div>
                                    <div class="fintech-row-sub">Realizado em caixa</div>
                                    ${idx === 0 && d.reservadoMetas > 0 ? `<div class="fintech-row-sub">Reservado</div>` : ''}
                                </div>
                            </div>
                            <div class="fintech-row-right">
                                <div class="fintech-row-val priv-val" style="color:${saldoExibido >= 0 ? 'var(--text-main)' : 'var(--danger)'}">${Services.formatBRL(saldoExibido)}</div>
                                <div class="fintech-row-sub priv-val">${Services.formatBRL(idx === 0 ? d.realizadoCaixa : saldoExibido)}</div>
                                ${idx === 0 && d.reservadoMetas > 0 ? `<div class="fintech-row-sub priv-val">${Services.formatBRL(d.reservadoMetas)}</div>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                elDashContas.innerHTML = '<div style="font-size:0.82rem;color:var(--text-muted);padding:4px 0;">Nenhuma conta cadastrada.</div>';
            }
        }

        // Seção Caixinhas / Metas no Dashboard (Com Anel de Progresso Circular Igual ao Vídeo)
        document.getElementById('dash-metas').innerHTML = d.metasCalc.map(m => {
            const pct = m.objetivo_cents > 0 ? Math.min(100, Math.round((m.acumulado_cents / m.objetivo_cents) * 100)) : 0;
            const icone = m.nome.toLowerCase().includes('viag') ? '✈️' : (m.nome.toLowerCase().includes('emerg') || m.nome.toLowerCase().includes('reserv') ? '🪙' : '🎯');
            const corAnel = pct >= 100 ? '#10b981' : '#f59e0b';
            return `
                <div class="fintech-row">
                    <div class="fintech-row-left">
                        <div class="meta-ring" style="background: conic-gradient(${corAnel} ${pct * 3.6}deg, #e2e8f0 0deg);">
                            <div class="meta-ring-inner">${icone}</div>
                        </div>
                        <div>
                            <div class="fintech-row-title">${UICommon.esc(m.nome)}</div>
                            <div class="fintech-row-sub">${pct}% concluído</div>
                        </div>
                    </div>
                    <div class="fintech-row-right">
                        <div class="fintech-row-val priv-val" style="color:var(--success)">${Services.formatBRL(m.acumulado_cents)}</div>
                        <div class="fintech-row-sub priv-val">de ${Services.formatBRL(m.objetivo_cents)}</div>
                    </div>
                </div>
            `;
        }).join('') || '<span style="color:var(--text-muted);font-size:0.82rem;">Nenhuma caixinha/meta cadastrada.</span>';

        // Seção Cartões de Crédito com Logos SVG e Rodapé Total (Igual ao Vídeo)
        const totalFaturasMes = d.cartoesDetalhe.reduce((acc, k) => acc + k.faturaMes.total, 0);
        const totalComprometido = d.cartoesDetalhe.reduce((acc, k) => acc + k.comprometido, 0);
        const cartoesRowsHtml = d.cartoesDetalhe.map(k => `
            <div class="fintech-row" onclick="UI1.navegarPara('view-Faturas', 'Faturas de Cartão')" style="cursor:pointer;">
                <div class="fintech-row-left">
                    <div>
                        <div class="fintech-row-title">${UICommon.esc(k.nome.replace(/^Cart[ãa]o\s+/i, ''))}</div>
                        <div class="fintech-row-sub">
                            Fatura ${k.faturaMes.status === 'paga' ? 'paga' : 'aberta'} • Fecha dia ${k.fechamento}
                        </div>
                    </div>
                </div>
                <div class="fintech-row-right">
                    <div class="fintech-row-val priv-val">${Services.formatBRL(k.faturaMes.total)} <span style="font-size:0.75rem;color:${k.faturaMes.status === 'paga' ? 'var(--success)' : 'var(--text-muted)'}">${k.faturaMes.status === 'paga' ? '✓' : '🕒'}</span></div>
                    <div class="fintech-row-sub priv-val">Total: ${Services.formatBRL(k.comprometido)}</div>
                </div>
            </div>
        `).join('');

        const cartoesFooterHtml = d.cartoesDetalhe.length > 0 ? `
            <div class="fintech-row" style="padding-top:12px;margin-top:4px;border-top:1px solid var(--border-light);">
                <div class="fintech-row-left">
                    <div>
                        <div class="fintech-row-title">Total no mês</div>
                        <div class="fintech-row-sub">Comprometido geral</div>
                    </div>
                </div>
                <div class="fintech-row-right">
                    <div class="fintech-row-val priv-val">${Services.formatBRL(totalFaturasMes)}</div>
                    <div class="fintech-row-sub priv-val">${Services.formatBRL(totalComprometido)}</div>
                </div>
            </div>
        ` : '<span style="color:var(--text-muted);font-size:0.82rem;">Nenhum cartão cadastrado.</span>';

        document.getElementById('dash-cartoes').innerHTML = cartoesRowsHtml + cartoesFooterHtml;

        // Seção Despesas Recentes no Dashboard (Igual ao Vídeo 00:05)
        const elRecentes = document.getElementById('dash-recentes');
        if (elRecentes) {
            const todosLanc = await DB.getAll("lancamentos");
            const recMes = todosLanc
                .filter(l => (l.competencia || Services.getCompetencia(l.data)) === comp && l.tipo === 'Despesa')
                .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
                .slice(0, 5);

            elRecentes.innerHTML = recMes.map(l => {
                const mParc = (l.item || '').match(/\((\d+)\s*(?:de|\/)\s*(\d+)\)/i);
                const badgeParc = mParc ? `<div class="fintech-row-sub">${mParc[2]}x</div>` : '';
                return `
                    <div class="fintech-row" onclick="UI5.abrirEdicao(${l.id})" style="cursor:pointer;">
                        <div class="fintech-row-left">
                            <div class="tx-cat-badge">${this.iconeCategoria(l.categoria, l.tipo)}</div>
                            <div style="min-width:0;">
                                <div class="fintech-row-title">${UICommon.esc(l.item)}</div>
                                <div class="fintech-row-sub">${this.formatarDataCurta(l.data)} • ${UICommon.esc(l.conta)}</div>
                            </div>
                        </div>
                        <div class="fintech-row-right">
                            <div class="fintech-row-val priv-val" style="color:var(--danger)">${Services.formatBRL(l.valor_cents)}</div>
                            ${badgeParc}
                        </div>
                    </div>
                `;
            }).join('') || '<span style="color:var(--text-muted);font-size:0.82rem;">Nenhuma despesa recente neste mês.</span>';
        }

        // A Pagar e A Receber
        document.getElementById('dash-pagar').innerHTML = d.aPagar.slice(0, 8).map(l => `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;padding:8px 0;border-bottom:1px solid var(--border-light);">
                <span><b>${UICommon.esc(l.item)}</b> <span style="color:var(--text-muted)">(${Services.fmtData(l.data)})</span></span>
                <span style="display:flex;align-items:center;gap:6px;">
                    <b class="priv-val" style="color:var(--danger)">${Services.formatBRL(l.valor_cents)}</b>
                    <button class="btn-success btn-small" style="padding:3px 7px;font-size:0.7rem;" onclick="UI1.darBaixaRapida(${l.id})">✓</button>
                </span>
            </div>
        `).join('') || '<span style="color:var(--text-muted);font-size:0.82rem;">Nada pendente a pagar neste mês.</span>';

        document.getElementById('dash-receber').innerHTML = d.aReceber.slice(0, 8).map(r => `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;padding:8px 0;border-bottom:1px solid var(--border-light);">
                <span><b>${UICommon.esc(r.desc)}</b> <span style="color:var(--text-muted)">(${Services.fmtData(r.data)})</span></span>
                <b class="priv-val" style="color:var(--success)">${Services.formatBRL(r.valor_cents)}</b>
            </div>
        `).join('') || '<span style="color:var(--text-muted);font-size:0.82rem;">Nada pendente a receber neste mês.</span>';

        // Gráfico de Barras Verticais Arredondadas (3 meses: Anterior | Atual | Próximo)
        this.renderGraficoBarras('dash-evo-chart', d.evo, comp);

        // Despesas por Categoria com Barra de Progresso e Expansão (Details)
        const catsActive = d.catsList.filter(c => c.gasto > 0 || c.limite > 0);
        document.getElementById('dash-cats').innerHTML = catsActive.map(c => {
            const pct = c.limite > 0 ? Math.min(100, Math.round((c.gasto / c.limite) * 100)) : (c.gasto > 0 ? 100 : 0);
            const estourou = c.limite > 0 && c.gasto > c.limite;
            const detRows = c.itens.map(it => `<div style="display:flex;justify-content:space-between;font-size:0.78rem;padding:5px 0;border-top:1px solid var(--border-light);"><span>${Services.fmtData(it.data)} • ${UICommon.esc(it.item)}</span><b class="priv-val">${Services.formatBRL(it.valor_cents)}</b></div>`).join('');
            return `
                <details class="det">
                    <summary>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <div class="tx-cat-badge">${this.iconeCategoria(c.nome, 'Despesa')}</div>
                            <div style="flex:1;">
                                <div style="display:flex;justify-content:space-between;font-size:0.88rem;font-weight:700;">
                                    <span>${UICommon.esc(c.nome)}</span>
                                    <span class="priv-val" style="color:${estourou ? 'var(--danger)' : 'var(--text-main)'}">${Services.formatBRL(c.gasto)}</span>
                                </div>
                                <div class="bar"><i class="${estourou ? 'danger' : ''}" style="width:${pct}%"></i></div>
                                <div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px;display:flex;justify-content:space-between;">
                                    <span>${c.limite > 0 ? 'Limite: ' + Services.formatBRL(c.limite) : 'Sem limite definido'}</span>
                                    <span>${c.limite > 0 ? pct + '%' : ''}</span>
                                </div>
                            </div>
                        </div>
                    </summary>
                    <div style="margin-top:8px;padding-left:46px;">${detRows || '<span style="font-size:0.75rem;color:var(--text-muted);">Sem lançamentos no mês.</span>'}</div>
                </details>
            `;
        }).join('') || '<span style="color:var(--text-muted);font-size:0.82rem;">Sem despesas registradas no mês.</span>';

        // Alertas
        const ic = { erro: '⛔', atencao: '⚠️', info: 'ℹ️' };
        document.getElementById('dash-alertas').innerHTML = d.alertas.map(a => `
            <div class="al ${a.nivel}">${ic[a.nivel] || '•'} ${UICommon.esc(a.msg)}</div>
        `).join('') || '<span style="color:var(--success);font-size:0.85rem;font-weight:600;">✓ Tudo sob controle neste mês!</span>';
    },

    formatarValorCurto: function(cents) {
        const val = Math.abs(Number(cents || 0)) / 100;
        if (val === 0) return 'R$ 0';
        if (val >= 1000) {
            return 'R$ ' + (val / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k';
        }
        return 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },

    renderGraficoBarras: function(containerId, evoData, compAtual) {
        const el = document.getElementById(containerId);
        if (!el) return;

        // Garante exatamente 3 meses: [mês anterior, mês atual, próximo mês]
        const refComp = compAtual || this.dashMesAtual;
        const tresMeses = [-1, 0, 1].map(k => {
            const c = Services.addMonths(refComp, k);
            const found = (evoData || []).find(item => item.comp === c);
            return found || { comp: c, rec: 0, des: 0, fat: 0 };
        });

        let maxVal = 0;
        tresMeses.forEach(m => {
            maxVal = Math.max(maxVal, m.rec || 0, m.des || 0, m.fat || 0);
        });
        if (maxVal <= 0) maxVal = 10000; // base visual quando tudo for R$ 0,00

        const mesesCurtos = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        const fmtMesLabel = (iso) => {
            const [y, m] = iso.split('-').map(Number);
            return `${mesesCurtos[(m - 1) % 12]}/${String(y).slice(2)}`;
        };

        const gruposHtml = tresMeses.map((m, idx) => {
            const isMeio = idx === 1;
            const hRec = m.rec > 0 ? Math.max(12, Math.round((m.rec / maxVal) * 100)) : 6;
            const hDes = m.des > 0 ? Math.max(12, Math.round((m.des / maxVal) * 100)) : 6;
            const hFat = m.fat > 0 ? Math.max(12, Math.round((m.fat / maxVal) * 100)) : 6;

            return `
                <div class="bar-month-group ${isMeio ? 'current' : ''}">
                    <div class="bar-triplet">
                        <div class="bar-col" title="Receitas: ${Services.formatBRL(m.rec)}">
                            <span class="bar-val-top priv-val">${m.rec > 0 ? this.formatarValorCurto(m.rec) : ''}</span>
                            <div class="bar-track">
                                <div class="bar-fill rec" style="height:${hRec}%;"></div>
                            </div>
                        </div>
                        <div class="bar-col" title="Despesas: ${Services.formatBRL(m.des)}">
                            <span class="bar-val-top priv-val">${m.des > 0 ? this.formatarValorCurto(m.des) : ''}</span>
                            <div class="bar-track">
                                <div class="bar-fill des" style="height:${hDes}%;"></div>
                            </div>
                        </div>
                        <div class="bar-col" title="Faturas: ${Services.formatBRL(m.fat)}">
                            <span class="bar-val-top priv-val">${m.fat > 0 ? this.formatarValorCurto(m.fat) : ''}</span>
                            <div class="bar-track">
                                <div class="bar-fill fat" style="height:${hFat}%;"></div>
                            </div>
                        </div>
                    </div>
                    <div class="bar-month-label">${fmtMesLabel(m.comp)}</div>
                </div>
            `;
        }).join('');

        el.innerHTML = `
            <div class="bar-chart-legend">
                <span><i class="leg-dot rec"></i>Receitas</span>
                <span><i class="leg-dot des"></i>Despesas</span>
                <span><i class="leg-dot fat"></i>Faturas</span>
            </div>
            <div class="bar-chart-stage">
                ${gruposHtml}
            </div>
        `;
    },

    darBaixaRapida: async function(id) {
        await DB.update("lancamentos", id, { status: "pago" });
        this.renderDashboard();
    },

    renderExtrato: async function() {
        let lancamentos = await DB.getAll("lancamentos");
        let mesExtrato = document.getElementById('extrato-mes').value;
        if (!mesExtrato) {
            mesExtrato = this.dashMesAtual || new Date().toISOString().substring(0, 7);
            document.getElementById('extrato-mes').value = mesExtrato;
        }

        const extLbl = document.getElementById('extrato-month-label');
        if (extLbl) extLbl.innerText = this.formatarMesExtenso(mesExtrato);

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

        lancamentos = lancamentos.filter(l => {
            const compMatch = (l.competencia || Services.getCompetencia(l.data)) === mesExtrato;
            const contaMatch = (filtroConta === 'todas' || l.conta === filtroConta);
            if (!compMatch || !contaMatch) return false;
            if (this.filtroTipoExtrato === 'Receita') return l.tipo === 'Receita';
            if (this.filtroTipoExtrato === 'Despesa') return l.tipo === 'Despesa';
            if (this.filtroTipoExtrato === 'pendente') return l.status === 'pendente';
            return true;
        });
        lancamentos.sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);

        const totalMes = lancamentos.reduce((acc, l) => acc + (l.tipo === 'Receita' ? l.valor_cents : -l.valor_cents), 0);
        document.getElementById('extrato-resumo').innerText = `${lancamentos.length} transação(ões) • Resultado: ${Services.formatBRL(totalMes)}`;

        // Agrupa lançamentos por data (Estilo Vídeo 00:27)
        let html = '';
        let dataAtualGrupo = null;
        for (const l of lancamentos) {
            if (l.data !== dataAtualGrupo) {
                dataAtualGrupo = l.data;
                html += `<div class="date-group-header">${this.formatarDataCurta(l.data)}</div>`;
            }
            const isPago = l.status === 'pago';
            html += `
                <div class="list-item">
                    <div class="tx-row">
                        <button type="button" class="tx-status-btn ${l.status}" onclick="UI1.alternarStatus(${l.id}, '${l.status}')" title="Alternar Pago/Pendente">
                            ${isPago ? '✓' : '🕒'}
                        </button>
                        <div class="tx-cat-badge">${this.iconeCategoria(l.categoria, l.tipo)}</div>
                        <div class="list-item-left" style="min-width:0;">
                            <span class="list-item-title">${UICommon.esc(l.item)}</span>
                            <span class="list-item-sub">${UICommon.esc(l.categoria)} • ${UICommon.esc(l.conta)}</span>
                        </div>
                        <div class="list-item-val ${l.tipo === 'Receita' ? 'rec' : 'des'}">
                            ${l.tipo === 'Receita' ? '+' : ''}${Services.formatBRL(l.valor_cents)}
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button class="btn-success btn-small" onclick="UI1.alternarStatus(${l.id}, '${l.status}')">${isPago ? 'Marcar Pendente' : 'Dar Baixa (Pago)'}</button>
                        <button class="btn-primary btn-small" onclick="UI5.abrirEdicao(${l.id})">Editar</button>
                        <button class="btn-danger btn-small" onclick="UI5.excluirLancamento(${l.id})">Excluir</button>
                    </div>
                </div>
            `;
        }

        document.getElementById('extrato-list').innerHTML = html || '<div class="card" style="text-align:center;color:var(--text-muted);">Nenhuma transação encontrada neste filtro.</div>';
    },

    alternarStatus: async function(id, statusAtual) {
        const novo = statusAtual === 'pago' ? 'pendente' : 'pago';
        await DB.update("lancamentos", id, { status: novo });
        this.renderExtrato();
        this.renderDashboard();
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
        
        const cartoesCadastrados = await DB.getAll("cartoes");
        let baseComp = compManual ? compManual : Services.calcularCompetenciaCartao(dataIso, conta, cartoesCadastrados, tipo);
        
        if (isParcela) {
            const n = parseInt(document.getElementById('novo-parcelas').value || 2);
            const parcelasVals = Services.splitParcelas(cents, n);
            
            const grupoId = await DB.add("grupos_parc", { descricao: itemDesc, total_cents: cents, n, data_compra: dataIso, conta, categoria });
            
            let [anoData, mesData, diaData] = dataIso.split('-').map(Number);
            for (let i = 0; i < n; i++) {
                let pDate = new Date(anoData, (mesData - 1) + i, diaData);
                let pDateIso = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
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

// Sincroniza o botão voltar (‹) também quando o usuário clica nos itens da tela "Mais" (Menu)
document.addEventListener('click', function(e) {
    const btn = e.target.closest('.menu-btn');
    if (btn) {
        const target = btn.getAttribute('data-target');
        const btnBack = document.getElementById('btn-header-back');
        if (btnBack && target) {
            UI1.ultimaViewPrincipal = 'view-Menu';
            btnBack.style.display = 'inline-flex';
        }
    }
});

if (typeof Logos !== 'undefined') {
    Logos.getLogoHTML = function() { return ''; };
}
