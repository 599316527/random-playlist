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
        await fse.ensureDir(path.join(targetDir, key));
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
    let metadataFile = path.join(targetDir, 'metadata.json');
    let metadata = {};
    try {
        let result = await fse.readJSON(metadataFile);
        if (!result.keyNameMapping) result.keyNameMapping = {};
        Object.assign(result.keyNameMapping, keyNameMapping);
        metadata = result;
    }
    catch (err) {
        metadata = {keyNameMapping};
    }
    await fse.writeJSON(metadataFile, metadata);
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
    let segmentFilename = `part%03d.${extname}`;
    if (singleFile) {
        segmentFilename = `single.${extname}`;
        outputParams = outputParams.concat(['-hls_flags', 'single_file']);
    }
    segmentFilename = path.join(targetDir, key, segmentFilename);
    outputParams = outputParams.concat([
        '-hls_segment_filename', segmentFilename,
        '-f', 'hls', path.join(targetDir, key, 'entry.m3u8')
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
