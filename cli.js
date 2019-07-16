const yargs = require('yargs');
const { generate } = require('./generate');
const { getServer } = require('./server');

yargs.command(
    'generate',
    'generate m3u8 files',
    {
        source: {
            alias: 's'
        },
        target: {
            alias: 't'
        }
    },
    handleGenerate
);

yargs.command(
    'serve',
    'Start server',
    {
        port: {
            alias: 'p',
            default: 8000
        },
        www: {
            alias: 'w'
        }
    },
    handleServe
);

yargs.option('verbose', {
    alias: 'v',
    default: false
}).argv;

async function handleGenerate({source, target}) {
    if (!source || !target) {
        throw new Error('Source and Target are required');
    }
    await generate(source, target);
}

function handleServe({port, www}) {
    port = parseInt(port, 10);
    if (isNaN(port) || port < 1) {
        throw new Error('Port is illegal');
    }
    if (!www) {
        throw new Error('web dir is required');
    }

    getServer(www).listen(port, function () {
        console.log('server is running');
    });
}
