const openBtn = document.getElementById('openOverlay');
const closeBtn = document.getElementById('closeOverlay');
const overlay = document.getElementById('overlay');
const addLinkBtn = document.getElementById('addLink');
const linkList = document.getElementById('linkList');
const originalMenu = document.getElementById('originalMenu');
let isdefaultmenu = false;

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOMの準備が整いました！');
    // ここでlocalStorageからデータを読み込んで表示する処理などを書く
    const currentData = JSON.parse(localStorage.getItem('kumasite-urlList')) || [];
    currentData.forEach(item => {
        const listItem = document.createElement('div');
        listItem.innerHTML = `
        <a href="${item.url}" target="_blank" class="app">
        <i class="fa-solid ${item.icon}"></i>
        <p class="title">${item.name}</p>
        </a>
        `;
        linkList.appendChild(listItem);
    });
});

openBtn.addEventListener('click', () => {
    overlay.style.display = 'flex';
    originalMenu.style.display = 'none'; // カスタムメニューを閉じる
});

closeBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
});

// click outside to close
overlay.addEventListener('click', e => {
    if (e.target === overlay) {
        overlay.style.display = 'none';
    }
});



addLinkBtn.addEventListener('click', () => {
    // 3つの入力値を取得
    const name = document.getElementById('nameInput').value.trim();
    const url = document.getElementById('urlInput').value.trim();
    const icon = document.getElementById('iconInput').value.trim();

    // 全て入力されているかチェック
    if (name && url && icon) {
        // 1. オブジェクトとしてまとめる（これが「1セット」のデータ）
        const itemData = { name, url, icon };

        // 2. HTML要素を作成
        const listItem = document.createElement('div');

        // 3. 3つのデータを1つの文字列（または構造）として流し込む
        // テンプレートリテラルを使うと楽に書けます
        listItem.innerHTML = `
        <a href="${itemData.url}" target="_blank" class="app">
        <i class="fa-solid ${itemData.icon}"></i>
        <p class="title">${itemData.name}</p>
        </a>
        `;

        // 4. 画面に追加
        linkList.appendChild(listItem);

        // 1. 現在のリストを取得（空なら新しい配列 [] を用意）
        const currentData = JSON.parse(localStorage.getItem('kumasite-urlList')) || [];

        // 2. 新しいデータを追加
        const newEntry = { id: Date.now(), name: itemData.name, url: itemData.url, icon: itemData.icon };
        currentData.push(newEntry);

        // 3. まるごと保存（これで「追加」された状態になる）
        localStorage.setItem('kumasite-urlList', JSON.stringify(currentData));

        // 5. 入力欄をすべてリセット
        document.querySelectorAll('input').forEach(input => input.value = '');
    }
});

document.addEventListener('contextmenu', event => {
    if (!isdefaultmenu) {
        event.preventDefault(); // 右クリックメニューを表示しない
        console.log('右クリックされましたが、メニューは表示されません');
        originalMenu.style.display = 'flex'; // カスタムメニューを表示
        originalMenu.style.left = `${event.pageX}px`; // カスタムメニューの位置を設定
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

        // 標的の要素（あるいはdocument）に対してイベントを発火させる
        document.dispatchEvent(menuEvent);
    }
});