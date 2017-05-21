//Build script
const fs = require('fs');
const path = require('path');
const ncp = require('ncp').ncp;
const compressor = require('node-minify');
const minify = require('html-minifier').minify;
var _remaining;
//const promisedIO = require('promised-io/promise');

//const promise_readdir = promisedIO.convertNodeAsyncFunction(fs.readdir);

function readFiles(dirname, onFileContent, onError) {
	fs.readdir(dirname, function(err, filenames) {
		if (err) {
			onError(err);
			return;
		}
		_remaining = filenames.length;
		filenames.forEach(function(filename) {
			var _path = path.join(dirname, filename)
			if (fs.lstatSync(_path).isDirectory()) {
				--_remaining;
				if (_remaining <= 0)
					setTimeout(compress, 50);
				return;
			}
			fs.readFile(_path, 'utf-8', function(err, content) {
				if (err) {
					onError(err);
					return;
				}
				onFileContent(filename, content);
			});
		});
	});
}

// NOTE THAT THIS COULD BE SIMPLIFIED WITH NCP TRANSOFRM
// ... i just can't be bothered to do it
var constants;
fs.readFile("./constants.json", 'utf-8', function(err, content) {
	if (err) {
		console.error(err);
		return;
	}
	constants = JSON.parse(content);
	readFiles("./dev", (filename, content) => {
		var reg = /\${[a-zA-Z]+}/g;
		while ((match = reg.exec(content)) != null) {
			var vname = match[0].slice(2, match[0].length - 1);
			var value = constants[vname];
			if (value == undefined) {
				console.error(`${vname} is not a defined constant!`);
				return;
			}
			content = content.replace(match[0], value);
		};
		fs.writeFile(path.join("./temp", filename), content, (err) => {
			if (err) {
				console.error(err);
				return;
			}
			--_remaining;
			if (_remaining <= 0)
				setTimeout(compress, 50);
		});
	}, (err) => {
		console.error(err);
	});
});


ncp("./dev", "./app/public", (err) => {
	if (err) {
		return console.error(err);
	}
});

console.log("Loading server...");
require('./app/index.js');

function compress() {
	console.log("Compressing.");
	/*compressor.minify({
		compressor: 'gcc',
		input: './temp/main.js',
		output: './temp/main.gcc.js',
		callback: function (err, min) {}
	});*/

	compressor.minify({
		compressor: 'uglifyjs',
		input: './temp/main.js',
		output: './app/public/main.js',
		callback: function (err, min) {}
	});

	compressor.minify({
		compressor: 'clean-css',
		input: './temp/style.css',
		output: './app/public/style.css',
		callback: function (err, min) {}
	});

	fs.readFile("./temp/index.html", 'utf-8', function(err, content) {
		if (err) {
			console.error(err);
			return;
		}
		fs.writeFile("./app/public/index.html", minify(content), (err) => {
			if (err) {
				console.error(err);
				return;
			}
		});
	});
	console.log("Done.");
}