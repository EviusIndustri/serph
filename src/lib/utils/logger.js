import log from '../log'

const error = (err) => {
	console.log(`> ${log.error(err)}`)
	process.exit(1)
}

module.exports = {
	error
}