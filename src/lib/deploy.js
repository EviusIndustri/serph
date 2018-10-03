import path from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync, unlinkSync } from 'fs'

import tar from 'tar-fs'
import zlib from 'zlib'
import _cliProgress from 'cli-progress'
import toStream from 'buffer-to-stream'
import request from 'request'

import atma from '@evius/atma-client'

import log from './log'

const formatBytes = (a, b) => {
	if(0==a) return'0 Bytes'
	var c=1024,d=b||2,e=['Bytes','KB','MB','GB','TB','PB','EB','ZB','YB'],f=Math.floor(Math.log(a)/Math.log(c))
	return parseFloat((a/Math.pow(c,f)).toFixed(d))+' '+e[f]
}

const main = async (deploymentPath, filesToUpload) => {
	const APP_DIR = process.cwd()
	const HOME_DIR = homedir()

	if(existsSync(path.join(APP_DIR, 'index.html'))) {
		console.log(`ᑀ authenticating...`)
		const authFile = path.join(HOME_DIR, '.serph', 'auth.json')
		if(existsSync(authFile)) {
			const auth = JSON.parse(readFileSync(authFile))
			if(auth.token) {
				try {
					const response = await atma.requestAccessToken('serph', auth.token)
					const accessToken = response.data.data

					console.log(`ᑀ preparing files...`)

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
						console.log(`ᑀ deploying to ${log.bold('serph.network')} [${formatBytes(totalData)}]`)
						const progressBar = new _cliProgress.Bar({
							format: '  ᑀ upload [{bar}] {percentage}% | ETA: {eta}s'
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
						})

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
							const data = parseBody.data
							if(parseBody.status === 'error') {
								console.log(log.error('ᑀ Something went wrong. Please come back later.'))
								return process.exit(1)
							}
							if(existsSync(path.join(APP_DIR, 'serph.json'))) {
								const config = readFileSync(path.join(APP_DIR, 'serph.json'))
								try {
									const parseConfig = JSON.parse(config)
									if(parseConfig.link) {
										console.log(`ᑀ link was found on ${log.bold(`serph.json`)}`)
										console.log(`ᑀ linking ${log.bold(parseConfig.link)} to new deployment (${log.bold(data.name)})`)
										const response = await atma.requestAccessToken('serph', auth.token)
										const accessToken = response.data.data
										request.post({
											url: 'http://localhost:7000/api/links',
											form: {
												link: parseConfig.link,
												target: data.name
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

											console.log(`ᑀ online at ${log.url(`https://${data.link}.serph.network`)}`)
											return process.exit(0)

										})
									}
									else{
										console.log(`ᑀ online at ${log.url(`https://${data.name}.serph.network`)}`)
										return process.exit(0)		
									}
								} catch (err) {
									console.log(err)
									process.exit(1)
								}
							}
							else{
								console.log(`ᑀ online at ${log.url(`https://${data.name}.serph.network`)}`)
								return process.exit(0)
							}
						})

						readable.pipe(r)
					})
				} catch (err) {
					if(err.response.data) {
						console.log('please login')
						unlinkSync(authFile)
					}
					process.exit(1)
				}
			}
			else{
				console.log('please login using serph login')
				process.exit(0)
			}
		}
		else{
			console.log('please login using serph login')
			process.exit(0)
		}
	}
	else{
		console.error(`${log.error('index.html')} not found`)
		process.exit(1)
	}
}

export default main