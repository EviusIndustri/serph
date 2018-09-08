#!/usr/bin/env node

import zlib from 'zlib'
import path from 'path'
import {existsSync} from 'fs'

import express from 'express'
import morgan from 'morgan'
import request from 'request'
import tar from 'tar-fs'

import toStream from 'buffer-to-stream'
import _cliProgress from 'cli-progress'
import program from 'commander'

import log from './lib/log'
import sera from '@evius/sera'

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
	.action(function () {
		cmdValue = 'deploy'
		
		const APP_DIR = process.cwd()
		
		if(existsSync(path.join(APP_DIR, 'index.html'))) {
			let buff = []
	
			const tarStream = tar.pack(APP_DIR).pipe(zlib.Gzip())

			let totalData = 0
			tarStream.on('data', (data) => {
				totalData += data.length
				buff.push(data)
			})
			tarStream.on('end', () => {
				const progressBar = new _cliProgress.Bar({}, _cliProgress.Presets.shades_classic)
				progressBar.start(100, 0)
				let progress = 0
				const readable = toStream(Buffer.concat(buff))
				readable.on('data', (data) => {
					progress += data.length
					progressBar.update(progress*100/totalData)
				})
				readable.on('end', () => {
					progressBar.stop()
				})

				const r = request.post({url: 'http://localhost:8080/upload'}, (err, httpResponse, body) => {
					console.log(body)
				})

				readable.pipe(r)
			})

		}
		else{
			console.error(log.error('file index.html not found'))
		}
	})

program.parse(process.argv)

if (typeof cmdValue === 'undefined') {
	program.help()
	process.exit(1)
}