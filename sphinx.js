var _ = require('underscore'),
    util  = require('util'),
    spawn = require('child_process').spawn,
    sphinx;

//Launches sphinx, wires up listeners, and waits on the python script to
//respond with recognized speech
var launch = function(ready_callback, command_callback, err_callback) {
    sphinx = spawn('python',['sphinx/sphinx.py']);

    sphinx.stdout.on('data', function (data) {
	    data = data.toString();

		console.log(data);

		//### TODO - This isn't working yet, how can we make it notify us when ready?
    	if (data.match(/^READY*/) || data.match(/^Listening*/)) {
	    	console.log('STATUS: ' + data);
			ready_callback();
    	}
	    var recognized_match = /^>>>(.*)/;
    	var matched = data.match(recognized_match) 
	    if (matched && matched[1]) {
            command_callback(matched[1].toString());
//			sphinx.kill();
    	}
    });

    sphinx.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
    });

    sphinx.on('exit', function (code) {
        console.log('python pocketsphinx child process exited with code ' + code);
    });
}
module.exports.launch = launch;

var dispose = function() {
    sphinx.kill();
}
module.exports.dispose = dispose;
