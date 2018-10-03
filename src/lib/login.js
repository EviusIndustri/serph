import utils from './utils'

const main = async () => {
	const user = utils.auth.isLoggedIn()

	if(user) {
		console.log(`> logged in as ${user.email}`)
		process.exit(0)
	}
	else{
		utils.prompt.question('> email: ', async (answer) => {
			console.log('> logging in...')
			let [, _err] = await utils.auth.login(answer)

			if(_err) return utils.logger.error(_err)
			console.log(`> successfully logged in!`)
			process.exit(0)
		})
	}
}

export default main