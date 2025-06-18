/**
 * Processa uma lista de bookmarks, removendo duplicatas baseadas na URL ou no título.
 * A comparação de títulos é case-insensitive e ignora pontuação.
 * @param {Array} bookmarks - A lista plana de bookmarks.
 * @param {object} bookmarkAPI - O objeto da API de bookmarks (chrome.bookmarks ou browser.bookmarks).
 * @returns {Promise<number>} O número de bookmarks removidos.
 */

export async function processDuplicates(bookmarks, bookmarkAPI) {

    const urlMap = new Map();
    const titleMap = new Map(); // Novo mapa para rastrear títulos
    const duplicatesToRemove = new Set(); // Usar Set para evitar IDs duplicados se um bookmark for duplicado por URL e por Título.

    bookmarks.forEach(bookmark => {

        // Normaliza o título para comparação case-insensitive e ignorando pontuação
        // Usamos 'pt-BR' e as mesmas opções de 'compareNodes' para consistência.
        const normalizedTitle = bookmark.title.localeCompare(bookmark.title, 'pt-BR', {
            sensitivity: 'base',
            ignorePunctuation: true
        }) === 0 ? bookmark.title.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") : bookmark.title;


        // Verifica duplicatas por URL
        if (urlMap.has(bookmark.url)) {
            duplicatesToRemove.add(bookmark.id);
        } else {
            urlMap.set(bookmark.url, true);
        }

        // Verifica duplicatas por Título (apenas se não for o primeiro a usar esse título)
        // Evitamos adicionar o mesmo bookmark duas vezes ao map se ele for único,
        // mas adicionamos o ID aos duplicados se o título normalizado já existir.
        if (titleMap.has(normalizedTitle)) {
            duplicatesToRemove.add(bookmark.id);
        } else {
            titleMap.set(normalizedTitle, true);
        }
    });

    // Converte o Set para Array para usar com Promise.all
    const idsToRemove = Array.from(duplicatesToRemove);

    // Remove todos os duplicatas de uma vez para melhor performance
    const removalPromises = idsToRemove.map(id =>
        bookmarkAPI.remove(id).catch(e => {
            console.warn(`[Bookmark Organizer] Falha ao remover bookmark duplicado ID: ${id}`, e.message);
        })
    );

    await Promise.all(removalPromises);

    return idsToRemove.length;
}
