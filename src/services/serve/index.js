import express from 'express'
import path from 'path'
import fs from 'fs'

import mime from 'mime-types'

import views from '../../views'

const router = express.Router()

export default (sitePath, opts) => {

	const options = {
		dotfiles: opts.showHidden ? 'allow': 'deny'
	}

	router.get('*', async (req, res) => {
		const targetPath = req.originalUrl.split('?')[0]
		try {
			const target = path.join(sitePath, targetPath)
			const stat = await fs.statSync(target)
			if(stat.isFile()) {
				if(!mime.lookup(target)){
					res.type('text/plain')
				}
				return res.sendFile(target, options)
			}
			else{
				if(targetPath === '/') {
					return res.sendFile(path.join(sitePath, `index.html`))
				}
				return res.sendFile(path.join(sitePath, `${targetPath}.html`), (err) => {
					if(err) {
						return res.send(views.page404().toString())
					}
				})
			}
		} catch(err) {
			if(opts.spa == true) {
				return res.sendFile(path.join(sitePath, `index.html`))
			}
			if(err.errno == -2) {
				return res.send(views.page404().toString())
			}
			return res.send(err)
		}
	})

	return router
}