// bot_worker.js — один бот: логин, адаптивная верификация, регистрация, финальное сообщение
const mineflayer = require('mineflayer');

function runBot({ host, port, version, name, finalMessage, regPassword }) {
    return new Promise((resolve) => {
        const opts = { host, port, username: name, auth: 'offline' };
        if (version) opts.version = version;

        const bot = mineflayer.createBot(opts);
        const log = [];
        const push = (line) => { log.push(line); console.log(`[${name}] ${line}`); };

        bot._client.on('packet', (data, meta) => {
            if (meta.name === 'add_resource_pack') {
                const rpPacket = 'resource_pack_receive';
                try { bot._client.write(rpPacket, { uuid: data.uuid, result: 3 }); } catch (e) {
                    try { bot._client.write('resource_pack_send', { uuid: data.uuid, result: 3 }); } catch (e2) {}
                }
                setTimeout(() => {
                    try { bot._client.write(rpPacket, { uuid: data.uuid, result: 0 }); } catch (e) {
                        try { bot._client.write('resource_pack_send', { uuid: data.uuid, result: 0 }); } catch (e2) {}
                    }
                }, 300);
            }
        });

        const origWrite = bot._client.write.bind(bot._client);
        bot._client.write = function (name2, params) {
            if (name2 === 'client_information' || name2 === 'settings') {
                if (!params.locale || params.locale === '') {
                    params = Object.assign({}, params, { locale: 'en_us' });
                }
            }
            return origWrite(name2, params);
        };

        let verifyCmd = '.bind';
        let registerCmd = '/reg';
        let loginCmd = '/login';
        let verifyDone = false;
        let registerDone = false;
        let loginDone = false;
        // "scheduled" выставляются СРАЗУ при обнаружении промпта — чтобы 4-секундный
        // fallback не выстрелил раньше отложенного doLogin/doRegister, если сервер
        // прислал промпт поздно (после resource-pack/configuration overhead)
        let verifyScheduled = false;
        let registerScheduled = false;
        let loginScheduled = false;
        let finished = false;

        const finish = (status) => {
            if (finished) return;
            finished = true;
            try { bot.quit(); } catch (e) {}
            resolve({ name, status, log });
        };

        const doVerify = () => {
            if (verifyDone) return;
            verifyDone = true;
            bot.chat(verifyCmd);
            push(`sent verify: ${verifyCmd}`);
        };

        const sendFinal = () => {
            setTimeout(() => {
                bot.chat(finalMessage);
                push(`sent final: ${finalMessage}`);
                setTimeout(() => finish('ok'), 1000);
            }, 2000);
        };

        const doRegister = () => {
            if (registerDone || loginDone) return;
            registerDone = true;
            const cmd = `${registerCmd} ${regPassword} ${regPassword}`;
            bot.chat(cmd);
            push(`sent register: ${cmd}`);
            sendFinal();
        };

        const doLogin = () => {
            if (loginDone || registerDone) return;
            loginDone = true;
            const cmd = `${loginCmd} ${regPassword}`;
            bot.chat(cmd);
            push(`sent login: ${cmd}`);
            sendFinal();
        };

        bot.on('message', (jsonMsg) => {
            const text = jsonMsg.toString();
            if (text.trim()) log.push(`chat: ${text}`);

            const verifyMatch = text.match(/[Ff]or example:\s*(\.\w+)/);
            if (verifyMatch && !verifyScheduled) {
                verifyScheduled = true;
                verifyCmd = verifyMatch[1];
                setTimeout(doVerify, 500);
            }

            // Аккаунт уже зарегистрирован — сервер просит /login, а не /register
            const loginMatch = text.match(/login.*?command:\s*(\/\w+)/i);
            if (loginMatch && !loginScheduled && !registerScheduled) {
                loginScheduled = true;
                loginCmd = loginMatch[1];
                setTimeout(doLogin, 1500);
                return;
            }

            const regMatch = text.match(/register.*?command:\s*(\/\w+)/i);
            if (regMatch && !registerScheduled && !loginScheduled) {
                registerScheduled = true;
                registerCmd = regMatch[1];
                setTimeout(doRegister, 1500);
            }

            if (/verification/i.test(text) && !verifyMatch && !verifyScheduled) {
                verifyScheduled = true;
                setTimeout(doVerify, 3000);
            }
            if (/\blogin\b/i.test(text) && !loginMatch && !loginScheduled && !registerScheduled) {
                loginScheduled = true;
                setTimeout(doLogin, 3000);
            } else if (/register/i.test(text) && !regMatch && !registerScheduled && !loginScheduled) {
                registerScheduled = true;
                setTimeout(doRegister, 3000);
            }
        });

        bot.on('login', () => {
            push('login OK');
            setTimeout(() => {
                if (!verifyScheduled && !registerScheduled && !loginScheduled) doRegister();
            }, 6000);
        });

        bot.on('kicked', (reason) => {
            const txt = typeof reason === 'string' ? reason : JSON.stringify(reason);
            push(`kicked: ${txt.slice(0, 200)}`);
            finish('kicked');
        });

        bot.on('error', (err) => {
            push(`error: ${err.message}`);
            finish('error');
        });

        setTimeout(() => {
            if (!finished) {
                push('timeout');
                finish('timeout');
            }
        }, 30000);
    });
}

module.exports = { runBot };
