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
const port = 33333;

var db = new sqlite3.Database(__dirname + '/data.db');
var stmt;
var stmt_proc;
db.serialize(() => {
	db.run(["CREATE TABLE IF NOT EXISTS received (",
		"DATE TEXT NOT NULL,",//UTC
		"PC_ID TEXT NOT NULL,",
		"MALE BOOLEAN NOT NULL,",
		"AGE INTEGER NOT NULL,",
		"COFFEE BOOLEAN NOT NULL,",
		"SUGAR BOOLEAN NOT NULL,",
		"EXPERIENCED BOOLEAN NOT NULL,",
		"SEATED BOOLEAN NOT NULL,",
		"RESULTS TEXT NOT NULL)"].join('')); // hacky multiline string to avoid whitespace issue with backslashes
	stmt = db.prepare('INSERT INTO received VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
	db.run(["CREATE TABLE IF NOT EXISTS processed (",
		"DATE TEXT NOT NULL,",//UTC
		"PC_ID TEXT NOT NULL,",
		"MALE BOOLEAN NOT NULL,",
		"AGE INTEGER NOT NULL,",
		"COFFEE BOOLEAN NOT NULL,",
		"SUGAR BOOLEAN NOT NULL,",
		"EXPERIENCED BOOLEAN NOT NULL,",
		"SEATED BOOLEAN NOT NULL,",
		"TN INTEGER NOT NULL,",
		"FL INTEGER NOT NULL,",
		"E1 INTEGER NOT NULL,",
		"E2l INTEGER NOT NULL,",
		"E2d INTEGER NOT NULL,",
		"E INTEGER NOT NULL,",
		"E_100 INTEGER NOT NULL,",
		"TN_E INTEGER NOT NULL,",
		"CP INTEGER NOT NULL,",
		"TIMING TEXT NOT NULL)"].join('')); // hacky multiline string to avoid whitespace issue with backslashes
	stmt_proc = db.prepare('INSERT INTO processed VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
});

var usersInProgress = {"sitting": 0, "standing": 0, "ids": {}};
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
		&& Type.is(req.body.position, "String") && Type.is(req.body.results, "Object") &&
		Type.is(strRestult, "String")) ||
		re.test(req.body.position) || re.test(strRestult) || re.test(req.body.pc_id))
	{		
		console.error("Faulty data!");
		console.log(JSON.stringify(req.body));
		res.sendStatus(400);
		return;
	}
	var date = new Date().toISOString();
	stmt.run(date, req.body.pc_id, req.body.sex, req.body.age, req.body.coffee, req.body.sugar,
		req.body.doneThatBefore, req.body.position == "sitting", strRestult, (err) => {
			if (err) {
				console.error("Error during sqlite write:\n" + err.message);
				res.sendStatus(500);
				return;
			}
			res.sendStatus(200);
		});
	processed = processData(req.body.results);
	stmt_proc.run(date, req.body.pc_id, req.body.sex, req.body.age, req.body.coffee, req.body.sugar,
		req.body.doneThatBefore, req.body.position == "sitting", processed[0], processed[1],
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
	if (!(Type.is(req.body.type, "String") && Type.is(req.body.position, "String"))
		|| re.test(req.body.type) || re.test(req.body.position)) {
		console.error("Faulty data!");
	res.sendStatus(400);
	return;
}
switch(req.body.type) {
	case "begin":
	usersInProgress[req.body.position] += 1;
	break;
	case "end":
	usersInProgress[req.body.position] -= 1;
	break;
	default:
	console.log("WARNING: Got pushStatus request of invalid type.");
}
res.sendStatus(200);
});

app.get('/stats', (req, res) => {
	var doneSit, doneStand, sit = {tn: 0, e100: 0, fl: 0, cp: 0}, stand = {tn: 0, e100: 0, fl: 0, cp: 0};
	db.serialize(() => {
		db.all("SELECT TN,E_100,FL,CP FROM processed WHERE SEATED=1", (err,rows) => {
			rows.forEach((row) => {
				sit.tn += parseInt(row["TN"]);
				sit.e100 += parseInt(row["E_100"]);
				sit.fl += parseInt(row["FL"]);
				sit.cp += parseInt(row["CP"]);
			});
			for (prop in sit) {
				sit[prop] = sit[prop] / rows.length;
			}
		}).all("SELECT TN,E_100,FL,CP FROM processed WHERE SEATED=0", (err,rows) => {
			rows.forEach((row) => {
				stand.tn += parseInt(row["TN"]);
				stand.e100 += parseInt(row["E_100"]);
				stand.fl += parseInt(row["FL"]);
				stand.cp += parseInt(row["CP"]);
			});
			for (prop in stand) {
				stand[prop] = stand[prop] / rows.length;
			}
		}).get("SELECT COUNT(SEATED) FROM received WHERE SEATED=1", (err, row) => {
			doneSit = row["COUNT(SEATED)"];
		}).get("SELECT COUNT(SEATED) FROM received WHERE SEATED=0", (err, row) => {
				doneStand = row["COUNT(SEATED)"];
				data = {"comp_seated": doneSit, "comp_stood": doneStand,
				"prog_seated": usersInProgress.sitting, "prog_stood": usersInProgress.standing,
				"tot_seated": usersInProgress.sitting + doneSit, "tot_stood": usersInProgress.standing + doneStand,
				"tot_tot": usersInProgress.sitting + doneSit +usersInProgress.standing + doneStand, 
				"sit_tn": sit.tn, "sit_e100": sit.e100, "sit_fl": sit.fl, "sit_cp": sit.cp,
				"std_tn": stand.tn, "std_e100": stand.e100, "std_fl": stand.fl, "std_cp": stand.cp,
			};

				res.send(statsTemplate(data));
		});
	});
});

app.listen(port, (err) => {  
	if (err)
		return console.log('something bad happened', err);

	console.log(`server is listening on ${port}`);
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