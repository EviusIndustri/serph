import chalk from 'chalk'

const bold = (message) => chalk.bold(`${message}`)
const url = (url) => chalk.blue.bold(`${url}`)
const success = (message) => chalk.green(message)
const error = (message) => chalk.red(`${message}`)
const lightError = (message) => chalk.redBright(message)

export default {
	bold,
	url,
	success,
	error,
	lightError
}