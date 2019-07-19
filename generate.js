const fse = require('fs-extra');
const path = require('path');
const uuid = require('uuid/v4');
const spawn = require('await-spawn');

const albumPath = path.join(__dirname, 'album.jpg');
const videoExts = ['.mp4', '.mkv'];
const audioExts = ['.mp3', '.m4a'];
const videoEncodeParams = (process.env.RPLST_VIDEO_ENCODE_PARAMS || '-c:v libx264 -crf 23 -profile:v high -level 4.1 -pix_fmt yuv420p').split(/\s+/);
const audioEncodeParams = (process.env.RPLST_AUDIO_ENCODE_PARAMS || '-c:a aac -ac 1 -strict -2 -b:a 192k').split(/\s+/);

exports.generate = async function (sourceDir, targetDir, options) {
    let files = await fse.readdir(sourceDir);
    files = files.filter(file => !file.startsWith('.'))
            .map(file => path.join(sourceDir, file))
            .filter(file => isVideo(file) || isAudio(file));
    let spawnOptions = {cwd: process.cwd(), env: process.env};
    let keyNameMapping = {};
    await fse.ensureDir(targetDir);
    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let {command, parameters, key} = getCommand(file, targetDir, options);
        keyNameMapping[key] = path.basename(file, path.extname(file));
        if (!options.singleFile) {
            await fse.ensureDir(path.join(targetDir, key));
        }
        console.log(['Running\t', command].concat(parameters).join(' '));
        let promise = spawn(command, parameters, spawnOptions);
        if (options.verbose) {
            promise.child.stderr.on('data', function (data) {
                console.log(`FFMPEG stderr: ${data}`);
            });
        }
        try {
            await promise;
        }
        catch (err) {
            console.log('ERROR: ', err.stderr.toString());
            process.exit(err.code);
        }
    }
    await fse.writeJSON(path.join(targetDir, 'metadata.json'), {keyNameMapping});
};

function getCommand(file, targetDir, {type, audioOnly, singleFile}) {
    let key = uuid();
    let targetPath = path.join(targetDir, key);
    let command = 'ffmpeg';
    let commonParams = ['-hide_banner'];

    let inputParams = ['-i', file];
    if (isAudio(file)) {
        inputParams = inputParams.concat(['-loop', 1, '-i', albumPath, '-shortest']);
    }

    let videoParams = [...videoEncodeParams];
    if (audioOnly) {
        videoParams.push('-vn');
    }

    let audioParams = [...audioEncodeParams];
    let outputParams = [
        '-start_number', 0,
        '-hls_time', 10,
        '-hls_list_size', 0,
        '-hls_segment_type', type
    ];
    let extname = getExtByType(type);
    let segmentFilename;
    if (singleFile) {
        segmentFilename = path.join(targetDir, `${key}.${extname}`);
        outputParams = outputParams.concat(['-hls_flags', 'single_file']);
    }
    else {
        segmentFilename = path.join(targetDir, key, `part%03d.${extname}`);
        outputParams = outputParams.concat(['-hls_base_url', `${key}/`]);
    }
    outputParams = outputParams.concat([
        '-hls_segment_filename', segmentFilename,
        '-f', 'hls', `${targetPath}.m3u8`
    ]);

    return {
        command,
        parameters: [
            ...commonParams,
            ...inputParams,
            ...videoParams,
            ...audioParams,
            ...outputParams
        ],
        key
    };
}

function isAudio(file) {
    return audioExts.includes(path.extname(file));
}

function isVideo(file) {
    return videoExts.includes(path.extname(file));
}

function getExtByType(type) {
    return {
        mpegts: 'ts',
        fmp4: 'm4s'
    }[type];
}
