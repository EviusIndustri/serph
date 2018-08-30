#!/usr/bin/env node

import express from 'express'
import morgan from 'morgan'
import path from 'path'
import serve from './services/serve'

import program from 'commander'
import { existsSync } from 'fs'

program
	.version('0.1.0')
	.option('-p, --port <n>', 'port to use')
	.option('-s, --spa', 'redirect all route to index.html')

program.parse(process.argv)

const OPTS = {
	port: program.port || 8080,
	spa: program.spa || false
}

const APP_DIR = process.cwd()

if(existsSync(path.join(APP_DIR, 'index.html'))) {
	const app = express()

	app.use(morgan('tiny'))
	app.use('*', serve(APP_DIR, OPTS))

	app.listen(OPTS.port, () => {
		console.log(`Sera is up on PORT ${OPTS.port}`)
	})
}
else{
	console.error('file index.html not found')
}