require('dotenv').config();
const fs = require("fs");
const readline = require("readline");
const login = require("facebook-chat-api");
const request = require('request');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let authObj = {};
if (fs.existsSync('appstate.json')) {
	authObj = {appState: JSON.parse(fs.readFileSync('appstate.json', 'utf8'))};
} else if (process.env.FB_EMAIL && process.env.FB_PASSWORD) {
	authObj = {email: process.env.FB_EMAIL, password: process.env.FB_PASSWORD};
} else {
	console.error("No authentication options avaliable");
	return;
}

// Create simple echo bot
login(authObj, (err, api) => {
    if(err) {
        switch (err.error) {
            case 'login-approval':
            	pushOver('Login Approval Needed');
                console.log('Enter code > ');
                rl.on('line', (line) => {
                    err.continue(parseInt(line));
                    rl.close();
                });
                break;
            default:
                console.error(err);
        }
        return;
    }

    if (!authObj.appState) {
	    //save appstate
	    fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState()));
	}
	var myID = api.getCurrentUserID();
	console.log('my id', myID);
	api.setOptions({
		listenEvents: true,
		logLevel: 'http'
	});

    api.listen((err, message) => {
    	if (err) {console.error(err);}
    	console.log('Message receieved: ', message);
    	if (message.type === 'message') {
    		var userId = message.senderID;
    		var body = message.body;
    		var isAttachment = false;
    		if (message.attachments.length > 0) {
    			isAttachment = true
    		}
    		// TODO: fix this for blocked threads
    		if (!message.isGroup) {
	    		api.getUserInfo(userId, (err, usr) => {
	    			if (err) {console.error(err);}
	    			sendMessageNotification(usr[userId].name, body, isAttachment);
	    		});
	    	}
    	} else if (message.type === 'read_receipt') {
    		var userId = message.reader;
    		api.getUserInfo(userId, (err, usr) => {
    			if (err) {console.error(err);}
    			sendReadReceiptNotification(usr[userId].name);
    		});
    	}
    });
});

function pushOver(msg){
	var params = {
		token: process.env.PUSHOVER_API,
		user: process.env.PUSHOVER_USER,
		message: msg
	}
	request({
		uri: 'https://api.pushover.net/1/messages.json',
		method: 'POST',
		qs: params
	}, function (error, response, body) {
		if (response && response.statusCode != 200) {
			console.error(error, response, body);
		}
	});
}


function sendMessageNotification(userName, body, isAttachment) {
	var output = userName + ' sent you ';
	if (body) {
		output += 'a message: ' + body + ' ';
	}
	if (body && isAttachment) {
		output += 'along with ';
	}
	if(isAttachment) {
		output += 'an attachment ';
	}
	pushOver(output);
}

function sendReadReceiptNotification(username) {
	var output = username + ' read your message';
	pushOver(output);
}