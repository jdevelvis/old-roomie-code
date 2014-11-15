var sphinx = require('./sphinx'),
	stp = require('./roomie-stp')
	audio = require('./audio')
;

//Initialize Pocketsphinx. Note, the sphinx code launches this as a child process
//sphinx.launch(sphinx_ready_callback,sphinx_command_callback, sphinx_error_callback);

stp.init(stp_callback);

audio.accept();
//audio.say ("testing");

function stp_callback(status) {
	//###Handle status update here - Add LED capabilities?
	console.log("STP Status Update: " + status);
	stp.sendCommand("is living in you good dim aloha");
}

function sphinx_ready_callback(data) {
	console.log("In Ready Callback");
}

function sphinx_command_callback(command) {
	if (command.indexOf('EHMA') > -1) {
		var cmd = command.split('EHMA')[1].trim();

	    console.log("Sending Command: " + cmd);
	    audio.say("Sending Command: " + cmd);

		stp.sendCommand(cmd, stp_callback);

		audio.accept();

		setTimeout(function() {stp.sendCommand(' ', stp_callback);},5000); //is 5 seconds right?
	}
}

function sphinx_error_callback(e) {
    
}

function dispose() {
	sphinx.dispose();
}
