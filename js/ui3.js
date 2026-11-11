// js/ui3.js
const UI3 = {
    renderCategorias: async function() {
        const cats = await DB.getAll("categorias");
        document.getElementById('cats-list').innerHTML = cats.map(c => `<div class="list-item"><div class="list-item-left"><span class="list-item-title">${c.nome}</span></div><div class="list-item-val">${Services.formatBRL(c.limite_cents)} limite</div></div>`).join('');
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
        a.download = `gestor_backup_completo_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }
};
