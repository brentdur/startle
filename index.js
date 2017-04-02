require('dotenv').config();
const fs = require("fs");
const readline = require("readline");
const login = require("facebook-chat-api");
const request = require('request');
const Raven = require('raven');
Raven.config('https://d7f1874667204593930e96dd35b9a61f:32b10b1a23924bc3a91a170e1f8d5fe3@sentry.io/154434').install();

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

	// deal with autnetication and error codes
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
            	pushError(err);
        }
        return;
    }

    //save appstate to avoid authenticating again
    if (!authObj.appState) {
	    fs.writeFileSync('appstate.json', JSON.stringify(api.getAppState()));
	}

	// deal with setup
	var myID = api.getCurrentUserID();
	api.setOptions({
		listenEvents: true,
		logLevel: 'http'
	});

	// find muted threads
	api.getThreadList(0, 100, (err, arr) => {
		if (err) {pushError(err);}
		arr.forEach(function(item){
			if (item.threadID === '1099033266852452') {
				console.log(item);
			}
		});
	});

	// listen for events and messages
    api.listen((err, message) => {
    	if (err) {pushError(err);}
    	console.log('Message receieved: ', message);
    	if (message.type === 'message') {
    		var userId = message.senderID;
    		var body = message.body;
    		var isAttachment = false;
    		var isGroup = message.isGroup;
    		if (message.attachments.length > 0) {
    			isAttachment = true
    		}
    		// TODO: fix this for blocked threads
    		if (message.threadID !== '1099033266852452') {
	    		api.getUserInfo(userId, (err, usr) => {
	    			if (err) {pushError(err);}
	    			sendMessageNotification(usr[userId].name, body, isAttachment, isGroup);
	    		});
	    	}
    	} else if (message.type === 'read_receipt') {
    		var userId = message.reader;
    		api.getUserInfo(userId, (err, usr) => {
    			if (err) {pushError(err);}
    			sendReadReceiptNotification(usr[userId].name);
    		});
    	}
    });
});

function pushError(error) {
	console.error(error);
	pushOver('There was an error! ... ' + error);
}
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


function sendMessageNotification(userName, body, isAttachment, isGroup) {
	var output = userName + ' sent ';
	if (isGroup) {
		output += 'your group ';
	} else {
		output += 'you ';
	}
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