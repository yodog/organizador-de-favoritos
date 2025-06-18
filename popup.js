import {DEFAULT_OPTIONS, DEFAULT_INTERVAL_MINUTES} from './default-options.js';

const sortBookmarksCb = document.getElementById('sortBookmarksCb');
const mergeFoldersCb = document.getElementById('mergeFoldersCb');
const removeDuplicatesCb = document.getElementById('removeDuplicatesCb');
const organizeBtn = document.getElementById('organizeBtn');
const restoreDefaultsBtn = document.getElementById('restoreDefaultsBtn');
const statusDiv = document.getElementById('status');
const intervalInput = document.getElementById('intervalInput');

const STORAGE_KEY_INTERVAL = 'autoOrganizationInterval';
const STORAGE_KEY_OPTIONS = 'organizationOptions';

// Função para carregar e aplicar as opções salvas
async function loadAndApplyOptions() {
    const data = await chrome.storage.sync.get(STORAGE_KEY_OPTIONS);
    // Usa os padrões se não houver opções salvas ou se uma opção específica for undefined
    const savedOptions = data[STORAGE_KEY_OPTIONS] || DEFAULT_OPTIONS;

    sortBookmarksCb.checked = savedOptions.sortBookmarks !== undefined ? savedOptions.sortBookmarks : DEFAULT_OPTIONS.sortBookmarks;
    mergeFoldersCb.checked = savedOptions.mergeFolders !== undefined ? savedOptions.mergeFolders : DEFAULT_OPTIONS.mergeFolders;
    removeDuplicatesCb.checked = savedOptions.removeDuplicates !== undefined ? savedOptions.removeDuplicates : DEFAULT_OPTIONS.removeDuplicates;

    // Carrega o intervalo também
    const intervalData = await chrome.storage.sync.get(STORAGE_KEY_INTERVAL);
    const savedInterval = intervalData[STORAGE_KEY_INTERVAL];
    if (savedInterval !== undefined) {
        intervalInput.value = savedInterval;
    } else {
        intervalInput.value = DEFAULT_INTERVAL_MINUTES; // Usa o padrão
    }

    // Garante que o alarme esteja configurado com o valor inicial ou salvo
    chrome.runtime.sendMessage({
        action: "updateInterval",
        interval: parseInt(intervalInput.value)
    });
}

// Salva as opções quando uma checkbox é alterada
sortBookmarksCb.addEventListener('change', saveOptions);
mergeFoldersCb.addEventListener('change', saveOptions);
removeDuplicatesCb.addEventListener('change', saveOptions);

// Função para salvar as opções atuais
async function saveOptions() {
    const options = {
        sortBookmarks: sortBookmarksCb.checked,
        mergeFolders: mergeFoldersCb.checked,
        removeDuplicates: removeDuplicatesCb.checked
    };
    await chrome.storage.sync.set({[STORAGE_KEY_OPTIONS]: options});
    console.log('[Popup] Opções salvas:', options);
}

// Carrega as opções quando o popup é aberto
document.addEventListener('DOMContentLoaded', loadAndApplyOptions);

// Event listener para o botão de organização
organizeBtn.addEventListener('click', async () => {
    statusDiv.style.display = "block";
    statusDiv.innerHTML = "⌛ Organizando seus favoritos...";
    statusDiv.className = "";

    const options = {
        sortBookmarks: sortBookmarksCb.checked,
        mergeFolders: mergeFoldersCb.checked,
        removeDuplicates: removeDuplicatesCb.checked
    };

    try {
        const result = await chrome.runtime.sendMessage({
            action: "processBookmarks",
            options: options
        });

        if (result && result.success) {
            const {before, after, removed, mergedFolders} = result;
            const reductionPercent = before > 0 ? ((removed / before) * 100).toFixed(2) : 0;

            // Monta as linhas da grade com 3 colunas
            let statsHtml = `
                <div class="stats-icon">📊</div><div class="stats-label">Total inicial:</div><div class="stats-value">${before}</div>
                <div class="stats-icon">🗑️</div><div class="stats-label">Duplicados removidos:</div><div class="stats-value">${removed} (${reductionPercent}%)</div>
                <div class="stats-icon">🔄</div><div class="stats-label">Pastas unificadas:</div><div class="stats-value">${mergedFolders}</div>
                <div class="stats-icon">📂</div><div class="stats-label">Total atual:</div><div class="stats-value">${after}</div>
            `;

            statusDiv.innerHTML = `
                <strong>✅ Organização concluída!</strong>
                </p>
                <div class="stats-grid">
                    ${statsHtml}
                </div>
            `;
            statusDiv.className = "success";

            console.log('Resultado completo:', result);
        } else {
            statusDiv.innerHTML = `<strong>❌ Erro:</strong> ${result.error}`;
            statusDiv.className = "error";
        }
    } catch (error) {
        statusDiv.innerHTML = `<strong>⚠️ Falha na comunicação:</strong> Verifique os logs de erro no background service worker.`;
        statusDiv.className = "error";
        console.error('Erro ao enviar mensagem:', error);
    }
});

// Event listener para o botão "Restaurar Padrões"
restoreDefaultsBtn.addEventListener('click', async () => {
    try {
        statusDiv.innerHTML = "⌛ Restaurando padrões...";
        statusDiv.className = "";
        statusDiv.style.display = "block";

        // Envia a mensagem para o background service worker para restaurar padrões
        const result = await chrome.runtime.sendMessage({
            action: "restoreDefaults"
        });

        if (result.success) {
            // Após restaurar, recarrega as opções no popup para atualizar a UI
            await loadAndApplyOptions();
            statusDiv.innerHTML = `<strong>✅ Padrões restaurados com sucesso!</strong>`;
            statusDiv.className = "success";
        } else {
            statusDiv.innerHTML = `<strong>❌ Erro ao restaurar padrões:</strong> ${result.error}`;
            statusDiv.className = "error";
        }
    } catch (error) {
        statusDiv.innerHTML = `<strong>⚠️ Falha na comunicação:</strong> Verifique os logs de erro no background service worker.`;
        statusDiv.className = "error";
        console.error('Erro ao enviar mensagem de restaurar padrões:', error);
    }
});


// Salva o valor do intervalo e envia para o background quando o usuário altera o campo
intervalInput.addEventListener('change', async () => {
    let newInterval = parseInt(intervalInput.value);
    if (isNaN(newInterval) || newInterval < 1) {
        newInterval = 1;
        intervalInput.value = newInterval;
    }

    await chrome.storage.sync.set({[STORAGE_KEY_INTERVAL]: newInterval});

    chrome.runtime.sendMessage({
        action: "updateInterval",
        interval: newInterval
    });
    console.log(`[Popup] Intervalo de auto-organização salvo: ${newInterval} minutos.`);
});
