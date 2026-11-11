
// 1. DATABASE COMPLETO
const DB_NAME = "GestorFinanceiroDB";
const DB_VERSION = 2; // Incrementado para incluir todas as tabelas
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            // Todas as tabelas do SCHEMA original do database.py
            const stores = ["lancamentos", "contas", "cartoes", "categorias", "pag_faturas", 
                            "grupos_parc", "fixas", "metas", "mov_metas", "transferencias", 
                            "quem_me_deve", "qmd_parc"];
            stores.forEach(name => {
                if (!database.objectStoreNames.contains(name)) {
                    database.createObjectStore(name, { keyPath: "id", autoIncrement: true });
                }
            });
        };
        request.onsuccess = (e) => { db = e.target.result; seedData().then(resolve); };
        request.onerror = (e) => reject(e);
    });
}

function addRecord(storeName, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const req = tx.objectStore(storeName).put(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function getAll(storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function seedData() {
    const cats = await getAll("categorias");
    if (cats.length === 0) {
        const limitesIniciais = { "Alimentação": 30000, "Mercado": 30000, "Eletrônicos": 30000, "Moradia": 30000, "Saúde": 30000 };
        for (const [nome, limite] of Object.entries(limitesIniciais)) {
            await addRecord("categorias", { nome, limite_cents: limite });
        }
    }
    const contas = await getAll("contas");
    if (contas.length === 0) {
        await addRecord("contas", { nome: "Conta Corrente", tipo: "Conta", saldo_inicial_cents: 0, ativa: 1 });
    }
    const cartoes = await getAll("cartoes");
    if (cartoes.length === 0) {
        await addRecord("cartoes", { nome: "Cartão Nubank", conta_pagto: "Conta Corrente", limite_cents: 500000, fechamento: 10, ativo: 1 });
    }
}

// 2. NAVEGAÇÃO COMPLETA
document.querySelectorAll('.nav-item, .menu-btn').forEach(item => {
    item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        
        if (item.classList.contains('nav-item')) {
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        }

        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById(target).classList.add('active');
        
        const title = target.replace('view-', '').replace('_', ' ');
        document.getElementById('header-title').innerText = title;

        if (target === 'view-Dashboard') renderDashboard();
        if (target === 'view-Extrato') renderExtrato();
        if (target === 'view-Novo_lancamento') populateDropdowns();
    });
});

function formatBRL(cents) { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// 3. LOGIC (SERVICES.PY PORT)
async function populateDropdowns() {
    const cats = await getAll("categorias");
    const contas = await getAll("contas");
    const cartoes = await getAll("cartoes");
    
    document.getElementById("novo-categoria").innerHTML = cats.map(c => `<option value="${c.nome}">${c.nome}</option>`).join('');
    
    let allAccounts = contas.map(c => `<option value="${c.nome}">${c.nome}</option>`);
    allAccounts = allAccounts.concat(cartoes.map(c => `<option value="${c.nome}">${c.nome}</option>`));
    document.getElementById("novo-conta").innerHTML = allAccounts.join('');
    
    document.getElementById("novo-data").valueAsDate = new Date();
}

document.getElementById('form-novo').addEventListener('submit', async (e) => {
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
        const baseVal = Math.floor(cents / n);
        const resto = cents % n;
        
        const grupo = { descricao: itemDesc, total_cents: cents, n: n, data_compra: dataIso, conta, categoria };
        const grupoId = await addRecord("grupos_parc", grupo);
        
        let currentDate = new Date(dataIso);
        for(let i=0; i<n; i++) {
            let parcVal = baseVal + (i < resto ? 1 : 0);
            let pDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, currentDate.getDate());
            await addRecord("lancamentos", {
                data: pDate.toISOString().split('T')[0],
                competencia: pDate.toISOString().substring(0, 7),
                item: `${itemDesc} (${i+1} de ${n})`,
                tipo, valor_cents: parcVal, categoria, conta, status,
                origem: 'parcela', grupo_id: grupoId, numero: i+1
            });
        }
        alert(`Salvo parcelado em ${n}x!`);
    } else {
        await addRecord("lancamentos", {
            data: dataIso, competencia: dataIso.substring(0, 7), item: itemDesc,
            tipo, valor_cents: cents, categoria, conta, status, origem: 'manual'
        });
        alert("Lançamento salvo!");
    }
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
    const cartoes = await getAll("cartoes");
    const pagFaturas = await getAll("pag_faturas");
    const currentComp = new Date().toISOString().substring(0, 7);
    
    let recMes = 0; let desMes = 0; let saldoAcumulado = 0;
    
    // Calculo do comprometido (todas as despesas em cartão menos o que já foi pago em pag_faturas)
    let totalCartao = 0;
    let totalPagoFatura = 0;
    
    const cartaoNames = cartoes.map(c => c.nome);
    
    lancamentos.forEach(l => {
        if (cartaoNames.includes(l.conta) && l.tipo === 'Despesa') {
            totalCartao += l.valor_cents;
        }

        if (l.status === 'pago') {
            if (l.tipo === 'Receita') saldoAcumulado += l.valor_cents;
            else if (!cartaoNames.includes(l.conta)) saldoAcumulado -= l.valor_cents;
        }

        if (l.competencia === currentComp) {
            if (l.tipo === 'Receita') recMes += l.valor_cents;
            else desMes += l.valor_cents;
        }
    });

    pagFaturas.forEach(pf => {
        saldoAcumulado -= pf.valor_cents;
        totalPagoFatura += pf.valor_cents;
    });

    const faturasAbertas = totalCartao - totalPagoFatura;

    document.getElementById('kpi-saldo').innerText = formatBRL(recMes - desMes);
    document.getElementById('kpi-receitas').innerText = formatBRL(recMes);
    document.getElementById('kpi-despesas').innerText = formatBRL(desMes);
    document.getElementById('kpi-acumulado').innerText = formatBRL(saldoAcumulado);
    document.getElementById('kpi-faturas').innerText = formatBRL(faturasAbertas);
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
    a.download = `gestor_backup_completo_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
});

initDB().then(() => { renderDashboard(); populateDropdowns(); });
