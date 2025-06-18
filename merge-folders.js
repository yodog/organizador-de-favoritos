/**
 * Unifica pastas de bookmarks que têm o mesmo nome.
 * @param {object} bookmarkAPI - O objeto da API de bookmarks.
 * @param {Function} getAllFoldersUtil - A função utilitária para obter todas as pastas.
 * @returns {Promise<number>} O número de pastas que foram unificadas (removidas).
 */

export async function mergeDuplicateFolders(bookmarkAPI, getAllFoldersUtil) {
    console.log('[Bookmark Organizer] Iniciando unificação de pastas...');

    const tree = await bookmarkAPI.getTree();
    const allFolders = getAllFoldersUtil(tree);

    const foldersByName = new Map();

    // 1. Agrupar pastas por nome
    allFolders.forEach(folder => {
        // Normaliza o nome para evitar diferenças de espaços
        const name = folder.title.trim();
        if (!foldersByName.has(name)) {
            foldersByName.set(name, []);
        }
        foldersByName.get(name).push(folder);
    });

    let mergedFoldersCount = 0;

    // 2. Iterar sobre os grupos de pastas e processar duplicatas
    for (const [name, folders] of foldersByName.entries()) {
        if (folders.length > 1) {
            console.log(`[Bookmark Organizer] Encontradas ${folders.length} pastas com o nome "${name}". Unificando...`);
            const destinationFolder = folders[0]; // A primeira será o destino
            const sourceFolders = folders.slice(1); // As restantes serão a origem

            for (const sourceFolder of sourceFolders) {
                const children = await bookmarkAPI.getChildren(sourceFolder.id);

                // 3. Mover todos os filhos da pasta de origem para a de destino
                const movePromises = children.map(child =>
                    bookmarkAPI.move(child.id, {parentId: destinationFolder.id})
                );
                await Promise.all(movePromises);

                // 4. Após mover tudo, remover a pasta de origem (agora vazia)
                await bookmarkAPI.remove(sourceFolder.id);
                mergedFoldersCount++;
            }
        }
    }

    if (mergedFoldersCount > 0) {
        console.log(`[Bookmark Organizer] ${mergedFoldersCount} pastas foram unificadas com sucesso.`);
    }

    return mergedFoldersCount;
}
