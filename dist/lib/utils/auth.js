'use strict';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _os = require('os');

var _fs = require('fs');

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

var _atmaClient = require('@evius/atma-client');

var _atmaClient2 = _interopRequireDefault(_atmaClient);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const HOME_DIR = (0, _os.homedir)();

const isLoggedIn = () => {
	const authFile = _path2.default.join(HOME_DIR, '.serph', 'auth.json');
	if ((0, _fs.existsSync)(authFile)) {
		try {
			const auth = JSON.parse((0, _fs.readFileSync)(authFile));
			if (auth.token) {
				return auth;
			}
		} catch (err) {
			(0, _fs.unlinkSync)(authFile);
			return false;
		}
	}
};

const requestAccessToken = async refreshToken => {
	try {
		const response = await _atmaClient2.default.requestAccessToken('serph', refreshToken);
		return [response.data.data, null];
	} catch (err) {
		return [null, err];
	}
};

const login = email => {
	return new Promise(async (resolve, reject) => {
		try {
			const response = await _atmaClient2.default.login(email);
			_atmaClient2.default.confirmPooling(email, response.data.data.codename).then(response => {
				Object.assign(response.data.data, { email: email });
				(0, _fs.writeFileSync)(_path2.default.join(HOME_DIR, '.serph', 'auth.json'), JSON.stringify(response.data.data));
				resolve([true, null]);
			});
			console.log(`> we just sent you verification email with access code: ${_log2.default.bold(response.data.data.codename)}`);
		} catch (err) {
			const _err = err.response.data;
			if (_err.status === 'not_registered') {
				reject([null, _err.message]);
			} else {
				reject([null, _err.message]);
			}
		}
	});
};

module.exports = {
	isLoggedIn,
	requestAccessToken,
	login
};
//# sourceMappingURL=auth.js.map