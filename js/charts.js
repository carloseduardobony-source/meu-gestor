// js/charts.js - Equivalente ao charts.py (Gráficos em Canvas e SVG com curva Catmull-Rom)
const Charts = {
    COR_REC: "#15803d",
    COR_DES: "#dc2626",
    COR_SALDO: "#2563eb",
    COR_ALERTA: "#ea580c",

    // Desenha curva suave Catmull-Rom para evolução mensal (Receitas x Despesas x Faturas)
    renderTendenciaSVG: function(containerId, pontos) {
        const el = document.getElementById(containerId);
        if (!el) return;
        if (!pontos || !pontos.length) {
            el.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;padding:20px;text-align:center;">(sem dados para o gráfico)</div>';
            return;
        }

        const W = 500, H = 220, padTop = 30, padBot = 30, margem = 44;
        const n = pontos.length;
        const vals = [];
        pontos.forEach(p => { vals.push(p.rec / 100, p.des / 100, p.fat / 100); });
        const mn = Math.min(...vals, 0);
        const mx = Math.max(...vals, 100);
        const amp = (mx - mn) || 1;

        const X = i => margem + i * (W - 2 * margem) / Math.max(n - 1, 1);
        const Y = v => padTop + (1 - (v - mn) / amp) * (H - padTop - padBot);

        function catmullRomSpline(xs, ys) {
            if (xs.length === 1) return `${xs[0]},${ys[0]}`;
            const extX = [2 * xs[0] - xs[1], ...xs, 2 * xs[xs.length - 1] - xs[xs.length - 2]];
            const extY = [2 * ys[0] - ys[1], ...ys, 2 * ys[ys.length - 1] - ys[ys.length - 2]];
            const pts = [];
            function calc(p0, p1, p2, p3, t) {
                const t2 = t * t, t3 = t2 * t;
                return (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3) / 2;
            }
            for (let i = 0; i < xs.length - 1; i++) {
                for (let k = 0; k < 12; k++) {
                    const t = k / 12;
                    pts.push(`${calc(extX[i], extX[i+1], extX[i+2], extX[i+3], t).toFixed(1)},${calc(extY[i], extY[i+1], extY[i+2], extY[i+3], t).toFixed(1)}`);
                }
            }
            pts.push(`${xs[xs.length - 1].toFixed(1)},${ys[ys.length - 1].toFixed(1)}`);
            return pts.join(' ');
        }

        const xs = pontos.map((_, i) => X(i));
        const ysRec = pontos.map(p => Y(p.rec / 100));
        const ysDes = pontos.map(p => Y(p.des / 100));
        const ysFat = pontos.map(p => Y(p.fat / 100));

        const polyRec = catmullRomSpline(xs, ysRec);
        const polyDes = catmullRomSpline(xs, ysDes);
        const polyFat = catmullRomSpline(xs, ysFat);

        const nomesMes = {"01":"jan","02":"fev","03":"mar","04":"abr","05":"mai","06":"jun","07":"jul","08":"ago","09":"set","10":"out","11":"nov","12":"dez"};
        let svg = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}">`;

        // Area preenchida sob a curva de despesas
        const base = H - padBot + 4;
        svg += `<polygon points="${xs[0]},${base} ${polyDes} ${xs[xs.length-1]},${base}" fill="#fee2e2" opacity="0.45"/>`;

        svg += `<polyline fill="none" stroke="${this.COR_REC}" stroke-width="2.5" points="${polyRec}"/>`;
        svg += `<polyline fill="none" stroke="${this.COR_DES}" stroke-width="2.5" points="${polyDes}"/>`;
        svg += `<polyline fill="none" stroke="${this.COR_SALDO}" stroke-width="2.5" points="${polyFat}"/>`;

        pontos.forEach((p, i) => {
            const x = xs[i];
            const yD = ysDes[i];
            const yR = ysRec[i];
            const mes = p.comp.substring(5, 7);
            const ano = p.comp.substring(2, 4);
            svg += `<circle cx="${x}" cy="${yD}" r="4" fill="#fff" stroke="${this.COR_DES}" stroke-width="2"/>`;
            svg += `<circle cx="${x}" cy="${yR}" r="4" fill="#fff" stroke="${this.COR_REC}" stroke-width="2"/>`;
            if (p.des > 0) {
                svg += `<text x="${x}" y="${yD - 8}" font-size="9" font-weight="bold" fill="#111" text-anchor="middle">${Services.formatBRL(p.des)}</text>`;
            }
            svg += `<text x="${x}" y="${H - 8}" font-size="10" fill="#555" text-anchor="middle">${nomesMes[mes] || mes}/${ano}</text>`;
        });

        svg += `<g font-size="10" font-weight="600">
            <circle cx="${W - 240}" cy="12" r="4" fill="${this.COR_REC}"/><text x="${W - 232}" y="15" fill="#333">Receitas</text>
            <circle cx="${W - 165}" cy="12" r="4" fill="${this.COR_DES}"/><text x="${W - 157}" y="15" fill="#333">Despesas</text>
            <circle cx="${W - 85}" cy="12" r="4" fill="${this.COR_SALDO}"/><text x="${W - 77}" y="15" fill="#333">Faturas</text>
        </g>`;
        svg += `</svg>`;
        el.innerHTML = svg;
    }
};
