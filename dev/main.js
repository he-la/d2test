/*
CLIENT-SIDE TEST CODE

This code is written very linearly and has some duplicates.
If you find some parts are too cryptic or hacky, feel free
to fix it and make a pull request.
*/
// Global variables
var position = '',	// sitting / standing
time = ${TIME} - 1,	// series time left
currentseries = 0,	// current series index
block,				// block events for test
tickID,				// ID of test timer
index,				// index in series
targets,			// target numbers for series
row,				// current row values
correct,			// correct current row values
consecutives = 0,	// consecutive correct exercises
ex_canvas,			// exercise canvas
ex_ctx,				// exercise context
test_canvas,		// test canvas
test_ctx,			// test context
udata = {};			// Maps user input data

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
    if (position == '') {
    	$('#notifier').css("visibility", "visible");
    	$('#container').css("display", "none");
    }*/
}

// Called by #loadup
function saveSetup(_pos) {
	position = _pos;
	switchTo('#ustart');
}

// Called by #uform
function submitUDetails() {
	if (!_checkUDetails()) {
		// Faulty data
		$("#checkdata").css("visibility", "visible");
		return;
	}
	udata.sex = $("input[name=sex]:checked").attr('id') === "male"; // true if male, false if female. This is sexist, I know.
	udata.age = parseInt($("#age").val());
	udata.coffee = $("#coffee").val() == true;
	udata.sugar = $("#sugar").val() == true;
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
		$("#timeleft").html("Die Zeit ist abgelaufen.");
		test_ctx.clearRect(0, 0, 464, 60);
		test_ctx.fillText("Die Zeit ist abgelaufen.", 5, 34);
		setTimeout(function() {
			targets = generateTargetNumbers();
			nextRow(test_ctx);
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
		var broken = false;
		ex_ctx.strokeStyle = '#ff3399';
		for (i = 0; i < row.length; i++) {
			if ((row[i] >> 12 > true) != correct[i]) {
				broken = true;
				ex_ctx.beginPath();
				ex_ctx.arc(i * 26 + 10.5, 26.5, 15, 0, 2 * Math.PI);
				ex_ctx.stroke();
				$('#ex_correct_errors').css("visibility", "visible");
			}
		}
		ex_ctx.strokeStyle = '#000000';
		if (broken) {
			consecutives = -1;
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
		for (i = 0; i < row.length; i++) {
			if ((row[i] >> 12 > true) != correct[i]) {
                // mistake at i
                // TODO: Evaluate
            }
        }
        if (index >= 7) {
        	index = 0;
        	targets = generateTargetNumbers();
        	clearTimeout(tickID);
        	nextSeries();
        }
        nextRow(test_ctx);
    });
}

// TODO: Submit results
function submit(doneThatBefore) {
	switchTo("#postthanks");
}