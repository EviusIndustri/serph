'use strict';

var _log = require('../log');

var _log2 = _interopRequireDefault(_log);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const error = err => {
	console.log(`> ${_log2.default.error(err)}`);
	process.exit(1);
};

module.exports = {
	error
};
//# sourceMappingURL=logger.js.map