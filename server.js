var express = require('express'), app = express()
, http = require('http')
, server = http.createServer(app).listen(process.env.PORT || 3000)
, io = require('socket.io').listen(server);
var jade = require('jade');

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set("view options", { layout: false });
app.configure(function() {
    app.use(express.static(__dirname + '/public'));
    app.use(express.urlencoded());
    app.use(app.router);

});

var usernamesList = Array();

io.sockets.on('connection', function (socket) {

    //at this point the user is guarenteed to have a valid username, TODO I should add vaildation login before this point
    socket.set('username', username);
    console.log('User ' + username + ' connected');
    if (typeof username !== 'undefined') {
        usernamesList.push(username);
    }

    io.sockets.emit('loadUsersList', usernamesList);
    io.sockets.emit('numConnected', {'numConnected' : io.sockets.clients().length});
    console.log(io.sockets.clients().length + ' connected');

    socket.on('message', function (clientData) {
        socket.get('username', function (error, name) {
            var data = { 'message' : clientData.messageBody, 'username' : name, 'roomName' : clientData.messageRoom};
            if (clientData.messageRoom == "Lobby") {
                socket.broadcast.to('').emit('message', data);
            }
            else {
                socket.broadcast.to(clientData.messageRoom).emit('message', data);
            }

            console.log('user ' + name + ' send this : ' + clientData.messageBody + " to room: " + clientData.messageRoom);
        });
    });

    socket.on('createRoom', function (roomName) {
        socket.get('username', function (error, name) {
            var created = false;
            var errorCode = 0;
            if(!isValidString(roomName)) {
                errorCode = 1;
            }
            else if (typeof io.sockets.manager.rooms['/' + roomName] !== 'undefined') {
                errorCode = 2;
            }
            else if (roomName == "Lobby") {
                errorCode = 3;
            }
            else {
                console.log("User " + name + " created room name: " + roomName);
                created = true;
            }
            var data = {'created' : created, 'roomName' : roomName, 'errorCode' : errorCode};
            socket.emit('createRoomResponse', data);

        });
    });

    socket.on('joinRoom', function (roomName) {
        socket.get('username', function (error, username) {
            socket.join(roomName);
            console.log("Added user: " + username + " to room: " + roomName);
        });
    });

    socket.on('leaveRoom', function (roomName) {
        socket.get('username', function (error, username) {
            socket.leave(roomName);
            console.log("Removed user: " + username + " from room: " + roomName);
        });
    });

    socket.on('disconnect', function() {
        socket.get('username', function (error, username) {
            console.log('User ' + username + ' has disconnected');
            io.sockets.emit('numConnected', {'numConnected' : io.sockets.clients().length});

            var index = usernamesList.indexOf(username);
            if(index > -1) {
                console.log("usernamesList was " + usernamesList);
                usernamesList.splice(index, 1);
                console.log("usernamesList is now " + usernamesList);
            }

            console.log("Users left on the service " + usernamesList);
            socket.broadcast.emit('loadUsersList', usernamesList);
        });
    });
});

//Determines whether the given string is a proper username or room
//alphanumeric + spaces + hyphen
function isValidString (string) {
    var valid = /^[a-zA-Z0-9- ]*$/.test(string) ? true : false;
    return valid;
}

var username;
app.post('/main', function(req, res){
    console.log("POST Request made to " + '/main');
    username = req.body.username;
    if(isValidString(username)) {
        console.log("User logged in as " + username);
        res.render('main.jade', {needSocketIo: true});
    }
    else {
        res.render('login.jade', {needSocketIo: false});
    }
});

app.get('/main', function(req, res){
    console.log("GET Request made to " + '/main');
    res.render('login.jade', {needSocketIo: false});
});

app.get('/', function(req, res){
    console.log("GET Request made to " + '/');
    res.render('login.jade', {needSocketIo: false});
});
