const fse = require('fs-extra');
const path = require('path');
const {shuffle} = require('lodash');
const express = require('express');
const serve = require('express-static');
const cors = require('cors');

exports.getServer = function (www, options) {
    let app = express();

    let preprocessor = [];
    if (options.cors) {
        preprocessor.push(cors());
    }
    if (options.verbose) {
        preprocessor.push(function (req, res, next) {
            console.log('[REQ]', req.method, req.ip, req.originalUrl, req.get('Range'), req.get('Origin'));
            next();
        });
    }
    app.use(...preprocessor);

    app.get('/random.m3u8', async function (req, res) {
        res.header({
            'Cache-Control': 'no-cache'
        });
        res.type('.m3u8').send(await combinePlaylist(www));
    });

    app.use(serve(www));

    return app;
};


async function combinePlaylist(www) {
    let {keyNameMapping = {}} = await fse.readJSON(path.join(www, 'metadata.json'));
    let keys = shuffle(Object.keys(keyNameMapping));
    let result = [];
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let name = keyNameMapping[key];
        let file = path.join(www, key, 'entry.m3u8');
        let content = await fse.readFile(file, 'utf8');
        let lines = content.trim().split('\n');

        let count = 0;
        lines = lines.map(function (line) {
            if (name && line.startsWith('#EXTINF:') && line.endsWith(',')) {
                line += `${name} part${count++}`;
            }
            if (line.endsWith('.ts') || line.endsWith('.m4s')) {
                line = `${key}/${line}`;
            }
            if (line === '#EXT-X-MAP:URI="init.mp4"') {
                line = `#EXT-X-MAP:URI="${key}/init.mp4"`;
            }
            return line;
        });

        if (i === 0) {
            result = result.concat(lines.slice(0, 4));
        }
        result = result.concat(lines.slice(4, -1));
        if (i === keys.length - 1) {
            result = result.concat(lines.slice(-1));
        }
        else {
            result.push('#EXT-X-DISCONTINUITY');
        }
    }
    return result.concat('').join('\n');
}