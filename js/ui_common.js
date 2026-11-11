// js/ui_common.js
const UICommon = {
    showView: function(targetId, title) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const el = document.getElementById(targetId);
        if (el) el.classList.add('active');
        if (title) document.getElementById('header-title').innerText = title;
        window.scrollTo(0, 0);
        const main = document.getElementById('app-content');
        if (main) main.scrollTop = 0;
    },
    alert: function(msg) {
        alert(msg);
    },
    esc: function(s) {
        return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
};
