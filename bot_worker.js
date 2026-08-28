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
        let verifyDone = false;
        let registerDone = false;
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

        const doRegister = () => {
            if (registerDone) return;
            registerDone = true;
            const cmd = `${registerCmd} ${regPassword} ${regPassword}`;
            bot.chat(cmd);
            push(`sent register: ${cmd}`);
            setTimeout(() => {
                bot.chat(finalMessage);
                push(`sent final: ${finalMessage}`);
                setTimeout(() => finish('ok'), 1000);
            }, 2000);
        };

        bot.on('message', (jsonMsg) => {
            const text = jsonMsg.toString();

            const verifyMatch = text.match(/[Ff]or example:\s*(\.\w+)/);
            if (verifyMatch && !verifyDone) {
                verifyCmd = verifyMatch[1];
                setTimeout(doVerify, 500);
            }

            const regMatch = text.match(/command:\s*(\/\w+)/);
            if (regMatch && !registerDone) {
                registerCmd = regMatch[1];
                setTimeout(doRegister, 1500);
            }

            if (/verification/i.test(text) && !verifyMatch && !verifyDone) {
                setTimeout(doVerify, 3000);
            }
            if (/register/i.test(text) && !regMatch && !registerDone) {
                setTimeout(doRegister, 3000);
            }
        });

        bot.on('login', () => {
            push('login OK');
            setTimeout(() => {
                if (!verifyDone && !registerDone) doRegister();
            }, 4000);
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
