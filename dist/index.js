#!/usr/bin/env node
'use strict';

var _tls = require('tls');

var _tls2 = _interopRequireDefault(_tls);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _morgan = require('morgan');

var _morgan2 = _interopRequireDefault(_morgan);

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _commander = require('commander');

var _commander2 = _interopRequireDefault(_commander);

var _sera = require('@evius/sera');

var _sera2 = _interopRequireDefault(_sera);

var _atmaClient = require('@evius/atma-client');

var _atmaClient2 = _interopRequireDefault(_atmaClient);

var _log = require('./lib/log');

var _log2 = _interopRequireDefault(_log);

var _deploy = require('./lib/deploy');

var _deploy2 = _interopRequireDefault(_deploy);

var _login = require('./lib/login');

var _login2 = _interopRequireDefault(_login);

var _register = require('./lib/register');

var _register2 = _interopRequireDefault(_register);

var _link = require('./lib/link');

var _link2 = _interopRequireDefault(_link);

var _config = require('./lib/config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_tls2.default.DEFAULT_ECDH_CURVE = 'auto';

const homedir = _os2.default.homedir();
if (!(0, _fs.existsSync)(_path2.default.join(homedir, '.serph'))) {
	(0, _fs.mkdirSync)(_path2.default.join(homedir, '.serph'));
}

_atmaClient2.default.init({
	server: _config2.default.ATMA_URL
});

const successOrError = statusCode => {
	if (statusCode >= 400) {
		return _log2.default.error(statusCode);
	}
	return _log2.default.success(statusCode);
};

const responseTime = time => {
	if (time < 3000) {
		return _log2.default.bold(`${time} ms`);
	}
	if (time < 5000) {
		return _log2.default.lightError(`${time} ms`);
	}
	return _log2.default.lightError(`${time} ms`);
};

const morganMiddleware = (0, _morgan2.default)(function (tokens, req, res) {
	return [_log2.default.bold(`--> ${tokens.method(req, res)}`), successOrError(tokens.status(req, res)), _log2.default.url(tokens.url(req, res)), responseTime(tokens['response-time'](req, res)), _log2.default.bold('- ' + tokens.date(req, res))].join(' ');
});

let cmdValue;

_commander2.default.version('0.1.0').description('Minimalist http-server for static site').usage('<commands> [options]').arguments('<cmd>').action(cmd => {
	cmdValue = cmd;
});

_commander2.default.command('local').description('serve static file locally').option('--port <n>', 'port to use').option('--spa', 'redirect all route to index.html').option('--no-hidden', 'ignore all request to dot files (hidden)').action(function (options) {
	cmdValue = 'local';

	const OPTS = {
		port: options.port || 8080,
		spa: options.spa || false,
		showHidden: options.hidden
	};

	const APP_DIR = process.cwd();

	if ((0, _fs.existsSync)(_path2.default.join(APP_DIR, 'index.html'))) {
		const app = (0, _express2.default)();

		app.use(morganMiddleware);
		// app.use('*', sera(APP_DIR, OPTS))

		app.use('*', async (req, res) => {
			const targetSite = APP_DIR;
			const targetPath = req.originalUrl.split('?')[0];

			if ((0, _fs.existsSync)(targetSite)) {
				const result = await (0, _sera2.default)(targetSite, targetPath, {
					spa: options.spa,
					showHidden: options.hidden
				});
				if (result.status === 200) {
					if (!result.type) {
						res.type = result.type;
					}
					return res.sendFile(result.path, result.options);
				}
				return res.status(result.status).send('error boy');
			}
			return res.status(404).send('url not found');
		});

		app.listen(OPTS.port, () => {
			console.log(_log2.default.bold(`Serph is up on ${_log2.default.url(`localhost:${OPTS.port}`)}`));
		});
	} else {
		console.error(_log2.default.error('file index.html not found'));
	}
});

_commander2.default.command('deploy').description('deploy your static site to serph.network').action(function () {
	cmdValue = 'deploy';

	(0, _deploy2.default)();
});

_commander2.default.command('link').description('create new link to your deployment').arguments('<deployment> <new_link>').action(async function (deployment, new_link) {
	cmdValue = 'link';

	(0, _link2.default)(deployment, new_link);
});

_commander2.default.command('register').description('register to serph.network').action(function () {
	cmdValue = 'register';

	(0, _register2.default)();
});

_commander2.default.command('login').description('login with serph account').action(function () {
	cmdValue = 'login';

	(0, _login2.default)();
});

_commander2.default.command('logout').description('logout evius account in this system').action(function () {
	cmdValue = 'login';
	const authFile = _path2.default.join(homedir, '.serph', 'auth.json');
	if ((0, _fs.existsSync)(authFile)) {
		const auth = JSON.parse((0, _fs.readFileSync)(authFile));
		_atmaClient2.default.logout(auth.token);
		(0, _fs.unlinkSync)(authFile);
		console.log('Successfully logged out');
		process.exit(0);
	} else {
		console.log('Not logged in');
		process.exit(0);
	}
});

_commander2.default.parse(process.argv);

if (typeof cmdValue === 'undefined') {
	_commander2.default.help();
	process.exit(1);
}
//# sourceMappingURL=index.js.map