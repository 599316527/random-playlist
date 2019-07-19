const yargs = require('yargs');
const { generate } = require('./generate');
const { getServer } = require('./server');

yargs.option('verbose', {
    boolean: true,
    default: false
}).command(
    'generate <source> <target>',
    'generate m3u8 files',
    {
        type: {
            alias: 't',
            choices: ['mpegts', 'fmp4'],
            default: 'mpegts'
        },
        audioOnly: {
            alias: 'a',
            boolean: true,
            default: false
        },
        singleFile: {
            alias: 's',
            boolean: true,
            default: false
        }
    },
    handleGenerate
).command(
    'serve <www>',
    'Start server',
    {
        port: {
            alias: 'p',
            number: true,
            default: 8000
        },
        cors: {
            alias: 'c',
            boolean: true,
            default: false
        }
    },
    handleServe
).argv;



async function handleGenerate({source, target, type, audioOnly, singleFile, verbose}) {
    await generate(source, target, {type, audioOnly, singleFile, verbose});
}

function handleServe({port, www, verbose, cors}) {
    getServer(www, {verbose, cors}).listen(port, function () {
        console.log('server is running on ' + port);
    });
}
