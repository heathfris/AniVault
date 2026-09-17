'use strict';

const path = require('node:path');

function getDataRoot(app, appRoot) {
  return app.isPackaged ? app.getPath('userData') : appRoot;
}

module.exports = { getDataRoot };
