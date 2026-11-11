// js/ui4.js - Conciliação Financeira Flexível
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
            UICommon.alert("Erro ao ler o arquivo.");
        };
        reader.readAsText(file);
    },

    processarCSV: function(texto, sep) {
        const linhas = texto.split('\n').filter(l => l.trim().length > 0);
        this.linhasExtrato = [];

        const colData = parseInt(document.getElementById('conc-col-data').value) - 1;
        const colDesc = parseInt(document.getElementById('conc-col-desc').value) - 1;
        const colVal = parseInt(document.getElementById('conc-col-val').value) - 1;
        const fmtData = document.getElementById('conc-fmt-data').value;
        const maxCol = Math.max(colData, colDesc, colVal);

        for (let i = 1; i < linhas.length; i++) { // Pula a linha de cabeçalho
            const colunas = linhas[i].split(sep);
            
            if (colunas.length > maxCol) {
                const dataRaw = colunas[colData].trim().replace(/"/g, ''); 
                const descricao = colunas[colDesc].trim().replace(/"/g, '');
                const valorCents = Services.parseBRL(colunas[colVal].trim().replace(/"/g, ''));

                if (dataRaw && !isNaN(valorCents) && valorCents !== 0) {
                    let dataIso = '';
                    
                    if (fmtData === 'DMY') {
                        // Trata DD/MM/AAAA ou DD-MM-AAAA
                        const partes = dataRaw.split(/[\/\-]/); 
                        if (partes.length === 3) {
                            dataIso = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
                        }
                    } else {
                        // Trata AAAA-MM-DD
                        dataIso = dataRaw.substring(0, 10);
                    }
                    
                    if(dataIso.length === 10) {
                        this.linhasExtrato.push({
                            data: dataIso,
                            descricao: descricao,
                            valor_cents: valorCents,
                            tipo: valorCents < 0 ? 'Despesa' : 'Receita',
                            id_temp: i
                        });
                    }
                }
            }
        }
        
        if (this.linhasExtrato.length === 0) {
            UICommon.alert("Nenhuma linha válida encontrada. Verifique se o separador e os números das colunas estão corretos para o seu banco.");
            return;
        }

        this.compararComBanco();
    },

    compararComBanco: async function() {
        document.getElementById('conc-analise-container').style.display = 'block';
        const lancamentosDB = await DB.getAll("lancamentos");
        
        let html = '';
        let conciliados = 0, pendentes = 0;

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
                html += `<div class="list-item" style="border-left: 4px solid var(--success);"><div class="list-item-left"><span class="list-item-title">${ext.descricao}</span><span class="list-item-sub">${ext.data.split('-').reverse().join('/')} • Encontrado: ${match.item}</span></div><div class="list-item-val ${ext.tipo === 'Receita' ? 'rec' : 'des'}">${Services.formatBRL(Math.abs(ext.valor_cents))}</div></div>`;
            } else {
                pendentes++;
                html += `<div class="list-item" style="border-left: 4px solid var(--danger);"><div class="list-item-left"><span class="list-item-title">${ext.descricao}</span><span class="list-item-sub">${ext.data.split('-').reverse().join('/')} • Só no extrato</span></div><div class="list-item-val ${ext.tipo === 'Receita' ? 'rec' : 'des'}">${Services.formatBRL(Math.abs(ext.valor_cents))}</div><button class="btn-primary btn-small" onclick="UI4.importarAusente('${ext.id_temp}')">Importar</button></div>`;
            }
        }

        document.getElementById('conc-resumo').innerText = `${this.linhasExtrato.length} registros válidos lidos. ${conciliados} conciliados (já lançados). ${pendentes} aguardando importação.`;
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
            
            // Marca o container como escondido para resetar no futuro e navega
            UICommon.showView('view-Novo_lancamento', 'Novo Lançamento');
            UICommon.alert("Dados carregados! Escolha a categoria e a conta para salvar.");
        }
    }
};
