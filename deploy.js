/*
BUILD SCRIPT IMPLEMENTING:
- universal constant preprocessor (very hacky, needs some work)
- html, js, and css compression
- auto-launch express server after build
*/
// TODO: Rewrite everything with proper async.
const fs = require('fs');
const path = require('path');
const ncp = require('ncp').ncp;
const compressor = require('node-minify');
const minify = require('html-minifier').minify;
const prompt = require('prompt')
const yesno = require('yesno')
const Handlebars = require('handlebars')
const PushBullet = require('pushbullet')
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
					setTimeout(begin, 50);
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

if (!fs.existsSync('./temp')){
	fs.mkdirSync('./temp');
}

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
			//console.log("Mathed with", match[0], "in", filename)
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
				setTimeout(begin, 50);
		});
	}, (err) => {
		console.error(err);
	});
});


if (process.argv[2] == "clean") {
	// Because we love some synchornous code in an asnychrnous deploy script...
	if (fs.existsSync("./app/data.db"))
		fs.unlinkSync("./app/data.db");
}
else
	console.log("Note: You can clean the database by passing 'clean' to the deploy script (CAUTION! This will wipe all data!)");
//console.log("Loading server...");
//require('./app/index.js');

function compress() {
	console.log("Deploying...");
	compressor.minify({
		compressor: 'gcc',
		input: './temp/main.js',
		output: './temp/main.gcc.js',
		callback: function (err, min) {}
	});

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

var template = Handlebars.compile(fs.readFileSync('./dev/index.html').toString())

var schema = {
	properties: {
		treatments: {
			pattern: /^[a-zA-Z,]+$/,
			message: 'Names must be only letters.',
			required: true
		},
		APIkey: {
			required: true
		}
	}
}

function begin() {
	prompt.start()
	console.log('Separate individual items with a comma (no spaces).')
	prompt.get(schema, (err, res) => {
		treatments = res.treatments.split(",")
		fs.writeFileSync('./temp/index.html', template({"treatments": treatments}))
		fs.writeFileSync('./app/treatments.json', JSON.stringify(treatments))
		var pusher = new PushBullet(res.APIkey)
		var pushJson = {"token": res.APIkey, "devices": []}
		pusher.devices((err, res) => {
			err && console.error("An error occured.", err)
			console.log('Select which devices you want to push messages to. You can select multiple devices.')
			promptDevices(res.devices, pushJson)
		})
	})
}

function promptDevices(devices, pushJson) {
	device = devices.shift()
	yesno.ask(`${device.nickname} (${device.manufacturer}; ${device.model})`, true, (ok) => {
		if (ok) pushJson.devices.push(device.iden)
		if (devices.length == 0) {
			fs.writeFile('./app/pushbullet.json', JSON.stringify(pushJson))
			ncp("./dev", "./app/public", (err) => {
				if (err)
					return console.error(err);
				compress()
			})
		}
		else promptDevices(devices, pushJson)
	})
}
