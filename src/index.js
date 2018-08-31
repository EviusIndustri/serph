#!/usr/bin/env node

import express from 'express'
import morgan from 'morgan'
import path from 'path'
import serve from './services/serve'

import {existsSync} from 'fs'

import program from 'commander'

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
	.description('run serph on localhost')
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
		
			app.use(morgan('tiny'))
			app.use('*', serve(APP_DIR, OPTS))
		
			app.listen(OPTS.port, () => {
				console.log(`Serph is up on localhost:${OPTS.port}`)
			})
		}
		else{
			console.error('file index.html not found')
		}
	})

program.parse(process.argv)

if (typeof cmdValue === 'undefined') {
	program.help()
	process.exit(1)
}