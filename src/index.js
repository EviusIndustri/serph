#!/usr/bin/env node
require("tls").DEFAULT_ECDH_CURVE = "auto"
import path from 'path'
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs'

import express from 'express'
import morgan from 'morgan'

import os from 'os'
import program from 'commander'

import sera from '@evius/sera'
import atma from '@evius/atma-client'

import log from './lib/log'
import deploy from './lib/deploy'
import login from './lib/login'
import register from './lib/register'
import link from './lib/link'
import config from './lib/config'

const homedir = os.homedir()
if(!existsSync(path.join(homedir, '.serph'))) {
	mkdirSync(path.join(homedir, '.serph'))
}

atma.init({
	server: config.ATMA_URL
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
	.description('deploy your static site to serph.network')
	.action(function () {
		cmdValue = 'deploy'

		deploy()
	})

program
	.command('link')
	.description('create new link to your deployment')
	.arguments('<deployment> <new_link>')
	.action(async function (deployment, new_link) {
		cmdValue = 'link'

		link(deployment, new_link)
	})

program
	.command('register')
	.description('register to serph.network')
	.action(function () {
		cmdValue = 'register'
		
		register()
	})	

program
	.command('login')
	.description('login with serph account')
	.action(function () {
		cmdValue = 'login'
		
		login()
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