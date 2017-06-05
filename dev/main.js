/*
CLIENT-SIDE TEST CODE

This code is written very linearly and has some duplicates.
If you find some parts are too cryptic or hacky, feel free
to fix it and make a pull request.
*/
// Global variables
var _POS = '',		// sitting / standing
_PC_ID = '',			// computer identifier
time = ${TIME} - 1,	// series time left
currentseries = 0,	// current series index
block,				// block events for test
tickID,				// ID of test timer
index,				// index in series
targets,			// target numbers for series
row,				// current row values
correct,			// correct current row values
consecutives = 0,	// consecutive correct exercises
totals = 0,			// Total practice rounds
ex_canvas,			// exercise canvas
ex_ctx,				// exercise context
test_canvas,		// test canvas
test_ctx,			// test context
data = {results: {}},// Holds json to be submitted on complete
rowtime,			// holds time when current row started.
begin = false;		// have we sent a pushBegin?

// For testing; quickly switch to frame
$(document).ready(function() {
	$('select').material_select();
	_setup(); // Create event listeners
	if (location.hash != "") {
		switchTo(location.hash)
	}
});

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function switchTo(divId) {
	$('.content.active').toggleClass('active');
	$(divId).toggleClass('active');
	switch (divId) {
		case "#uform":
		$("#uform_form")[0].reset();
		$("label[for=age]").removeClass("active");
		pushBegin();
		case '#explanation':
		example();
		break;
		case "#exercise":
		exercise();
		break;
		case "#test":
		nextSeries();
		break;
		case "#thanks":
		setTimeout(function() {
			$("#thanksmenu").css({
				visibility: "visible",
				opacity: "1"
			})},1500);
		break;
		case "#postthanks":
		setTimeout(function() {switchTo("#ustart");}, 5000);
		break;
	}
    //TODO: Implement ifdefs in preprocessor
    //
    //Sets warning notification when not configured properly
    //NOTE: Consider activating on release
    /*
    if (_POS == '') {
    	$('#notifier').css("visibility", "visible");
    	$('#container').css("display", "none");
    }*/
}

// Called by #loadup
function saveSetup(position) {
	_PC_ID = $("#PC_ID").val();
	if (_PC_ID.length <= 2) {
		$("#loadup_checkinput").css("visibility", "visible");
		return;
	}
	$("#loadup_checkinput").css("visibility", "hidden");
	_POS = position;
	switchTo('#ustart');
}

// Called by #uform
function submitUDetails() {
	if (!_checkUDetails()) {
		// Faulty data
		$("#checkdata").css("visibility", "visible");
		return;
	}
	$("#checkdata").css("visibility", "hidden");
	data.sex = $("input[name=sex]:checked").attr('id') === "male"; // true if male, false if female. This is sexist, I know.
	data.age = parseInt($("#age").val());
	data.coffee = $("#coffee").is(":checked");
	data.sugar = $("#sugar").is(":checked");
	switchTo("#explanation");
}

function _checkUDetails() {
	if ($("input[name=sex]:checked").attr('id') === undefined)
		return false;
	var age = $("#age").val();// As of jQuery 3.0, if no options are selected, it returns an empty array; prior to jQuery 3.0, it returns null.
	if (age === null || !$.isNumeric(age) || Math.floor(parseInt(age)) != parseInt(age))
		return false;
	return true;
}

// Generates a set of target numbers for 8 rows
function generateTargetNumbers() {
	var targets;
	(targets = []).length = 7;
	var rn = getRandomInt(-2, 2);
    targets[0] = 8 + rn; //1,2	= 4 + 4
    targets[1] = 8 - rn; //3,4	= 4 + 4 
    targets[2] = 6; //5,6	= 2 + 4
    rn = getRandomInt(-1, 1);
    targets[3] = 5 + 4 + rn; //7,8	= 5 + 4
    targets[4] = 4 - rn; //9,10	= 4 + 4
    rn = getRandomInt(-1, 1);
    targets[4] += 4 + rn;
    targets[5] = 4 - rn + 2; //11,12 = 4 + 2
    targets[6] = 9; //13,14 = 4 + 5
    return targets;
}


// Generates a row from a target number
function createRow(targetN) {
	var row = [],
	correct = [],
	i = 0;
    //0x(marked)(ntop)(nbot)(0|1; 1=d, 0=p)
    /*
    How to decode val:
     - marked	= val >> 3*4;
     - ntop 	= (val >> 2*4) & (0x0F);
     - nbot 	= (val >> 1*4) & (0x00F);
     - chr		= val & (0x000F);
     */
    while (i < 18) { //pre-ES6 way to init array with 0 (IE11 has no ES6 Prototypes)
    	var ntop = 2,
    	nbot = 0,
    	chr = 1;
    	while (ntop + nbot == 2 && chr == 1) {
    		ntop = getRandomInt(0, 2);
    		nbot = getRandomInt(0, 2);
    		chr = getRandomInt(0, 1);
    	}
    	correct[i] = false;
    	row[i++] = parseInt("0x0" + ntop.toString() + nbot.toString() + chr.toString());
    }
    i = 0;
    while (i < targetN) {
    	correct[i] = true;
    	switch (getRandomInt(0, 2)) {
    		case 0:
    		row[i++] = 0x0021;
    		break;
    		case 1:
    		row[i++] = 0x0111;
    		break;
    		case 2:
    		row[i++] = 0x0201;
    		break;
    	}
    }
    var j, x, c;
    for (i = row.length; i; i--) { // Shuffle array
    	j = Math.floor(Math.random() * i);
    	x = row[i - 1];
    	c = correct[i - 1];
    	row[i - 1] = row[j];
    	correct[i - 1] = correct[j];
    	row[j] = x;
    	correct[j] = c;
    }
    return [row, correct];
}


// Draws a row on the specified canvas
function drawRow(ctx, row) {
	ctx.clearRect(0, 0, 464, 58);
	ctx.font = "24px Arial";
	var x = 4,
	chr, ntop, nbot, marked;
	ctx.beginPath();
	for (i = 0; i < row.length; i++) {
		marked = row[i] >> 3 * 4;
		ntop = (row[i] >> 2 * 4) & 0x0F;
		nbot = (row[i] >> 1 * 4) & 0x00F;
		chr = ((row[i] & 0x000F) ? 'd' : 'p');
		ctx.fillText(chr, x, 34);
		if (ntop == 1) {
			ctx.moveTo(x + 6, 13);
			ctx.lineTo(x + 6, 5);
		} else if (ntop == 2) {
			ctx.moveTo(x + 5, 13);
			ctx.lineTo(x + 5, 5);
			ctx.moveTo(x + 8, 13);
			ctx.lineTo(x + 8, 5);
		}
		if (nbot == 1) {
			ctx.moveTo(x + 6, 42);
			ctx.lineTo(x + 6, 50);
		} else if (nbot == 2) {
			ctx.moveTo(x + 5, 42);
			ctx.lineTo(x + 5, 50);
			ctx.moveTo(x + 8, 42);
			ctx.lineTo(x + 8, 50);
		}
		if (marked) {
			ctx.moveTo(x - 2.5, 40);
			ctx.lineTo(x + 16.5, 12)
		}
		x += 26;
	}
	ctx.stroke();
}

// Draws a static example series to the example canvas
function example() {
	var row = [272, 4609, 545, 4369, 4129, 545, 4369, 289, 4369, 16, 545, 272, 16, 528, 4129, 289, 4609, 545];
	var ctx = $('#canv_example')[0].getContext('2d');
	drawRow(ctx, row);
}

// Exercise init
function exercise() {
	index = 0;
	targets = generateTargetNumbers();
	row = createRow(targets[index++]);
	correct = row[1];
	row = row[0];
	drawRow(ex_ctx, row);
}

// The actual test; initialise next series
function nextSeries() {
    // Welcome to hell!
    // If you are editing this, look, I'm sorry.
    // I did not expect you to come here.
    // What are you doing in this barren wasteland anyway?
    // Well, I guess if you've made it this far, you've grown
    // to understand my ugly code.
    // But since this is (probably) the worst part,
    // feel free to ask me for help:
    // henrik@laxhuber.com
    //
    // Note to future self:
    // This message does not apply to you. Enjoy hell.
    if (currentseries >= ${SERIES}) {
        // we are done! Whoohoo!
        clearTimeout(tickID);
        switchTo("#thanks");
        return;
    }
    index = 0;
    time = ${TIME} - 1;
    $("#timeleft").html("Verbleibende Zeit für Serie: ${TIME} Sekunden.");
    currentseries += 1;
    block = false;
    data.results[currentseries] = {};
    $("#totalprogress").html("Serie " + currentseries + "/${SERIES}");
    var splash = $("#test_splash");
    var test_determinate = $("#test_determinate");
    splash.css({
    	height: "auto",
    	position: "static",
    	visibility: "visible"
    });
    $("#test_actual").css("visibility", "hidden");
    test_determinate.removeClass("doTransition");
    setTimeout(function() {
    	splash.css("opacity", "0");
    	setTimeout(function() {
    		splash.css("opacity", ".7");
    		splash.html("3");
    		setTimeout(function() {
    			splash.html("2");
    			setTimeout(function() {
    				splash.html("1");
    				setTimeout(function() {
    					splash.css({
    						height: "0",
    						position: "fixed",
    						visibility: "hidden"
    					});
    					splash.html("Nächste Serie");
    					targets = generateTargetNumbers();
    					nextRow(test_ctx);
    					$("#test_actual").css("visibility", "visible");
    					test_determinate.addClass("doTransition");
    					tickID = setTimeout(testTick, 1000);
    				}, 1000);
    			}, 1000);
    		}, 1000);
    	}, 200);
    }, 1000);
}

// The actual test; timer. Remember to disable when switching series
// by calling clearTimeout(tickID);
function testTick() {
	if (time) {
		time -= 1;
		$("#timeleft").html("Verbleibende Zeit für Serie: " + (time + 1) + " Sekunden.");
		tickID = setTimeout(testTick, 1000);
	} else {
		block = true;
		evaluateRow();
		$("#timeleft").html("Die Zeit ist abgelaufen.");
		test_ctx.clearRect(0, 0, 464, 60);
		test_ctx.fillText("Die Zeit ist abgelaufen.", 5, 34);
		setTimeout(function() {
			targets = generateTargetNumbers();
			nextSeries();
		}, 600);
	}
}

// Set global vars to new row
function nextRow(ctx) {
	row = createRow(targets[index++]);
	$("#rowprogress").html("Reihe " + index + "/7");
	correct = row[1];
	row = row[0];
	drawRow(ctx, row);
	rowtime = Date.now();
}

// Sets event listeners
function _setup() {
	//
	// EXERCISE
	//
	// TODO: Smarter algorithm to determine when done
	ex_canvas = $('#canv_exercise');
	ex_ctx = ex_canvas[0].getContext('2d');

	ex_canvas.mousemove(function(event) {
		ex_ctx.clearRect(0, 58, 464, 2);
		ex_ctx.fillStyle = '#ff3399';
		ex_ctx.fillRect(26 * Math.floor((event.clientX - ex_canvas.offset().left) / 26) - 3, 59, 26, 1);
		ex_ctx.fillStyle = '#000000';
	        //ex_ctx.fillRect(event.clientX, 59, 26, 1);
	    });
	ex_canvas.click(function(event) {
		var i = Math.floor((event.clientX - ex_canvas.offset().left) / 26);
		if (row[i] >> 12)
			row[i] = row[i] & 0x0FFF;
		else
			row[i] = row[i] | 0xF000;
		drawRow(ex_ctx, row);
	        //ex_ctx.fillRect(event.clientX, 59, 26, 1);
	    });
	ex_canvas.mouseleave(function() {
		ex_ctx.clearRect(0, 58, 464, 2);
	});


	$("#ex_next").click(function(event) {
		var broken = 0;
		ex_ctx.strokeStyle = '#ff3399';
		for (i = 0; i < row.length; i++) {
			if ((row[i] >> 12 > true) != correct[i]) {
				broken += 1;
				ex_ctx.beginPath();
				ex_ctx.arc(i * 26 + 10.5, 26.5, 15, 0, 2 * Math.PI);
				ex_ctx.stroke();
				$('#ex_correct_errors').css("visibility", "visible");
			}
		}
		ex_ctx.strokeStyle = '#000000';
		totals += 1;
		if (totals >= 4 && broken > 1) {
			// This user needs some help!
			needHelp("User is having trouble with practice rounds (count: " + totals + ")", false);
		}
		if (broken > 1) {
			consecutives = -1;
			return true;
		} else if (broken == 1) {
			consecutives = 0;
			return true;
		}
		$('#ex_correct_errors').css("visibility", "hidden");
		consecutives += 1;
		if (consecutives >= 2)
			switchTo("#test");
		if (index >= 7) {
			index = 0;
			targets = generateTargetNumbers();
		}
		row = createRow(targets[index++]);
		correct = row[1];
		row = row[0];
		drawRow(ex_ctx, row);
	});


	//
	// TEST
	//
	test_canvas = $('#canv_test');
	test_ctx = test_canvas[0].getContext('2d');

	test_canvas.mousemove(function(event) {
		if (block)
			return;
		test_ctx.clearRect(0, 58, 464, 2);
		test_ctx.fillStyle = '#ff3399';
		test_ctx.fillRect(26 * Math.floor((event.clientX - test_canvas.offset().left) / 26) - 3, 59, 26, 1);
		test_ctx.fillStyle = '#000000';
	        //test_ctx.fillRect(event.clientX, 59, 26, 1);
	    });
	test_canvas.click(function(event) {
		if (block)
			return;
		var i = Math.floor((event.clientX - test_canvas.offset().left) / 26);
		if (row[i] >> 12)
			row[i] = row[i] & 0x0FFF;
		else
			row[i] = row[i] | 0xF000;
		drawRow(test_ctx, row);
	        //test_ctx.fillRect(event.clientX, 59, 26, 1);
	    });
	test_canvas.mouseleave(function() {
		test_ctx.clearRect(0, 58, 464, 2);
	});

	$("#test_next").click(function(event) {
		if (block)
			return;
		evaluateRow();
		if (index >= 7) {
			index = 0;
			targets = generateTargetNumbers();
			clearTimeout(tickID);
			nextSeries();
			return;
		}
		nextRow(test_ctx); // here index is set to point to new row
	});
}

/*
How to decode val:
- marked	= val >> 3*4;
- ntop 	= (val >> 2*4) & (0x0F);
- nbot 	= (val >> 1*4) & (0x00F);
- chr		= val & (0x000F);
*/
function evaluateRow() {
	//FIXME: This code is extremely ugly
	data.results[currentseries][index - 1] = {time: Date.now() - rowtime};
 	var rowres1 = {};
 	rowres1.n = 0;
 	rowres1.e1 = 0;
 	rowres1.e2l = 0;
 	rowres1.e2d = 0;
 	var rowres2 = {};
	rowres2.n = 0;
 	rowres2.e1 = 0;
 	rowres2.e2l = 0;
 	rowres2.e2d = 0;
 	// Ugly duplicates to split in half to fit Brickenkamp normals
 	// First half (First 9)
 	for (i = 0; i < row.length / 2; i++) {
 		var marked = row[i] >> 12 > true;
 		if (marked)
 			rowres1.n += 1;
 		if (marked != correct[i]) {
			// Evaluate error type
			if (!marked && correct[i]) {
				rowres1.e1 += 1;
			}
			else {
				if ((row[i] & 0x000F) == 0)
					rowres1.e2l += 1;
				if ((((row[i] >> 2*4) & (0x0F)) + ((row[i] >> 1*4) & (0x00F))) != 2)
					rowres1.e2d += 1;
			}
		}
	}
	data.results[currentseries][index - 1][0] = rowres1;
	// Second half (Second 9)
	for (i = row.length / 2; i < row.length; i++) {
 		var marked = row[i] >> 12 > true;
 		if (marked)
 			rowres2.n += 1;
 		if (marked != correct[i]) {
			// Evaluate error type
			if (!marked && correct[i]) {
				rowres2.e1 += 1;
			}
			else {
				if ((row[i] & 0x000F) == 0)
					rowres2.e2l += 1;
				if ((((row[i] >> 2*4) & (0x0F)) + ((row[i] >> 1*4) & (0x00F))) != 2)
					rowres2.e2d += 1;
			}
		}
	}
	data.results[currentseries][index - 1][1] = rowres2;
}

// TODO: Submit results
function submit(doneThatBefore) {
	$('html,body').css('cursor','wait');
	pushQuit();
	data.position = _POS;
	data.pc_id = _PC_ID;
	data.doneThatBefore = doneThatBefore;
	var _data = JSON.stringify(data);
	$.ajax({
		type: "PUT",
		url: "/submit",
		contentType: "application/json",
		data: _data
	}).done(function() {
		data = {results:{}};
		time = ${TIME} - 1;
		consecutives = 0;
		totals = 0;
		currentseries = 0;
		$("#test_splash").html("Es geht los!");
		block = false;
		$('html,body').css('cursor','');
		switchTo("#postthanks");
	}).fail(function() {
		$('html,body').css('cursor','');
		alert("Ein Fehler ist aufgetreten. Bitte melde dich bei mir.");
		console.log(_data);
	});
}

function needHelp(details, active, title) {
	title = typeof title !== 'undefined' ? title : "Help user " + _PC_ID;
	if (active)
		$('html,body').css('cursor','wait');
	$.ajax({
		type: "POST",
		url: "/help",
		contentType: "application/json",
		data: JSON.stringify({"pc_id": _PC_ID, "details": details, "title": title})
	}).done(function() {
		$('html,body').css('cursor','');
	}).fail(function() {
		$('html,body').css('cursor','');
		if (active)
			alert("Ein Fehler ist aufgetreten - melde dich doch direkt bei mir.");
		else
			console.log("Error requesting help.");
	});
}

function pushBegin() {
	begin = true;
	$.ajax({
		type: "POST",
		url: "/pushStatus",
		contentType: "application/json",
		data: JSON.stringify({"type": "begin", "position": _POS})
	})
}

function pushQuit() {
	needHelp("User is trying to leave page.", false, "User " + _PC_ID + " leaves page!");
	var msg = "Bitte nicht... sonst werde ich böse!";
	if (!begin)
		return msg;
	begin = false;
	$.ajax({
		type: "POST",
		url: "/pushStatus",
		contentType: "application/json",
		data: JSON.stringify({"type": "end", "position": _POS})
	});
	return msg;
}

window.onbeforeunload = pushQuit; // page refresh etc
$(window).unload(pushQuit); // tab/browser quit (doesn't always work...)