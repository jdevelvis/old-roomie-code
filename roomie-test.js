/***********************************************
Todo: 
- Loop to wait to download SSL certificate
- Remove random time addition to UUID/udn once we figure out what that is
- Process for reconnecting when the steward goes down 
	- 1/2 works now, needs bug hunting
		- Looks like Pocketsphinx still sends commands, and the script tries to send via ws, but blows up because the ws is closed

***********************************************/

var ThingAPI = require('thing-client'),
	exec = require('child_process').exec,
	spawn = require('child_process').spawn,
	fs = require('fs'),
	isEmpty = require('underscore').isEmpty,
	url = require('url'),
	audio = require('./audio')
  ;

var db_file = "roomie-stp.db";
var config = {};
var stpThing = "begin", thingID = '';

/*
 	thing-client code, modified from test.js in the thing-client package

   	get a copy of server.crt from your steward, it's the file

       steward/steward/sandbox/server.crt

   	also known as

       http://steward.local/server.crt
*/


var deviceType = '/device/sensor/ehma/roomie';

var protothing = {};
    protothing[deviceType] = 
{ device                         :
  { name                         : 'EHMA Roomie'
  , maker                        : 'Jade Automation, LLC'
  }
, observe                        : [ ]
, perform                        : [ 'speak','play_sound' ]
, name                           : true
, status                         : [ 'ready', 'standby', 'busy' ]
, properties                     :
  {
    command                      : 'text'
  }
, validate                       : 
  { observe                      : false
  , perform                      : true
  }
};


// the udn must be both globally-unique and specific to the thing being registered.
//   cf., https://github.com/TheThingSystem/steward/wiki/Simple-Thing-Protocol#define-instances
// since this is a test file, we are going to use a static value, when you write your code, you MUST use something meaningfully
// related to the thing in question...

//var udn = '5eb160e4-e770-4e97-b8ef-dd89aa0a80ed2';

var instathing = {};
    instathing.t1 =
{ devicetype                     : deviceType
, name                           : 'EHMA Roomie'
, status                         : 'standby'
, device                         :
  { name                         : protothing[deviceType].device.name
  , maker                        : protothing[deviceType].device.maker
/*  , model                        :
    { name                       : 'Roomie'
    , descr                      : 'EHMA Roomie v1'
    , number                     : '1.0'
    }
*/
  , unit                         :
    { serial                     : '...'
    , udn                        : '123'
    }
  }
, updated                        : new Date().getTime()
, info                           :
  { command                      : ''
  }
};

var init = exports.init = function(callback) {
    var self = this;
	//Get the SSL Cert
	if (!fs.existsSync('./certs/server.crt')) download_certificate();
	getConfig(function() { console.log('using config: ' + JSON.stringify(config)); connect(callback); });
}

var connect = exports.connect = function(callback) {
	var self = this;

	//console.log('state: ' + JSON.stringify(config));
	if (isEmpty(config['state'])) config['state'] = null;

	console.log('Creating Thing with: ' + JSON.stringify(config,null,4));

/* Is this code necessary? I had added it due to registration UDN errors, but I'm not getting them now
	var thingJSON = { steward : { } //name: 'steward.local' }
	    , pairing : { thingUUID : 'EHMARoomie' + config['id'] }//config['uuid'] }
	    , state   : config['state']
    }
	//Now check to see if we've already paired. If so, kill the pairing data to keep from confusing the steward
	if (!isEmpty(thingJSON['state'])) delete thingJSON['pairing'];

	console.log('Sending thingJSON: ' + JSON.stringify(thingJSON,null,4));
*/
	new ThingAPI.ThingAPI(
	{ steward : { } //name: 'steward.local' }
	, pairing : { thingUUID : 'EHMARoomie' + config['id'] }//config['uuid'] }
	, state   : config['state']
	}).on('paired', function(state) {
  		console.log('paired state='+ JSON.stringify(state));
		console.log('In pair function: ' + JSON.stringify(config));

		// when you get the value of state, then put it above and comment out 'pairing'
		config['state'] = state;
		saveConfig();
	
	}).on('ready', function() {
		var self = this;

		console.log("Sending prototype message: " + JSON.stringify(protothing,null,4));
		self.prototype(protothing, function(message) {
    		if ((!message.things) || (!message.things[deviceType])) {
	    		console.log('definition: invalid response');
    			process.exit(1);
		    }
    		if (!message.things[deviceType].success) {
	    		console.log('definition: ' + JSON.stringify(message.things[deviceType]));
	    		process.exit(1);
		    }

			instathing.t1.device.unit.udn = config['uuid'];

			console.log("Sending registration message: " + JSON.stringify(instathing,null,4));
	    	self.register(instathing, function(message) {
		    	console.log(require('util').inspect(message, { depth: null }));

	    		if ((!message.things) || (!message.things.t1)) {
		        	console.log('registration: invalid response');
	        		process.exit(1);
				}
		    	if (!message.things.t1.success) {
    	    		console.log('registration: ' + JSON.stringify(message.things.t1));
        			process.exit(1);
	      		}

				console.log("Ready...");
				console.log("Thing ID: " + config.state.thingID);

				if (callback) callback("Ready");
				thingID = message.things.t1.thingID;

				console.log("STP Thing Data: " + stpThing);
				stpThing = self;
				console.log("STP Thing Data: " + stpThing);
//      		getToWork(self, message.things.t1.thingID);

				//Set up the heartbeat to keep the Roomie from going inactive on the Steward
		  		setInterval(function() {
					sendCommand('');
				}, 50 * 1000);
	    	});
		});
	}).on('message', function(message) {
		console.log(require('util').inspect(message, { depth: null }));
	}).on('close', function() {
		console.log('Session closed. Attempting to reconnect...');
		// lost connection, re-establish it...
		setTimeout(function() { connect(callback) } , 1000);

		//process.exit(0);
	}).on('error', function(err) {
		console.log('error: ' + err.message);
		switch (err.message) {
			case "duplicate name":
			case "duplicate uuid":
				config['id']++;
				saveConfig();
				break;
		}
		//wait a second, then try to connect again
		setTimeout(function() { connect(callback) } , 1000);

		// something is seriously wrong, not sure how to recover...
//		process.exit(0);
	});
}

//var command   = instathing.t1.info.command;
var observe   = {};

/***
Send the command to the Steward
***/
var sendCommand = exports.sendCommand = function(command, callback) {
	var status = {};

	if (command == '') {
    	status[thingID] = { updated: new Date().getTime() };
	} else {
	    status[thingID] = { status: 'ready', updated: new Date().getTime(), info: { command: command } };
	}
    stpThing.update(status);
/*
    thing.report(events, function(message) {
      var eventID;

      if (!message.events) return;
      for (eventID in message.events) if (message.events.hasOwnProperty(eventID)) {
        if (message.events[eventID].status === 'success') delete(observe[eventID]);
      }      
    });
*/
  stpThing.on('message', function(message) {
    var f = { '/api/v1/thing/observe':
                function() {
                  var event, eventID, response;

                  response = { path: '/api/v1/thing/report', requestID: message.requestID, events: {} };

                  for (eventID in message.events) if (message.events.hasOwnProperty(eventID)) {
                    event = message.events[eventID];

                    if (event.observe !== 'motion') {
                      response.events[eventID] = { error: { permanent: true, diagnostic: 'invalid observe value' }};
                      continue;
                    }
                    if (!event.testOnly) observe[eventID] = event;
                    response.events[eventID] = { success: true };
                  }

                  stpThing.reply(response);
                }

            , '/api/v1/thing/report':
                function() {
                  var event, eventID, response;

                  response = { path: '/api/v1/thing/report', requestID: message.requestID, events: {} };

                  for (eventID in message.events) if (message.events.hasOwnProperty(eventID)) {
                    event = message.events[eventID];

                    if (event.reason !== 'cancel') {
                      response.events[eventID] = { error: { permanent: true, diagnostic: 'invalid reason' }};
                      continue;
                    }
                    if (!!observe[eventID]) {
                      response.events[eventID] = { error: { permanent: true, diagnostic: 'invalid eventID' }};
                      continue;
                    }
                    delete(observe[eventID]);
                    response.events[eventID] = { success: true };
                  }

                  stpThing.reply(response);
                }

            , '/api/v1/thing/perform':
                function() {
                  var task, taskID, response;

                  response = { path: '/api/v1/thing/report', requestID: message.requestID, tasks: {} };

                  for (taskID in message.tasks) if (message.tasks.hasOwnProperty(taskID)) {
                    task = message.tasks[taskID];

                    if (task.perform == 'speak') {
	                    console.log('>>> speaking: ' + task.parameter);
						audio.speak(task.parameter[0]);
						response.tasks[taskID] = { success: true };
						continue;
                    } else if (task.perform == 'play_sound') {
						console.log('>>>> playing sound: ' + task.parameter);
						switch (task.parameter) {
							case 'accept':
								audio.accept();
								response.tasks[taskID] = { success: true };
								break;
							case 'deny':
								audio.deny();
								response.tasks[taskID] = { success: true };
								break;
							case 'error':
								audio.error();
								response.tasks[taskID] = { success: true };
								break;
							default:
								break;
						}
						continue;
					} else if (task.perform !== 'speak' && task.perform !== 'play_sound') {
                      response.tasks[taskID] = { error: { permanent: true, diagnostic: 'invalid perform value' }};
                      continue;
                    }
                    if ((!task.parameter) || (typeof task.parameter !== 'string') || (task.parameter.length === 0)) {
                      response.tasks[taskID] = { error: { permanent: true, diagnostic: 'invalid parameter value' }};
                      continue;
                    }
                    if (task.testOnly) {
                      response.tasks[taskID] = { success: true };
                      continue;
                    }
                  }

                  stpThing.reply(response);
                }
            }[message.path];
    if (!f) return console.log ('invalid message: ' + JSON.stringify(message));
    f(stpThing, thingID, message);    
  });
}

var download_certificate = function(callback) {
	console.log('in download_certificate');
	setTimeout(function() {console.log('timed out')},5000);
    //Make sure the certs directory exists. If not, create it
    var mkdir = 'mkdir -p ./certs/';
    var child = exec(mkdir, function(err, stdout, stderr) {
   		if (err) {
			console.log('error creating directory');
			throw err;
		}
	    else {
			console.log("certs directory exists, downloading .crt");
		    // compose the wget command
		    var wget = 'wget -P ./certs/ http://steward.local:8887/server.crt';
		    // excute wget using child_process' exec function

		    var child = exec(wget, function(err, stdout, stderr) {
		        if (err) {
					console.log('error downloading certificate');
					throw err;
				}
		        else {
					console.log('certificate received successfully!');
					if (callback) callback();
				}
			});
		}
    });
}

var saveConfig = exports.saveConfig = function () {
    //Create or overwrite the config file
    //### Add a try/catch block here to catch any file write errors
    console.log("Saving: " + JSON.stringify(config,null,4));
    fs.writeFileSync(db_file,JSON.stringify(config),'utf8');
}

var getConfig = exports.getConfig = function (callback) {
	var self = this;
	var ret = false;

	//Check if it's in the database first
	if (fs.existsSync(db_file)) {
    	//Great! The Thing is already paired! Now authenticate
	    console.log("Database exists!");
	    var data = fs.readFileSync(db_file,'utf8')
		if (!isEmpty(data) && data != '{}') {
			console.log('data is not empty!');
       		config = JSON.parse(data);
//			config['uuid'] = 'ehmaroomie' + Date.now();
		} else {
			console.log('data is empty... create new config');
			config = null;
		}
	}
	if (isEmpty(config)) { //If the config is empty, create it
		console.log("Creating DB");
		config = {};
	    config['id'] = 1; //Start the ID count, to fix any name collisions

	    //Get the uuid from the CPU serial number
    	cat = spawn('cat',['/proc/cpuinfo']);

	    cat.stdout.on('data', function (data) {
    	    data = data.toString().trim();

        	var matched = data.match(/Serial\s*:\s(.+)/);
	        if (!isEmpty(matched) && !isEmpty(matched[1])) {
    	        //Pair then authenticate
				console.log('cpuinfo received!');
/* ========================================================== */
/*** TODO: Remove this, added random number to end of UUID to get rid of UUID Collisions ***/
            	config['uuid'] = 'ehmaroomie' + matched[1].toString();// + Date.now();
				console.log('uuid: ' + config['uuid']);
				saveConfig();
				if (callback) callback();
        	}
	    });

    	cat.stderr.on('data', function (data) {
	        console.log('stderr: ' + data);
    	});

	    cat.on('exit', function (code) {
    	    //console.log('child process (cat)  exited with code ' + code);
	    });
	} else {
   		console.log("config found! using: " + JSON.stringify(config,null,4));
		if (callback) callback();
	}
}
