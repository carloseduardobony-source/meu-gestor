// js/database.js - Equivalente ao database.py + migracoes.py (17 tabelas completas)
const DB_NAME = "GestorFinanceiroDB";
const DB_VERSION = 7; // Versão 7 conforme migracoes.py
let db;

const DB = {
    STORES: [
        "lancamentos", "contas", "cartoes", "categorias", "pag_faturas", 
        "grupos_parc", "fixas", "metas", "mov_metas", "transferencias", 
        "quem_me_deve", "qmd_parc",
        "conc_sessoes", "conc_extrato", "conc_match", "conc_hist", "conc_revisados", "config"
    ],

    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const database = e.target.result;
                this.STORES.forEach(name => {
                    if (!database.objectStoreNames.contains(name)) {
                        const store = database.createObjectStore(name, { keyPath: "id", autoIncrement: true });
                        if (name === "lancamentos") {
                            store.createIndex("data", "data", { unique: false });
                            store.createIndex("competencia", "competencia", { unique: false });
                            store.createIndex("hash", "hash", { unique: false });
                        }
                        if (name === "conc_extrato") {
                            store.createIndex("hash", "hash", { unique: false });
                            store.createIndex("sessao_id", "sessao_id", { unique: false });
                        }
                    }
                });
            };
            request.onsuccess = (e) => { 
                db = e.target.result; 
                this.seedData().then(resolve); 
            };
            request.onerror = (e) => reject(e);
        });
    },

    add: function(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            const req = tx.objectStore(storeName).put(data);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    getAll: function(storeName) {
        return new Promise((resolve, reject) => {
            if (!db.objectStoreNames.contains(storeName)) return resolve([]);
            const tx = db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    },

    delete: function(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            const req = tx.objectStore(storeName).delete(Number(id));
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    update: function(storeName, id, newData) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            const store = tx.objectStore(storeName);
            const getReq = store.get(Number(id));
            getReq.onsuccess = () => {
                const item = getReq.result;
                if (!item) return resolve();
                const updatedItem = { ...item, ...newData };
                const putReq = store.put(updatedItem);
                putReq.onsuccess = () => resolve(updatedItem);
                putReq.onerror = () => reject(putReq.error);
            };
            getReq.onerror = () => reject(getReq.error);
        });
    },

    seedData: async function() {
        const cats = await this.getAll("categorias");
        if (cats.length === 0) {
            const iniciais = { "Alimentação": 60000, "Mercado": 80000, "Lazer": 40000, "Vestuário": 30000, "Moradia": 120000, "Saúde": 35000, "Transporte": 30000, "Salário": 0 };
            for (const [nome, limite] of Object.entries(iniciais)) {
                await this.add("categorias", { nome, limite_cents: limite });
            }
        }
        const contas = await this.getAll("contas");
        if (contas.length === 0) {
            await this.add("contas", { nome: "Conta Corrente", tipo: "Conta", saldo_inicial_cents: 0, ativa: 1 });
            await this.add("contas", { nome: "Carteira Física", tipo: "Carteira", saldo_inicial_cents: 0, ativa: 1 });
        }
        const cartoes = await this.getAll("cartoes");
        if (cartoes.length === 0) {
            await this.add("cartoes", { nome: "Cartão Santander", conta_pagto: "Conta Corrente", limite_cents: 500000, fechamento: 10, vencimento: 17, ativo: 1 });
            await this.add("cartoes", { nome: "Cartão Nubank", conta_pagto: "Conta Corrente", limite_cents: 450000, fechamento: 5, vencimento: 12, ativo: 1 });
        }
    }
};
