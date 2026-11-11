// js/ui3.js
const UI3 = {
    setupListeners: function() {
        document.getElementById('form-cat').addEventListener('submit', this.saveCategoria.bind(this));
        document.getElementById('form-meta').addEventListener('submit', this.saveMeta.bind(this));
        document.getElementById('form-transf').addEventListener('submit', this.saveTransferencia.bind(this));
        document.getElementById('form-qmd').addEventListener('submit', this.saveDivida.bind(this));
        
        document.getElementById('t-data').valueAsDate = new Date();
        document.getElementById('q-ini').valueAsDate = new Date();
    },

    saveCategoria: async function(e) {
        e.preventDefault();
        const nome = document.getElementById('cat-nome').value.trim();
        const limiteStr = document.getElementById('cat-lim').value;
        const limite_cents = limiteStr ? Services.parseBRL(limiteStr) : 0;
        
        await DB.add("categorias", { nome, limite_cents });
        UICommon.alert(`Categoria '${nome}' salva!`);
        document.getElementById('form-cat').reset();
        this.renderCategorias();
    },

    renderCategorias: async function() {
        const cats = await DB.getAll("categorias");
        document.getElementById('cats-list').innerHTML = cats.map(c => `<div class="list-item"><div class="list-item-left"><span class="list-item-title">${c.nome}</span></div><div class="list-item-val">${Services.formatBRL(c.limite_cents)} limite</div></div>`).join('');
    },

    saveMeta: async function(e) {
        e.preventDefault();
        const nome = document.getElementById('m-nome').value.trim();
        const objetivo_cents = Services.parseBRL(document.getElementById('m-obj').value);
        const prazo = document.getElementById('m-prazo').value || null;
        
        await DB.add("metas", { nome, objetivo_cents, prazo, valor_externo_cents: 0, ativa: 1 });
        UICommon.alert(`Meta '${nome}' criada!`);
        document.getElementById('form-meta').reset();
        this.renderMetas();
    },

    renderMetas: async function() {
        const metas = await DB.getAll("metas");
        document.getElementById('metas-list').innerHTML = metas.map(m => `<div class="list-item"><div class="list-item-left"><span class="list-item-title">${m.nome}</span><span class="list-item-sub">Prazo: ${m.prazo || 'N/A'}</span></div><div class="list-item-val" style="color:var(--primary)">Objetivo: ${Services.formatBRL(m.objetivo_cents)}</div></div>`).join('');
    },

    saveTransferencia: async function(e) {
        e.preventDefault();
        const data = document.getElementById('t-data').value;
        const origem = document.getElementById('t-orig').value;
        const destino = document.getElementById('t-dest').value;
        const valor_cents = Services.parseBRL(document.getElementById('t-val').value);
        const descricao = document.getElementById('t-desc').value;
        
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
        
        document.getElementById('transf-list').innerHTML = transfs.map(t => `<div class="list-item"><div class="list-item-left"><span class="list-item-title">${t.origem} ➔ ${t.destino}</span><span class="list-item-sub">${t.data.split('-').reverse().join('/')} • ${t.descricao}</span></div><div class="list-item-val" style="color:var(--primary)">${Services.formatBRL(t.valor_cents)}</div></div>`).join('');
    },

    saveDivida: async function(e) {
        e.preventDefault();
        const devedor = document.getElementById('q-dev').value.trim();
        const descricao = document.getElementById('q-desc').value.trim();
        const total_cents = Services.parseBRL(document.getElementById('q-val').value);
        const n = parseInt(document.getElementById('q-n').value);
        const data_ini = document.getElementById('q-ini').value;
        
        await DB.add("quem_me_deve", { devedor, descricao, valor_total_cents: total_cents, n, data_ini, status: 'aberta' });
        UICommon.alert(`Dívida de '${devedor}' registrada!`);
        document.getElementById('form-qmd').reset();
        document.getElementById('q-ini').valueAsDate = new Date();
        this.renderQuemMeDeve();
    },

    renderQuemMeDeve: async function() {
        const qmd = await DB.getAll("quem_me_deve");
        document.getElementById('qmd-list').innerHTML = qmd.map(q => `<div class="list-item"><div class="list-item-left"><span class="list-item-title">${q.devedor}</span><span class="list-item-sub">${q.descricao} • ${q.n}x</span></div><div class="list-item-val rec">${Services.formatBRL(q.valor_total_cents)}</div></div>`).join('');
    },

    exportBackup: async function() {
        const lancamentos = await DB.getAll("lancamentos");
        if (lancamentos.length === 0) return UICommon.alert("Nenhum dado para exportar.");
        
        const header = "Data,Item,Tipo,Categoria,Conta,Valor,Status\n";
        const csv = lancamentos.map(l => `${l.data},"${l.item}",${l.tipo},${l.categoria},${l.conta},${l.valor_cents / 100},${l.status}`).join("\n");
        
        const blob = new Blob([header + csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gestor_backup_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }
};
