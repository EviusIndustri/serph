import {importer} from 'ipfs-unixfs-engine'
import IPLD from 'ipld'
import { createReadStream } from 'fs'
import pull from 'pull-stream'
import CID from 'cids'
import toPull from 'stream-to-pull-stream'

const files = [
	'/home/riqi/Projects/serph-cli/Charlotte-Episode-1.mp4'
]

IPLD.inMemory((err, ipld) => {
	pull(
		pull.values(files),
		pull.map((file) => ({
			path: file,
			content: toPull.source(createReadStream(file))
		})),
		importer(ipld),
		pull.collect((err, files) => {
			if(err) return console.error(err)
			const cid = new CID(0, 'dag-pb', files[0].multihash)
			console.log(cid.toBaseEncodedString())
		})
	)
})