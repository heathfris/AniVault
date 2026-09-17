'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function getPortableManifest(outputRoot) {
  return {
    launcher: 'AniVault.exe',
    outputRoot,
    files: [
      'electron.exe',
      'resources\\app\\package.json',
      'resources\\app\\anime_updater.js',
      'resources\\app\\electron',
      'resources\\app\\renderer',
      'resources\\app\\src',
      'resources\\app\\scripts',
      'resources\\app\\integrations',
      'resources\\app\\tools\\aria2\\aria2c.exe',
      'resources\\app\\tools\\ffmpeg\\ffmpeg.exe',
      'resources\\app\\node_modules\\playwright-core',
    ],
  };
}

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(fs.realpathSync(source), target, { recursive: true });
}

function buildPortable(outputRoot) {
  const electronDist = path.join(root, 'node_modules', 'electron', 'dist');
  const playwright = path.join(root, 'node_modules', 'playwright-core');
  const required = [
    path.join(electronDist, 'electron.exe'),
    path.join(root, 'tools', 'aria2', 'aria2c.exe'),
    path.join(root, 'tools', 'ffmpeg', 'ffmpeg.exe'),
    playwright,
  ];
  for (const file of required) {
    if (!fs.existsSync(file)) throw new Error('缺少打包依赖: ' + file);
  }

  let targetRoot = outputRoot;
  try {
    fs.rmSync(targetRoot, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'EBUSY') throw error;
    targetRoot = outputRoot + '-' + Date.now();
  }
  fs.mkdirSync(targetRoot, { recursive: true });
  for (const entry of fs.readdirSync(electronDist)) {
    if (entry === 'electron.exe') continue;
    copy(path.join(electronDist, entry), path.join(targetRoot, entry));
  }
  copy(path.join(electronDist, 'electron.exe'), path.join(targetRoot, 'AniVault.exe'));

  const appRoot = path.join(targetRoot, 'resources', 'app');
  for (const entry of ['package.json', 'anime_updater.js', 'electron', 'renderer', 'src', 'scripts', 'integrations']) {
    copy(path.join(root, entry), path.join(appRoot, entry));
  }
  copy(path.join(root, 'tools', 'aria2'), path.join(appRoot, 'tools', 'aria2'));
  copy(path.join(root, 'tools', 'ffmpeg'), path.join(appRoot, 'tools', 'ffmpeg'));
  copy(playwright, path.join(appRoot, 'node_modules', 'playwright-core'));

  fs.writeFileSync(path.join(targetRoot, 'README.txt'), [
    '番仓 AniVault Portable',
    '',
    '双击 AniVault.exe 启动。首次启动后，配置和运行记录会保存到当前 Windows 用户的 AppData 目录。',
    '需要 Microsoft Edge；aria2 和 ffmpeg 已随包提供。',
    '',
  ].join('\r\n'), 'utf8');
  return targetRoot;
}

if (require.main === module) {
  const output = path.resolve(process.argv[2] || path.join(root, 'dist', `AniVault-${packageInfo.version}-portable`));
  console.log('PORTABLE_BUILD ' + buildPortable(output));
}

module.exports = { buildPortable, getPortableManifest };
