var express = require('express'), app = express()
	, http = require('http')
	, server = http.createServer(app).listen(3000)
	, io = require('socket.io').listen(server);
var jade = require('jade');

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set("view options", { layout: false });
app.configure(function() {
      app.use(express.static(__dirname + '/public'));
});

var numConnected = 0;
var usersList = Array();

io.sockets.on('connection', function (socket) {

numConnected++;
io.sockets.emit('numConnected', {numConnected : numConnected});
console.log(numConnected + ' connected');

    socket.on('setUsername', function (data) {
    	socket.set('username', data);
    	socket.get('username', function (error, name) {
    		console.log('User ' + name + ' connected');

    		//adds user to the user array
    		usersList.push(name);

	    	socket.broadcast.emit('userConnected', {username : name});
	    	socket.emit('loadUsersList', {usersList : usersList});	
	    })
	});

    socket.on('message', function (message) {
	    socket.get('username', function (error, name) {
	        var data = { 'message' : message, username : name };
	        socket.broadcast.emit('message', data);
	        console.log('user ' + name + ' send this : ' + message);
	    })
	});

    socket.on('disconnect', function() {
    	socket.get('username', function (error, name) {
    		console.log('User ' + name + ' has disconnected');
    		numConnected--;
			io.sockets.emit('numConnected', {numConnected : numConnected});
    		console.log(numConnected + ' connected');

    		//remove user from the user array
    		var index = usersList.indexOf(name);
    		if(index > -1) {
    			usersList.splice(index, 1);
    		}

        	io.sockets.emit('userDisconnected', {username : name})	

    	})
    });
});

var params = new Array(numConnected);

app.get('/', function(req, res){
  console.log("Request made to " + '/');
    res.render('home.jade');
});



