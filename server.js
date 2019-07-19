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
    let keyNameMapping = {};
    try {
        let result = await fse.readJSON(path.join(www, 'metadata.json'));
        keyNameMapping = result.keyNameMapping || {};
    }
    catch (err) {};
    let files = await fse.readdir(www);
    files = files.filter(file => !file.startsWith('.') && file.endsWith('.m3u8'))
            .map(file => path.join(www, file));
    files = shuffle(files);
    let result = [];
    for (let i = 0; i < files.length; i++) {
        let key = path.basename(files[i], path.extname(files[i]));
        let name = keyNameMapping[key];
        let content = await fse.readFile(files[i], 'utf8');
        let lines = content.trim().split('\n');

        let count = 0;
        lines = lines.map(function (line) {
            if (line.startsWith('#EXTINF:') && line.endsWith(',')) {
                line += `${name} part${count++}`;
            }
            return line;
        });

        if (i === 0) {
            result = result.concat(lines.slice(0, 4));
        }
        result = result.concat(lines.slice(4, -1));
        if (i === files.length - 1) {
            result = result.concat(lines.slice(-1));
        }
        else {
            result.push('#EXT-X-DISCONTINUITY');
        }
    }
    return result.concat('').join('\n');
}