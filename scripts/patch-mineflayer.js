// Патчит mineflayer/lib/plugins/settings.js: добавляет обязательное поле particleStatus,
// которого не хватает в пакете client_information/settings для протокола 1.21.4+.
// Без этого поля сервер кикает бота с DecoderException при декодировании пакета.
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'mineflayer', 'lib', 'plugins', 'settings.js');

if (!fs.existsSync(target)) {
    console.log('[patch-mineflayer] settings.js not found, skipping');
    process.exit(0);
}

let content = fs.readFileSync(target, 'utf8');

// Ищем именно вызов write('settings', {...}) — а не просто любое упоминание particleStatus
// (в defaults объекта bot.settings оно уже есть, но в сам пакет не попадает)
const writeCallMatch = content.match(/bot\._client\.write\('settings',\s*\{[\s\S]*?\}\)/);

if (writeCallMatch && writeCallMatch[0].includes('particleStatus')) {
    console.log('[patch-mineflayer] already patched');
    process.exit(0);
}

const needle = `enableServerListing: bot.settings.enableServerListing\n    })`;
const replacement = `enableServerListing: bot.settings.enableServerListing,\n      particleStatus: bot.settings.particleStatus || 'all'\n    })`;

if (!content.includes(needle)) {
    console.log('[patch-mineflayer] expected code not found, skipping (mineflayer version may have changed)');
    process.exit(0);
}

content = content.replace(needle, replacement);
fs.writeFileSync(target, content, 'utf8');
console.log('[patch-mineflayer] patched successfully');
