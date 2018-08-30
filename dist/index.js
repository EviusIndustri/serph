#!/usr/bin/env node
'use strict';

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _morgan = require('morgan');

var _morgan2 = _interopRequireDefault(_morgan);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _serve = require('./services/serve');

var _serve2 = _interopRequireDefault(_serve);

var _commander = require('commander');

var _commander2 = _interopRequireDefault(_commander);

var _fs = require('fs');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_commander2.default.version('0.1.0').option('-p, --port <n>', 'port to use').option('-s, --spa', 'redirect all route to index.html');

_commander2.default.parse(process.argv);

const OPTS = {
	port: _commander2.default.port || 8080,
	spa: _commander2.default.spa || false
};

const APP_DIR = process.cwd();

if ((0, _fs.existsSync)(_path2.default.join(APP_DIR, 'index.html'))) {
	const app = (0, _express2.default)();

	app.use((0, _morgan2.default)('tiny'));
	app.use('*', (0, _serve2.default)(APP_DIR, OPTS));

	app.listen(OPTS.port, () => {
		console.log(`Sera is up on PORT ${OPTS.port}`);
	});
} else {
	console.error('file index.html not found');
}
//# sourceMappingURL=index.js.map