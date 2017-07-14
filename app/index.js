/*
EXPRESS HTTP SERVER
*/
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const morgan = require('morgan');
const path = require('path');
const sqlite3 = require('sqlite3');
const Type = require('type-of-is');
const fs = require("fs");
const PushBullet = require('pushbullet');
const Handlebars = require("handlebars");
var port = 33333;

if (process.argv[2] != undefined) port = parseInt(process.argv[2])

var db = new sqlite3.Database(__dirname + '/data.db');
var stmt;
var stmt_proc;
db.serialize(() => {
	db.run(["CREATE TABLE IF NOT EXISTS received (",
		"date TEXT NOT NULL,",//UTC
		"pc_id TEXT NOT NULL,",
		"male BOOLEAN NOT NULL,",
		"age INTEGER NOT NULL,",
		"coffee BOOLEAN NOT NULL,",
		"sugar BOOLEAN NOT NULL,",
		"experienced BOOLEAN NOT NULL,",
		"treatment TEXT NOT NULL,",
		"results TEXT NOT NULL)"].join('')); // hacky multiline string to avoid whitespace issue with backslashes
	stmt = db.prepare('INSERT INTO received VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
	db.run(["CREATE TABLE IF NOT EXISTS processed (",
		"date TEXT NOT NULL,",//UTC
		"pc_id TEXT NOT NULL,",
		"male BOOLEAN NOT NULL,",
		"age INTEGER NOT NULL,",
		"coffee BOOLEAN NOT NULL,",
		"sugar BOOLEAN NOT NULL,",
		"experienced BOOLEAN NOT NULL,",
		"treatment TEXT NOT NULL,",
		"tn INTEGER NOT NULL,",
		"fl INTEGER NOT NULL,",
		"e1 INTEGER NOT NULL,",
		"e2l INTEGER NOT NULL,",
		"e2d INTEGER NOT NULL,",
		"e INTEGER NOT NULL,",
		"e_100 INTEGER NOT NULL,",
		"tn_e INTEGER NOT NULL,",
		"cp INTEGER NOT NULL,",
		"timing TEXT NOT NULL)"].join('')); // hacky multiline string to avoid whitespace issue with backslashes
	stmt_proc = db.prepare('INSERT INTO processed VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
});

var usersInProgress = {};
var _treatmentGroups = eval(fs.readFileSync('./app/treatments.json').toString())
for (var i=0; i<_treatmentGroups.length; i++) usersInProgress[_treatmentGroups[i]] = 0

const statsTemplate = Handlebars.compile(fs.readFileSync('./app/stats.html').toString());

const re = /\(|\)|;|'|_|%/g; // sqlite sanitize regex

var pushapidata = JSON.parse(fs.readFileSync('./app/pushbullet.json'), 'utf8');
/*
Requires file ./app/pushover.json to be present. This file contains
the pushover api data in jspon format, such as:
{
	"token": "xxxxxxxxxxx",
	"user": "xxxxx",
	"devices": ["xxx", "yyy"] (optional multi-device support. If you just need one device, enter only ["xxx"])
}
*/
const pusher = new PushBullet(pushapidata.token);
// A littl helper to let you set your devices more easily:
/*pusher.devices((err, response) => {
	if (err)
		console.error("Pushbullet encountered an error getting my details.")
	else
		console.log(response);
});*/

app.use(morgan('common')); // logger middleware
app.use(bodyParser.json());// parse json of xhr requests

app.use(express.static(path.join(__dirname, 'public')));//serve static content

app.put('/submit', (req, res) => {
	// Prevent injection
	var strRestult = JSON.stringify(req.body.results);
	if (!(Type.is(req.body.pc_id, "String") && Type.is(req.body.sex, "Boolean") &&
		Type.is(req.body.age, "Number") && Type.is(req.body.coffee, "Boolean") &&
		Type.is(req.body.sugar, "Boolean") && Type.is(req.body.doneThatBefore, "Boolean")
		&& Type.is(req.body.treatment, "String") && Type.is(req.body.results, "Object") &&
		Type.is(strRestult, "String")) ||
		re.test(req.body.treatment) || re.test(strRestult) || re.test(req.body.pc_id))
	{		
		console.error("Faulty data!");
		console.log(JSON.stringify(req.body));
		res.sendStatus(400);
		return;
	}
	var date = new Date().toISOString();
	stmt.run(date, req.body.pc_id, req.body.sex, req.body.age, req.body.coffee, req.body.sugar,
		req.body.doneThatBefore, req.body.treatment, strRestult, (err) => {
			if (err) {
				console.error("Error during sqlite write:\n" + err.message);
				res.sendStatus(500);
				return;
			}
			res.sendStatus(200);
		});
	processed = processData(req.body.results);
	stmt_proc.run(date, req.body.pc_id, req.body.sex, req.body.age, req.body.coffee, req.body.sugar,
		req.body.doneThatBefore, req.body.treatment, processed[0], processed[1],
		processed[2], processed[3], processed[4], processed[5], processed[6], processed[7],
		processed[8], JSON.stringify(processed[9]), (err) => {
			if (err) {
				console.error("Could not store processed data for " + req.body.pc_id + ": " + err.message);
				return;
			}
		});
});

app.post('/help', (req, res) => {
	var msg = {
		title: req.body.title,
		message: req.body.details
	};
	var status = 200;
	pushapidata.devices.forEach((device)=> {
		pusher.note(device, msg.title, msg.message, (err, response) => {
			if(err) {
				console.error("PUSHBULLET FATAL ERROR:\nCould not send message to " + device + ":\n" + msg.title + "\n" + msg.message);
				console.error(err);
				status = 500;
			}
		});
	});
	res.sendStatus(status);
});

app.post('/pushStatus', (req, res) => {
	if (!(Type.is(req.body.type, "String") && Type.is(req.body.treatment, "String"))
		|| re.test(req.body.type) || re.test(req.body.treatment)) {
		console.error("Faulty data!");
		console.log(JSON.stringify(req.body));
		res.sendStatus(400);
		return;
	}
	switch(req.body.type) {
		case "begin":
			usersInProgress[req.body.treatment] += 1;
			break;
		case "end":
			usersInProgress[req.body.treatment] -= 1;
			break;
		default:
			console.log("WARNING: Got pushStatus request of invalid type.");
	}
	res.sendStatus(200);
});

function do_stats(values, totals, _tot_, index, callback) {
	var treatment = _treatmentGroups[index]
	db.all("SELECT tn, e_100, fl, cp FROM processed WHERE treatment=?", treatment, (err, rows) => {
		var _vals = {tn: 0, e100: 0, fl: 0, cp: 0}
		if (err) return console.error("Error reading for group", treatment, err)
		for (var j = 0; j < rows.length; j++) {
			row = rows[j]
			_vals.tn += parseInt(row["tn"]);
			_vals.e100 += parseInt(row["e_100"]);
			_vals.fl += parseInt(row["fl"]);
			_vals.cp += parseInt(row["cp"]);
		}
		for (prop in _vals) _vals[prop] = _vals[prop] / rows.length // praise the lord for auto null division handling
		values[treatment] = _vals
		values[treatment].count = rows.length
		totals[treatment] = rows.length + usersInProgress[treatment]
		_tot_ += totals[treatment]

		if (index + 1>= _treatmentGroups.length) callback({"completed": values, "progress": usersInProgress, "total": totals, "_tot_": _tot_})
		else do_stats(values, totals, _tot_, index+1, callback)
	})
}

app.get('/stats', (req, res) => {
	var values = {}, totals = {}, _tot_ = 0
	db.serialize(() => {
		do_stats({}, {}, 0, 0, (data) => { // dirty hack to wait for above to execute
			console.log(JSON.stringify(data))
			res.send(statsTemplate(data))
		})
	})
})

app.listen(port, (err) => {  
	if (err)
		return console.log('something bad happened', err);

	console.log(`server is listening on port ${port}`);
	require('dns').lookup(require('os').hostname(), function (err, add, fam) {
		console.log('Your local IP address is', add + ".")
		console.log("To access your server, type http://" + add + ((port != 80) ? (":" + port) : ""), "in a web broser")
	})
});

function processData(data) {
	var series;
	var tn = 0,
		fl = 0,
		e1 = 0,
		e2l = 0,
		e2d = 0,
		e = 0,
		e_100 = 0,
		tn_e = 0,
		cp = 0,
		lastTime = 0,
		timing = {},
		count = 0;
	var lastSeries = false, lastSequence = false;
	for (var i=1; !lastSeries; i++) {
		var ser = data[i];
		var fl_min = Infinity, fl_max = 0;

		if (!data.hasOwnProperty(i+1))
			lastSeries = true;

		lastSequence = false;
		for (var j=0; !lastSequence; j++) {
			var sequ = ser[j];
			var keys = ["0","1"];
			lastTime += sequ.time;
			// Filter data cut from last sequence
			if (!ser.hasOwnProperty(j+1)) {
				if (sequ.time < 2*2700) {
					if (sequ.time > 2700)
						keys = ["0"];
					else
						break;
					if (sequ[0].n <= 1)
						break;
					if (sequ[1].n <= 1)
						keys = ["0"];
				}
				lastSequence = true;
			}
			for (key in keys) {
				tn += sequ[key].n;
				fl_min = Math.min(fl_min, sequ[key].n);
				fl_max = Math.max(fl_max, sequ[key].n);
				e1 += sequ[key].e1;
				e2l += sequ[key].e2l;
				e2d += sequ[key].e2d;
			}
			fl = Math.max(fl, fl_max - fl_min);
			e = e1 + e2d + e2l;
			e_100 = e * 100 / tn;
			tn_e = tn - e;
			cp = tn_e - e2l - e2d;
			timing[lastTime] = {"tn": tn, "fl": fl, "e1": e1, "e2l": e2l, "e2d": e2d, "e": e, "e_100": e_100, "tn_e": tn_e, "cp": cp, "last": lastSequence};
			count ++;
		}
	}
	return [tn, fl, e1, e2l, e2d, e, e_100, tn_e, cp, timing];
}
