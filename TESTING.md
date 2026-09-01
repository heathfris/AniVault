# Testing

The regression suite exercises the real downloader control flow, configuration,
Electron IPC helpers, schedule integration, template matching, and the optional
mpv watched-prefix module without contacting AGE or changing the real download
directory.

Run it with the bundled Node.js runtime or a regular Node.js installation:

```powershell
pnpm test
```

For the smaller downloader-only regression, run `node tests/run-tests.js`.

Real M3U8 downloads always use `tools/ffmpeg/ffmpeg.exe` when it exists; aria2
is reserved for single-file media. Otherwise provide `ffmpeg.exe` on PATH or
set `AGE_FFMPEG` to its full path.
