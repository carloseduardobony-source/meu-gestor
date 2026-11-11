// js/ui4.js - Módulo de Conciliação Financeira
const UI4 = {
    linhasExtrato: [],

    lerArquivo: function() {
        const fileInput = document.getElementById('conc-file');
        const sep = document.getElementById('conc-sep').value;
        
        if (!fileInput.files.length) {
            UICommon.alert("Selecione um arquivo CSV primeiro.");
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            const conteudo = e.target.result;
            UI4.processarCSV(conteudo, sep);
        };

        reader.onerror = function() {
            UICommon.alert("Erro ao ler o arquivo. Verifique se ele não está corrompido.");
        };

        reader.readAsText(file);
    },

    processarCSV: function(texto, sep) {
        const linhas = texto.split('\n').filter(l => l.trim().length > 0);
        this.linhasExtrato = [];

        // Ignora cabeçalho (i=1)
        for (let i = 1; i < linhas.length; i++) {
            const colunas = linhas[i].split(sep);
            if (colunas.length >= 3) {
                const dataBr = colunas[0].trim(); 
                const descricao = colunas[1].trim();
                const valorCents = Services.parseBRL(colunas[2].trim());

                if (dataBr && !isNaN(valorCents)) {
                    const [d, m, a] = dataBr.split('/');
                    const dataIso = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                    
                    this.linhasExtrato.push({
                        data: dataIso,
                        descricao: descricao.replace(/"/g, ''),
                        valor_cents: valorCents,
                        tipo: valorCents < 0 ? 'Despesa' : 'Receita',
                        id_temp: i
                    });
                }
            }
        }
        this.compararComBanco();
    },

    compararComBanco: async function() {
        document.getElementById('conc-analise-container').style.display = 'block';
        const lancamentosDB = await DB.getAll("lancamentos");
        
        let html = '';
        let conciliados = 0;
        let pendentes = 0;

        for (const ext of this.linhasExtrato) {
            const dataExt = new Date(ext.data);
            const match = lancamentosDB.find(lan => {
                if (lan.valor_cents === Math.abs(ext.valor_cents) && lan.tipo === ext.tipo) {
                    const dataLan = new Date(lan.data);
                    const diffDias = Math.abs(dataExt - dataLan) / (1000 * 60 * 60 * 24);
                    return diffDias <= 3;
                }
                return false;
            });

            if (match) {
                conciliados++;
                html += `
                    <div class="list-item" style="border-left: 4px solid var(--success);">
                        <div class="list-item-left">
                            <span class="list-item-title">${ext.descricao}</span>
                            <span class="list-item-sub">${ext.data.split('-').reverse().join('/')} • Encontrado: ${match.item}</span>
                        </div>
                        <div class="list-item-val ${ext.tipo === 'Receita' ? 'rec' : 'des'}">
                            ${Services.formatBRL(Math.abs(ext.valor_cents))}
                        </div>
                    </div>`;
            } else {
                pendentes++;
                html += `
                    <div class="list-item" style="border-left: 4px solid var(--danger);">
                        <div class="list-item-left">
                            <span class="list-item-title">${ext.descricao}</span>
                            <span class="list-item-sub">${ext.data.split('-').reverse().join('/')} • Só no extrato</span>
                        </div>
                        <div class="list-item-val ${ext.tipo === 'Receita' ? 'rec' : 'des'}">
                            ${Services.formatBRL(Math.abs(ext.valor_cents))}
                        </div>
                        <button class="btn-primary" style="padding: 6px; font-size: 0.8rem; margin-top:0; width: 80px;" onclick="UI4.importarAusente('${ext.id_temp}')">Importar</button>
                    </div>`;
            }
        }

        document.getElementById('conc-resumo').innerText = `${this.linhasExtrato.length} registros lidos. ${conciliados} já estão no sistema. ${pendentes} faltam ser adicionados.`;
        document.getElementById('conc-list').innerHTML = html;
    },

    importarAusente: function(id_temp) {
        const ext = this.linhasExtrato.find(l => l.id_temp == id_temp);
        if (ext) {
            document.getElementById('novo-data').value = ext.data;
            document.getElementById('novo-item').value = ext.descricao;
            document.getElementById('novo-valor').value = (Math.abs(ext.valor_cents) / 100).toFixed(2);
            document.getElementById('novo-tipo').value = ext.tipo;
            document.getElementById('novo-status').value = 'pago';
            
            UICommon.showView('view-Novo_lancamento', 'Novo Lançamento');
            UICommon.alert("Dados importados para o formulário. Escolha a categoria e a conta para salvar.");
        }
    }
};
