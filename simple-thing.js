var WebSocket = require('ws'),
	speakeasy = require('speakeasy'),
	spawn = require('child_process').spawn,
	fs = require('fs'),
	isEmpty = require('underscore').isEmpty,
	ThingAPI = require('thing-client');

var db_file = "ehma-com.db";
var db_exists = fs.existsSync(db_file);

var config = {};
var pairingCode = '';

var init = exports.init = function(callback) {
	var self = this;

	//Check if it's in the database first
	if (db_exists) {
		//Great! The Thing is already paired! Now authenticate
		console.log("Database exists!");
		self.getConfig(self, function() { console.log("config: " + JSON.stringify(config,null,4)); self.authenticate(self,callback); });
	} else {
		self.config = {};
		self.config['name'] = "EHMAcom";
		self.config['basename'] = "EHMAcom";
		self.config['id'] = 1; //Start the ID count, to fix any name collisions

		//Get the uuid amd pair with the Steward
		cat = spawn('cat',['/proc/cpuinfo']);

		cat.stdout.on('data', function (data) {
    	    data = data.toString().trim();

        	var matched = data.match(/Serial\s*:\s(.+)/);
	        if (!isEmpty(matched) && !isEmpty(matched[1])) {
				//Pair then authenticate
	            self.pair('ehmacom' + matched[1].toString(),function() { self.authenticate(callback); });
   		    }
	    });

    	cat.stderr.on('data', function (data) {
        	console.log('stderr: ' + data);
	    });

	    cat.on('exit', function (code) {
    	    //console.log('child process (cat)  exited with code ' + code);
	    });
	}
}

var authenticate = exports.authenticate = function(self, callback, tries) {
	if (isNaN(tries)) tries = 0;

	console.log("Authenticating...");

	var totp = speakeasy.totp({key:config['params']['base32'],step:config['params']['step'],encoding:'base32'});

	console.log(totp);

	this.sendMessage('manage',{path:'/api/v1/thing/hello/' + config['thingID'],requestID:'100002',response:totp}, function(data) {
		//If we're receiving it here, it's either a result or an error
		console.log("data: " + JSON.stringify(data,null,4));
		if (!isEmpty(data['result'])) {
			console.log('Result!');
		} else if (!isEmpty(data['error'])) {
			console.log('Error...');
		}
	});
}

var saveConfig = exports.saveConfig = function (config_to_save) {
	//Create or overwrite the config file
	//### Add a try/catch block here to catch any file write errors
	console.log("Saving: " + JSON.stringify(config_to_save,null,4));
	fs.writeFileSync(db_file,JSON.stringify(config_to_save),'utf8');
}

var getConfig = exports.getConfig = function (self, callback) {
	console.log("config: " + JSON.stringify(config,null,4));

	fs.readFile(db_file,'utf8', function(err, data) {
		config = JSON.parse(data);
		callback();
	});
}

var pair = exports.pair = function(uuid, callback) {
	var self = this;
	self.config['uuid'] = uuid;

	console.log("Beginning pair process");
	//Get the Pairing Code from the Steward
	self.sendMessage('manage', {path:'/api/v1/actor/list',requestID:'100000',options:{depth: 'all'}}, function(data) {
		console.log("Received actor data");

		delete data['result']['actors'];

		console.log("place/1 data: " + JSON.stringify(data['result']['/place']['place/1'],null,4));

		switch (data['result']['/place']['place/1']['info']['pairing']) {
			case "on":
				self.pairingCode = '1234'; //Doesn't matter, this gets ignored anyhow
				break;
			case "code":
				self.pairingCode = data['result']['/place']['place/1']['info']['pairingCode'];
				break;
			default:
				//No pairing allowed
				console.log("This Steward does not currently allow pairing");
				break;
		}
		console.log("Pairing Code: " + self.pairingCode);

		if (!isEmpty(self.pairingCode)) {
			self.sendMessage('manage', {path:'/api/v1/thing/pair/'+self.config['uuid'],requestID:'100001',name:self.config['name'],pairingCode: self.pairingCode}, function(data, self) { completePair(data, self, callback); });
		}
	});
}

var completePair = exports.completePair = function(data, self, callback) {
    if(!isEmpty(data['result'])) {
        if(data['result']['success']) {
            console.log("Success!");
            //Save the thingID and params in the database for later use
            self.config['thingID'] = data['result']['thingID'];
            self.config['params'] = data['result']['params'];
            console.log("Config Set!" + JSON.stringify(self.config,null,4));
			saveConfig(self.config);
			callback();
        } else if(!isEmpty(data['error'])) {
            console.log("Error pairing");
        }
    }
}

var connect = function() {
	//Find the steward
	//Connect

}

var sendMessage = exports.sendMessage = function(endpoint, message, callback) {
	var self = this;
	console.log("config: " + JSON.stringify(config,null,4));
	console.log("Sending message to " + endpoint + ":\n" + JSON.stringify(message,null,4));

	var ws = new WebSocket('ws://steward.local:8887/' + endpoint);
	
    ws.onopen = function(event) {
        console.log("Opened websocket to steward: " + endpoint);
		ws.send(JSON.stringify(message));
    };

    ws.onmessage = function(event) {
        data = JSON.parse(event.data);
		console.log("Received data:" + JSON.stringify(data,null,4));
		
/*
		console.log("isEmpty(data['result']): " + isEmpty(data['result']));
		console.log("self.config before result: " + self.config['id']);
*/
		if (!isEmpty(data['result'])) {
			callback(data, self);
			ws.close();
		} else if (!isEmpty(data['error'])) {
//			if (!isEmpty(data['error']['diagnostic'])) { //Check for diagnostic messages
				switch (data['error']['diagnostic']) { //Check for diagnostic messages
					case "duplicate name": 
					case "duplicate uuid":
						self.config['id']++;
						self.config['name'] = self.config['basename'] + " #" + self.config['id'];
						console.log("Name collision... Changing name to " + self.config['name']);
						message['name'] = self.config['name'];
						self.sendMessage(endpoint, message, callback);
						break;
					default:
						break;
				}
//			}
			ws.close(); //if data['error'] is not empty, close ws. Errors are final.
		}
    };

    ws.onclose = function(event) {
        console.log(endpoint + " Socket closed: " + event.wasClean );
    };

    ws.onerror = function(event) {
        console.log(endpoint + " Socket error: " + JSON.stringify(event, null,4));
        data = JSON.parse(event.data);
		callback(data);
        try {
            ws.close ();
            console.log("Closing websocket because of error: " + endpoint);
        } catch (ex) {}
    }

}
