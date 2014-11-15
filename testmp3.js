//#####################################
//Quick script to test the audio module
//#####################################

var audio = require('./audio');
var path = require('path');

console.log(path.resolve(__filename,'../sounds/accept.mp3'));
audio.accept();

audio.say ("testing 1 2 3");

