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
			try {
				await utils.auth.register(answer)	
				console.log(`> successfully logged in!`)
				process.exit(0)
			} catch (err) {
				return utils.logger.error(err)
			}
		})
	}
}

export default main