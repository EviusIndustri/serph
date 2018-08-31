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

var _fs = require('fs');

var _commander = require('commander');

var _commander2 = _interopRequireDefault(_commander);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

let cmdValue;

_commander2.default.version('0.1.0').description('Minimalist http-server for static site').usage('<commands> [options]').arguments('<cmd>').action(cmd => {
	cmdValue = cmd;
});

_commander2.default.command('local').description('run serph on localhost').option('--port <n>', 'port to use').option('--spa', 'redirect all route to index.html').option('--no-hidden', 'ignore all request to dot files (hidden)').action(function (options) {
	cmdValue = 'local';

	const OPTS = {
		port: options.port || 8080,
		spa: options.spa || false,
		showHidden: options.hidden
	};

	const APP_DIR = process.cwd();

	if ((0, _fs.existsSync)(_path2.default.join(APP_DIR, 'index.html'))) {
		const app = (0, _express2.default)();

		app.use((0, _morgan2.default)('tiny'));
		app.use('*', (0, _serve2.default)(APP_DIR, OPTS));

		app.listen(OPTS.port, () => {
			console.log(`Serph is up on localhost:${OPTS.port}`);
		});
	} else {
		console.error('file index.html not found');
	}
});

_commander2.default.parse(process.argv);

if (typeof cmdValue === 'undefined') {
	_commander2.default.help();
	process.exit(1);
}
//# sourceMappingURL=index.js.map