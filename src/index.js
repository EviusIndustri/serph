#!/usr/bin/env node

import path, { sep } from 'path'
var recursive = require('recursive-readdir')
import {existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, statSync} from 'fs'

const dagPB = require('ipld-dag-pb')
const UnixFS = require('ipfs-unixfs')

import express from 'express'
import morgan from 'morgan'
import request from 'request'

import os from 'os'
import readline from 'readline'
import program from 'commander'

import sera from '@evius/sera'
import atma from '@evius/atma-client'

import log from './lib/log'
import deploy from './lib/deploy'

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
		
		deploy()
	})

program
	.command('test')
	.action(function () {
		cmdValue = 'test'

		const APP_DIR = process.cwd()
		const APP_DIR_SPLIT = APP_DIR.split(sep)
		const APP_INDEX = APP_DIR_SPLIT.length

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
				const PATH_SPLIT = f.path.split(sep)
				const finalPath = `${PATH_SPLIT.slice(APP_INDEX).join(sep)}`
				return {
					path: finalPath,
					hash: f.hash,
					address: {
						[`/${finalPath}`]: f.hash
					}
				}
			})

			const authFile = path.join(homedir, '.serph', 'auth.json')
			const auth = JSON.parse(readFileSync(authFile))
			const response = await atma.requestAccessToken('serph', auth.token)
			const accessToken = response.data.data

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

					// console.log(parseBody.data)

					const filesToUploadPath = parseBody.data.filesToUpload.map((f) => (f.path))

					if(filesToUploadPath.length > 0) {
						console.log(`uploading ${filesToUploadPath.length} files`)
						deploy(parseBody.data.deploymentPath, filesToUploadPath)
					}
					else{
						console.log('nothing to upload')
						process.exit(0)
					}

					// return process.exit(0)	
				} catch (err) {
					console.log(err)
					process.exit(1)
				}
			})
		})
	})

program
	.command('link')
	.description('create new link to your deployment')
	.arguments('<deployment> <new_link>')
	.action(async function (deployment, new_link) {
		cmdValue = 'link'

		const authFile = path.join(homedir, '.serph', 'auth.json')
		if(existsSync(authFile)) {
			const auth = JSON.parse(readFileSync(authFile))
			if(auth.token) {
				try {
					const response = await atma.requestAccessToken('serph', auth.token)
					const accessToken = response.data.data
					console.log(`ᑀ authenticating...`)
					request.post({
						url: 'http://localhost:7000/api/links',
						form: {
							link: new_link,
							target: deployment
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

							if(parseBody.status === 'error') {
								console.log(`${log.error(`ᑀ deployment ${deployment} is not found!`)}`)
								return process.exit(1)
							}
							else if(parseBody.status === 'already_used') {
								console.log(`${log.error(`ᑀ link ${new_link} is already used!`)}`)
								return process.exit(1)
							}

							console.log(`ᑀ ${log.bold(new_link)} is now linking to deployment (${log.bold(deployment)})`)
							const data = parseBody.data
							console.log(`ᑀ online at ${log.url(`https://${data.link}.serph.network`)}`)
							return process.exit(0)	
						} catch (err) {
							console.log(err)
							process.exit(1)
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