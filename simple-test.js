var ThingAPI = require('thing-client')
  ;

new ThingAPI.ThingAPI(
{ steward : { crtPath : 'server.crt' }
, pairing : { thingUUID : 'testing0'
            }
, state : null
}).on('ready', function(state) {
  console.log('ready state='+ JSON.stringify(state));


// when you get the value of state, then put it above and comment out 'pairing'
}).on('close', function() {
  console.log('close');
  process.exit(0);
}).on('error', function(err) {
  console.log('error: ' + err.message);
  process.exit(0);
});

//var st = require('./simple-thing');

//st.init(function() { console.log("Fin"); });
/*
st.completePair({
    "requestID": "100001",
    "result": {
        "params": {
            "algorithm": "sha1",
            "length": 40,
            "name": "EHMAcom #13@steward",
            "issuer": "steward",
            "step": 30,
            "base32": "NBJU2TBYGIZXE5TMKN5FCVCFGFLEO42XK5YDMM2GGNQWKYKDIZBGK32HIFRFIQKI",
            "protocol": "totp"
        },
        "success": true,
        "thingID": "14"
    },
    "timestamp": 1392263622
},"{id:1,name:'ehmacom'}");
*/

