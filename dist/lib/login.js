'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _utils = require('./utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const main = async () => {
	const user = _utils2.default.auth.isLoggedIn();

	if (user) {
		console.log(`> logged in as ${user.email}`);
		process.exit(0);
	} else {
		_utils2.default.prompt.question('> email: ', async answer => {
			console.log('> logging in...');
			try {
				await _utils2.default.auth.login(answer);
				console.log(`> successfully logged in!`);
				process.exit(0);
			} catch (err) {
				return _utils2.default.logger.error(err);
			}
		});
	}
};

exports.default = main;
//# sourceMappingURL=login.js.map