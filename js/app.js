// js/app.js - Ponto de Entrada e Roteador das 17 Views
document.addEventListener("DOMContentLoaded", () => {
    DB.init().then(() => {
        UI2.setupListeners();
        UI3.setupListeners();
        document.getElementById('form-novo').addEventListener('submit', UI1.saveLancamento);
        document.getElementById('generic-edit-form').addEventListener('submit', UI5.salvarEdicaoGenerica.bind(UI5));

        document.querySelectorAll('.nav-item, .menu-btn').forEach(item => {
            item.addEventListener('click', () => {
                const target = item.getAttribute('data-target');
                if (!target) return;

                if (item.classList.contains('nav-item')) {
                    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                    item.classList.add('active');
                }
        
                const title = target.replace('view-', '').replace('_', ' ');
                UICommon.showView(target, title);
        
                switch(target) {
                    case 'view-Dashboard': UI1.renderDashboard(); break;
                    case 'view-Extrato': UI1.renderExtrato(); break;
                    case 'view-Novo_lancamento': UI1.populateNovoLancamento(); break;
                    case 'view-ContasCartoes': UI2.renderContasCartoes(); break;
                    case 'view-Faturas': UI2.renderFaturas(); break;
                    case 'view-Parcelamentos': UI2.renderParcelamentos(); break;
                    case 'view-ContasFixas': UI2.renderFixas(); break;
                    case 'view-Categorias': UI3.renderCategorias(); break;
                    case 'view-Metas': UI3.renderMetas(); break;
                    case 'view-Transferencias': UI3.renderTransferencias(); break;
                    case 'view-QuemMeDeve': UI3.renderQuemMeDeve(); break;
                    case 'view-Conciliacao': UI4.renderSessao(); break;
                    case 'view-Pesquisar': UI5.initPesquisa(); break;
                    case 'view-Planejamento': UI5.renderPlanejamento(); break;
                    case 'view-Relatorios': 
                        document.getElementById('rel-ano').value = new Date().getFullYear(); 
                        UI5.gerarRelatorio(); 
                        break;
                }
            });
        });

        UI1.renderDashboard();
    }).catch(err => {
        console.error("Falha ao iniciar aplicativo:", err);
    });
});
