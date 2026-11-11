
const DB_NAME = "GestorFinanceiroDB";
const DB_VERSION = 1;
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains("lancamentos")) {
                const ls = database.createObjectStore("lancamentos", { keyPath: "id", autoIncrement: true });
                ls.createIndex("data", "data", { unique: false });
                ls.createIndex("competencia", "competencia", { unique: false });
            }
            if (!database.objectStoreNames.contains("categorias")) {
                database.createObjectStore("categorias", { keyPath: "nome" });
            }
            if (!database.objectStoreNames.contains("contas")) {
                database.createObjectStore("contas", { keyPath: "nome" });
            }
        };
        request.onsuccess = (e) => { db = e.target.result; seedData().then(resolve); };
        request.onerror = (e) => reject(e);
    });
}

function addRecord(storeName, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.put(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function getAll(storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function seedData() {
    const cats = await getAll("categorias");
    if (cats.length === 0) {
        const defaultCats = ["Alimentação", "Moradia", "Transporte", "Saúde", "Salário", "Lazer", "Assinaturas"];
        for (let c of defaultCats) await addRecord("categorias", { nome: c, limite_cents: 0 });
    }
    const contas = await getAll("contas");
    if (contas.length === 0) {
        await addRecord("contas", { nome: "Carteira", tipo: "Carteira", saldo_inicial_cents: 0 });
        await addRecord("contas", { nome: "Conta Corrente", tipo: "Conta", saldo_inicial_cents: 0 });
        await addRecord("contas", { nome: "Cartão Nubank", tipo: "Cartão", saldo_inicial_cents: 0 });
    }
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        const target = item.getAttribute('data-target');
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById(target).classList.add('active');
        const titles = { 'view-dashboard': 'Dashboard', 'view-extrato': 'Lançamentos', 'view-novo': 'Novo Lançamento', 'view-config': 'Backup' };
        document.getElementById('header-title').innerText = titles[target];
        if (target === 'view-dashboard') renderDashboard();
        if (target === 'view-extrato') renderExtrato();
        if (target === 'view-novo') populateDropdowns();
    });
});

function formatBRL(cents) { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

async function populateDropdowns() {
    const cats = await getAll("categorias");
    const contas = await getAll("contas");
    document.getElementById("novo-categoria").innerHTML = cats.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    document.getElementById("novo-conta").innerHTML = contas.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    document.getElementById("novo-data").valueAsDate = new Date();
}

document.getElementById('form-novo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const dataIso = document.getElementById('novo-data').value;
    const cents = Math.round(parseFloat(document.getElementById('novo-valor').value) * 100);
    const lancamento = {
        data: dataIso,
        competencia: dataIso.substring(0, 7),
        item: document.getElementById('novo-item').value,
        tipo: document.getElementById('novo-tipo').value,
        valor_cents: cents,
        categoria: document.getElementById('novo-categoria').value,
        conta: document.getElementById('novo-conta').value,
        status: document.getElementById('novo-status').value,
        origem: 'manual',
        created_at: new Date().toISOString()
    };
    await addRecord("lancamentos", lancamento);
    alert("Salvo offline!");
    document.getElementById('form-novo').reset();
    populateDropdowns();
});

async function renderExtrato() {
    let lancamentos = await getAll("lancamentos");
    lancamentos.sort((a, b) => b.data.localeCompare(a.data));
    document.getElementById('extrato-list').innerHTML = lancamentos.map(l => `
        <div class="list-item">
            <div class="list-item-left">
                <span class="list-item-title">${l.item}</span>
                <span class="list-item-sub">${l.data.split('-').reverse().join('/')} • ${l.categoria} • ${l.conta}</span>
            </div>
            <div class="list-item-val ${l.tipo === 'Receita' ? 'rec' : 'des'}">
                ${l.tipo === 'Receita' ? '+' : '-'}${formatBRL(l.valor_cents)}
            </div>
        </div>
    `).join('');
}

async function renderDashboard() {
    const lancamentos = await getAll("lancamentos");
    const currentComp = new Date().toISOString().substring(0, 7);
    let recMes = 0; let desMes = 0; let saldoAcumulado = 0;
    lancamentos.forEach(l => {
        if (l.status === 'pago') {
            if (l.tipo === 'Receita') saldoAcumulado += l.valor_cents;
            else saldoAcumulado -= l.valor_cents;
        }
        if (l.competencia === currentComp) {
            if (l.tipo === 'Receita') recMes += l.valor_cents;
            else desMes += l.valor_cents;
        }
    });
    document.getElementById('kpi-saldo').innerText = formatBRL(recMes - desMes);
    document.getElementById('kpi-receitas').innerText = formatBRL(recMes);
    document.getElementById('kpi-despesas').innerText = formatBRL(desMes);
    document.getElementById('kpi-acumulado').innerText = formatBRL(saldoAcumulado);
}

document.getElementById('btn-export').addEventListener('click', async () => {
    const lancamentos = await getAll("lancamentos");
    if (lancamentos.length === 0) return alert("Nenhum dado para exportar.");
    const header = "Data,Item,Tipo,Categoria,Conta,Valor,Status\n";
    const csv = lancamentos.map(l => `${l.data},"${l.item}",${l.tipo},${l.categoria},${l.conta},${l.valor_cents / 100},${l.status}`).join("\n");
    const blob = new Blob([header + csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gestor_backup_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
});

initDB().then(() => { renderDashboard(); populateDropdowns(); });
