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
const port = 33333;

var db = new sqlite3.Database(__dirname + '/data.db');
var stmt;
db.serialize(() => {
	db.run(["CREATE TABLE IF NOT EXISTS received (",
		"MALE BOOLEAN NOT NULL,",
		"AGE INTEGER NOT NULL,",
		"COFFEE BOOLEAN NOT NULL,",
		"SUGAR BOOLEAN NOT NULL,",
		"EXPERIENCED BOOLEAN NOT NULL,",
		"SEATED BOOLEAN NOT NULL,",
		"RESULTS TEXT NOT NULL)"].join('\n')); // hacky multiline string to avoid whitespace issue with backslashes
	stmt = db.prepare('INSERT INTO received VALUES (?, ?, ?, ?, ?, ?, ?)');
});

app.use(morgan('common')); // logger middleware
app.use(bodyParser.json());// parse json for submit

app.use(express.static(path.join(__dirname, 'public')));//serve static content

app.put('/:submit', (req, res) => {
	// Prevent injection
	var re = /;|'|_|%|[A-Z]/g;
	var strRestult = JSON.stringify(req.body.results);
	if (!(Type.is(req.body.sex, "Boolean") && Type.is(req.body.age, "Number") && 
		Type.is(req.body.coffee, "Boolean") && Type.is(req.body.sugar, "Boolean") &&
		Type.is(req.body.doneThatBefore, "Boolean") && Type.is(req.body.position, "String") &&
		Type.is(req.body.results, "Object") && Type.is(strRestult, "String")) ||
		re.test(req.body.position) || re.test(strRestult))
	{		
		console.error("Faulty data!");
		console.log(JSON.stringify(req.body));
		res.sendStatus(400);
		return;
	}
	stmt.run(req.body.sex, req.body.age, req.body.coffee, req.body.sugar,
		req.body.doneThatBefore, req.body.position == "sitting", strRestult, (err) => {
			if (err) {
				console.error("Error during sqlite write:\n" + error.message);
				res.sendStatus(500);
			} else {
				res.sendStatus(200);
			}
		});
})

app.listen(port, (err) => {  
	if (err)
		return console.log('something bad happened', err);

	console.log(`server is listening on ${port}`);
})