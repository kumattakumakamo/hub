const openBtn = document.getElementById('openOverlay');
const closeBtn = document.getElementById('closeOverlay');
const overlay = document.getElementById('overlay');
const addLinkBtn = document.getElementById('addLink');
const originalMenu = document.getElementById('originalMenu');
let isdefaultmenu = false;

// ========== デスクトップ式 自由配置ドラッグ ==========

let dragState = null;

/**
 * a.app 要素にデスクトップアイコン機能を付与する
 * - シングルクリック → ドラッグ可能（リンクは開かない）
 * - ダブルクリック → リンクを開く
 */
function makeDesktopIcon(appEl) {
    // シングルクリックでリンクが開かないようにする
    appEl.addEventListener('click', (e) => {
        e.preventDefault();
    });

    // ダブルクリックでリンクを開く
    appEl.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(appEl.getAttribute('href'), '_blank');
    });

    // mousedown でドラッグ開始
    appEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();

        const rect = appEl.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        dragState = { appEl, offsetX, offsetY };

        appEl.style.cursor = 'grabbing';
        appEl.style.opacity = '0.8';
        appEl.style.zIndex = '9999';
        appEl.style.transform = 'scale(1.1)';
    });
}

document.addEventListener('mousemove', (e) => {
    if (!dragState) return;
    const { appEl, offsetX, offsetY } = dragState;

    const newLeft = Math.max(0, Math.min(window.innerWidth - appEl.offsetWidth, e.clientX - offsetX));
    const newTop = Math.max(0, Math.min(window.innerHeight - appEl.offsetHeight, e.clientY - offsetY));

    appEl.style.left = newLeft + 'px';
    appEl.style.top = newTop + 'px';
});

document.addEventListener('mouseup', () => {
    if (!dragState) return;
    const { appEl } = dragState;

    appEl.style.cursor = 'grab';
    appEl.style.opacity = '1';
    appEl.style.zIndex = '100';
    appEl.style.transform = '';

    savePositions();
    dragState = null;
});

/**
 * 全アイコンの位置を localStorage に保存
 */
function savePositions() {
    // 動的アイコン
    const data = JSON.parse(localStorage.getItem('kumasite-urlList')) || [];
    document.querySelectorAll('a.app[data-id]').forEach(appEl => {
        const id = appEl.dataset.id;
        const entry = data.find(d => String(d.id) === id);
        if (entry) {
            entry.x = parseFloat(appEl.style.left) || 0;
            entry.y = parseFloat(appEl.style.top) || 0;
        }
    });
    localStorage.setItem('kumasite-urlList', JSON.stringify(data));

    // 静的アイコン（data-id が "static-" で始まるもの）
    const staticPos = JSON.parse(localStorage.getItem('kumasite-staticPos')) || {};
    document.querySelectorAll('a.app[data-id^="static-"]').forEach(appEl => {
        staticPos[appEl.dataset.id] = {
            x: parseFloat(appEl.style.left) || 0,
            y: parseFloat(appEl.style.top) || 0,
        };
    });
    localStorage.setItem('kumasite-staticPos', JSON.stringify(staticPos));
}

/**
 * アイコン要素を生成して body に fixed 配置する
 */
function createAppIcon({ id, name, url, icon, x, y }) {
    const appEl = document.createElement('a');
    appEl.href = url;
    appEl.target = '_blank';
    appEl.className = 'app';
    appEl.dataset.id = String(id);
    appEl.innerHTML = `<i class="fa-solid ${icon} icon"></i><p class="title">${name}</p>`;

    appEl.style.position = 'fixed';
    appEl.style.left = (x ?? 80) + 'px';
    appEl.style.top = (y ?? 80) + 'px';
    appEl.style.zIndex = '100';

    document.body.appendChild(appEl);
    makeDesktopIcon(appEl);
    return appEl;
}


// ========== アイコンの自動整列（グリッドスナップ）==========

// グリッドのセルサイズ（見えないマス目）
const GRID_CELL_W = 100;
const GRID_CELL_H = 100;
const GRID_MARGIN_LEFT = 16;
const GRID_MARGIN_TOP = 16;

/**
 * 座標 (x, y) を最も近いグリッドセルの左上座標にスナップして返す
 */
function snapToGrid(x, y) {
    const col = Math.max(0, Math.round((x - GRID_MARGIN_LEFT) / GRID_CELL_W));
    const row = Math.max(0, Math.round((y - GRID_MARGIN_TOP) / GRID_CELL_H));
    return {
        x: GRID_MARGIN_LEFT + col * GRID_CELL_W,
        y: GRID_MARGIN_TOP + row * GRID_CELL_H,
    };
}

/**
 * 「アイコンの自動整列」:
 * 全アイコンをそれぞれ現在位置から最も近いグリッドマスにスナップする。
 * 複数のアイコンが同じマスに当たった場合は、近い方を優先し
 * 残りを隣の空きマスに押し出す。
 */
function autoArrangeIcons() {
    const icons = Array.from(document.querySelectorAll('a.app[data-id]'));

    // 各アイコンの「希望グリッド座標」を計算
    const assignments = icons.map(appEl => {
        const x = parseFloat(appEl.style.left) || 0;
        const y = parseFloat(appEl.style.top) || 0;
        const snapped = snapToGrid(x, y);
        const dist = Math.hypot(x - snapped.x, y - snapped.y);
        return { appEl, x, y, sx: snapped.x, sy: snapped.y, dist };
    });

    // 近い順にソートして、先着優先でマスを確保
    assignments.sort((a, b) => a.dist - b.dist);

    // 使用済みマスを記録するセット（"col,row" 形式）
    const occupied = new Set();

    assignments.forEach(item => {
        let col = Math.max(0, Math.round((item.sx - GRID_MARGIN_LEFT) / GRID_CELL_W));
        let row = Math.max(0, Math.round((item.sy - GRID_MARGIN_TOP) / GRID_CELL_H));

        // 衝突していたら螺旋状に空きマスを探す
        if (occupied.has(`${col},${row}`)) {
            let found = false;
            outer: for (let radius = 1; radius < 50; radius++) {
                // 上下左右→斜めの順で近傍を探索
                const candidates = [];
                for (let dc = -radius; dc <= radius; dc++) {
                    for (let dr = -radius; dr <= radius; dr++) {
                        if (Math.abs(dc) === radius || Math.abs(dr) === radius) {
                            candidates.push([col + dc, row + dr]);
                        }
                    }
                }
                // 元の希望位置に近い順で試す
                candidates.sort((a, b) => {
                    const da = Math.hypot(a[0] - col, a[1] - row);
                    const db = Math.hypot(b[0] - col, b[1] - row);
                    return da - db;
                });
                for (const [c, r] of candidates) {
                    if (c >= 0 && r >= 0 && !occupied.has(`${c},${r}`)) {
                        col = c; row = r;
                        found = true;
                        break outer;
                    }
                }
            }
        }

        occupied.add(`${col},${row}`);

        const newLeft = GRID_MARGIN_LEFT + col * GRID_CELL_W;
        const newTop = GRID_MARGIN_TOP + row * GRID_CELL_H;

        item.appEl.style.transition = 'left 0.2s ease, top 0.2s ease';
        item.appEl.style.left = newLeft + 'px';
        item.appEl.style.top = newTop + 'px';
        setTimeout(() => { item.appEl.style.transition = ''; }, 250);
    });

    setTimeout(() => savePositions(), 260);
}

// ========== 初期化 ==========

window.addEventListener('DOMContentLoaded', () => {
    // index.html に直書きされた静的アイコン（Book App など）を fixed 配置に変換
    const staticPos = JSON.parse(localStorage.getItem('kumasite-staticPos')) || {};
    document.querySelectorAll('a.app:not([data-id])').forEach((appEl, i) => {
        const id = 'static-' + i;
        appEl.dataset.id = id;
        appEl.style.position = 'fixed';
        appEl.style.zIndex = '100';
        if (staticPos[id]) {
            // 保存済みの位置に復元
            appEl.style.left = staticPos[id].x + 'px';
            appEl.style.top = staticPos[id].y + 'px';
        } else {
            // 初回: 現在の位置をそのまま使う
            const rect = appEl.getBoundingClientRect();
            appEl.style.left = rect.left + 'px';
            appEl.style.top = rect.top + 'px';
        }
        makeDesktopIcon(appEl);
    });

    // localStorage からアイコンを復元
    const currentData = JSON.parse(localStorage.getItem('kumasite-urlList')) || [];
    currentData.forEach(item => createAppIcon(item));
});

// ========== オーバーレイ ==========

openBtn.addEventListener('click', () => {
    overlay.style.display = 'flex';
    originalMenu.style.display = 'none';
});

closeBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
});

overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.style.display = 'none';
});

addLinkBtn.addEventListener('click', () => {
    const name = document.getElementById('nameInput').value.trim();
    const url = document.getElementById('urlInput').value.trim();
    const icon = document.getElementById('iconInput').value.trim();

    if (name && url && icon) {
        const id = Date.now();
        const x = Math.max(0, window.innerWidth / 2 - 32);
        const y = Math.max(0, window.innerHeight / 2 - 32);

        const newEntry = { id, name, url, icon, x, y };
        createAppIcon(newEntry);

        const currentData = JSON.parse(localStorage.getItem('kumasite-urlList')) || [];
        currentData.push(newEntry);
        localStorage.setItem('kumasite-urlList', JSON.stringify(currentData));

        document.querySelectorAll('input').forEach(input => input.value = '');
        overlay.style.display = 'none';
    }
});

// ========== カスタム右クリックメニュー ==========

document.addEventListener('contextmenu', event => {
    if (!isdefaultmenu) {
        event.preventDefault();
        originalMenu.style.display = 'flex';
        originalMenu.style.left = `${event.pageX}px`;
        originalMenu.style.top = `${event.pageY}px`;
    }
});

document.addEventListener('click', event => {
    if (!event.target.closest('#originalMenu')) {
        originalMenu.style.display = 'none';
    }
    if (event.target.id === 'autoArrange') {
        originalMenu.style.display = 'none';
        autoArrangeIcons();
    }
    if (event.target.id === 'defaultmenu') {
        originalMenu.style.display = 'none';
        isdefaultmenu = true;
        const menuEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: event.clientX,
            clientY: event.clientY
        });
        document.dispatchEvent(menuEvent);
    }
});