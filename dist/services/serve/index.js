'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const router = _express2.default.Router();

exports.default = (sitePath, opts) => {

	router.get('*', async (req, res) => {
		const targetPath = req.originalUrl.split('?')[0];
		try {
			const target = _path2.default.join(sitePath, targetPath);
			const stat = await _fs2.default.statSync(target);
			if (stat.isFile()) {
				return res.sendFile(target);
			} else {
				if (targetPath === '/') {
					return res.sendFile(_path2.default.join(sitePath, `index.html`));
				}
				return res.sendFile(_path2.default.join(sitePath, `${targetPath}.html`));
			}
		} catch (err) {
			if (opts.spa == true) {
				return res.sendFile(_path2.default.join(sitePath, `index.html`));
			}
			if (err.errno == -2) {
				return res.sendFile(_path2.default.join(__dirname, '..', '..', 'views', 'default-404.html'));
			}
			return res.send(err);
		}
	});

	return router;
};
//# sourceMappingURL=index.js.map