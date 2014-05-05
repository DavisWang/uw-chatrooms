var port = process.env.OPENSHIFT_NODEJS_PORT || 3000  
, ip = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";

var express = require("express"), app = express()
, http = require("http")
, server = http.createServer(app).listen(port, ip)
, io = require("socket.io").listen(server);

io.enable('browser client minification'); // send minified client
io.enable('browser client etag'); // apply etag caching logic based on version number
io.enable('browser client gzip'); // gzip the file
// io.set("log level", 2);

var jade = require("jade");

app.set("views", __dirname + "/views");
app.set("view engine", "jade");
app.set("view options", { layout: false });
app.configure(function() {
    app.use(express.static(__dirname + "/public"));
    app.use(express.urlencoded());
    app.use(app.router);
});

//usersList: id -> username
//usersListr: username -> id
var usersList = {};
var usersListr = {};

//public rooms list
var publicRoomsList = ["Lobby"];

//length of the usersList, JS makes it difficult to get the
//length of a dictionary, so we just store a separate variable
var numConnected = 0;

io.sockets.on("connection", function (socket) {

    socket.set("username", username);
    console.log(logStr() + "User " + username + " connected");

    if (usersListr[username]) {
        console.log(logStr() + "Kicking user: " + username + " due to duplicate username");
        socket.emit("kickClient", {"url" : "/error2"});
    }
    else if (typeof username !== "undefined" && typeof username != null) {
        usersList[socket.id] = username;
        usersListr[username] = socket.id;
        numConnected++;
        console.log(logStr() + "usersList is: " + JSON.stringify(usersList));
        console.log(logStr() + numConnected + " connected");

        socket.emit("saveUsername", {"clientUsername": username});
        io.sockets.emit("loadUsersList", {"roomName" : "Lobby", "usernamesList" : getUsernamesList("Lobby")});
        io.sockets.emit("numConnected", {"numConnected" : numConnected});

        socket.emit("initRoomsList", getUserRoomList(socket), publicRoomsList);
    }
    else {
        console.log(logStr() + "Kicking user: " + username + " due to server restart");
        socket.emit("kickClient", {"url" : "/error1"});
    }

    socket.on("sendMessage", function (clientData) {
        //TODO: validate msg contents
        if(clientData.messageRoom == "Lobby" || io.roomClients[socket.id]["/" + clientData.messageRoom]) {
            socket.get("username", function (error, username) {
                var data = {"message" : clientData.messageBody, "username" : username, "roomName" : clientData.messageRoom};
                if (clientData.messageRoom == "Lobby") {
                    socket.broadcast.to("").emit("sendMessageResponse", data);
                }
                else {
                    socket.broadcast.to(clientData.messageRoom).emit("sendMessageResponse", data);
                }
                console.log(logStr() + "User " + username + " send this : " + clientData.messageBody + " to room: " + clientData.messageRoom);
            });
        }
        else {
            console.log(logStr() + "User: " + usersList[socket.id] + " tried to spoof sendMessage! Data: " + JSON.stringify(clientData));
        }
    });

    socket.on("createRoom", function (data) {
        socket.get("username", function (error, username) {
            var created = false;
            var errorCode = 0;
            var roomName = data.roomName.trim();
            if(!isValidString(roomName)) {
                errorCode = 1;
            }
            else if (typeof io.sockets.manager.rooms["/" + roomName] !== "undefined") {
                errorCode = 2;
            }
            else if (roomName == "Lobby") {
                errorCode = 3;
            }
            else {
                console.log(logStr() + "User " + username + " created room name: '" + roomName + "'");
                created = true;
            }

            //populate the public room list for everyone
            if (created && data.isPublic) {
              publicRoomsList.push(roomName);
              io.sockets.emit("populatePublicRooms", {"publicRoomsList" : publicRoomsList});
            }

            //joins the room, this is the same logic as in socket.on('joinRoom')

            socket.emit("joinRoomResponse", {"created" : created, "roomName" : roomName, "errorCode" : errorCode});
            socket.join(roomName);
            io.sockets.in(roomName).emit("loadUsersList", {"roomName" : roomName, "usernamesList" : getUsernamesList(roomName)});
            console.log(logStr() + "Added user: " + username + " to room: " + roomName);
            console.log(logStr() + "User: " + username + " is in rooms: " + JSON.stringify(io.roomClients[socket.id]));
        });
    });

    socket.on("joinRoom", function (data) {
        if (socket.roomInvited == data.roomName) {
            if (data.hasAccepted) {
                socket.get("username", function (error, username) {
                    socket.emit("joinRoomResponse", {"created" : true, "roomName" : data.roomName, "errorCode" : 0});

                    socket.join(data.roomName);
                    io.sockets.in(data.roomName).emit("loadUsersList", {"roomName" : data.roomName, "usernamesList" : getUsernamesList(data.roomName)});
                    console.log(logStr() + "Added user: " + username + " to room: " + data.roomName);
                    console.log(logStr() + "User: " + username + " is in rooms: " + JSON.stringify(io.roomClients[socket.id]));
                });
            }
            //invalidate the invitation
            socket.roomInvited = null;
        } else {
            console.log(logStr() + "User: " + usersList[socket.id] + " tried to spoof joinRoom! Tried to join room: " + JSON.stringify(data.roomName));
        }
    });

    socket.on("leaveRoom", function (roomName) {
        if (io.roomClients[socket.id]["/" + data.roomName]) {
            socket.get("username", function (error, username) {
                socket.leave(roomName);
                io.sockets.in(roomName).emit("loadUsersList", {"roomName" : roomName, "usernamesList" : getUsernamesList(roomName)});
                console.log(logStr() + "Removed user: " + username + " from room: " + roomName);
                console.log(logStr() + "User: " + username + " is in rooms: " + JSON.stringify(io.roomClients[socket.id]));

                //Remove public room if no one is in a public room
                if (io.sockets.clients(roomName).length == 0) {
                  var index = publicRoomsList.indexOf(roomName);
                  if (index != -1) {
                    publicRoomsList.splice(index, 1);
                    //update public rooms list
                    var data = {"publicRoomsList": publicRoomsList};
                    io.sockets.emit("populatePublicRooms", data);
                  }
                }
            });
        }
        else {
            console.log(logStr() + "User: " + usersList[socket.id] + " tried to spoof leaveRoom! Data: " + JSON.stringify(roomName));
        }
    });

    //data.username: who to invite
    //data.roomName: the room to invite to
    socket.on("inviteUser", function (data) {
        if (io.roomClients[socket.id]["/" + data.roomName]) {
            socket.get("username", function (error, username) {
                //cannot invite someone already in room
                if (usersListr[data.username] && !io.sockets.manager.roomClients[usersListr[data.username]]["/" + data.roomName]) {
                    //set room invited variable so we can validate it later
                    io.sockets.socket(usersListr[data.username]).roomInvited = data.roomName;
                    io.sockets.socket(usersListr[data.username]).emit("roomInvite", {"inviter" : username, "roomName" : data.roomName});
                }
                else {
                    console.log(logStr() + "Cannot invite user: " + data.username + " to room: " + data.roomName);
                    //TODO emit a message to the socket of an error
                }
            });
        }
        else {
            console.log(logStr() + "User: " + usersList[socket.id] + " tried to spoof inviteUser! Data: " + JSON.stringify(data));
        }
    });

    socket.on("disconnect", function() {
        if(usersList.hasOwnProperty(socket.id)) {
            socket.get("username", function (error, username) {

                console.log(logStr() + "User " + username + " has disconnected");

                console.log(logStr() + "usersList was " + JSON.stringify(usersList));
                delete usersListr[usersList[socket.id]]
                delete usersList[socket.id];
                console.log(logStr() + "usersList is now " + JSON.stringify(usersList));
                numConnected--;
                io.sockets.emit("numConnected", {"numConnected" : numConnected});
                console.log(logStr() + "Number of users left on the service: " + numConnected);

                for (room in io.sockets.manager.roomClients[socket.id]) {
                    if(room == "") {
                        socket.leave(room);
                        io.sockets.emit("loadUsersList", {"roomName" : "Lobby", "usernamesList" : getUsernamesList("Lobby")});
                    }
                    else {
                        socket.leave(room.substring(1));
                        io.sockets.emit("loadUsersList", {"roomName" : room.substring(1), "usernamesList" : getUsernamesList(room.substring(1))});
                    }
                    
                    //remove public room if no one is left in a public room
                    if (io.sockets.clients(room).length == 0) {
                      var index = publicRoomsList.indexOf(room.substring(1));
                      if (index != -1) {
                        publicRoomsList.splice(index, 1);
                        //update public rooms list
                        var data = {"publicRoomsList": publicRoomsList};
                        io.sockets.emit("populatePublicRooms", data);
                      }
                    }
                }
            });
        }
    });
});

function logStr() {
    return "uwcr - " + new Date().toUTCString() + " - ";
}

//Determines whether the given string is a proper username or room
//alphanumeric + underscore + hyphen
//TODO provide support for spaces?
function isValidString (string) {
    var valid = /^[a-zA-Z0-9_ ]*$/.test(string) ? true : false;
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
app.post("/main", function(req, res){
    console.log(logStr() + "POST Request made to " + "/main");
    username = req.body.username.trim();
    if(isValidString(username) && !usersListr[username]) {
        console.log(logStr() + "User logged in as '" + username + "'");
        res.render("main.jade");
    }
    else {
        res.render("login.jade", {"usernameInvalid": true});
    }
});

app.get("/main", function(req, res){
    console.log(logStr() + "GET Request made to " + "/main");
    res.render("login.jade");
});

app.get("/error1", function(req, res){
    console.log(logStr() + "GET Request made to " + "/error1");
    res.render("login.jade", {"serverRestart": true});
});

app.get("/error2", function(req, res){
    console.log(logStr() + "GET Request made to " + "/error2");
    res.render("login.jade", {"usernameInvalid": true});
});

app.get("/", function(req, res){
    console.log(logStr() + "GET Request made to " + "/");
    res.render("login.jade");
});

app.get("/aboutus", function(req, res){
    console.log("GET Request made to " + "/aboutus");
    res.render("aboutus.jade");
});
