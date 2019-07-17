const fse = require('fs-extra');
const path = require('path');
const {shuffle} = require('lodash');
const express = require('express');
const serve   = require('express-static');

exports.getServer = function (www) {
    let app = express();

    app.get('/random.m3u8', async function (req, res) {
        res.header({
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
        });
        res.type('.m3u8').send(await combinePlaylist(www));
    });

    app.use(serve(www));

    return app;
};


async function combinePlaylist(www) {
    let files = await fse.readdir(www);
    files = files.filter(file => !file.startsWith('.') && file.endsWith('.m3u8'))
            .map(file => path.join(www, file));
    files = shuffle(files);
    let result = [];
    for (let i = 0; i < files.length; i++) {
        let content = await fse.readFile(files[i], 'utf8');
        let lines = content.trim().split('\n');
        if (i === 0) {
            result = result.concat(lines.slice(0, 4));
        }

        result = result.concat(lines.slice(4, -1));

        if (i === files.length - 1) {
            result = result.concat(lines.slice(-1));
        }
    }
    return result.concat('').join('\n');
}