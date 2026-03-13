// Logger simple pour les scripts de scraping
// Remplace ../utils/logger du legacyScraper

function formatDate() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function logInfo(message, meta = null) {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.log(`[${formatDate()}] ℹ️  ${message}${metaStr}`);
}

function logWarning(message, meta = null) {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.warn(`[${formatDate()}] ⚠️  ${message}${metaStr}`);
}

function logError(message, meta = null) {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.error(`[${formatDate()}] ❌ ${message}${metaStr}`);
}

module.exports = { logInfo, logWarning, logError };
