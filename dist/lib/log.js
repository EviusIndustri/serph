'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const bold = message => _chalk2.default.bold(`${message}`);
const url = url => _chalk2.default.blue.bold(`${url}`);
const success = message => _chalk2.default.green(message);
const error = message => _chalk2.default.red(`${message}`);
const lightError = message => _chalk2.default.redBright(message);

exports.default = {
	bold,
	url,
	success,
	error,
	lightError
};
//# sourceMappingURL=log.js.map