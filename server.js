if(process.env.NODETIME_ACCOUNT_KEY) {
    require('nodetime').profile({
      accountKey: process.env.NODETIME_ACCOUNT_KEY,
      appName: 'uw-chatrooms'
    });
}

if(process.env.NEW_RELIC_LICENSE_KEY) {
    require('newrelic');
}

var express = require('express'), app = express()
, http = require('http')
, server = http.createServer(app).listen(process.env.PORT || 3000)
, io = require('socket.io').listen(server);

io.set('log level', 1);

var jade = require('jade');

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set("view options", { layout: false });
app.configure(function() {
    app.use(express.static(__dirname + '/public'));
    app.use(express.urlencoded());
    app.use(app.router);

});

//usersList: id -> username
//usersListr: username -> id
var usersList = new Array();
var usersListr = new Array();

//length of the usersList, JS makes it difficult to get the
//length of a dictionary, so we just store a separate variable
var numConnected = 0;

io.sockets.on('connection', function (socket) {

    socket.set('username', username);
    console.log('User ' + username + ' connected');

    if (typeof username !== 'undefined' && typeof username != null) {
        usersList[socket.id] = username;
        usersListr[username] = socket.id;
        numConnected++;
    }
    
    socket.emit('saveUsername', {'clientUsername': username});
    io.sockets.emit('loadUsersList', {'roomName' : 'Lobby', 'usernamesList' : getUsernamesList("Lobby")});
    io.sockets.emit('numConnected', {'numConnected' : numConnected});

    socket.emit('updateRoomsList', getUserRoomList(socket));

    console.log(io.sockets.clients().length + ' connected');

    socket.on('sendMessage', function (clientData) {
        socket.get('username', function (error, name) {
            var data = { 'message' : clientData.messageBody, 'username' : name, 'roomName' : clientData.messageRoom};
            if (clientData.messageRoom == "Lobby") {
                socket.broadcast.to('').emit('sendMessageResponse', data);
            }
            else {
                socket.broadcast.to(clientData.messageRoom).emit('sendMessageResponse', data);
            }

            console.log('User ' + name + ' send this : ' + clientData.messageBody + " to room: " + clientData.messageRoom);
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

            socket.emit('updateRoomsList', getUserRoomList(socket));

            io.sockets.in(roomName).emit('loadUsersList', {'roomName' : roomName, 'usernamesList' : getUsernamesList(roomName)});
            console.log("Added user: " + username + " to room: " + roomName);
            console.log("User: " + username + " is in rooms: ");
            console.log(io.roomClients[socket.id]);
        });
    });

    socket.on('leaveRoom', function (roomName) {
        socket.get('username', function (error, username) {
            socket.leave(roomName);

            socket.emit('updateRoomsList', getUserRoomList(socket));

            io.sockets.in(roomName).emit('loadUsersList', {'roomName' : roomName, 'usernamesList' : getUsernamesList(roomName)});
            console.log("Removed user: " + username + " from room: " + roomName);
            console.log("User: " + username + " is in rooms: ");
            console.log(io.sockets.manager.roomClients[socket.id]);
        });
    });

    //data.username: who to invite
    //data.roomName: the room to invite to
    socket.on('inviteUser', function (data) {
        socket.get('username', function (error, username) {
            //TODO notify the target client with a modal
            //do data validation here
            //cannot invite youself, cannot invite someone already in room
            if (data.username != username && !io.sockets.manager.roomClients[usersListr[data.username]]["/" + data.roomName]) {
                io.sockets.socket(usersListr[data.username]).emit('roomInvite', {'inviter' : username, 'roomName' : data.roomName});
            }
            else {
                console.log("Cannot invite user: " + data.username + " to room: " + data.roomName);
                //TODO emit a message to the socket of an error
            }
        });
    });

    socket.on('acceptInvitation', function (roomName) {
        var data = {'created' : true, 'roomName' : roomName, 'errorCode' : 0};
        socket.emit('createRoomResponse', data);
    });

    socket.on('disconnect', function() {
        socket.get('username', function (error, username) {
            console.log('User ' + username + ' has disconnected');

            for (room in io.sockets.manager.roomClients[socket.id]) {
                socket.leave(room);

                if (room == "") {
                    socket.broadcast.to(room).emit('loadUsersList', getUsernamesList(''));
                }
                else {
                    socket.broadcast.to(room).emit('loadUsersList', getUsernamesList(room.substring(1)));
                }
            }

            console.log("usersList was ");
            console.log(usersList);
            delete usersListr[usersList[socket.id]]
            delete usersList[socket.id];
            console.log("usersList is now ");
            console.log(usersList);
            numConnected--;
            io.sockets.emit('numConnected', {'numConnected' : numConnected});
            console.log("Number of users left on the service: " + numConnected);

            for (room in io.sockets.manager.roomClients[socket.id]) {
                if(room == "") {
                    io.sockets.emit('loadUsersList', {'roomName' : 'Lobby', 'usernamesList' : getUsernamesList("Lobby")});
                }
                else {
                    io.sockets.emit('loadUsersList', {'roomName' : room.substring(1), 'usernamesList' : getUsernamesList(room.substring(1))});
                }
            }
        });
    });
});

//Determines whether the given string is a proper username or room
//alphanumeric + underscore + hyphen
//TODO provide support for spaces?
function isValidString (string) {
    var valid = /^[a-zA-Z0-9-_]*$/.test(string) ? true : false;
    return valid;
}

//given a room, generate a list of usernames that represent users in that room
function getUsernamesList(room) {
    var usernamesList = new Array();
    if(room == "Lobby" || room == "") {
        for (var i = 0 ; i < io.sockets.clients().length ; i++) {
            if(usersList[io.sockets.clients()[i].id]) {
                usernamesList.push(usersList[io.sockets.clients()[i].id]);
            }
        }
    }
    else {
        for (var i = 0 ; i < io.sockets.clients(room).length ; i++) {
            if(usersList[io.sockets.clients()[i].id]) {
                usernamesList.push(usersList[io.sockets.clients(room)[i].id]);
            }
        }
    }
    return usernamesList;
}

function getUserRoomList(socket) {
    var roomList = new Array();
    for (room in io.sockets.manager.roomClients[socket.id]) {
        if(room == "") {
            roomList.push("Lobby");
        }
        else {
            roomList.push(room.substring(1));
        }
    }
    return roomList;
}

var username;
app.post('/main', function(req, res){
    console.log("POST Request made to " + '/main');
    username = req.body.username;
    if(isValidString(username) && !usersListr[username]) {
        console.log("User logged in as " + username);
        res.render('main.jade');
    }
    else {
        res.render('login.jade', {"usernameInvalid": true});
    }
});

app.get('/main', function(req, res){
    console.log("GET Request made to " + '/main');
    res.render('login.jade');
});

app.get('/', function(req, res){
    if (!~req.header('user-agent').indexOf('NewRelicPinger')) {
        console.log("GET Request made to " + '/');
    }
    res.render('login.jade');
});
