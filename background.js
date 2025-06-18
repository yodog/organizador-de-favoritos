// Importa as funções dos módulos
import {flattenBookmarksTree, getAllFolders} from './bookmark-utils.js';
import {processDuplicates} from './remove-duplicates.js';
import {mergeDuplicateFolders} from './merge-folders.js';
import {sortAllBookmarks} from './sort-bookmarks.js';
import {startAutoOrganization, stopAutoOrganization} from './auto-organizer.js';
import {DEFAULT_OPTIONS, DEFAULT_INTERVAL_MINUTES} from './default-options.js';

// Define a API de bookmarks para compatibilidade
const bookmarkAPI = typeof browser !== 'undefined' ? browser.bookmarks : chrome.bookmarks;

// Chaves para o storage
const STORAGE_KEY_INTERVAL = 'autoOrganizationInterval';
const STORAGE_KEY_OPTIONS = 'organizationOptions';

async function runOrganization(options = {}) {
    // Define valores padrão para as opções, incluindo sortBookmarks.
    let {
        sortBookmarks = DEFAULT_OPTIONS.sortBookmarks,
        mergeFolders = DEFAULT_OPTIONS.mergeFolders,
        removeDuplicates = DEFAULT_OPTIONS.removeDuplicates
    } = options;

    let removedCount = 0;
    let mergedFoldersCount = 0;

    try {
        console.log('[Bookmark Organizer] Iniciando processamento com opções:', {
            sortBookmarks,
            mergeFolders,
            removeDuplicates
        });

        // 1. **PRIMEIRA ORDENAÇÃO:** Só executa se a opção estiver marcada.
        if (sortBookmarks) {
            console.log('[Bookmark Organizer] Iniciando ordenação inicial...');
            await sortAllBookmarks(bookmarkAPI);
            console.log('[Bookmark Organizer] Ordenação inicial concluída.');
        }

        // 2. Carregar bookmarks para contagem inicial (após a primeira ordenação, se houver)
        const treeBefore = await bookmarkAPI.getTree();
        const allBookmarksBefore = flattenBookmarksTree(treeBefore);
        const initialCount = allBookmarksBefore.length;

        // 3. Processar remoção de duplicatas se a opção estiver ativa
        if (removeDuplicates) {
            // Recarrega a árvore para garantir que estamos trabalhando com os dados mais recentes
            const allBookmarks = flattenBookmarksTree(await bookmarkAPI.getTree());
            removedCount = await processDuplicates(allBookmarks, bookmarkAPI);
            console.log(`[Bookmark Organizer] ${removedCount} bookmarks duplicados removidos.`);
        }

        // 4. Processar unificação de pastas se a opção estiver ativa
        if (mergeFolders) {
            mergedFoldersCount = await mergeDuplicateFolders(bookmarkAPI, getAllFolders);
            console.log(`[Bookmark Organizer] ${mergedFoldersCount} pastas unificadas.`);
        }

        // 5. **SEGUNDA ORDENAÇÃO:** Só executa se a opção estiver marcada.
        if (sortBookmarks) {
            console.log('[Bookmark Organizer] Iniciando ordenação final...');
            await sortAllBookmarks(bookmarkAPI);
            console.log('[Bookmark Organizer] Ordenação final concluída.');
        }

        // 6. Contar bookmarks após a organização final
        const treeAfter = await bookmarkAPI.getTree();
        const allBookmarksAfter = flattenBookmarksTree(treeAfter);
        const finalCount = allBookmarksAfter.length;

        console.log(`[Bookmark Organizer] Processamento concluído. Inicial: ${initialCount}, Removidos: ${removedCount}, Final: ${finalCount}`);
        return {success: true, before: initialCount, after: finalCount, removed: removedCount, mergedFolders: mergedFoldersCount};

    } catch (error) {
        console.error('[Bookmark Organizer] Erro durante o processamento:', error);
        return {success: false, error: error.message};
    }
}

// Função auxiliar para configurar o alarme
async function setupAutoOrganization(interval) {
    if (interval > 0) {
        startAutoOrganization(interval);
    } else {
        // Se o intervalo for 0 ou inválido, pare a auto-organização
        stopAutoOrganization();
    }
}


// Listener para receber mensagens do popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "processBookmarks") {
        // Para execução manual, use as opções enviadas pelo popup
        runOrganization(request.options).then(sendResponse);
        return true; // Mantém a porta de comunicação aberta
    } else if (request.action === "updateInterval") {
        setupAutoOrganization(request.interval);
        sendResponse({success: true});
        return true;
    } else if (request.action === "restoreDefaults") {
        (async () => {
            try {
                // Ao restaurar padrões, as opções incluem 'sortBookmarks' conforme DEFAULT_OPTIONS
                await chrome.storage.sync.set({
                    [STORAGE_KEY_OPTIONS]: DEFAULT_OPTIONS, // Usa DEFAULT_OPTIONS completo
                    [STORAGE_KEY_INTERVAL]: DEFAULT_INTERVAL_MINUTES
                });
                // Reconfigura o alarme com o novo intervalo padrão
                await setupAutoOrganization(DEFAULT_INTERVAL_MINUTES);
                console.log('[Background] Padrões restaurados com sucesso.');
                sendResponse({success: true});
            } catch (error) {
                console.error('[Background] Erro ao restaurar padrões:', error);
                sendResponse({success: false, error: error.message});
            }
        })();
        return true; // Mantém a porta de comunicação aberta para a resposta assíncrona
    }
});

// Lógica para agendamento automático
// Garante que o alarme seja configurado quando o service worker é ativado.
chrome.runtime.onInstalled.addListener(async () => {
    const data = await chrome.storage.sync.get(STORAGE_KEY_INTERVAL);
    // Se não houver intervalo salvo, salva o padrão antes de configurar o alarme
    const savedInterval = data[STORAGE_KEY_INTERVAL];
    if (savedInterval === undefined) {
        await chrome.storage.sync.set({[STORAGE_KEY_INTERVAL]: DEFAULT_INTERVAL_MINUTES});
    }
    setupAutoOrganization(savedInterval || DEFAULT_INTERVAL_MINUTES);

    // Garante que as opções padrão sejam salvas na primeira instalação
    const optionsData = await chrome.storage.sync.get(STORAGE_KEY_OPTIONS);
    if (Object.keys(optionsData).length === 0 || !optionsData[STORAGE_KEY_OPTIONS]) {
        await chrome.storage.sync.set({[STORAGE_KEY_OPTIONS]: DEFAULT_OPTIONS}); // Usa DEFAULT_OPTIONS completo
    }
});

chrome.runtime.onStartup.addListener(async () => {
    const data = await chrome.storage.sync.get(STORAGE_KEY_INTERVAL);
    const savedInterval = data[STORAGE_KEY_INTERVAL] || DEFAULT_INTERVAL_MINUTES;
    setupAutoOrganization(savedInterval);

    // Garante que as opções padrão sejam carregadas/salvas na inicialização
    const optionsData = await chrome.storage.sync.get(STORAGE_KEY_OPTIONS);
    if (Object.keys(optionsData).length === 0 || !optionsData[STORAGE_KEY_OPTIONS]) {
        await chrome.storage.sync.set({[STORAGE_KEY_OPTIONS]: DEFAULT_OPTIONS}); // Usa DEFAULT_OPTIONS completo
    }
});

// Listener para o alarme agendado
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'organizeBookmarksAlarm') {
        console.log('[Auto Organizer] Alarme disparado. Executando organização automática...');
        // Carrega as opções salvas do storage para a execução automática
        const data = await chrome.storage.sync.get(STORAGE_KEY_OPTIONS);
        const autoOptions = data[STORAGE_KEY_OPTIONS] || DEFAULT_OPTIONS; // Usa as opções salvas ou as padrão
        runOrganization(autoOptions);
    }
});
