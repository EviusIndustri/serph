import express from 'express'
import path from 'path'
import fs from 'fs'

const router = express.Router()

export default (sitePath, opts) => {
	
	router.get('*', async (req, res) => {
		const targetPath = req.originalUrl.split('?')[0]
		try {
			const target = path.join(sitePath, targetPath)
			const stat = await fs.statSync(target)
			if(stat.isFile()) {
				return res.sendFile(target)
			}
			else{
				if(targetPath === '/') {
					return res.sendFile(path.join(sitePath, `index.html`))
				}
				return res.sendFile(path.join(sitePath, `${targetPath}.html`))
			}
		} catch(err) {
			if(opts.spa == true) {
				return res.sendFile(path.join(sitePath, `index.html`))
			}
			if(err.errno == -2) {
				return res.sendFile(path.join(__dirname, '..', '..', 'views', 'default-404.html'))
			}
			return res.send(err)
		}
	})

	return router
}