import path from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'

import log from '../log'

import atma from '@evius/atma-client'

const HOME_DIR = homedir()

const isLoggedIn = () => {
	const authFile = path.join(HOME_DIR, '.serph', 'auth.json')
	if(existsSync(authFile)) {
		try {
			const auth = JSON.parse(readFileSync(authFile))
			if(auth.token) {
				return auth
			}	
		} catch (err) {
			unlinkSync(authFile)
			return false
		}
	}
}

const requestAccessToken = async (refreshToken) => {
	try {
		const response = await atma.requestAccessToken('serph', refreshToken)
		return [response.data.data, null]
	} catch (err) {
		return [null, err]
	}
}

const login = (email) => {
	return new Promise( async (resolve, reject) => {
		try {
			const response = await atma.login(email)
			atma.confirmPooling(email, response.data.data.codename)
				.then((response) => {
					Object.assign(response.data.data, {email: email})
					writeFileSync(path.join(HOME_DIR, '.serph', 'auth.json'), JSON.stringify(response.data.data))
					resolve()
				})
			console.log(`> we just sent you verification email with access code: ${log.bold(response.data.data.codename)}`)
		} catch (err) {
			const _err = err.response.data
			reject(_err.message)
		}
	})
}

const register = (email) => {
	return new Promise( async (resolve, reject) => {
		try {
			const response = await atma.register(email)
			atma.confirmPooling(email, response.data.data.codename)
				.then((response) => {
					Object.assign(response.data.data, {email: email})
					writeFileSync(path.join(HOME_DIR, '.serph', 'auth.json'), JSON.stringify(response.data.data))
					resolve()
				})
			console.log(`> we just sent you verification email with access code: ${log.bold(response.data.data.codename)}`)
		} catch (err) {
			const _err = err.response.data
			reject(_err.message)
		}
	})
}

module.exports = {
	isLoggedIn,
	requestAccessToken,
	login,
	register
}