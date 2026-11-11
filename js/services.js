// js/services.js - Equivalente ao services.py + importer.py + conciliacao.py
const Services = {
    formatBRL: (cents) => {
        const val = Number(cents || 0) / 100;
        return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    },

    fmtData: (iso) => {
        if (!iso) return "";
        return String(iso).substring(0, 10).split('-').reverse().join('/');
    },

    parseBRL: (valueStr) => {
        if (valueStr === null || valueStr === undefined || valueStr === "") return 0;
        let s = String(valueStr).trim().replace("R$", "").trim();
        let neg = false;
        if (s.startsWith("(") && s.endsWith(")")) { neg = true; s = s.slice(1, -1); }
        if (s.startsWith("-")) { neg = true; s = s.slice(1); }
        else if (s.startsWith("+")) { s = s.slice(1); }
        if (s.includes(",")) {
            s = s.replace(/\./g, "").replace(",", ".");
        }
        const num = parseFloat(s);
        if (isNaN(num)) return 0;
        return Math.round(num * 100) * (neg ? -1 : 1);
    },

    normalizaDesc: (s) => {
        return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
    },

    normalizaCaso: (t) => {
        const s = String(t || "").trim();
        if (s && s === s.toUpperCase() && s !== s.toLowerCase()) {
            return s.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        }
        return s;
    },

    hashStr: (str) => {
        let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length;
        for (let i = 0, ch; i < str.length; i++) {
            ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
    },

    contentHash: function(data, item, tipo, categoria, conta, valor_cents) {
        const base = [String(data), String(item).trim().toLowerCase(), tipo, String(categoria).trim(), String(conta).trim(), String(Math.abs(parseInt(valor_cents)))].join("|");
        return "imp-" + this.hashStr(base);
    },

    extHash: function(data, descricao, valor_cents, tipo, conta, txn) {
        const base = [String(data), this.normalizaDesc(descricao), String(Math.abs(parseInt(valor_cents))), tipo, String(conta || "").trim(), String(txn || "")].join("|");
        return "conc-" + this.hashStr(base);
    },

    getCompetencia: (dateIso) => String(dateIso || "").substring(0, 7),

    // Calcula a competência (mês da fatura) de uma compra respeitando o Dia de Fechamento do cartão.
    // Regra: se dia da compra >= dia de fechamento, cai na fatura do mês seguinte; caso contrário, no mesmo mês.
    calcularCompetenciaCartao: function(dataIso, nomeConta, cartoesList, tipo = "Despesa") {
        const compBase = this.getCompetencia(dataIso);
        if (!dataIso || dataIso.length < 10 || tipo !== "Despesa") return compBase;
        const contaStr = String(nomeConta || "").trim();
        if (!contaStr) return compBase;

        const norm = (s) => String(s || "").toLowerCase().replace(/^cart[aã]o\s+/i, "").trim();
        const alvo = norm(contaStr);
        const isCardName = /^cart[aã]o/i.test(contaStr);

        let cartaoObj = null;
        if (Array.isArray(cartoesList)) {
            cartaoObj = cartoesList.find(c => c.nome === contaStr || norm(c.nome) === alvo);
        }
        if (!cartaoObj && !isCardName) return compBase;

        const diaFech = cartaoObj && cartaoObj.fechamento ? parseInt(cartaoObj.fechamento) : null;
        if (!diaFech || isNaN(diaFech)) return compBase;

        const diaCompra = parseInt(dataIso.substring(8, 10));
        if (diaCompra >= diaFech) {
            return this.addMonths(compBase, 1);
        }
        return compBase;
    },

    addMonths: (isoComp, k) => {
        let [y, m] = isoComp.split('-').map(Number);
        m += k;
        y += Math.floor((m - 1) / 12);
        m = (((m - 1) % 12) + 12) % 12 + 1;
        return `${y}-${String(m).padStart(2, '0')}`;
    },

    splitParcelas: (totalCents, n) => {
        const total = Math.abs(Math.round(totalCents));
        const base = Math.floor(total / n);
        const resto = total % n;
        const parcelas = [];
        for (let i = 0; i < n; i++) parcelas.push(base + (i < resto ? 1 : 0));
        return parcelas;
    },

    // Motor completo do Dashboard & Resumo Mensal (espelha services.py + exports.py)
    dadosCompletosMes: async function(comp) {
        const [lancamentos, contas, cartoes, categorias, pagFaturas, fixas, metas, movMetas, qmd, qmdParc] = await Promise.all([
            DB.getAll("lancamentos"), DB.getAll("contas"), DB.getAll("cartoes"), DB.getAll("categorias"),
            DB.getAll("pag_faturas"), DB.getAll("fixas"), DB.getAll("metas"), DB.getAll("mov_metas"),
            DB.getAll("quem_me_deve"), DB.getAll("qmd_parc")
        ]);

        const cartaoNames = cartoes.map(c => c.nome);
        const eCartao = (nomeConta) => cartaoNames.includes(nomeConta) || String(nomeConta || "").toLowerCase().startsWith("cartão") || String(nomeConta || "").toLowerCase().startsWith("cartao");

        // Saldo inicial das contas
        let realizadoCaixa = contas.reduce((acc, c) => acc + (parseInt(c.saldo_inicial_cents) || 0), 0);
        let totalCartaoGeral = 0;
        let totalPagoFaturaGeral = pagFaturas.reduce((acc, pf) => acc + (parseInt(pf.valor_cents) || 0), 0);

        let receitasMes = 0, despesasMes = 0, desPagasMes = 0, desPendentesMes = 0;
        let fixasQtd = 0, fixasTotal = 0, parcQtd = 0, parcTotal = 0;

        lancamentos.forEach(l => {
            const val = Math.abs(parseInt(l.valor_cents) || 0);
            const isCard = eCartao(l.conta);
            const lComp = l.competencia || this.getCompetencia(l.data);

            if (isCard && l.tipo === "Despesa") {
                totalCartaoGeral += val;
            }

            if (l.status === "pago") {
                if (l.tipo === "Receita") realizadoCaixa += val;
                else if (!isCard) realizadoCaixa -= val;
            }

            if (lComp === comp) {
                if (l.tipo === "Receita") {
                    receitasMes += val;
                } else {
                    despesasMes += val;
                    if (l.status === "pago") desPagasMes += val;
                    else desPendentesMes += val;

                    if (l.origem === "fixa") { fixasQtd++; fixasTotal += val; }
                    if (l.origem === "parcela" || /\(\d+\s*(?:de|\/)\s*\d+\)/i.test(l.item)) { parcQtd++; parcTotal += val; }
                }
            }
        });

        realizadoCaixa -= totalPagoFaturaGeral;

        // Reservado em Metas (mov_metas + valor_externo_cents)
        const metasCalc = metas.map(m => {
            const movs = movMetas.filter(mv => Number(mv.meta_id) === Number(m.id));
            const saldoMov = movs.reduce((acc, mv) => acc + (mv.tipo === "retirada" ? -mv.valor_cents : mv.valor_cents), 0);
            const acumulado = (parseInt(m.valor_externo_cents) || 0) + saldoMov;
            return { ...m, acumulado_cents: Math.max(0, acumulado), saldo_interno_cents: Math.max(0, saldoMov) };
        });

        const reservadoMetas = metasCalc.reduce((acc, m) => acc + m.saldo_interno_cents, 0);
        const disponivelGastar = realizadoCaixa - reservadoMetas;
        const faturasAbertasGeral = Math.max(0, totalCartaoGeral - totalPagoFaturaGeral);

        // Cartoes detalhados e Faturas do mes
        let fatPendenteMes = 0;
        const cartoesDetalhe = cartoes.map(c => {
            const gastosCartaoTotal = lancamentos.filter(l => l.conta === c.nome && l.tipo === "Despesa").reduce((acc, l) => acc + l.valor_cents, 0);
            const pagosCartaoTotal = pagFaturas.filter(p => p.cartao === c.nome).reduce((acc, p) => acc + p.valor_cents, 0);
            const comprometido = Math.max(0, gastosCartaoTotal - pagosCartaoTotal);
            const disponivel = c.limite_cents ? Math.max(0, c.limite_cents - comprometido) : null;

            const gastosMes = lancamentos.filter(l => l.conta === c.nome && (l.competencia || this.getCompetencia(l.data)) === comp && l.tipo === "Despesa");
            const totalMes = gastosMes.reduce((acc, l) => acc + l.valor_cents, 0);
            const pagoMes = pagFaturas.filter(p => p.cartao === c.nome && p.fechamento === comp).reduce((acc, p) => acc + p.valor_cents, 0);
            const pendMes = Math.max(0, totalMes - pagoMes);
            fatPendenteMes += pendMes;

            return {
                ...c,
                logo: Logos.getLogoHTML(c.nome),
                comprometido,
                disponivel,
                faturaMes: { total: totalMes, pago: pagoMes, pendente: pendMes, status: pendMes === 0 && totalMes > 0 ? "paga" : (totalMes > 0 ? "aberta" : "zerada") }
            };
        });

        // Despesas por Categoria no Mes
        const catsMap = {};
        categorias.forEach(ct => { catsMap[ct.nome] = { nome: ct.nome, id: ct.id, gasto: 0, limite: ct.limite_cents || 0, itens: [] }; });
        lancamentos.filter(l => (l.competencia || this.getCompetencia(l.data)) === comp && l.tipo === "Despesa").forEach(l => {
            const cNome = l.categoria || "Sem Categoria";
            if (!catsMap[cNome]) catsMap[cNome] = { nome: cNome, id: null, gasto: 0, limite: 0, itens: [] };
            catsMap[cNome].gasto += l.valor_cents;
            catsMap[cNome].itens.push(l);
        });
        const catsList = Object.values(catsMap).sort((a, b) => b.gasto - a.gasto);

        // Alertas Inteligentes
        const alertas = [];
        catsList.forEach(c => {
            if (c.limite > 0 && c.gasto > c.limite) {
                alertas.push({ nivel: "erro", msg: `Categoria "${c.nome}" estourou o limite (${this.formatBRL(c.gasto)} de ${this.formatBRL(c.limite)})` });
            } else if (c.limite > 0 && c.gasto >= c.limite * 0.85) {
                alertas.push({ nivel: "atencao", msg: `Categoria "${c.nome}" atingiu ${Math.round(c.gasto/c.limite*100)}% do limite.` });
            }
        });
        if (desPendentesMes > 0) {
            alertas.push({ nivel: "atencao", msg: `Você possui ${this.formatBRL(desPendentesMes)} em despesas pendentes neste mês.` });
        }
        if (disponivelGastar < 0) {
            alertas.push({ nivel: "erro", msg: `Atenção: Seu saldo livre disponível está negativo em ${this.formatBRL(disponivelGastar)}.` });
        }

        // A Pagar (despesas pendentes do mês) e A Receber (receitas pendentes + parcelas de Quem Me Deve abertas)
        const aPagar = lancamentos.filter(l => (l.competencia || this.getCompetencia(l.data)) === comp && l.tipo === "Despesa" && l.status === "pendente").sort((a,b) => a.data.localeCompare(b.data));
        const recPendentes = lancamentos.filter(l => (l.competencia || this.getCompetencia(l.data)) === comp && l.tipo === "Receita" && l.status === "pendente").map(l => ({ data: l.data, desc: l.item, valor_cents: l.valor_cents, origem: "lancamento", id: l.id }));
        const qmdAbertas = qmdParc.filter(p => p.status !== "pago" && this.getCompetencia(p.vencimento) === comp).map(p => ({ data: p.vencimento, desc: `${p.devedor} (${p.numero}/${p.total_n})`, valor_cents: p.valor_cents, origem: "qmd", id: p.id }));
        const aReceber = [...recPendentes, ...qmdAbertas].sort((a,b) => a.data.localeCompare(b.data));

        // Evolucao 6 meses para o grafico Catmull-Rom
        const evo = [];
        for (let k = -4; k <= 1; k++) {
            const mComp = this.addMonths(comp, k);
            let r = 0, d = 0, f = 0;
            lancamentos.forEach(l => {
                if ((l.competencia || this.getCompetencia(l.data)) === mComp) {
                    if (l.tipo === "Receita") r += l.valor_cents;
                    else {
                        d += l.valor_cents;
                        if (eCartao(l.conta)) f += l.valor_cents;
                    }
                }
            });
            evo.push({ comp: mComp, rec: r, des: d, fat: f });
        }

        return {
            comp, realizadoCaixa, reservadoMetas, disponivelGastar, faturasAbertasGeral,
            receitasMes, despesasMes, saldoMes: receitasMes - despesasMes,
            desPagasMes, desPendentesMes, fatPendenteMes,
            fixasQtd, fixasTotal, parcQtd, parcTotal,
            cartoesDetalhe, catsList, alertas, metasCalc, aPagar, aReceber, evo
        };
    }
};
