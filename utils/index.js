/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0/
 */

const crypto = require('crypto');
const nodeFetch = require('node-fetch');
const { extractFull } = require('node-7z');
const { path7za } = require('7zip-bin');
const fs = require('fs');

const download = require('./download');
const minecraft = require('./minecraft');
const downloadTools = require('./downloadTools');

class utils {
    async getFileHash(filePath, algorithm = 'sha1') {
        let shasum = crypto.createHash(algorithm);

        let file = fs.ReadStream(filePath);
        file.on('data', data => {
            shasum.update(data);
        });

        let hash = await new Promise(resolve => {
            file.on('end', () => {
                resolve(shasum.digest('hex'));
            });
        });
        return hash;
    };

    async checkNetworkStatus(timeout = 10000) {
        const networkStatus = await nodeFetch('https://google.com', { timeout }).then(() => true).catch(() => false);
        return networkStatus;
    }

    getPathLibraries(main, nativeString, forceExt) {
        let libSplit = main.split(':')
        let fileName = libSplit[3] ? `${libSplit[2]}-${libSplit[3]}` : libSplit[2];
        let finalFileName = fileName.includes('@') ? fileName.replace('@', '.') : `${fileName}${nativeString || ''}${forceExt || '.jar'}`;
        let pathLib = `${libSplit[0].replace(/\./g, '/')}/${libSplit[1]}/${libSplit[2].split('@')[0]}`
        return {
            path: pathLib,
            name: `${libSplit[1]}-${finalFileName}`
        };
    }


    async extractAll(source, destination, args = {}) {
        if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
        const extraction = extractFull(source, destination, {
            ...args,
            yes: true,
            $bin: path7za,
            $spawnOptions: { shell: true }
        });

        let extractedParentDir = null;
        await new Promise((resolve, reject) => {
            extraction.on('data', data => {
                if (!extractedParentDir) {
                    [extractedParentDir] = data.file.split('/');
                }
            });
            extraction.on('end', () => {
                resolve(extractedParentDir);
            });
        });
        return { extraction };
    };

    loader(type) {
        if (type === 'forge') {
            return {
                metaData: 'https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json',
                meta: 'https://files.minecraftforge.net/net/minecraftforge/forge/${build}/meta.json',
                promotions: 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json',
                install: 'https://maven.minecraftforge.net/net/minecraftforge/forge/${version}/forge-${version}-installer.jar'

            }
        } else if (type === 'fabric') {
            return {
                metaData: 'https://meta.fabricmc.net/v2/versions',
                json: 'https://meta.fabricmc.net/v2/versions/loader/${version}/${build}/profile/json'
            }
        }
    }
}

let utilsInstance = new utils();

let mirrors = [
    "https://maven.minecraftforge.net",
    "https://maven.creeperhost.net",
    "https://libraries.minecraft.net"
]

module.exports = {
    getFileHash: utilsInstance.getFileHash,
    checkNetworkStatus: utilsInstance.checkNetworkStatus,
    getPathLibraries: utilsInstance.getPathLibraries,
    extractAll: utilsInstance.extractAll,
    loader: utilsInstance.loader,
    download: download,
    mirrors: mirrors,
    minecraft: minecraft,
    downloadTools: downloadTools
}