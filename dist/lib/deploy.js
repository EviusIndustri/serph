'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _tarFs = require('tar-fs');

var _tarFs2 = _interopRequireDefault(_tarFs);

var _zlib = require('zlib');

var _zlib2 = _interopRequireDefault(_zlib);

var _cliProgress2 = require('cli-progress');

var _cliProgress3 = _interopRequireDefault(_cliProgress2);

var _bufferToStream = require('buffer-to-stream');

var _bufferToStream2 = _interopRequireDefault(_bufferToStream);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _recursiveReaddir = require('recursive-readdir');

var _recursiveReaddir2 = _interopRequireDefault(_recursiveReaddir);

var _utils = require('./utils');

var _utils2 = _interopRequireDefault(_utils);

var _log = require('./log');

var _log2 = _interopRequireDefault(_log);

var _ipfsUnixfsEngine = require('ipfs-unixfs-engine');

var _ipld = require('ipld');

var _ipld2 = _interopRequireDefault(_ipld);

var _pullStream = require('pull-stream');

var _pullStream2 = _interopRequireDefault(_pullStream);

var _cids = require('cids');

var _cids2 = _interopRequireDefault(_cids);

var _streamToPullStream = require('stream-to-pull-stream');

var _streamToPullStream2 = _interopRequireDefault(_streamToPullStream);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// const BASE_URL = 'http://localhost:7000'
const BASE_URL = 'http://serph.network';

const stripPath = (index, targetPath) => {
	const PATH_SPLIT = targetPath.split(_path2.default.sep);
	return `${PATH_SPLIT.slice(index - 1).join(_path2.default.sep)}`;
};

const fullPath = (APP_DIR, targetPath) => {
	const baseSplit = APP_DIR.split('/');
	const baseFinal = baseSplit.slice(0, baseSplit.length - 1).join('/');
	return _path2.default.join(baseFinal, targetPath);
};

const hashGeneration = files => {
	const APP_DIR = process.cwd();
	const APP_DIR_SPLIT = APP_DIR.split(_path2.default.sep);
	const APP_INDEX = APP_DIR_SPLIT.length;
	const OWNER_PATH = stripPath(APP_INDEX, `${APP_DIR}/owner`);

	const inputFiles = files.map(file => ({
		path: stripPath(APP_INDEX, file),
		content: _streamToPullStream2.default.source((0, _fs.createReadStream)(file))
	}));

	return new Promise((resolve, reject) => {
		_ipld2.default.inMemory((err, ipld) => {
			(0, _pullStream2.default)(_pullStream2.default.values(inputFiles), (0, _ipfsUnixfsEngine.importer)(ipld, {
				onlyHash: true
			}), _pullStream2.default.map(node => ({
				path: stripPath(2, node.path),
				hash: new _cids2.default(0, 'dag-pb', node.multihash).toBaseEncodedString(),
				isDir: node.path === OWNER_PATH ? false : (0, _fs.statSync)(fullPath(APP_DIR, node.path)).isDirectory()
			})),
			// pull.filter((node) => ( !node.isDir )),
			_pullStream2.default.map(node => ({
				path: node.path,
				hash: node.hash,
				isDir: node.isDir,
				address: {
					[`/${node.path}`]: node.hash
				}
			})), _pullStream2.default.collect((err, files) => {
				if (err) return reject(err);
				// console.log(files)
				files.pop();
				resolve(files);
			}));
		});
	});
};

const pre = async (user, config) => {
	return new Promise(async resolve => {
		let [accessToken, _err] = await _utils2.default.auth.requestAccessToken(user.token);

		if (_err) return _utils2.default.logger.error(_err);

		const APP_DIR = process.cwd();

		console.log('> preparing your files...');

		const ignores = config && config.ignores ? config.ignores : [''];

		(0, _recursiveReaddir2.default)(APP_DIR, ignores, async (err, files) => {
			console.log(`> generating hash address for ${_log2.default.bold(files.length)} files...`);
			const final = await hashGeneration(files);

			_request2.default.post({
				url: `${BASE_URL}/api/deployments/prepare`,
				form: {
					filesAddress: JSON.stringify(final)
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

					if (parseBody.data.filesToUpload.length > 0) {
						resolve({
							deploymentPath: parseBody.data.deploymentPath,
							filesToUpload: parseBody.data.filesToUpload
						});
					} else {
						console.log(`> no new files to be deployed`);
						if (parseBody.data.similarName) {
							console.log(`> similar deployment found at ${_log2.default.url(`https://${parseBody.data.similarName}.serph.network`)}`);
							console.log(`  > Hash: ${_log2.default.bold(parseBody.data.similarHash)}`);
						}
						_utils2.default.prompt.question('> continue deployment? [yes/no] ', async answer => {
							answer = answer.toLowerCase();
							if (answer === 'y' || answer === 'yes') {
								resolve({
									deploymentPath: parseBody.data.deploymentPath,
									filesToUpload: parseBody.data.filesToUpload
								});
							} else {
								process.exit(0);
							}
						});
					}
				} catch (err) {
					console.log(err);
					process.exit(1);
				}
			});
		});
	});
};

const main = async (user, config, deploymentPath, filesToUpload) => {
	return new Promise(async resolve => {
		const APP_DIR = process.cwd();

		if ((0, _fs.existsSync)(_path2.default.join(APP_DIR, 'index.html'))) {
			console.log(`> packing ${_log2.default.bold(filesToUpload.length)} files...`);
			const filesToPack = filesToUpload.filter(f => f !== 'owner');

			let [accessToken, _err] = await _utils2.default.auth.requestAccessToken(user.token);
			if (_err) return console.error(_err);

			let buff = [];

			const tarStream = _tarFs2.default.pack(APP_DIR, {
				entries: filesToPack
			}).pipe(_zlib2.default.Gzip());

			let totalData = 0;
			tarStream.on('data', data => {
				totalData += data.length;
				buff.push(data);
			});
			tarStream.on('end', () => {
				console.log(`> deploying to ${_log2.default.bold('serph.network')} [${_utils2.default.formatBytes(totalData)}]`);
				const progressBar = new _cliProgress3.default.Bar({
					format: '  > upload [{bar}] {percentage}% | ETA: {eta}s'
				});
				progressBar.start(100, 0);
				let progress = 0;
				const readable = (0, _bufferToStream2.default)(Buffer.concat(buff));

				readable.on('error', err => {
					throw err;
				});
				readable.on('data', data => {
					progress += data.length;
					progressBar.update(progress * 100 / totalData);
				});
				readable.on('end', () => {
					progressBar.stop();
					console.log(`> building your deployment...`);
					// if(filesToPack.length > 1000) {
					// 	console.log(`> processing huge amount of files [${filesToPack.length}]. probably `)
					// }
				});

				const r = _request2.default.post({
					url: `${BASE_URL}/api/deployments/upload-cli`,
					headers: {
						'authorization': `bearer ${accessToken}`,
						'x-serph-deployment': deploymentPath
					},
					timeout: 1000 * 60 * 10
				}, async (err, httpResponse, body) => {
					if (err) {
						console.log(err);
						return process.exit(1);
					}
					const parseBody = JSON.parse(body);

					if (parseBody.status === 'error') {
						console.log(_log2.default.error('> Something went wrong. Please come back later.'));
						console.log(parseBody);
						return process.exit(1);
					}
					resolve();
				});

				readable.pipe(r);
			});
		} else {
			console.error(`${_log2.default.error('index.html')} not found`);
			process.exit(1);
		}
	});
};

const post = async (user, config, deploymentPath) => {
	if (config && config.link) {
		console.log(`> link was found on ${_log2.default.bold(`serph.json`)}`);
		console.log(`> linking ${_log2.default.bold(config.link)} to new deployment (${_log2.default.bold(deploymentPath)})`);

		let [accessToken, _err] = await _utils2.default.auth.requestAccessToken(user.token);
		if (_err) return console.error(_err);

		_request2.default.post({
			url: `${BASE_URL}/api/links`,
			form: {
				link: config.link,
				target: deploymentPath
			},
			headers: {
				authorization: `bearer ${accessToken}`
			}
		}, (err, httpResponse, body) => {
			if (err) {
				console.log(err);
				return process.exit(1);
			}

			const data = JSON.parse(body).data;

			console.log(`> online at ${_log2.default.url(`https://${data.link}.serph.network`)}`);
			return process.exit(0);
		});
	} else {
		console.log(`> online at ${_log2.default.url(`https://${deploymentPath}.serph.network`)}`);
		return process.exit(0);
	}
};

const core = async (user, config) => {
	const preResult = await pre(user, config);
	if (preResult) {
		await main(user, config, preResult.deploymentPath, preResult.filesToUpload);
		await post(user, config, preResult.deploymentPath);
	}
};

const deploy = async () => {
	const APP_DIR = process.cwd();

	if (!(0, _fs.existsSync)(_path2.default.join(APP_DIR, 'index.html'))) {
		console.error(`> ${_log2.default.error('index.html not found')}`);
		process.exit(1);
	}

	console.log('> authenticating...');

	const user = _utils2.default.auth.isLoggedIn();
	if (user) {
		if ((0, _fs.existsSync)(_path2.default.join(APP_DIR, 'serph.json'))) {
			const config = (0, _fs.readFileSync)(_path2.default.join(APP_DIR, 'serph.json'));
			try {
				const parseConfig = JSON.parse(config);
				core(user, parseConfig);
			} catch (err) {
				console.log(err);
				process.exit(1);
			}
		} else {
			core(user);
		}
	} else {
		console.log(`> please login using ${_log2.default.bold(`serph login`)}`);
		process.exit(0);
	}
};

exports.default = deploy;
//# sourceMappingURL=deploy.js.map