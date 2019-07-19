Random Playlist
============

1. Convert audios to m3u8 files
   `node cli.js generate <source> <target> --type fmp4 --audioOnly --singleFile --verbose`
2. Serve random combined m3u8 file
   `node cli.js serve <target> --port 8000 --cors --verbose`
3. Request m3u8
   `http://127.0.0.1:8000/random.m3u8`

