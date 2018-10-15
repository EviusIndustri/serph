#!/usr/bin/env node
'use strict';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _morgan = require('morgan');

var _morgan2 = _interopRequireDefault(_morgan);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const homedir = _os2.default.homedir();
if (!(0, _fs.existsSync)(_path2.default.join(homedir, '.serph'))) {
	(0, _fs.mkdirSync)(_path2.default.join(homedir, '.serph'));
}

_atmaClient2.default.init({
	// server: 'http://localhost:6969'
	server: 'http://atma.serph.network'
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

	const authFile = _path2.default.join(homedir, '.serph', 'auth.json');
	if ((0, _fs.existsSync)(authFile)) {
		const auth = JSON.parse((0, _fs.readFileSync)(authFile));
		if (auth.token) {
			try {
				const response = await _atmaClient2.default.requestAccessToken('serph', auth.token);
				const accessToken = response.data.data;
				console.log(`ᑀ authenticating...`);
				_request2.default.post({
					url: 'http://localhost:7000/api/links',
					form: {
						link: new_link,
						target: deployment
					},
					headers: {
						authorization: `bearer ${accessToken}`
					}
				}, (err, httpResponse, body) => {
					if (err) {
						console.log(err);
						return process.exit(1);
					}
					try {
						const parseBody = JSON.parse(body);

						if (parseBody.status === 'error') {
							console.log(`${_log2.default.error(`ᑀ deployment ${deployment} is not found!`)}`);
							return process.exit(1);
						} else if (parseBody.status === 'already_used') {
							console.log(`${_log2.default.error(`ᑀ link ${new_link} is already used!`)}`);
							return process.exit(1);
						}

						console.log(`ᑀ ${_log2.default.bold(new_link)} is now linking to deployment (${_log2.default.bold(deployment)})`);
						const data = parseBody.data;
						console.log(`ᑀ online at ${_log2.default.url(`https://${data.link}.serph.network`)}`);
						return process.exit(0);
					} catch (err) {
						console.log(err);
						process.exit(1);
					}
				});
			} catch (err) {
				console.error(err.response);
				if (err.response.data) {
					console.log('please login');
					(0, _fs.unlinkSync)(authFile);
				}
				process.exit(1);
			}
		} else {
			console.log('please login using serph login');
			process.exit(0);
		}
	} else {
		console.log('please login using serph login');
		process.exit(0);
	}
});

_commander2.default.command('login').description('login with evius account').action(function () {
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