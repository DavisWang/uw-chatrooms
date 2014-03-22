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

//usersList id -> username
//userListr username -> id
var usersList = new Array();
var usersListr = new Array();

io.sockets.on('connection', function (socket) {

    //TODO: bug connect with valid username, shutdown server, restart server, username is now null
    //at this point the user is guarenteed to have a valid username, TODO I should add validation login before this point
    socket.set('username', username);
    console.log('User ' + username + ' connected');
    var clients = io.sockets.clients();
    // console.log(clients);
    if (typeof username !== 'undefined' && typeof username != null) {
        usersList[socket.id] = username;
        usersListr[username] = socket.id;
    }

    io.sockets.emit('loadUsersList', {'roomName' : 'Lobby', 'usernamesList' : getUsernamesList("Lobby")});
    io.sockets.emit('numConnected', {'numConnected' : io.sockets.clients().length});

    socket.emit('updateRoomsList', getUserRoomList(socket));

    console.log(io.sockets.clients().length + ' connected');

    socket.on('sendMessage', function (clientData) {
        socket.get('username', function (error, name) {
            var data = { 'message' : clientData.messageBody, 'username' : name, 'roomName' : clientData.messageRoom};
            if (clientData.messageRoom == "Lobby") {
                socket.broadcast.to('').emit('sendMessageResponse', data);
            }
            else {
                console.log("broadcast room: " + clientData.messageRoom);
                socket.broadcast.to(clientData.messageRoom).emit('sendMessageResponse', data);
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
            // else if (typeof io.sockets.manager.rooms['/' + roomName] !== 'undefined') {
            //     errorCode = 2;
            // }
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
            console.log("sending room list to client: " + getUserRoomList(socket));

            io.sockets.in(roomName).emit('loadUsersList', {'roomName' : roomName, 'usernamesList' : getUsernamesList(roomName)});
            console.log("Added user: " + username + " to room: " + roomName);
            console.log("User is in rooms: ");
            console.log(io.roomClients[socket.id]);
            console.log("List of all rooms: ");
            console.log(io.sockets.manager.rooms);
        });
    });

    socket.on('leaveRoom', function (roomName) {
        socket.get('username', function (error, username) {
            socket.leave(roomName);

            socket.emit('updateRoomsList', getUserRoomList(socket));

            io.sockets.in(roomName).emit('loadUsersList', {'roomName' : roomName, 'usernamesList' : getUsernamesList(roomName)});
            console.log("Removed user: " + username + " from room: " + roomName);
            console.log("User is in rooms: ");
            console.log(io.sockets.manager.roomClients[socket.id]);
            console.log("List of all rooms: ");
            console.log(io.sockets.manager.rooms);
        });
    });

    //data.username: who to invite
    //data.roomName: the room to invite to
    socket.on('inviteUser', function (data) {
        //notify the target client with a modal
        socket.get('username', function (error, username) {
            io.sockets.socket(usersListr[data.username]).emit('roomInvite', {'inviter' : username, 'roomName' : data.roomName});
        });
    });

    socket.on('acceptInvitation', function (roomName) {
        var data = {'created' : true, 'roomName' : roomName, 'errorCode' : 0};
        socket.emit('createRoomResponse', data);
    });

    socket.on('disconnect', function() {
        socket.get('username', function (error, username) {
            console.log('User ' + username + ' has disconnected');
            io.sockets.emit('numConnected', {'numConnected' : io.sockets.clients().length});

            console.log(io.sockets.manager.roomClients[socket.id]);

            for (room in io.sockets.manager.roomClients[socket.id]) {
                socket.leave(room);
                console.log("Leaving room: " + room);

                if (room == "") {
                    console.log("Broadcasting to Lobby");
                    socket.broadcast.to(room).emit('loadUsersList', getUsernamesList(''));
                }
                else {
                    console.log("Broadcasting to room:" + room);
                    socket.broadcast.to(room).emit('loadUsersList', getUsernamesList(room.substring(1)));
                }

                console.log(io.sockets.manager.roomClients[socket.id]);
            }

            // console.log(io.sockets.manager.roomClients[socket.id]);

            console.log("usersList was ");
            console.log(usersList);
            delete usersList[socket.id];
            console.log("usersList is now ");
            console.log(usersList);

            // console.log("Users left on the service " + usernamesList);
            // var data = { 'roomName' :}
            // socket.broadcast.emit('loadUsersList', usernamesList);
            //also broadcast to rooms that the disconnected user was in
        });
    });
});

//Determines whether the given string is a proper username or room
//alphanumeric + spaces + hyphen
function isValidString (string) {
    var valid = /^[a-zA-Z0-9-_]*$/.test(string) ? true : false;
    return valid;
}

//given a room, generate a list of usernames that represent users in that room
function getUsernamesList(room) {
    var usernamesList = new Array();
    if(room == "Lobby" || room == "") {
        for (var i = 0 ; i <  io.sockets.clients().length ; i++) {
            usernamesList.push(usersList[io.sockets.clients()[i].id]);
        }
        return usernamesList;
    }
    else {
        for (var i = 0 ; i <  io.sockets.clients(room).length ; i++) {
            usernamesList.push(usersList[io.sockets.clients(room)[i].id]);
        }
        return usernamesList;
    }
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
