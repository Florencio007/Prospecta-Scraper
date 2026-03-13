// Script to convert translations.ts to JSON files for i18next
// Run with: node scripts/convertTranslations.js

const fs = require('fs');
const path = require('path');

// Import the translations
const translationsPath = path.join(__dirname, '../src/data/translations.ts');
const content = fs.readFileSync(translationsPath, 'utf8');

// Extract the translations object using regex
const match = content.match(/export const translations = ({[\s\S]*});/);
if (!match) {
    console.error('Could not find translations object');
    process.exit(1);
}

// Use eval to parse the object (safe since we control the source)
const translationsStr = match[1];
const translations = eval(`(${translationsStr})`);

// Create directories
const localesDir = path.join(__dirname, '../src/i18n/locales');
const frDir = path.join(localesDir, 'fr');
const enDir = path.join(localesDir, 'en');

[localesDir, frDir, enDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Write JSON files
fs.writeFileSync(
    path.join(frDir, 'translation.json'),
    JSON.stringify(translations.fr, null, 2),
    'utf8'
);

fs.writeFileSync(
    path.join(enDir, 'translation.json'),
    JSON.stringify(translations.en, null, 2),
    'utf8'
);

console.log('✅ Translations converted successfully!');
console.log('  - French: src/i18n/locales/fr/translation.json');
console.log('  - English: src/i18n/locales/en/translation.json');
