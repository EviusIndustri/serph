'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _utils = require('./utils');

var _utils2 = _interopRequireDefault(_utils);

var _log = require('./log');

var _log2 = _interopRequireDefault(_log);

var _config = require('./config');

var _config2 = _interopRequireDefault(_config);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const core = async (user, deployment, new_link) => {
	let [accessToken, _err] = await _utils2.default.auth.requestAccessToken(user.token);
	if (_err) return _utils2.default.logger.error(_err);

	console.log(`ᑀ authenticating...`);
	_request2.default.post({
		url: `${_config2.default.BASE_URL}/api/links`,
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
			} else if (parseBody.status === 'invalid_parameter') {
				console.log(`${_log2.default.error(`ᑀ ${parseBody.message}`)}`);
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
};

const link = async (deployment, new_link) => {
	const user = _utils2.default.auth.isLoggedIn();
	if (user) {
		core(user, deployment, new_link);
	} else {
		console.log(`> please login using ${_log2.default.bold(`serph login`)}`);
		process.exit(0);
	}
};

exports.default = link;
//# sourceMappingURL=link.js.map