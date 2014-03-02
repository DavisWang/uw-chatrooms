var express = require('express'), app = express()
	, http = require('http')
	, server = http.createServer(app).listen(3000)
	, io = require('socket.io').listen(server);
var jade = require('jade');

var __dirname = '/Users/Davis/Documents/workspace/uw-chatrooms'

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set("view options", { layout: false });
app.configure(function() {
      app.use(express.static(__dirname + '/public'));
});

app.get('/', function(req, res){
    res.render('home.jade');
});
// app.listen(3000);

io.sockets.on('connection', function (socket) {
    //our other events...
    socket.on('setPseudo', function (data) {
    socket.set('pseudo', data);
	});

    socket.on('message', function (message) {
	    socket.get('pseudo', function (error, name) {
	        var data = { 'message' : message, pseudo : name };
	        socket.broadcast.emit('message', data);
	        console.log("user " + name + " send this : " + message);
	    })
	});


});