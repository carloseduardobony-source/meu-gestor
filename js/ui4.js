// js/ui4.js - Motor Completo de Conciliação Financeira (conciliacao.py) com preset Kontto
const UI4 = {
    sessaoAtualId: null,

    aplicarPresetKontto: function() {
        document.getElementById('conc-sep').value = ';';
        document.getElementById('conc-fmt-data').value = 'YMD';
        document.getElementById('conc-col-data').value = 1;
        document.getElementById('conc-col-tipo').value = 3;
        document.getElementById('conc-col-val').value = 4;
        document.getElementById('conc-col-desc').value = 5;
        document.getElementById('conc-col-cat').value = 6;
        document.getElementById('conc-col-conta').value = 9; // Coluna 9 é Cartão (Santander) no Kontto
        document.getElementById('conc-sinal').value = 'pos_despesa';
        UICommon.alert("Preset Kontto aplicado! Agora selecione o arquivo CSV e clique em 'Iniciar Sessão de Conciliação'.");
    },

    lerArquivo: function() {
        const fileInput = document.getElementById('conc-file');
        const sep = document.getElementById('conc-sep').value;
        if (!fileInput.files.length) return UICommon.alert("Selecione um arquivo CSV primeiro.");

        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => this.processarCSV(e.target.result, sep, file.name);
        reader.onerror = () => UICommon.alert("Erro ao ler o arquivo.");
        reader.readAsText(file);
    },

    processarCSV: async function(texto, sep, nomeArquivo) {
        const cleanTexto = texto.replace(/^\uFEFF/, '');
        const linhas = cleanTexto.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (linhas.length < 2) return UICommon.alert("Arquivo CSV sem linhas de dados.");

        const colData = parseInt(document.getElementById('conc-col-data').value) - 1;
        const colDesc = parseInt(document.getElementById('conc-col-desc').value) - 1;
        const colVal = parseInt(document.getElementById('conc-col-val').value) - 1;
        const colTipo = (parseInt(document.getElementById('conc-col-tipo').value) || 0) - 1;
        const colCat = (parseInt(document.getElementById('conc-col-cat').value) || 0) - 1;
        const colConta = (parseInt(document.getElementById('conc-col-conta').value) || 0) - 1;
        const fmtData = document.getElementById('conc-fmt-data').value;
        const orientacao = document.getElementById('conc-sinal').value; // neg_despesa ou pos_despesa
        const tolDias = parseInt(document.getElementById('conc-tol').value) || 3;

        const sessaoId = await DB.add("conc_sessoes", {
            nome: `Sessão ${new Date().toLocaleDateString('pt-BR')}`,
            arquivo: nomeArquivo,
            created_at: new Date().toISOString()
        });
        this.sessaoAtualId = sessaoId;

        const extratosExistentes = await DB.getAll("conc_extrato");
        const hashesVistos = new Set(extratosExistentes.map(x => x.hash));

        let novos = 0, repetidos = 0;

        for (let i = 1; i < linhas.length; i++) {
            const colunas = linhas[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
            if (colunas.length <= Math.max(colData, colDesc, colVal)) continue;

            const dataRaw = colunas[colData];
            const descricao = Services.normalizaCaso(colunas[colDesc]);
            const rawVal = colunas[colVal];
            if (!dataRaw || !descricao || !rawVal) continue;

            let dataIso = '';
            if (fmtData === 'DMY' || dataRaw.includes('/')) {
                const partes = dataRaw.split(/[\/\-]/);
                if (partes.length === 3) {
                    dataIso = partes[0].length === 4 ? `${partes[0]}-${partes[1].padStart(2,'0')}-${partes[2].padStart(2,'0')}` : `${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`;
                }
            } else {
                dataIso = dataRaw.substring(0, 10);
            }
            if (dataIso.length !== 10) continue;

            const signedCents = Services.parseBRL(rawVal);
            const absCents = Math.abs(signedCents);
            if (absCents === 0) continue;

            let tipo = "Despesa";
            if (colTipo >= 0 && colunas[colTipo]) {
                const tt = Services.normalizaDesc(colunas[colTipo]);
                tipo = (tt.includes("receit") || tt.includes("credit") || tt.includes("entrada")) ? "Receita" : "Despesa";
            } else {
                let isNeg = signedCents < 0;
                if (orientacao === "pos_despesa") isNeg = !isNeg;
                tipo = isNeg ? "Despesa" : "Receita";
            }

            const categoria = (colCat >= 0 && colunas[colCat]) ? Services.normalizaCaso(colunas[colCat]) : "Outros";
            let conta = (colConta >= 0 && colunas[colConta]) ? Services.normalizaCaso(colunas[colConta]) : "Conta Corrente";
            if (conta && !conta.toLowerCase().startsWith("cart") && !conta.toLowerCase().startsWith("conta") && (conta.toLowerCase().includes("santander") || conta.toLowerCase().includes("nubank"))) {
                conta = `Cartão ${conta}`;
            }

            const hash = Services.extHash(dataIso, descricao, absCents, tipo, conta, i);
            if (hashesVistos.has(hash)) {
                repetidos++;
                continue;
            }
            hashesVistos.add(hash);

            await DB.add("conc_extrato", {
                sessao_id: sessaoId, data: dataIso, descricao, valor_cents: absCents,
                tipo, categoria, conta, linha: i + 1, hash
            });
            novos++;
        }

        await this.gerarSugestoes(sessaoId, tolDias);
        await this.renderSessao(sessaoId);
    },

    gerarSugestoes: async function(sessaoId, tolDias) {
        const extratos = (await DB.getAll("conc_extrato")).filter(e => Number(e.sessao_id) === Number(sessaoId));
        const lancs = await DB.getAll("lancamentos");
        const pags = await DB.getAll("pag_faturas");
        const trs = await DB.getAll("transferencias");

        for (const ext of extratos) {
            const dl = Services.normalizaDesc(ext.descricao);
            // 1. Verifica possível estorno/reembolso
            if (["estorno", "devolu", "reembolso", "chargeback", "cancel"].some(k => dl.includes(k))) {
                await DB.add("conc_match", {
                    extrato_id: ext.id, alvo_tipo: "nenhum", alvo_id: null,
                    tipo_match: "revisao", estado: "sugerida", motivos: "possível estorno/devolução",
                    created_at: new Date().toISOString()
                });
                continue;
            }

            let encontrou = false;
            const dExt = new Date(ext.data);

            // 2. Match exato ou aproximado em lançamentos
            for (const lan of lancs) {
                if (lan.tipo !== ext.tipo) continue;
                const dLan = new Date(lan.data);
                const dd = Math.round(Math.abs(dExt - dLan) / (1000 * 60 * 60 * 24));
                if (dd > tolDias) continue;

                const dn = Services.normalizaDesc(lan.item);
                if (lan.valor_cents === ext.valor_cents) {
                    const motivos = [];
                    if (dd > 0) motivos.push(`div_data ${dd}d`);
                    if (dn !== dl && !dn.includes(dl) && !dl.includes(dn)) motivos.push("div_descricao");
                    await DB.add("conc_match", {
                        extrato_id: ext.id, alvo_tipo: "lancamento", alvo_id: lan.id, alvo_desc: lan.item,
                        tipo_match: dd === 0 && motivos.length === 0 ? "exata" : "aproximada",
                        estado: "sugerida", motivos: motivos.join("; "), created_at: new Date().toISOString()
                    });
                    encontrou = true;
                    break;
                } else if (dn === dl || (dn.length > 3 && (dn.includes(dl) || dl.includes(dn)))) {
                    await DB.add("conc_match", {
                        extrato_id: ext.id, alvo_tipo: "lancamento", alvo_id: lan.id, alvo_desc: lan.item,
                        tipo_match: "aproximada", estado: "sugerida",
                        motivos: `div_valor (${Services.formatBRL(ext.valor_cents)} vs ${Services.formatBRL(lan.valor_cents)})`,
                        created_at: new Date().toISOString()
                    });
                    encontrou = true;
                    break;
                }
            }
            if (encontrou) continue;

            // 3. Match com Transferências ou Pagamentos de Fatura
            for (const tr of trs) {
                const dd = Math.round(Math.abs(dExt - new Date(tr.data)) / (1000 * 60 * 60 * 24));
                if (tr.valor_cents === ext.valor_cents && dd <= tolDias) {
                    await DB.add("conc_match", {
                        extrato_id: ext.id, alvo_tipo: "transferencia", alvo_id: tr.id, alvo_desc: `${tr.origem} ➔ ${tr.destino}`,
                        tipo_match: "transferencia", estado: "sugerida", motivos: "transferência entre contas",
                        created_at: new Date().toISOString()
                    });
                    encontrou = true;
                    break;
                }
            }
            if (encontrou) continue;

            for (const pg of pags) {
                const dd = Math.round(Math.abs(dExt - new Date(pg.data_pagto)) / (1000 * 60 * 60 * 24));
                if (pg.valor_cents === ext.valor_cents && dd <= tolDias) {
                    await DB.add("conc_match", {
                        extrato_id: ext.id, alvo_tipo: "pagamento_fatura", alvo_id: pg.id, alvo_desc: `Pagto Fatura ${pg.cartao}`,
                        tipo_match: "pagamento_fatura", estado: "sugerida", motivos: "pagamento de fatura",
                        created_at: new Date().toISOString()
                    });
                    break;
                }
            }
        }
    },

    renderSessao: async function(sessaoId) {
        const sid = sessaoId || this.sessaoAtualId;
        const extratosAll = await DB.getAll("conc_extrato");
        const extratos = sid ? extratosAll.filter(e => Number(e.sessao_id) === Number(sid)) : extratosAll;
        if (!extratos.length) {
            document.getElementById('conc-analise-container').style.display = 'none';
            return;
        }
        document.getElementById('conc-analise-container').style.display = 'block';

        const matches = await DB.getAll("conc_match");
        let confirmadas = 0, sugeridas = 0, soExtrato = 0, ignoradas = 0;

        const html = extratos.map(ext => {
            const ms = matches.filter(m => Number(m.extrato_id) === Number(ext.id) && m.estado !== 'desfeita');
            const mAtivo = ms[0];

            if (!mAtivo) {
                soExtrato++;
                return `
                    <div class="list-item" style="border-left: 4px solid var(--danger);">
                        <div class="list-item-left">
                            <span class="list-item-title">${UICommon.esc(ext.descricao)}</span>
                            <span class="list-item-sub">${Services.fmtData(ext.data)} • ${UICommon.esc(ext.categoria)} • ${UICommon.esc(ext.conta)}</span>
                            <span class="st erro" style="width:fit-content;margin-top:4px;">Só no extrato (Ausente no App)</span>
                        </div>
                        <div class="list-item-val ${ext.tipo === 'Receita' ? 'rec' : 'des'}">${Services.formatBRL(ext.valor_cents)}</div>
                        <div class="action-buttons">
                            <button class="btn-success btn-small" onclick="UI4.importarAusenteDireto(${ext.id})">+ Importar p/ Extrato</button>
                            <button class="btn-secondary btn-small" onclick="UI4.ignorarSemMatch(${ext.id})">Ignorar</button>
                        </div>
                    </div>
                `;
            }

            if (mAtivo.estado === 'confirmada') confirmadas++;
            else if (mAtivo.estado === 'ignorada') ignoradas++;
            else sugeridas++;

            const corBorda = mAtivo.estado === 'confirmada' ? 'var(--success)' : (mAtivo.estado === 'ignorada' ? 'var(--text-muted)' : 'var(--warning)');

            return `
                <div class="list-item" style="border-left: 4px solid ${corBorda};">
                    <div class="list-item-left">
                        <span class="list-item-title">${UICommon.esc(ext.descricao)}</span>
                        <span class="list-item-sub">${Services.fmtData(ext.data)} • Match (${mAtivo.tipo_match}): <b>${UICommon.esc(mAtivo.alvo_desc || mAtivo.alvo_tipo)}</b></span>
                        ${mAtivo.motivos ? `<span class="list-item-sub" style="color:var(--warning);">Motivo/Divergência: ${UICommon.esc(mAtivo.motivos)}</span>` : ''}
                        <div style="margin-top:4px;"><span class="st ${mAtivo.estado}">${mAtivo.estado}</span> ${mAtivo.justificativa ? `<span class="list-item-sub">(${UICommon.esc(mAtivo.justificativa)})</span>` : ''}</div>
                    </div>
                    <div class="list-item-val ${ext.tipo === 'Receita' ? 'rec' : 'des'}">${Services.formatBRL(ext.valor_cents)}</div>
                    <div class="action-buttons">
                        ${mAtivo.estado === 'sugerida' ? `
                            <button class="btn-success btn-small" onclick="UI4.acaoMatch(${mAtivo.id}, 'confirmar')">✓ Confirmar</button>
                            <button class="btn-warning btn-small" onclick="UI4.acaoMatch(${mAtivo.id}, 'rejeitar')">✗ Rejeitar</button>
                            <button class="btn-secondary btn-small" onclick="UI4.acaoMatch(${mAtivo.id}, 'ignorar')">Ignorar c/ Justificativa</button>
                        ` : `
                            <button class="btn-secondary btn-small" onclick="UI4.acaoMatch(${mAtivo.id}, 'desfazer')">↺ Desfazer (${mAtivo.estado})</button>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('conc-resumo').innerHTML = `
            Total lido: <b>${extratos.length}</b> • 
            Confirmadas: <b style="color:var(--success)">${confirmadas}</b> • 
            Sugestões: <b style="color:var(--warning)">${sugeridas}</b> • 
            Só no Extrato: <b style="color:var(--danger)">${soExtrato}</b> • 
            Ignoradas: <b>${ignoradas}</b>
        `;
        document.getElementById('conc-list').innerHTML = html;
    },

    acaoMatch: async function(matchId, acao) {
        const matches = await DB.getAll("conc_match");
        const m = matches.find(x => Number(x.id) === Number(matchId));
        if (!m) return;

        let novoEstado = m.estado;
        let just = m.justificativa || "";

        if (acao === 'confirmar') novoEstado = 'confirmada';
        else if (acao === 'rejeitar') novoEstado = 'desfeita';
        else if (acao === 'desfazer') novoEstado = 'sugerida';
        else if (acao === 'ignorar') {
            just = prompt("Informe a justificativa para ignorar este registro:", "Transferência/ajuste interno");
            if (!just || !just.trim()) return UICommon.alert("Ignorar exige justificativa!");
            novoEstado = 'ignorada';
        }

        await DB.update("conc_match", matchId, { estado: novoEstado, justificativa: just });
        await DB.add("conc_hist", { match_id: matchId, ts: new Date().toISOString(), acao, antes: m.estado, depois: novoEstado, justificativa: just });
        this.renderSessao();
    },

    ignorarSemMatch: async function(extratoId) {
        const just = prompt("Informe a justificativa para ignorar esta linha do extrato:", "Desconsiderar");
        if (!just || !just.trim()) return UICommon.alert("Ignorar exige justificativa!");
        await DB.add("conc_match", {
            extrato_id: extratoId, alvo_tipo: "nenhum", alvo_id: null,
            tipo_match: "manual", estado: "ignorada", motivos: "ignorado pelo usuário", justificativa: just.trim(),
            created_at: new Date().toISOString()
        });
        this.renderSessao();
    },

    importarAusenteDireto: async function(extratoId) {
        const extratos = await DB.getAll("conc_extrato");
        const ext = extratos.find(e => Number(e.id) === Number(extratoId));
        if (!ext) return;

        const lid = await DB.add("lancamentos", {
            data: ext.data, competencia: ext.data.substring(0, 7),
            item: ext.descricao, tipo: ext.tipo || "Despesa",
            categoria: ext.categoria || "Outros", conta: ext.conta || "Conta Corrente",
            valor_cents: ext.valor_cents, status: "pago", origem: "conciliado",
            obs: `Importado da conciliação (extrato #${ext.id})`,
            hash: Services.contentHash(ext.data, ext.descricao, ext.tipo || "Despesa", ext.categoria || "Outros", ext.conta || "Conta Corrente", ext.valor_cents)
        });

        await DB.add("conc_match", {
            extrato_id: ext.id, alvo_tipo: "lancamento", alvo_id: lid, alvo_desc: ext.descricao,
            tipo_match: "manual", estado: "confirmada", motivos: "importado do extrato",
            created_at: new Date().toISOString()
        });
        this.renderSessao();
    },

    importarTodosAusentes: async function() {
        const sid = this.sessaoAtualId;
        const extratos = (await DB.getAll("conc_extrato")).filter(e => !sid || Number(e.sessao_id) === Number(sid));
        const matches = await DB.getAll("conc_match");
        let count = 0;

        for (const ext of extratos) {
            const temAtivo = matches.some(m => Number(m.extrato_id) === Number(ext.id) && m.estado !== 'desfeita');
            if (!temAtivo) {
                await this.importarAusenteDireto(ext.id);
                count++;
            }
        }
        UICommon.alert(`${count} registro(s) ausente(s) importado(s) diretamente para o seu Extrato e Conciliado(s)!`);
        this.renderSessao();
    }
};
