const openBtn = document.getElementById('openOverlay');
const closeBtn = document.getElementById('closeOverlay');
const overlay = document.getElementById('overlay');
const addLinkBtn = document.getElementById('addLink');
const originalMenu = document.getElementById('originalMenu');
const appEditMenu = document.getElementById('appEditMenu');
const editOpenOverlay = document.getElementById('editOpenOverlay');
const deleteConfirmOverlay = document.getElementById('deleteConfirmOverlay');
const deleteConfirmMessage = document.getElementById('deleteConfirmMessage');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const confirmDeleteBtn = document.getElementById('confirmDelete');
let isdefaultmenu = false;
let editingAppId = null;
let pendingDeleteAppId = null;

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
// 開くボタンでオーバーレイを表示
openBtn.addEventListener('click', () => {
    editingAppId = null;
    document.querySelectorAll('input').forEach(input => input.value = '');
    overlay.style.display = 'flex';
    originalMenu.style.display = 'none';
});
// 閉じるボタンでオーバーレイを閉じる
closeBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
    editingAppId = null;
    resetIconPicker();
});
// アイコン選択のリセット
function resetIconPicker() {
    document.querySelectorAll('.icon-choice').forEach(b => b.classList.remove('selected'));
    document.getElementById('iconInput').value = '';
}
// オーバーレイの背景クリックでオーバーレイを閉じる
overlay.addEventListener('click', e => {
    if (e.target === overlay) {
        overlay.style.display = 'none';
        editingAppId = null;
        resetIconPicker();
    }
});

// ========== アイコン選択ピッカー ==========
document.querySelectorAll('.icon-choice').forEach(btn => {
    btn.addEventListener('click', () => {
        // 選択状態を切り替え
        document.querySelectorAll('.icon-choice').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        // hidden input に値をセット
        document.getElementById('iconInput').value = btn.dataset.icon;
    });
});
editOpenOverlay.addEventListener('click', () => {
    overlay.style.display = 'flex';
    const name = document.getElementById('nameInput');
    const url = document.getElementById('urlInput');
    const icon = document.getElementById('iconInput');

    let a = editingAppId;
    JSON.parse(localStorage.getItem('kumasite-urlList')).forEach(d => {
        if (String(d.id) === a) {
            name.value = d.name;
            url.value = d.url;
            icon.value = d.icon;
        }
    });
    
    document.querySelectorAll('.icon-choice').forEach(b => b.classList.remove('selected'));
    document.querySelector(`.icon-choice[data-icon="${icon.value}"]`).classList.add('selected');
    
    appEditMenu.style.display = 'none';
});
// 追加ボタンで新しいアイコンを作成して保存
addLinkBtn.addEventListener('click', () => {

    if (editingAppId) {
        const name = document.getElementById('nameInput').value.trim();
        const url = document.getElementById('urlInput').value.trim();
        const icon = document.getElementById('iconInput').value.trim();
        
        if (name && url && icon) {
            const data = JSON.parse(localStorage.getItem('kumasite-urlList')) || [];
            const index = data.findIndex(d => String(d.id) === editingAppId);
            if (index !== -1) {
                data[index].name = name;
                data[index].url = url;
                data[index].icon = icon;
                localStorage.setItem('kumasite-urlList', JSON.stringify(data));

                const appEl = document.querySelector(`a.app[data-id="${editingAppId}"]`);
                if (appEl) {
                    appEl.href = url;
                    appEl.querySelector('.icon').className = `fa-solid ${icon} icon`;
                    appEl.querySelector('.title').textContent = name;
                }
            }
        }
            document.querySelectorAll('input').forEach(input => input.value = '');
            resetIconPicker();
            editingAppId = null;
            overlay.style.display = 'none';
    }

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
        resetIconPicker();
        overlay.style.display = 'none';
    }
});

function openDeleteConfirm(appId) {
    const normalizedId = String(appId || '');
    if (!normalizedId) return;

    pendingDeleteAppId = normalizedId;
    const appEl = document.querySelector(`a.app[data-id="${normalizedId}"]`);
    const appName = appEl?.querySelector('.title')?.textContent?.trim() || 'このアプリ';

    deleteConfirmMessage.textContent = `「${appName}」を削除しますか？`;
    deleteConfirmOverlay.style.display = 'flex';
    appEditMenu.style.display = 'none';
}

function closeDeleteConfirm() {
    deleteConfirmOverlay.style.display = 'none';
    pendingDeleteAppId = null;
    editingAppId = null;
}

function deleteAppById(appId) {
    const normalizedId = String(appId || '');
    if (!normalizedId) return;

    // localStorage から削除（壊れたデータでも落ちないように安全に扱う）
    let data = [];
    try {
        const parsed = JSON.parse(localStorage.getItem('kumasite-urlList'));
        data = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        data = [];
    }
    data = data.filter(d => String(d.id) !== normalizedId);
    localStorage.setItem('kumasite-urlList', JSON.stringify(data));

    // DOM から削除
    const appEl = document.querySelector(`a.app[data-id="${normalizedId}"]`);
    if (appEl) {
        appEl.remove();
    }

    editingAppId = null;
    appEditMenu.style.display = 'none';
}

// ===== アプリを削除 =====
document.getElementById('deleteLink').addEventListener('click', (e) => {
    e.preventDefault();
    if (!editingAppId) return;
    openDeleteConfirm(editingAppId);
});

cancelDeleteBtn.addEventListener('click', () => {
    closeDeleteConfirm();
});

confirmDeleteBtn.addEventListener('click', () => {
    if (!pendingDeleteAppId) return;
    deleteAppById(pendingDeleteAppId);
    closeDeleteConfirm();
});

deleteConfirmOverlay.addEventListener('click', (e) => {
    if (e.target === deleteConfirmOverlay) {
        closeDeleteConfirm();
    }
});

// ===== 右クリック判定 =====
document.addEventListener('contextmenu', event => {
    if (!event.target.closest('#originalMenu')) {
        originalMenu.style.display = 'none';
    }
    if (!event.target.closest('#appEditMenu')) {
        appEditMenu.style.display = 'none';
    }
    const appEl = event.target.closest('.app');
    if (!isdefaultmenu) {
        // app上での右クリックかどうか
        if (appEl) {
            event.preventDefault();
            appEditMenu.style.display = 'flex';
            appEditMenu.style.left = `${event.pageX}px`;
            appEditMenu.style.top = `${event.pageY}px`;
            editingAppId = appEl.dataset.id;
        } else {
            event.preventDefault();
            originalMenu.style.display = 'flex';
            originalMenu.style.left = `${event.pageX}px`;
            originalMenu.style.top = `${event.pageY}px`;
            editingAppId = null;
        }
    }
});

document.addEventListener('click', event => {
    if (!event.target.closest('#originalMenu')) {
        originalMenu.style.display = 'none';
    }
    if (!event.target.closest('#appEditMenu')) {
        appEditMenu.style.display = 'none';
        editingAppId = null;
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
// ========== テーマカラー変更 ==========
//
// 設計: H のみ変数。S・V・H差はすべて固定値。
// 各テーマのカラーセットは事前計算済みの静的テーブル。
//
// 色の構造（H差・S・Vは不変）:
//   icon  : H+0.0,  S=55.4, V=97.6
//   hover : H-0.1,  S=66.8, V=78.0
//   bg1   : H-1.5,  S=11.5, V=99.2
//   bg2   : H-0.8,  S=5.1,  V=99.2
//   bg3   : H-3.0,  S=5.9,  V=100.0

const THEMES = {
    pink: { label: 'ピンク（現在）', icon: '#f96f8d', hover: '#c7425f', bg1: '#fde0e7', bg2: '#fdf0f3', bg3: '#fff0f4' },
    red: { label: '赤', icon: '#f96f6f', hover: '#c74242', bg1: '#fde0e1', bg2: '#fdf0f0', bg3: '#fff0f1' },
    yellow: { label: '黄', icon: '#f9dd6f', hover: '#c7ac42', bg1: '#fdf6e0', bg2: '#fdfaf0', bg3: '#fffbf0' },
    green: { label: '緑', icon: '#6ff99d', hover: '#42c76e', bg1: '#e0fde9', bg2: '#f0fdf4', bg3: '#f0fff4' },
    cyan: { label: '水色', icon: '#6fe2f9', hover: '#42b1c7', bg1: '#e0f9fd', bg2: '#f0fbfd', bg3: '#f0fdff' },
    blue: { label: '青', icon: '#6f9df9', hover: '#426fc7', bg1: '#e0eafd', bg2: '#f0f5fd', bg3: '#f0f6ff' },
    purple: { label: '紫', icon: '#cb6ff9', hover: '#9a42c7', bg1: '#f3e0fd', bg2: '#f8f0fd', bg3: '#f9f0ff' },
};

let currentThemeKey = localStorage.getItem('kumasite-theme') || 'pink';

// テーマCSS注入用 <style> タグ
const themeStyleEl = document.createElement('style');
themeStyleEl.id = 'theme-style';
document.head.appendChild(themeStyleEl);

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * テーマキーを受け取り、対応する色セットを <style> タグに注入して適用する
 */
function applyTheme(themeKey) {
    const t = THEMES[themeKey];
    if (!t) return;

    themeStyleEl.textContent = `
/* テーマ: ${t.label} */
a { color: ${t.icon} !important; }
a.a-fff { color: #fff !important; }
a.a-fff:hover { background-color: ${t.hover} !important; color: #fff !important; }
.app:hover { background: ${hexToRgba(t.icon, 0.12)} !important; }
.icon { color: ${t.icon} !important; }
.title { color: ${t.icon} !important; }
.original-menu { background-color: ${t.icon} !important; }
.icon-choice { color: ${t.icon} !important; background: ${t.bg2} !important; }
.icon-choice:hover { background: ${t.bg1} !important; }
.icon-choice.selected {
    border-color: ${t.icon} !important;
    background: ${t.bg3} !important;
    box-shadow: 0 0 0 3px ${hexToRgba(t.icon, 0.2)} !important;
}
.apply-color-btn { background: ${t.icon}; }
    `.trim();

    currentThemeKey = themeKey;
}

// ページ読み込み時にテーマを復元
window.addEventListener('DOMContentLoaded', () => {
    applyTheme(currentThemeKey);
    document.querySelectorAll('.swatch').forEach(s => {
        s.classList.toggle('selected', s.dataset.theme === currentThemeKey);
    });
});

// ---- 色変更オーバーレイのUI制御 ----

const colorOverlay = document.getElementById('colorOverlay');
const openColorBtn = document.getElementById('openColorOverlay');
const closeColorBtn = document.getElementById('closeColorOverlay');
const applyColorBtn = document.getElementById('applyColor');

let pendingTheme = null;

openColorBtn.addEventListener('click', (e) => {
    e.preventDefault();
    colorOverlay.style.display = 'flex';
    originalMenu.style.display = 'none';
    pendingTheme = null;
    applyColorBtn.style.display = 'none';
    document.querySelectorAll('.swatch').forEach(s => {
        s.classList.toggle('selected', s.dataset.theme === currentThemeKey);
    });
});

closeColorBtn.addEventListener('click', () => {
    colorOverlay.style.display = 'none';
    pendingTheme = null;
});

colorOverlay.addEventListener('click', e => {
    if (e.target === colorOverlay) {
        colorOverlay.style.display = 'none';
        pendingTheme = null;
    }
});

document.querySelectorAll('.swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        pendingTheme = swatch.dataset.theme;
        applyColorBtn.style.display = pendingTheme === currentThemeKey ? 'none' : 'block';
        applyColorBtn.style.background = THEMES[pendingTheme].icon;
    });
});

applyColorBtn.addEventListener('click', () => {
    if (!pendingTheme) return;
    applyTheme(pendingTheme);
    localStorage.setItem('kumasite-theme', currentThemeKey);
    colorOverlay.style.display = 'none';
    pendingTheme = null;
});
