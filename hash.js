const dagPB = require('ipld-dag-pb')
const UnixFS = require('ipfs-unixfs')
import {readFileSync} from 'fs'

const fileBuffer = readFileSync('./index.js')

const file = new UnixFS('file', fileBuffer)

dagPB.DAGNode.create(file.marshal(), (err, node) => {
	if(err) return console.error(err)
	console.log(node._cid.toBaseEncodedString()) // nb. try to use this method instead of the multihashes module
	// output QmRFSrX7MJW5P7YjdDoe4ckEEMVMSpnR5WnFNxgbggjwH1

	// JS version:
	// $ jsipfs add index.js 
	// added QmRFSrX7MJW5P7YjdDoe4ckEEMVMSpnR5WnFNxgbggjwH1 index.js

	// Go version:
	// $ ipfs add index.js 
	// added QmRFSrX7MJW5P7YjdDoe4ckEEMVMSpnR5WnFNxgbggjwH1 index.js
})