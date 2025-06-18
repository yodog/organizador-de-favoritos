/**
 * Percorre a árvore de bookmarks e a transforma em uma lista "plana" (array).
 * @param {chrome.bookmarks.BookmarkTreeNode[]} bookmarksTree - A árvore de bookmarks da API.
 * @returns {Array} Uma lista de objetos de bookmark.
 */

export function flattenBookmarksTree(bookmarksTree) {
    const bookmarks = [];

    function traverse(node) {
        if (node.url) { // Apenas adiciona se for um bookmark, não uma pasta
            bookmarks.push({
                id: node.id,
                title: node.title || 'Sem título',
                url: node.url,
                parentId: node.parentId
            });
        }

        if (node.children) {
            node.children.forEach(child => traverse(child));
        }
    }

    bookmarksTree.forEach(traverse);
    return bookmarks;
}

/**
 * Percorre a árvore de bookmarks e retorna uma lista plana de todas as pastas.
 * @param {chrome.bookmarks.BookmarkTreeNode[]} bookmarksTree - A árvore de bookmarks.
 * @returns {Array} Uma lista de nós de bookmark que são pastas.
 */

export function getAllFolders(bookmarksTree) {
    const folders = [];

    function traverse(node) {
        // Adiciona o nó se ele não tiver uma URL (ou seja, é uma pasta)
        // e tiver filhos (não é uma pasta vazia que pode ser um artefato).
        // Ignoramos a raiz principal (id '0').
        if (!node.url && node.id !== '0') {
            folders.push(node);
        }

        if (node.children) {
            node.children.forEach(child => traverse(child));
        }
    }

    bookmarksTree.forEach(traverse);
    return folders;
}
