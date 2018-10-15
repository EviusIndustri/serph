'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _nanohtml = require('nanohtml');

var _nanohtml2 = _interopRequireDefault(_nanohtml);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const view = () => {
	return _nanohtml2.default`
	<html>
		<head>
			<meta charset="utf-8" />
			<meta http-equiv="X-UA-Compatible" content="IE=edge">
			<title>Page Not Found</title>
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<link href="https://fonts.googleapis.com/css?family=Nanum+Gothic+Coding" rel="stylesheet">
			<style>
			html, body, div, span, applet, object, iframe,
		h1, h2, h3, h4, h5, h6, p, blockquote, pre,
		a, abbr, acronym, address, big, cite, code,
		del, dfn, em, img, ins, kbd, q, s, samp,
		small, strike, strong, sub, sup, tt, var,
		b, u, i, center,
		dl, dt, dd, ol, ul, li,
		fieldset, form, label, legend,
		table, caption, tbody, tfoot, thead, tr, th, td,
		article, aside, canvas, details, embed, 
		figure, figcaption, footer, header, hgroup, 
		menu, nav, output, ruby, section, summary,
		time, mark, audio, video {
			margin: 0;
			padding: 0;
			border: 0;
			font-size: 100%;
			font: inherit;
			vertical-align: baseline;
		}

		article, aside, details, figcaption, figure, 
		footer, header, hgroup, menu, nav, section {
			display: block;
		}
		body {
			line-height: 1;
		}
		ol, ul {
			list-style: none;
		}
		blockquote, q {
			quotes: none;
		}
		blockquote:before, blockquote:after,
		q:before, q:after {
			content: '';
			content: none;
		}
		table {
			border-collapse: collapse;
			border-spacing: 0;
		}

		body{
			background-color: black;
			color: #BDBDBD;
			font-family: 'Nanum Gothic Coding', monospace;
			font-size: 16px;
		}

		h2{
			font-size: 2rem;
		}

		</style>
		</head>
		<body>
			<div style="display: flex; align-items: center; width: 100vw; height: 100vh;">
				<div style="text-align: center; width: 100%">
					<h2>Page Not Found — 404</h2>
				</div>
			</div>
		</body>
	</html>
	
	`;
};

exports.default = view;
//# sourceMappingURL=default-404.js.map