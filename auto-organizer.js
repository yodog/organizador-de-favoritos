const ALARM_NAME = 'organizeBookmarksAlarm';

/**
 * Agenda o alarme para executar a organização de bookmarks.
 * @param {number} intervalMinutes - O intervalo em minutos para o alarme.
 */

export function startAutoOrganization(intervalMinutes) {
    const actualInterval = Math.max(1, intervalMinutes); // Garante que seja no mínimo 1 minuto para persistência do alarme
    chrome.alarms.clear(ALARM_NAME, () => {
        chrome.alarms.create(ALARM_NAME, {
            delayInMinutes: actualInterval, // Inicia após o intervalo
            periodInMinutes: actualInterval // Repete a cada 'actualInterval' minutos
        });
        console.log(`[Auto Organizer] Auto-organização agendada para cada ${actualInterval} minutos.`);
    });
}

/**
 * Limpa o alarme, parando a execução automática.
 */

export function stopAutoOrganization() {
    chrome.alarms.clear(ALARM_NAME, (wasCleared) => {
        if (wasCleared) {
            console.log('[Auto Organizer] Auto-organização desativada.');
        } else {
            console.log('[Auto Organizer] Nenhuma auto-organização agendada para desativar.');
        }
    });
}

/**
 * Verifica se a auto-organização está atualmente agendada.
 * @returns {Promise<boolean>} True se estiver agendada, false caso contrário.
 */

export async function isAutoOrganizationActive() {
    const alarm = await chrome.alarms.get(ALARM_NAME);
    return !!alarm;
}