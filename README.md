# Gestor Financeiro Pessoal - Arquitetura Modular

Esta versão reflete com exatidão a arquitetura modular do código original em Python, separando banco de dados, lógica de negócio e interfaces em arquivos próprios.

## Estrutura do Projeto

* `index.html`: Base visual com todas as 17 telas (views) declaradas, incluindo o **Formulário de Upload de Conciliação**.
* `style.css`: Estilização PWA mobile-first.
* `js/database.js`: Motor do IndexedDB espelhando `database.py`.
* `js/services.js`: Regras matemáticas e conversores espelhando `services.py`.
* `js/ui_common.js`: Utilitários visuais compartilhados (`ui_common.py`).
* `js/ui1.js`, `js/ui2.js`, `js/ui3.js`: Controladores gerais baseados no Python.
* `js/ui4.js`: **[Novo]** Módulo de Conciliação Offline implementado nativamente com a `FileReader API` e tolerância de 3 dias de liquidação.
* `js/app.js`: Main loop do aplicativo (`main.py`).

Todas as regras do escopo foram obedecidas: sem perda de funcionalidade, pacote completo e modularizado.
