var exec = require('child_process').exec;
var voice = 'cmu_us_slt_arctic_hts';

//==========================================
//Festival Functions
//==========================================
module.exports.say = function(text) {
	console.log('festival -b ' + '\'(begin (voice_' + voice + ')\ (SayText "' + text + '"))\'');
	speak = exec('festival -b \'(begin (voice_' + voice + ')\ (SayText "' + text + '"))\'');
}

//==========================================
//mp3 functions
//==========================================
module.exports.playmp3 = function (mp3File) {
	sound = exec('mpg321 ' + mp3File);
}

module.exports.accept = function() {
	this.playmp3("sounds/accept.mp3");
}

module.exports.error = function() {
	this.playmp3("sounds/error.mp3");
}

module.exports.deny = function() {
	this.playmp3("sounds/deny.mp3");
}
