import request from 'request'
import utils from './utils'
import log from './log'
import config from './config'

const core = async (user, deployment, new_link) => {
	let [accessToken, _err] = await utils.auth.requestAccessToken(user.token)
	if(_err) return utils.logger.error(_err)
	
	console.log(`ᑀ authenticating...`)
	request.post({
		url: `${config.BASE_URL}/api/links`,
		form: {
			link: new_link,
			target: deployment
		},
		headers: {
			authorization: `bearer ${accessToken}`
		}
	}, (err, httpResponse, body) => {
		if(err) {
			console.log(err)
			return process.exit(1)
		}
		try {
			const parseBody = JSON.parse(body)

			if(parseBody.status === 'error') {
				console.log(`${log.error(`ᑀ deployment ${deployment} is not found!`)}`)
				return process.exit(1)
			}
			else if(parseBody.status === 'already_used') {
				console.log(`${log.error(`ᑀ link ${new_link} is already used!`)}`)
				return process.exit(1)
			}
			else if(parseBody.status === 'invalid_parameter') {
				console.log(`${log.error(`ᑀ ${parseBody.message}`)}`)
				return process.exit(1)
			}

			console.log(`ᑀ ${log.bold(new_link)} is now linking to deployment (${log.bold(deployment)})`)
			const data = parseBody.data
			console.log(`ᑀ online at ${log.url(`https://${data.link}.serph.network`)}`)
			return process.exit(0)	
		} catch (err) {
			console.log(err)
			process.exit(1)
		}
	})
}

const link = async (deployment, new_link) => {
	const user = utils.auth.isLoggedIn()
	if(user) {
		core(user, deployment, new_link)
	}
	else{
		console.log(`> please login using ${log.bold(`serph login`)}`)
		process.exit(0)
	}
}

export default link