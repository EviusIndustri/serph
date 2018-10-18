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
import config from './config'

import {importer} from 'ipfs-unixfs-engine'
import IPLD from 'ipld'
import pull from 'pull-stream'
import CID from 'cids'
import toPull from 'stream-to-pull-stream'

const stripPath = (index, targetPath) => {
	const PATH_SPLIT = targetPath.split(path.sep)
	return PATH_SPLIT.slice(index - 1).join(path.sep).replace(/\\/g, '/') + '/'
}

const fullPath = (APP_DIR, targetPath) => {
	const baseSplit = APP_DIR.split(path.sep)
	const baseFinal = baseSplit.slice(0, baseSplit.length - 1).join(path.sep)
	return path.join(baseFinal, targetPath)
}

const hashGeneration = (files) => {
	const APP_DIR = process.cwd()
	const APP_DIR_SPLIT = APP_DIR.split(path.sep)
	const APP_INDEX = APP_DIR_SPLIT.length
	const OWNER_PATH = stripPath(APP_INDEX, `${APP_DIR}${path.sep}owner`)

	const inputFiles = files.map((file) => ({
		path: stripPath(APP_INDEX, file),
		content: toPull.source(createReadStream(file))
	}))

	return new Promise((resolve, reject) => {
		IPLD.inMemory((err, ipld) => {
			pull(
				pull.values(inputFiles),
				importer(ipld, {	
					onlyHash: true,
					wrap: true
				}),
				pull.map((node) => ({
					path: stripPath(2, node.path),
					size: node.size,
					hash: new CID(0, 'dag-pb', node.multihash).toBaseEncodedString(),
					isDir: node.path === OWNER_PATH ? false : statSync(fullPath(APP_DIR, node.path)).isDirectory()
				})),
				pull.map((node) => ({
					path: node.path,
					size: node.size,
					hash: node.hash,
					isDir: node.isDir,
					address: {
						[`/${node.path}`]: node.hash
					}
				})),
				pull.collect((err, files) => {
					if(err) return reject(err)
					files.pop()
					resolve(files)
				})
			)
		})
	})
}

const pre = async (user, siteConfig) => {
	return new Promise(async (resolve) => {
		let [accessToken, _err] = await utils.auth.requestAccessToken(user.token)
		if(_err) return utils.logger.error(_err)

		const APP_DIR = process.cwd()

		console.log('> preparing your files...')

		const ignores = (siteConfig && siteConfig.ignores) ? siteConfig.ignores : ['']
	
		recursive(APP_DIR, ignores, async (err, files) => {
			console.log(`> generating hash address for ${log.bold(files.length)} files...`)
			const final = await hashGeneration(files)

			request.post({
				url: `${config.BASE_URL}/api/deployments/prepare`,
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
					console.log(body)
					const parseBody = JSON.parse(body)

					if(parseBody.data.filesToUpload.length > 0) {
						resolve({
							deploymentPath: parseBody.data.deploymentPath,
							filesToUpload: parseBody.data.filesToUpload
						})
					}
					else{
						console.log(`> no new files to be deployed`)
						if(parseBody.data.similarName) {
							console.log(`> similar deployment found at ${log.url(`https://${parseBody.data.similarName}.serph.network`)}`)
							console.log(`  > Hash: ${log.bold(parseBody.data.similarHash)}`)
						}
						utils.prompt.question('> continue deployment? [yes/no] ', async (answer) => {
							answer = answer.toLowerCase()
							if(answer === 'y' || answer === 'yes') {
								resolve({
									deploymentPath: parseBody.data.deploymentPath,
									filesToUpload: parseBody.data.filesToUpload
								})
							}
							else{
								process.exit(0)
							}
						})
					}
				} catch (err) {
					console.log(err)
					process.exit(1)
				}
			})
		})
	})
}

const main = async (user, siteConfig, deploymentPath, filesToUpload) => {
	return new Promise(async (resolve) => {
		const APP_DIR = process.cwd()

		if(existsSync(path.join(APP_DIR, 'index.html'))) {
			console.log(`> packing ${log.bold(filesToUpload.length)} files...`)
			const filesToPack = filesToUpload.filter((f) => ( f !== 'owner' ))

			let [accessToken, _err] = await utils.auth.requestAccessToken(user.token)
			if(_err) return console.error(_err)

			let buff = []

			const tarStream = tar.pack(APP_DIR, {
				entries: filesToPack
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
					// if(filesToPack.length > 1000) {
					// 	console.log(`> processing huge amount of files [${filesToPack.length}]. probably `)
					// }
				})

				const r = request.post({
					url: `${config.BASE_URL}/api/deployments/upload-cli`,
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
						console.log(parseBody)
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

const post = async (user, siteConfig, deploymentPath) => {
	if(siteConfig && siteConfig.link) {
		console.log(`> link was found on ${log.bold(`serph.json`)}`)
		console.log(`> linking ${log.bold(siteConfig.link)} to new deployment (${log.bold(deploymentPath)})`)
		
		let [accessToken, _err] = await utils.auth.requestAccessToken(user.token)
		if(_err) return console.error(_err)

		request.post({
			url: `${config.BASE_URL}/api/links`,
			form: {
				link: siteConfig.link,
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

const core = async (user, siteConfig) => {
	const preResult = await pre(user, siteConfig)
	if(preResult) {
		await main(user, siteConfig, preResult.deploymentPath, preResult.filesToUpload)	
		await post(user, siteConfig, preResult.deploymentPath)
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
			const siteConfig = readFileSync(path.join(APP_DIR, 'serph.json'))
			try {
				const parseSiteConfig = JSON.parse(siteConfig)
				core(user, parseSiteConfig)
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