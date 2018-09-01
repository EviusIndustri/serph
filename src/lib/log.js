import chalk from 'chalk'

const bold = (message) => chalk.bold(`${message}`)
const url = (url) => chalk.blue.bold(`${url}`)
const success = (message) => chalk.green.bold(`${message}`)
const error = (message) => chalk.red.bold(`${message}`)
const lightError = (message) => chalk.redBright.bold(message)

export default {
	bold,
	url,
	success,
	error,
	lightError
}