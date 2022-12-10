/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0/
 */

const fs = require('fs');
const nodeFetch = require('node-fetch');
const eventEmitter = require('events').EventEmitter;

module.exports = class download {
    constructor() {
        this.on = eventEmitter.prototype.on;
        this.emit = eventEmitter.prototype.emit;
    }

    async downloadFile(url, path, fileName) {
        if (!fs.existsSync(path)) fs.mkdirSync(path, { recursive: true });
        const writer = fs.createWriteStream(path + '/' + fileName);
        const response = await nodeFetch(url);
        const size = response.headers.get('content-length');
        let downloaded = 0;
        return new Promise((resolve, reject) => {
            response.body.on('data', (chunk) => {
                downloaded += chunk.length;
                this.emit('progress', downloaded, size);
                writer.write(chunk);
            });

            response.body.on('end', () => {
                writer.end();
                resolve();
            });

            response.body.on('error', (err) => {
                this.emit('error', err);
                reject(err);
            });
        })
    }

    async downloadFileMultiple(files, size, limit = 1) {
        if (limit > files.length) limit = files.length;
        let completed = 0;
        let downloaded = 0;
        let queued = 0;

        let start = new Date().getTime();
        let before = 0;
        let speeds = [];

        let estimated = setInterval(() => {
            let duration = (new Date().getTime() - start) / 1000;
            let loaded = (downloaded - before) * 8;
            if (speeds.length >= 5) speeds = speeds.slice(1);
            speeds.push((loaded / duration) / 8);
            let speed = 0;
            for (let s of speeds) speed += s;
            speed /= speeds.length;
            this.emit("speed", speed);
            let time = (size - downloaded) / (speed);
            this.emit("estimated", time);
            start = new Date().getTime();
            before = downloaded;
        }, 500);

        const downloadNext = async() => {
            if (queued < files.length) {
                let file = files[queued];
                queued++;
                if (!fs.existsSync(file.foler)) fs.mkdirSync(file.folder, { recursive: true });
                const writer = fs.createWriteStream(file.path);
                const response = await nodeFetch(file.url);
                response.body.on('data', (chunk) => {
                    downloaded += chunk.length;
                    this.emit('progress', downloaded, size);
                    writer.write(chunk);
                });

                response.body.on('end', () => {
                    writer.end();
                    completed++;
                    downloadNext();
                });

                response.body.on('error', (err) => {
                    this.emit('error', err);
                });
            }
        };

        while (queued < limit) {
            downloadNext();
        }

        return new Promise((resolve) => {
            const interval = setInterval(() => {
                if (completed === files.length) {
                    clearInterval(estimated);
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
    }

    async checkURL(url, timeout = 10000) {
        return await new Promise(async(resolve, reject) => {
            await nodeFetch(url, { method: 'HEAD', timeout: timeout }).then(res => {
                if (res.status === 200) {
                    resolve({
                        size: parseInt(res.headers.get('content-length')),
                        status: res.status
                    })
                }
            })
            reject(false);
        });
    }

    async checkMirror(baseURL, mirrors) {
        for (let mirror of mirrors) {
            let url = `${mirror}/${baseURL}`;
            let res = await this.checkURL(url).then(res => res).catch(err => false);

            if (res?.status == 200) {
                return {
                    url: url,
                    size: res.size,
                    status: res.status
                }
                break;
            } continue;
        }
        return false;
    }


}