#!/usr/bin/env node

import zlib from 'zlib'
import path from 'path'
import {existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync} from 'fs'

import express from 'express'
import morgan from 'morgan'
import request from 'request'
import tar from 'tar-fs'

import toStream from 'buffer-to-stream'
import _cliProgress from 'cli-progress'
import os from 'os'
import readline from 'readline'
import program from 'commander'

import log from './lib/log'
import sera from '@evius/sera'
import atma from '@evius/atma-client'

const homedir = os.homedir()
if(!existsSync(path.join(homedir, '.serph'))) {
	mkdirSync(path.join(homedir, '.serph'))
}

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
})

atma.init({
	server: 'http://localhost:6969'
})

const formatBytes = (a, b) => {
	if(0==a) return'0 Bytes'
	var c=1024,d=b||2,e=['Bytes','KB','MB','GB','TB','PB','EB','ZB','YB'],f=Math.floor(Math.log(a)/Math.log(c))
	return parseFloat((a/Math.pow(c,f)).toFixed(d))+' '+e[f]
}

const successOrError = (statusCode) => {
	if(statusCode >= 400) {
		return log.error(statusCode)
	}
	return log.success(statusCode)
}

const responseTime = (time) => {
	if(time < 3000) {
		return log.bold(`${time} ms`)
	}
	if(time < 5000) {
		return log.lightError(`${time} ms`)
	}
	return log.lightError(`${time} ms`)
}

const morganMiddleware = morgan(function (tokens, req, res) {
	return [
		log.bold(`--> ${tokens.method(req, res)}`),
		successOrError(tokens.status(req, res)),
		log.url(tokens.url(req, res)),
		responseTime(tokens['response-time'](req, res)),
		log.bold('- ' + tokens.date(req, res))
	].join(' ')
})

let cmdValue

program
	.version('0.1.0')
	.description('Minimalist http-server for static site')
	.usage('<commands> [options]')
	.arguments('<cmd>')
	.action((cmd) => {
		cmdValue = cmd
	})

program
	.command('local')
	.description('serve static file locally')
	.option('--port <n>', 'port to use')
	.option('--spa', 'redirect all route to index.html')
	.option('--no-hidden', 'ignore all request to dot files (hidden)')
	.action(function (options) {
		cmdValue = 'local'

		const OPTS = {
			port: options.port || 8080,
			spa: options.spa || false,
			showHidden: options.hidden
		}
		
		const APP_DIR = process.cwd()
		
		if(existsSync(path.join(APP_DIR, 'index.html'))) {
			const app = express()
		
			app.use(morganMiddleware)
			// app.use('*', sera(APP_DIR, OPTS))

			app.use('*', async (req, res) => {
				const targetSite = APP_DIR
				const targetPath = req.originalUrl.split('?')[0]
		
				if(existsSync(targetSite)) {
					const result = await sera(targetSite, targetPath, {
						spa: options.spa,
						showHidden: options.hidden
					})
					if(result.status === 200) {
						if(!result.type) {
							res.type = result.type
						}
						return res.sendFile(result.path, result.options)
					}
					return res.status(result.status).send('error boy')
				}
				return res.status(404).send('url not found')
			})
		
			app.listen(OPTS.port, () => {
				console.log(log.bold(`Serph is up on ${log.url(`localhost:${OPTS.port}`)}`))
			})
		}
		else{
			console.error(log.error('file index.html not found'))
		}
	})

program
	.command('deploy')
	.description('deploy your static site')
	.action(async function () {
		cmdValue = 'deploy'
		
		const APP_DIR = process.cwd()

		// get access token
		if(existsSync(path.join(APP_DIR, 'index.html'))) {
			if(existsSync(path.join(APP_DIR, 'serph.json'))) {
				const config = readFileSync(path.join(APP_DIR, 'serph.json'))
				try {
					const parseConfig = JSON.parse(config)

					const authFile = path.join(homedir, '.serph', 'auth.json')
					
					if(existsSync(authFile)) {
						const auth = JSON.parse(readFileSync(authFile))
						if(auth.token) {
							try {
								const response = await atma.requestAccessToken('serph', auth.token)
								const accessToken = response.data.data

								request.post({
									url: 'http://localhost:7000/api/files/config',
									form: parseConfig,
									headers: {
										authorization: `bearer ${accessToken}`
									}
								}, (err, httpResponse, body) => {
									if(err) {
										console.log(err)
										return process.exit(1)
									}
									if(httpResponse.statusCode >= 400) {
										console.log(`ᑀ ${JSON.parse(body).message}`)
										return process.exit(1)
									}
									else{
										console.log(`ᑀ preparing files`)

										let buff = []
								
										const tarStream = tar.pack(APP_DIR).pipe(zlib.Gzip())

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
													authorization: `bearer ${accessToken}`
												}
											}, (err, httpResponse, body) => {
												if(err) {
													console.log(err)
													return process.exit(1)
												}
												const data = JSON.parse(body).data
												if(data.alias && parseConfig.alias && data.alias !== parseConfig.alias) {
													console.log(`ᑀ alias ${log.bold(parseConfig.alias)} already used, using randomly generated alias`)
												}
												console.log(`ᑀ online at ${log.url(`https://${data.alias}.serph.network`)}`)
												return process.exit(0)
											})

											readable.pipe(r)
										})
									}
								})
							} catch (err) {
								console.error(err.response)
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
				} catch (err) {
					console.log(err)
					process.exit(1)
				}
			}
			else{
				console.error(`${log.error('serph.json')} not found`)
				process.exit(1)
			}
		}
		else{
			console.error(`${log.error('index.html')} not found`)
			process.exit(1)
		}
	})

program
	.command('login')
	.description('login with evius account')
	.action(function () {
		cmdValue = 'login'
		
		const authFile = path.join(homedir, '.serph', 'auth.json')
		if(existsSync(authFile)) {
			const auth = JSON.parse(readFileSync(authFile))
			if(auth.token) {
				console.log(`Already logged in with ${auth.email}`)
				process.exit(0)
			}
			else{
				rl.question('Email: ', async (answer) => {
					console.log('Logging in...')
					try {
						const response = await atma.login(answer)
						console.log('Check your email')
						console.log(`Waiting confirmation with code: ${response.data.data.codename}`)
						atma.onAuth((response) => {
							if(response) {
								console.log('login successful')
								Object.assign(response.data, {email: answer})
								writeFileSync(path.join(homedir, '.serph', 'auth.json'), JSON.stringify(response.data))
								process.exit(0)
							}
						})
					} catch (err) {
						console.error(err.response.data)
						process.exit(1)
					}
				})
			}
		}
		else{
			rl.question('Email: ', async (answer) => {
				console.log('Logging in...')
				try {
					const response = await atma.login(answer)
					console.log('Check your email')
					console.log(`Waiting confirmation with code: ${response.data.data.codename}`)
					atma.onAuth((response) => {
						if(response) {
							console.log('login successful')
							Object.assign(response.data, {email: answer})
							writeFileSync(path.join(homedir, '.serph', 'auth.json'), JSON.stringify(response.data))
							process.exit(0)
						}
					})
				} catch (err) {
					console.error(err.response.data)
					process.exit(1)
				}
			})
		}
	})

program
	.command('logout')
	.description('logout evius account in this system')
	.action(function () {
		cmdValue = 'login'
		const authFile = path.join(homedir, '.serph', 'auth.json')
		if(existsSync(authFile)) {
			const auth = JSON.parse(readFileSync(authFile))
			atma.logout(auth.token)
			unlinkSync(authFile)
			console.log('Successfully logged out')
			process.exit(0)
		}
		else{
			console.log('Not logged in')
			process.exit(0)
		}
	})

program.parse(process.argv)

if (typeof cmdValue === 'undefined') {
	program.help()
	process.exit(1)
}