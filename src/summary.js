'use strict';

function summarize(anime, folderCount) {
  const total = Number.isInteger(anime.site_latest)
    ? anime.site_latest
    : (Number.isInteger(anime.downloaded_end) ? anime.downloaded_end : 0);
  const downloaded = typeof folderCount === 'number' && folderCount >= 0 ? folderCount : '?';
  return { downloaded, total };
}

module.exports = { summarize };
