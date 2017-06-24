const testdata = require("./testdata.json");
const excel = require('msexcel-builder');
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
// todo: times
var lastSeries = false, lastSequence = false;
for (var i=1; !lastSeries; i++) {
	var ser = testdata[i];
	var fl_min = Infinity, fl_max = 0;
	console.log("Processing series " + i);

	if (!testdata.hasOwnProperty(i+1))
		lastSeries = true;

	lastSequence = false;
	for (var j=0; !lastSequence; j++) {
		var sequ = ser[j];
		var keys = ["0","1"];
		console.log("     ____" + j + " sequences");
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
console.log("TN: " + tn + "\nE1: " + e1 + "\nE2l: " + e2l + "\nE2d: " + e2d + "\nE: " + e + " = " + e_100 + "%\nFL: " + fl + "\nCP: " + cp + " (@ TN-E: " + tn_e + ")\nTime: " + lastTime + "\n---------------");
console.log(JSON.stringify(timing));
workbook = excel.createWorkbook("./", "testdata.xlsx");
var sheet = workbook.createSheet("data", count + 1, 12);
// beatiful manual listing of operations. 10/10 would do again.
sheet.set(1,2,"TN");
sheet.set(1,3,"FL");
sheet.set(1,4,"E1");
sheet.set(1,5,"E2l");
sheet.set(1,6,"E2d");
sheet.set(1,7,"E");
sheet.set(1,8,"E%");
sheet.set(1,9,"TN-E");
sheet.set(1,10,"CP");
sheet.set(1,11,"last");

column = 2;
for (prop in timing) {
	if (!timing.hasOwnProperty(prop))
		continue;
	// I'm doing it again.
	sheet.set(column,1,prop);
	sheet.set(column,2,timing[prop].tn);
	sheet.set(column,3,timing[prop].fl);
	sheet.set(column,4,timing[prop].e1);
	sheet.set(column,5,timing[prop].e2l);
	sheet.set(column,6,timing[prop].e2d);
	sheet.set(column,7,timing[prop].e);
	sheet.set(column,8,timing[prop].e_100.toString().replace(".", ","));
	sheet.set(column,9,timing[prop].tn_e);
	sheet.set(column,10,timing[prop].cp);
	sheet.set(column,11,timing[prop].last);
	column ++;
}

workbook.save(function(ok){
	console.log('workbook save ' + (ok?'ok':'failed'));
});