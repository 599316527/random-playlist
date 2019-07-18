const fse = require('fs-extra');
const path = require('path');
const uuid = require('uuid/v4');
const spawn = require('await-spawn');

const albumPath = path.join(__dirname, 'album.png');
const videoExts = ['.mp4', '.mkv'];
const audioExts = ['.mp3', '.m4a'];

exports.generate = async function (sourceDir, targetDir) {
    let files = await fse.readdir(sourceDir);
    files = files.filter(file => !file.startsWith('.'))
            .map(file => path.join(sourceDir, file))
            .filter(file => isVideo(file) || isAudio(file));
    let spawnOptions = {cwd: process.cwd(), env: process.env};
    console.log('cwd', spawnOptions.cwd);
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let {command, parameters, key} = getCommand(file, targetDir);
        await fse.ensureDir(path.join(targetDir, key));
        console.log(['Running\t', command].concat(parameters).join(' '));
        let promise = spawn(command, parameters, spawnOptions);
        promise.child.stderr.on('data', function (data) {
            console.log(`FFMPEG stderr: ${data}`);
        });
        try {
            await promise;
        }
        catch (err) {
            console.log('ERROR: ', err.stderr.toString());
            process.exit(err.code);
        }
    }
};

function getCommand(file, targetDir) {
    let key = uuid();
    let targetPath = path.join(targetDir, key);
    let command = 'ffmpeg';
    let parameters = ['-y', '-hide_banner'];
    if (isAudio(file)) {
        parameters = parameters.concat(['-loop', 1, '-i', albumPath]);
    }
    parameters = parameters.concat([
        '-i', file,
        ...('-c:v libx264 -tune stillimage -crf 23 -profile:v high -level 4.1 -pix_fmt yuv420p -c:a aac -ac 1 -strict -2 -b:a 192k'.split(/\s+/)),
        // ...('-c:v mpeg2video -qscale:v 2 -c:a mp2 -b:a 192k'.split(/\s+/)),
        ...('-s 64x64 -shortest -start_number 0 -hls_time 10 -hls_list_size 0 -f hls'.split(/\s+/)),
        '-hls_segment_filename', `${targetPath}/file%03d.ts`,
        '-hls_base_url', `${key}/`,
        `${targetPath}.m3u8`
    ]);
    return {command, parameters, key};
}

function isAudio(file) {
    return audioExts.includes(path.extname(file));
}

function isVideo(file) {
    return videoExts.includes(path.extname(file));
}