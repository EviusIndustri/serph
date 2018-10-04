import path from 'path'
import { existsSync, readFileSync, statSync, createReadStream } from 'fs'

import tar from 'tar-fs'
import zlib from 'zlib'
import _cliProgress from 'cli-progress'
import toStream from 'buffer-to-stream'
import request from 'request'
import recursive from 'recursive-readdir'

import utils from './utils'
import log from './log'

import {importer} from 'ipfs-unixfs-engine'
import IPLD from 'ipld'
import pull from 'pull-stream'
import CID from 'cids'
import toPull from 'stream-to-pull-stream'

const stripPath = (index, targetPath) => {
	const PATH_SPLIT = targetPath.split(path.sep)
	return `${PATH_SPLIT.slice(index - 1).join(path.sep)}`
}

const fullPath = (APP_DIR, targetPath) => {
	const baseSplit = APP_DIR.split('/')
	const baseFinal = baseSplit.slice(0, baseSplit.length - 1).join('/')
	return path.join(baseFinal, targetPath)
}

const hashGeneration = (files) => {
	const APP_DIR = process.cwd()
	const APP_DIR_SPLIT = APP_DIR.split(path.sep)
	const APP_INDEX = APP_DIR_SPLIT.length
	return new Promise((resolve, reject) => {
		IPLD.inMemory((err, ipld) => {
			pull(
				pull.values(files),
				pull.map((file) => ({
					path: stripPath(APP_INDEX, file),
					content: toPull.source(createReadStream(file))
				})),
				importer(ipld, {
					onlyHash: true
				}),
				pull.map((node) => ({
					path: stripPath(2, node.path),
					hash: new CID(0, 'dag-pb', node.multihash).toBaseEncodedString(),
					isDir: statSync(fullPath(APP_DIR, node.path)).isDirectory()
				})),
				pull.filter((node) => ( !node.isDir )),
				pull.map((node) => ({
					path: node.path,
					hash: node.hash,
					address: {
						[`/${node.path}`]: node.hash
					}
				})),
				pull.collect((err, files) => {
					if(err) return reject(err)
					resolve(files)
				})
			)
		})
	})
}

const pre = async (user, config) => {
	return new Promise(async (resolve) => {
		let [accessToken, _err] = await utils.auth.requestAccessToken(user.token)

		if(_err) return utils.logger.error(_err)

		const APP_DIR = process.cwd()

		console.log('> preparing your files...')

		const ignores = (config && config.ignores) ? config.ignores : ['']
	
		recursive(APP_DIR, ignores, async (err, files) => {
			console.log(`> generating hash address for ${log.bold(files.length)} files...`)
			const final = await hashGeneration(files)

			request.post({
				url: 'http://localhost:7000/api/deployments/prepare',
				form: {
					filesAddress: JSON.stringify(final)
				},
				headers: {
					authorization: `bearer ${accessToken}`
				}
			}, (err, httpResponse, body) => {
				if(err) {
					console.log(err)
					return process.exit(1)
				}
				try {
					const parseBody = JSON.parse(body)

					const filesToUploadPath = parseBody.data.filesToUpload.map((f) => (f.path))

					if(filesToUploadPath.length > 0) {
						resolve({
							deploymentPath: parseBody.data.deploymentPath, 
							filesToUpload: filesToUploadPath
						})
					}
					else{
						console.log(`> no new files to be deployed`)
						process.exit(0)
					}
				} catch (err) {
					console.log(err)
					process.exit(1)
				}
			})
		})
	})
}

const main = async (user, config, deploymentPath, filesToUpload) => {
	return new Promise(async (resolve) => {
		const APP_DIR = process.cwd()

		if(existsSync(path.join(APP_DIR, 'index.html'))) {
			console.log(`> packing ${log.bold(filesToUpload.length)} files...`)

			let [accessToken, _err] = await utils.auth.requestAccessToken(user.token)
			if(_err) return console.error(_err)

			let buff = []

			const tarStream = tar.pack(APP_DIR, {
				entries: filesToUpload
			}).pipe(zlib.Gzip())

			let totalData = 0
			tarStream.on('data', (data) => {
				totalData += data.length
				buff.push(data)
			})
			tarStream.on('end', () => {
				console.log(`> deploying to ${log.bold('serph.network')} [${utils.formatBytes(totalData)}]`)
				const progressBar = new _cliProgress.Bar({
					format: '  > upload [{bar}] {percentage}% | ETA: {eta}s'
				})
				progressBar.start(100, 0)
				let progress = 0
				const readable = toStream(Buffer.concat(buff))
				
				readable.on('error', (err) => {
					throw err
				})
				readable.on('data', (data) => {
					progress += data.length
					progressBar.update(progress*100/totalData)
				})
				readable.on('end', () => {
					progressBar.stop()
					console.log(`> building your deployment...`)
					if(filesToUpload.length > 1000) {
						console.log(`> processing huge amount of files [${filesToUpload.length}]. probably `)
					}
				})

				const r = request.post({
					url: 'http://localhost:7000/api/deployments/upload-cli',
					headers: {
						'authorization': `bearer ${accessToken}`,
						'x-serph-deployment': deploymentPath
					},
					timeout: 1000 * 60 * 10
				}, async (err, httpResponse, body) => {
					if(err) {
						console.log(err)
						return process.exit(1)
					}
					const parseBody = JSON.parse(body)

					if(parseBody.status === 'error') {
						console.log(log.error('> Something went wrong. Please come back later.'))
						return process.exit(1)
					}
					resolve()
				})

				readable.pipe(r)
			})
		}
		else{
			console.error(`${log.error('index.html')} not found`)
			process.exit(1)
		}
	})	
}

const post = async (user, config, deploymentPath) => {
	if(config && config.link) {
		console.log(`> link was found on ${log.bold(`serph.json`)}`)
		console.log(`> linking ${log.bold(config.link)} to new deployment (${log.bold(deploymentPath)})`)
		
		let [accessToken, _err] = await utils.auth.requestAccessToken(user.token)
		if(_err) return console.error(_err)

		request.post({
			url: 'http://localhost:7000/api/links',
			form: {
				link: config.link,
				target: deploymentPath
			},
			headers: {
				authorization: `bearer ${accessToken}`
			}
		}, (err, httpResponse, body) => {
			if(err) {
				console.log(err)
				return process.exit(1)
			}

			const data = JSON.parse(body).data

			console.log(`> online at ${log.url(`https://${data.link}.serph.network`)}`)
			return process.exit(0)

		})
	}
	else{
		console.log(`> online at ${log.url(`https://${deploymentPath}.serph.network`)}`)
		return process.exit(0)		
	}
}

const core = async (user, config) => {
	const preResult = await pre(user, config)
	if(preResult) {
		await main(user, config, preResult.deploymentPath, preResult.filesToUpload)	
		await post(user, config, preResult.deploymentPath)
	}
}

const deploy = async () => {
	const APP_DIR = process.cwd()

	if(!existsSync(path.join(APP_DIR, 'index.html'))) {
		console.error(`> ${log.error('index.html not found')}`)
		process.exit(1)
	}

	console.log('> authenticating...')

	const user = utils.auth.isLoggedIn()
	if(user) {
		if(existsSync(path.join(APP_DIR, 'serph.json'))) {
			const config = readFileSync(path.join(APP_DIR, 'serph.json'))
			try {
				const parseConfig = JSON.parse(config)
				core(user, parseConfig)
			}
			catch(err) {
				console.log(err)
				process.exit(1)
			}
		}
		else{
			core(user)
		}
	}
	else{
		console.log(`> please login using ${log.bold(`serph login`)}`)
		process.exit(0)
	}
}

export default deploy