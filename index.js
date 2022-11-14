/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0/
 */

const path = require('path');
const fs = require('fs');
const eventEmitter = require('events').EventEmitter;

const { checkNetworkStatus, loader } = require('./utils');
const Forge = require('./loader/forge');
const Fabric = require('./loader/fabric');
const Quilt = require('./loader/quilt');

class index {
    constructor(options = {}) {
        this.options = options;
        this.path = path.resolve(this.options.path);
        this.pathLibraries = path.resolve(this.path, 'libraries');
        this.pathVersions = path.resolve(this.path, 'versions');
        this.pathTemp = path.resolve(this.path, 'temp');
        this.on = eventEmitter.prototype.on;
        this.emit = eventEmitter.prototype.emit;
    }

    async install() {
        let networkStatus = await checkNetworkStatus(this.options.timeout);
        if (!networkStatus) return this.emit('error', { error: 'Network error' });

        let Loader = loader(this.options.loader.type);
        if (!Loader) return this.emit('error', { error: `Loader ${this.options.loader.type} not found` });

        if (this.options.loader.type === 'forge') {
            let forge = await this.forge(Loader);
            if (forge.error) return this.emit('error', forge);
            this.emit('json', forge);
        } else if (this.options.loader.type === 'fabric') {
            let fabric = await this.fabric(Loader);
            if (fabric.error) return this.emit('error', fabric);
            this.emit('json', fabric);
        } else if (this.options.loader.type === 'quilt') {
            let quilt = await this.fabric(Loader);
            if (quilt.error) return this.emit('error', quilt);
            this.emit('json', quilt);
        }
    }

    async forge(Loader) {
        let forge = new Forge(this.options);

        // set event
        forge.on('check', (progress, size, element) => {
            this.emit('check', progress, size, element);
        });
        
        forge.on('progress', (progress, size, element) => {
            this.emit('progress', progress, size, element);
        });

        forge.on('extract', (element) => {
            this.emit('extract', element);
        });

        forge.on('patch', patch => {
            this.emit('patch', patch);
        });

        // download installer
        let installer = await forge.donwloadInstaller(Loader);
        if (installer.error) return installer;

        // extract install profile
        let profile = await forge.extractProfile(installer.filePath);
        if (profile.error) return profile
        let destination = path.resolve(this.pathVersions, profile.version.id)
        if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
        fs.writeFileSync(path.resolve(destination, `${profile.version.id}.json`), JSON.stringify(profile.version, null, 4));

        // extract universal jar
        let universal = await forge.extractUniversalJar(profile.install, installer.filePath);
        if (universal.error) return universal;

        // download libraries
        let libraries = await forge.downloadLibraries(profile, universal);
        if (libraries.error) return libraries;

        // patch forge if nessary
        let patch = await forge.patchForge(profile.install, universal);
        if (patch.error) return patch;

        return profile.version;
    }

    async fabric(Loader) {
        let fabric = new Fabric(this.options);

        // set event
        fabric.on('check', (progress, size, element) => {
            this.emit('check', progress, size, element);
        });

        fabric.on('progress', (progress, size, element) => {
            this.emit('progress', progress, size, element);
        });

        // download Json
        let json = await fabric.downloadJson(Loader);
        if (json.error) return json;
        let destination = path.resolve(this.pathVersions, json.id)
        if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
        fs.writeFileSync(path.resolve(destination, `${json.id}.json`), JSON.stringify(json, null, 4));

        // download libraries
        await fabric.downloadLibraries(json);

        return json;
    }

    async fabric(Loader) {
        let quilt = new Quilt(this.options);

        // set event
        quilt.on('check', (progress, size, element) => {
            this.emit('check', progress, size, element);
        });
        
        quilt.on('progress', (progress, size, element) => {
            this.emit('progress', progress, size, element);
        });

        // download Json
        let json = await quilt.downloadJson(Loader);
        if (json.error) return json;
        let destination = path.resolve(this.pathVersions, json.id)
        if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
        fs.writeFileSync(path.resolve(destination, `${json.id}.json`), JSON.stringify(json, null, 4));

        // download libraries
        await quilt.downloadLibraries(json);

        return json;
    }
}

module.exports = index;