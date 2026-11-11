// js/database.js
const DB_NAME = "GestorFinanceiroDB";
const DB_VERSION = 2;
let db;

const DB = {
    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const database = e.target.result;
                const stores = ["lancamentos", "contas", "cartoes", "categorias", "pag_faturas", 
                                "grupos_parc", "fixas", "metas", "mov_metas", "transferencias", 
                                "quem_me_deve", "qmd_parc"];
                stores.forEach(name => {
                    if (!database.objectStoreNames.contains(name)) {
                        const store = database.createObjectStore(name, { keyPath: "id", autoIncrement: true });
                        if(name === "lancamentos") {
                            store.createIndex("data", "data", { unique: false });
                            store.createIndex("competencia", "competencia", { unique: false });
                        }
                    }
                });
            };
            request.onsuccess = (e) => { db = e.target.result; this.seedData().then(resolve); };
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
            const tx = db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },
    
    delete: function(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            const req = tx.objectStore(storeName).delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },
    
    update: function(storeName, id, newData) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite");
            const store = tx.objectStore(storeName);
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const item = getReq.result;
                const updatedItem = { ...item, ...newData };
                const putReq = store.put(updatedItem);
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            };
        });
    },

    seedData: async function() {
        const cats = await this.getAll("categorias");
        if (cats.length === 0) {
            const limites = { "Alimentação": 30000, "Mercado": 30000, "Eletrônicos": 30000, "Moradia": 30000, "Saúde": 30000 };
            for (const [nome, limite] of Object.entries(limites)) await this.add("categorias", { nome, limite_cents: limite });
        }
        const contas = await this.getAll("contas");
        if (contas.length === 0) {
            await this.add("contas", { nome: "Conta Corrente", tipo: "Conta", saldo_inicial_cents: 0, ativa: 1 });
        }
        const cartoes = await this.getAll("cartoes");
        if (cartoes.length === 0) {
            await this.add("cartoes", { nome: "Cartão Nubank", conta_pagto: "Conta Corrente", limite_cents: 500000, fechamento: 10, ativo: 1 });
        }
    }
};
