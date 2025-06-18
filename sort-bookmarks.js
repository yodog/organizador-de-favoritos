/**
 * Compara dois bookmarks ou pastas para ordenação alfabética.
 * @param {chrome.bookmarks.BookmarkTreeNode} a - Primeiro item.
 * @param {chrome.bookmarks.BookmarkTreeNode} b - Segundo item.
 * @returns {number}
 */

function compareNodes(a, b) {
    return a.title.localeCompare(b.title, 'pt-BR', {
        sensitivity: 'base',
        ignorePunctuation: true
    });
}

/**
 * Função recursiva para ordenar os bookmarks e subpastas dentro de um nó (pasta).
 * @param {string} parentId - O ID da pasta pai cujos filhos serão ordenados.
 * @param {object} bookmarkAPI - O objeto da API de bookmarks.
 */

async function sortChildrenOfNode(parentId, bookmarkAPI) {
    const children = await bookmarkAPI.getChildren(parentId);

    if (!children || children.length < 2) {
        return; // Não precisa ordenar se tiver 0 ou 1 item
    }

    const folders = children.filter(child => !child.url);
    const bookmarks = children.filter(child => child.url);

    // Ordena pastas e bookmarks separadamente
    folders.sort(compareNodes);
    bookmarks.sort(compareNodes);

    // A convenção é pastas primeiro, depois bookmarks
    const sortedChildren = [...folders, ...bookmarks];

    // Move cada item para sua nova posição ordenada
    const movePromises = sortedChildren.map((node, index) =>
        bookmarkAPI.move(node.id, {parentId: parentId, index: index})
    );

    // Aguarda a conclusão de todos os movimentos nesta pasta
    await Promise.all(movePromises);

    // Chama recursivamente a função para cada subpasta
    const recursiveSortPromises = folders.map(folder => sortChildrenOfNode(folder.id, bookmarkAPI));

    await Promise.all(recursiveSortPromises);
}

/**
 * Inicia o processo de ordenação a partir da raiz da árvore de bookmarks.
 * @param {object} bookmarkAPI - O objeto da API de bookmarks.
 */

export async function sortAllBookmarks(bookmarkAPI) {
    // 1. Pega a árvore de bookmarks
    const tree = await bookmarkAPI.getTree();

    // 2. O nó raiz (tree[0]) contém as pastas principais como seus filhos
    //    (Barra de favoritos, Outros favoritos, etc.)
    const mainFolders = tree[0].children;

    // 3. Itera sobre cada pasta principal (que PODE ser modificada internamente)
    //    e chama a função para ordenar SEUS filhos.
    const sortPromises = mainFolders.map(folder => sortChildrenOfNode(folder.id, bookmarkAPI));

    await Promise.all(sortPromises);
    console.log('[Bookmark Organizer] Ordenação de todas as pastas concluída.');
}
