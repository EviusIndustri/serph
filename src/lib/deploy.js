import path from 'path'
import { existsSync, readFileSync, statSync } from 'fs'

import tar from 'tar-fs'
import zlib from 'zlib'
import _cliProgress from 'cli-progress'
import toStream from 'buffer-to-stream'
import request from 'request'
import dagPB from 'ipld-dag-pb'
import UnixFS from 'ipfs-unixfs'
import recursive from 'recursive-readdir'

import utils from './utils'
import log from './log'

const pre = async (user) => {
	return new Promise(async (resolve) => {
		let [accessToken, _err] = await utils.auth.requestAccessToken(user.token)

		if(_err) return utils.logger.error(_err)

		const APP_DIR = process.cwd()
		const APP_DIR_SPLIT = APP_DIR.split(path.sep)
		const APP_INDEX = APP_DIR_SPLIT.length

		console.log('> preparing your files...')

		recursive(APP_DIR, ['.*'], async (err, files) => {
			const filesStats = files.map((f) => ({
				path: f,
				isDir: statSync(f).isDirectory()
			}))
			const filesFilter = filesStats.filter((f) => !f.isDir)
			const final = await Promise.all(filesFilter.map((f) => {
				return new Promise((resolve, reject) => {
					const buff = readFileSync(f.path)
					const file = new UnixFS('file', buff)
					dagPB.DAGNode.create(file.marshal(), (err, node) => {
						if(err) return reject(err)
						resolve({
							path: f.path,
							hash: node._cid.toBaseEncodedString()
						})
					})
				})
			}))

			const finalTransform = final.map((f) => {
				const PATH_SPLIT = f.path.split(path.sep)
				const finalPath = `${PATH_SPLIT.slice(APP_INDEX).join(path.sep)}`
				return {
					path: finalPath,
					hash: f.hash,
					address: {
						[`/${finalPath}`]: f.hash
					}
				}
			})

			request.post({
				url: 'http://localhost:7000/api/files/prepare',
				form: {
					filesAddress: JSON.stringify(finalTransform)
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

const main = async (user, deploymentPath, filesToUpload) => {
	return new Promise((resolve) => {
		const APP_DIR = process.cwd()

		if(existsSync(path.join(APP_DIR, 'index.html'))) {
			console.log(`> packing ${log.bold(filesToUpload.length)} files...`)

			let buff = []

			const tarStream = tar.pack(APP_DIR, {
				entries: filesToUpload
			}).pipe(zlib.Gzip())

			let totalData = 0
			tarStream.on('data', (data) => {
				totalData += data.length
				buff.push(data)
			})
			tarStream.on('end', async () => {
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
				})

				let [accessToken, _err] = await utils.auth.requestAccessToken(user.token)
				if(_err) return console.error(_err)

				const r = request.post({
					url: 'http://localhost:7000/api/files/upload-cli',
					headers: {
						'authorization': `bearer ${accessToken}`,
						'x-serph-deployment': deploymentPath
					}
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

const post = async (user, deploymentPath) => {
	const APP_DIR = process.cwd()
	if(existsSync(path.join(APP_DIR, 'serph.json'))) {
		const config = readFileSync(path.join(APP_DIR, 'serph.json'))
		try {
			const parseConfig = JSON.parse(config)
			if(parseConfig.link) {
				console.log(`> link was found on ${log.bold(`serph.json`)}`)
				console.log(`> linking ${log.bold(parseConfig.link)} to new deployment (${log.bold(deploymentPath)})`)
				
				let [accessToken, _err] = await utils.auth.requestAccessToken(user.token)
				if(_err) return console.error(_err)

				request.post({
					url: 'http://localhost:7000/api/links',
					form: {
						link: parseConfig.link,
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
		} catch (err) {
			console.log(err)
			process.exit(1)
		}
	}
	else{
		console.log(`> online at ${log.url(`https://${deploymentPath}.serph.network`)}`)
		return process.exit(0)
	}
}

const deploy = async () => {
	console.log('> authenticating...')

	const user = utils.auth.isLoggedIn()
	if(user) {
		const preResult = await pre(user)
		if(preResult) {
			await main(user, preResult.deploymentPath, preResult.filesToUpload)	
			await post(user, preResult.deploymentPath)
		}
	}
	else{
		console.log(`> please login using ${log.bold(`serph login`)}`)
		process.exit(0)
	}
}

export default deploy