// js/ui_common.js
const UICommon = {
    showView: function(targetId, title) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
        if(title) document.getElementById('header-title').innerText = title;
    },
    alert: function(msg) {
        alert(msg);
    }
};
