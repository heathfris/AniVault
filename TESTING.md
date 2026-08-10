# Testing

The regression test exercises the real `downloadEpisode` control flow without
opening Edge or IDM. It injects test doubles for URL resolution, IDM launch,
and file stability checks.

Run it with the bundled Node.js runtime or a regular Node.js installation:

```powershell
node tests/run-tests.js
```

The test does not contact AGE, download media, or change the configured
download directory.

Real M3U8 and background-mode downloads use `tools/ffmpeg/ffmpeg.exe` when it
exists. Otherwise provide `ffmpeg.exe` on PATH or set `AGE_FFMPEG` to its full
path.
