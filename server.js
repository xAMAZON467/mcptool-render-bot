const http = require('http');
const crypto = require('crypto');
const { runBot } = require('./bot_worker');

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.RUN_TOKEN || null; // задай в Render env vars, чтобы эндпоинт не был открыт всем

const NAMES = [
    'GaGa_TW', 'Bhelper_BH', 'Trailior', 'Worper_2009', 'hyperthea',
    'Beltorz', 'zalos777', 'BethTheBeekeeper', 'EXPGamingTTV', 'SirLoinOfBeef7',
    'Adrianoooo', 'Siellov', 'DANIEHILL', 'madsole6', 'cooshie_scout__'
];

function pickNames(n) {
    const pool = [...NAMES];
    const out = [];
    for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        out.push(pool.splice(idx, 1)[0] || `Bot_${Math.floor(Math.random() * 9999)}`);
        if (pool.length === 0) pool.push(...NAMES);
    }
    return out;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function launchBots({ host, port, version, count, message, delay, regPassword }) {
    const names = pickNames(count);
    const results = [];
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        // не ждём завершения — запускаем и сразу планируем следующий через delay
        const p = runBot({ host, port, version, name, finalMessage: message, regPassword });
        results.push(p);
        if (delay > 0 && i < names.length - 1) await sleep(delay * 1000);
    }
    return Promise.all(results);
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('MCPTool render-bot запущен. POST /run с JSON телом для запуска ботов.\n');
        return;
    }

    if (req.method === 'POST' && req.url === '/run') {
        if (TOKEN) {
            const auth = req.headers['authorization'] || '';
            if (auth !== `Bearer ${TOKEN}`) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'unauthorized' }));
                return;
            }
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
            try {
                const params = JSON.parse(body || '{}');
                const host = params.host;
                const port = parseInt(params.port, 10) || 25565;
                const version = params.version || null;
                const count = Math.min(parseInt(params.count, 10) || 1, 20);
                const message = params.message || 'Я бот для тестирования проверки на бота';
                const delay = parseFloat(params.delay ?? '3');
                const regPassword = params.regPassword || 'Test12121212';

                if (!host) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'host is required' }));
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.write(JSON.stringify({ status: 'started', host, port, count }) + '\n');

                const results = await launchBots({ host, port, version, count, message, delay, regPassword });
                res.end(JSON.stringify({ status: 'done', results }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
