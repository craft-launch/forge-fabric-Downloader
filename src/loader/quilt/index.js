const path = require('path');
const nodeFetch = require('node-fetch');
const { download, getPathLibraries } = require('../../utils');
const fs = require('fs');
const eventEmitter = require('events').EventEmitter;

module.exports = class index {
    constructor(options = {}) {
        this.options = options;
        this.versionMinecraft = this.options.loader.version;
        this.path = path.resolve(this.options.path).replace(/\\/g, '/');
        this.pathLibraries = path.resolve(this.path, 'libraries').replace(/\\/g, '/');
        this.pathVersions = path.resolve(this.path, 'versions').replace(/\\/g, '/');
        this.on = eventEmitter.prototype.on;
        this.emit = eventEmitter.prototype.emit;
    }

    async downloadJson(Loader) {
        let build
        let metaData = await nodeFetch(Loader.metaData).then(res => res.json());

        let version = metaData.game.find(version => version.version === this.versionMinecraft);
        let AvailableBuilds = metaData.loader.map(build => build.version);
        if (!version) return { error: `QuiltMC doesn't support Minecraft ${this.versionMinecraft}` };

        if (this.options.loader.build === 'latest') {
            build = metaData.loader[0];
        } else if (this.options.loader.build === 'recommended') {
            build = metaData.loader.find(build => !build.version.includes('beta'));
        } else {
            build = metaData.loader.find(loader => loader.version === this.options.loader.build);
        }

        if (!build) return { error: `Quilt Loader ${this.options.loader.build} not fond, Available builds: ${AvailableBuilds.join(', ')}` };

        let url = Loader.json.replace('${build}', build.version).replace('${version}', this.versionMinecraft);
        let json = await nodeFetch(url).then(res => res.json()).catch(err => err);
        return json
    }

    async downloadLibraries(json) {
        let { libraries } = json;
        let downloader = new download();
        let files = [];
        let check = 0;
        let size = 0;

        for (let lib of libraries) {
            if (lib.rules) {
                this.emit('check', check++, libraries.length, 'libraries');
                continue;
            }
            let file = {}
            let libInfo = getPathLibraries(lib.name);
            let pathLib = path.resolve(this.pathLibraries, libInfo.path);
            let pathLibFile = path.resolve(pathLib, libInfo.name);

            if (!fs.existsSync(pathLibFile)) {
                let url = `${lib.url}${libInfo.path}/${libInfo.name}`
                let sizeFile = 0

                let res = await downloader.checkURL(url)
                
                if (res.status === 200) {
                    sizeFile = res.size;
                    size += res.size;
                }

                file = {
                    url: url,
                    folder: pathLib,
                    path: `${pathLib}/${libInfo.name}`,
                    name: libInfo.name,
                    size: sizeFile
                }
                files.push(file);
            }
            this.emit('check', check++, libraries.length, 'libraries');
        }

        if (files.length > 0) {
            downloader.on("progress", (DL, totDL) => {
                this.emit("progress", DL, totDL, 'libraries');
            });

            await downloader.downloadFileMultiple(files, size, this.options.downloadFileMultiple);
        }
        return libraries
    }
}