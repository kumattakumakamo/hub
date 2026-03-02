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