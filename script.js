const openBtn = document.getElementById('openOverlay');
const closeBtn = document.getElementById('closeOverlay');
const overlay = document.getElementById('overlay');
const addLinkBtn = document.getElementById('addLink');
const linkList = document.getElementById('linkList');


openBtn.addEventListener('click', () => {
    overlay.style.display = 'flex';
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

        // 5. 入力欄をすべてリセット
        document.querySelectorAll('input').forEach(input => input.value = '');
    }
});