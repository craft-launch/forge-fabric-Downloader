const spawn = require('child_process').spawn;
const path = require('path');
const fs = require('fs');

const { getPathLibraries, extractAll } = require('../../utils');

const eventEmitter = require('events').EventEmitter;


module.exports = class forgePatcher {
    constructor(options) {
        this.options = options;
        this.path = path.resolve(this.options.path);
        this.pathLibraries = path.resolve(this.path, 'libraries');
        this.pathVersions = path.resolve(this.path, 'versions');
        this.pathTemp = path.resolve(this.path, 'temp');
        this.versionMinecraft = this.options.loader.version;
        this.on = eventEmitter.prototype.on;
        this.emit = eventEmitter.prototype.emit;
    }

    async patcher(profile, config) {
        let { processors } = profile;

        for (let key in processors) {
            if (Object.prototype.hasOwnProperty.call(processors, key)) {
                let processor = processors[key];
                if (processor?.sides && !(processor?.sides || []).includes('client')) {
                    continue;
                }

                let jar = getPathLibraries(processor.jar)
                let filePath = path.resolve(this.pathLibraries, jar.path, jar.name)

                let args = processor.args.map(arg => this.setArgument(arg, profile, config)).map(arg => this.computePath(arg));
                let classPaths = processor.classpath.map(cp => {
                    let classPath = getPathLibraries(cp)
                    return `"${path.join(this.pathLibraries, `${classPath.path}/${classPath.name}`)}"`
                });
                let mainClass = await this.readJarManifest(filePath);

                await new Promise(resolve => {
                    const ps = spawn(
                        `"${path.resolve(config.java)}"`,
                        [
                            '-classpath',
                            [`"${filePath}"`, ...classPaths].join(path.delimiter),
                            mainClass,
                            ...args
                        ], { shell: true }
                    );

                    ps.stdout.on('data', data => {
                        this.emit('patch', data.toString('utf-8'))
                    });

                    ps.stderr.on('data', data => {
                        this.emit('patch', data.toString('utf-8'))
                    });

                    ps.on('close', code => {
                        if (code !== 0) {
                            this.emit('error', `Forge patcher exited with code ${code}`);
                            resolve();
                        }
                        resolve();
                    });
                });
            }
        }

    }

    check(profile) {
        let files = [];
        let { processors } = profile;

        for (let key in processors) {
            if (Object.prototype.hasOwnProperty.call(processors, key)) {
                let processor = processors[key];
                if (processor?.sides && !(processor?.sides || []).includes('client')) continue;

                processor.args.map(arg => {
                    let finalArg = arg.replace('{', '').replace('}', '');
                    if (profile.data[finalArg]) {
                        if (finalArg === 'BINPATCH') return
                        files.push(profile.data[finalArg].client)
                    }
                })
            }
        }

        files = files.filter((item, index) => files.indexOf(item) === index);

        for (let file of files) {
            let libMCP = getPathLibraries(file.replace('[', '').replace(']', ''))
            file = `${path.resolve(this.pathLibraries, `${libMCP.path}/${libMCP.name}`)}`;
            if (!fs.existsSync(file)) return false
        }
        return true;
    }

    setArgument(arg, profile, config) {
        let finalArg = arg.replace('{', '').replace('}', '');
        let universalPath = profile.libraries.find(v =>
            (v.name || '').startsWith('net.minecraftforge:forge')
        )

        if (profile.data[finalArg]) {
            if (finalArg === 'BINPATCH') {
                let clientdata = getPathLibraries(profile.path || universalPath.name)
                return `"${path
                    .join(this.pathLibraries, `${clientdata.path}/${clientdata.name}`)
                    .replace('.jar', '-clientdata.lzma')}"`;
            }
            return profile.data[finalArg].client;
        }

        return arg
            .replace('{SIDE}', `client`)
            .replace('{ROOT}', `"${path.dirname(path.resolve(this.options.path, 'forge'))}"`)
            .replace('{MINECRAFT_JAR}', `"${config.minecraft}"`)
            .replace('{MINECRAFT_VERSION}', `"${config.minecraftJson}"`)
            .replace('{INSTALLER}', `"${this.pathLibraries}"`)
            .replace('{LIBRARY_DIR}', `"${this.pathLibraries}"`);
    }

    computePath(arg) {
        if (arg[0] === '[') {
            let libMCP = getPathLibraries(arg.replace('[', '').replace(']', ''))
            return `"${path.join(this.pathLibraries, `${libMCP.path}/${libMCP.name}`)}"`;
        }
        return arg;
    }

    async readJarManifest(jarPath) {
        let extraction = await extractAll(jarPath, this.pathTemp, 'META-INF/MANIFEST.MF');

        if (extraction) return extraction;
        return null;
    }
}