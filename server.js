var port = process.env.OPENSHIFT_NODEJS_PORT || 3000
, ip = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";

var express = require("express"), app = express()
, http = require("http")
, server = http.createServer(app).listen(port, ip)
, io = require("socket.io").listen(server);

var bot = require("./public/js/uwbot.js");

io.enable('browser client minification'); // send minified client
io.enable('browser client etag'); // apply etag caching logic based on version number
io.enable('browser client gzip'); // gzip the file
io.set("log level", 2);

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

var botName = "@UWBOT";
var otherBotName = "@BOT";

//length of the usersList, JS makes it difficult to get the
//length of a dictionary, so we just store a separate variable
var numConnected = 0;

io.sockets.on("connection", function (socket) {
    username = socket.handshake.query.username;
    console.log(logStr() + "User " + username + " is connecting");

    if (!isValidString(username) || usersListr[username]) {
        console.log(logStr() + "Kicking user: " + username + " due to duplicate/invalid username");
        socket.emit("kickClient", {"url" : "/error2"});
    }
    else if (typeof username !== "undefined" && typeof username != null) {
        //delete client's tabs from previous sessions
        socket.emit("deleteTabs");
        
        socket.set("username", username);
        usersList[socket.id] = username;
        usersListr[username] = socket.id;
        numConnected++;
        console.log(logStr() + "User " + username + " connected");
        console.log(logStr() + "usersList is: " + JSON.stringify(usersList));
        console.log(logStr() + numConnected + " connected");

        socket.emit("saveUsername", {"clientUsername": username});

        var initialUsernamesList = getUsernamesList("Lobby");
        io.sockets.emit("loadUsersList", {"roomName" : "Lobby", "usernamesList" : initialUsernamesList, "allUsernamesList" : initialUsernamesList});
        io.sockets.emit("numConnected", {"roomName" : "Lobby" , "numConnected" : numConnected});

        socket.emit("initRoomsList", getUserRoomList(socket), publicRoomsList);
    }
    else {
        console.log(logStr() + "Kicking user: " + username + " due to server restart");
        socket.emit("kickClient", {"url" : "/error1"});
    }

    socket.on("sendMessage", function (data) {
        if (data.messageRoom == "Lobby" || io.roomClients[socket.id]["/" + data.messageRoom]) {
            socket.get("username", function (error, username) {
                var response = {"message" : data.messageBody, "username" : username, "roomName" : data.messageRoom};
                if (data.messageRoom == "Lobby") {
                    socket.broadcast.to("").emit("sendMessageResponse", response);
                }
                else {
                    socket.broadcast.to(data.messageRoom).emit("sendMessageResponse", response);
                }

                //if this is a command addressed to bot
                if(data.messageBody.slice(0, otherBotName.length).toUpperCase() === otherBotName ||
                    data.messageBody.slice(0, botName.length).toUpperCase() === botName) {
                    console.log(logStr() + "Processing @uwbot command: " + data.messageBody);
                    bot.process(data.messageBody, function (responseStr){
                        response.message = responseStr;
                        response.username = "@UWBot";
                        console.log(logStr() + "Bot response: " + JSON.stringify(response));
                        if(data.messageRoom == "Lobby") {
                            io.sockets.emit("sendMessageResponse", response);
                        }
                        else {
                            io.sockets.in(data.messageRoom).emit("sendMessageResponse", response);
                        }
                    });
                }

                console.log(logStr() + "User " + username + " send this : " + data.messageBody + " to room: " + data.messageRoom);
            });
        }
        else {
            console.log(logStr() + "User: " + usersList[socket.id] + " tried to spoof sendMessage! Data: " + JSON.stringify(data));
        }
    });

    socket.on("createRoom", function (data) {
        if(typeof data.roomName === "string" && typeof data.isPublic === "boolean") {
            socket.get("username", function (error, username) {
                var created = false;
                var errorCode = 0;
                var roomName = data.roomName.trim();
                if (!isValidString(roomName)) {
                    errorCode = 1;
                }
                else if (typeof io.sockets.manager.rooms["/" + roomName] !== "undefined") {
                    errorCode = 2;
                }
                else if (roomName == "Lobby") {
                    errorCode = 3;
                }
                else {
                    console.log(logStr() + "User " + username + " created room name: '" + roomName + "', isPublic: " + data.isPublic);
                    created = true;
                }

                if (created) {
                    //populate the public room list for everyone if the new room is public
                    if (data.isPublic) {
                        publicRoomsList.push(roomName);
                        io.sockets.emit("populatePublicRooms", {"publicRoomsList" : publicRoomsList});
                    }

                    //joins the room, this is the same logic as in socket.on('joinRoom')
                    socket.emit("joinRoomResponse", {"created" : created, "roomName" : roomName, "errorCode" : errorCode});
                    socket.join(roomName);
                    io.sockets.in(roomName).emit("loadUsersList", {"roomName" : roomName, "usernamesList" : getUsernamesList(roomName)});
                    io.sockets.in(roomName).emit("numConnected", {"roomName" : roomName, "numConnected" : io.sockets.clients(roomName).length});    //number of clients in a room
                    console.log(logStr() + "Added user: " + username + " to room: " + roomName);
                    console.log(logStr() + "User: " + username + " is in rooms: " + JSON.stringify(io.roomClients[socket.id]));
                }
                else {
                    console.log(logStr() + "Cannot create room! Error code: " + errorCode + " Data: " + JSON.stringify(data));
                    socket.emit("joinRoomResponse", {"created" : created, "errorCode" : errorCode});
                }
            });
        }
        else {
            console.log(logStr() + "Room name or isPublic isn't of the correct types! " + JSON.stringify(data));
        }
    });

    socket.on("joinRoom", function (data) {
        //don't need to check for Lobby as you should never be able to join or leave Lobby
        //checks if the user is already in the room
        if (!io.roomClients[socket.id]["/" + data.roomName]) {
            var index = publicRoomsList.indexOf(data.roomName);
            if (index != -1 || socket.roomInvited == data.roomName) { //if a public room, accept it. if a private room, check for invitation.
                if (data.hasAccepted) {
                    socket.get("username", function (error, username) {
                        socket.emit("joinRoomResponse", {"created" : true, "roomName" : data.roomName, "errorCode" : 0});

                        socket.join(data.roomName);
                        io.sockets.in(data.roomName).emit("loadUsersList", {"roomName" : data.roomName, "usernamesList" : getUsernamesList(data.roomName)});
                        io.sockets.in(data.roomName).emit("numConnected", {"roomName" : data.roomName, "numConnected" : io.sockets.clients(data.roomName).length}); //number of clients in a room
                        console.log(logStr() + "Added user: " + username + " to room: " + data.roomName);
                        console.log(logStr() + "User: " + username + " is in rooms: " + JSON.stringify(io.roomClients[socket.id]));
                    });
                }
                //invalidate the invitation
                socket.roomInvited = null;
            } else {
                console.log(logStr() + "User: " + usersList[socket.id] + " tried to spoof joinRoom! Tried to join room: " + JSON.stringify(data));
                console.log("Index is: " + index);
                console.log("socket.roomInvited is: " + socket.roomInvited);
            }
        }
        else {
            console.log(logStr() + "User: " + usersList[socket.id] + " cannot join room: " + data.roomName + " because user is already in room.");
        }
    });

    socket.on("leaveRoom", function (roomName) {
        if (io.roomClients[socket.id]["/" + roomName]) {
            socket.get("username", function (error, username) {
                socket.leave(roomName);
                io.sockets.in(roomName).emit("loadUsersList", {"roomName" : roomName, "usernamesList" : getUsernamesList(roomName)});
                io.sockets.in(roomName).emit("numConnected", {"roomName" : roomName, "numConnected" : io.sockets.clients(roomName).length}); //number of clients in a room

                console.log(logStr() + "Removed user: " + username + " from room: " + roomName);
                console.log(logStr() + "User: " + username + " is in rooms: " + JSON.stringify(io.roomClients[socket.id]));

                //Remove public room if no one is in a public room
                if (io.sockets.clients(roomName).length == 0) {
                  var index = publicRoomsList.indexOf(roomName);
                  if (index != -1) {
                    publicRoomsList.splice(index, 1);
                    //update public rooms list
                    io.sockets.emit("populatePublicRooms", {"publicRoomsList": publicRoomsList});
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
        if(typeof data.roomName === "string") {
            data.roomName = data.roomName.trim();
            if (io.roomClients[socket.id]["/" + data.roomName]) {
                socket.get("username", function (error, username) {
                    //cannot invite someone already in room
                    if (usersListr[data.username] && !io.sockets.manager.roomClients[usersListr[data.username]]["/" + data.roomName]) {
                        //set room invited variable so we can validate it later
                        io.sockets.socket(usersListr[data.username]).roomInvited = data.roomName;
                        io.sockets.socket(usersListr[data.username]).emit("roomInvite", {"inviter" : username, "roomName" : data.roomName});
                        console.log(logStr() + "User: " + username + " invited user: " + data.username + " to room: " + data.roomName);
                    }
                    else {
                        console.log(logStr() + "Cannot invite user: " + data.username + " to room: " + data.roomName);
                        socket.emit("failedInvitation", {"invitee" : data.username, "roomName" : data.roomName});
                    }
                });
            }
            else {
                console.log(logStr() + "User: " + usersList[socket.id] + " tried to spoof inviteUser! Data: " + JSON.stringify(data));
            }
        }
        else {
            console.log(logStr() + "Room name isn't of the correct type! " + JSON.stringify(data));
        }
    });

    socket.on("disconnect", function() {
        if (usersList.hasOwnProperty(socket.id)) {
            socket.get("username", function (error, username) {
                console.log(logStr() + "User " + username + " has disconnected");
                console.log(logStr() + "usersList was " + JSON.stringify(usersList));

                delete usersListr[usersList[socket.id]]
                delete usersList[socket.id];

                console.log(logStr() + "usersList is now " + JSON.stringify(usersList));
                numConnected--;
                io.sockets.emit("numConnected", {"roomName" : "Lobby" , "numConnected" : numConnected});
                console.log(logStr() + "Number of users left on the service: " + numConnected);

                socket.leave("");
                var usernamesList = getUsernamesList("Lobby");
                io.sockets.emit("loadUsersList", {"roomName" : "Lobby", "usernamesList" : usernamesList, "allUsernamesList" : usernamesList});
                for (room in io.sockets.manager.roomClients[socket.id]) {
                    socket.leave(room.substring(1));
                    io.sockets.emit("loadUsersList", {"roomName" : room.substring(1), "usernamesList" : getUsernamesList(room.substring(1)), "allUsernamesList" : usernamesList});
                    io.sockets.in(room.substring(1)).emit("numConnected", {"roomName" : room.substring(1), "numConnected" : io.sockets.clients(room.substring(1)).length});	//number of clients in a room

                    //remove public room if no one is left in a public room
                    if (io.sockets.clients(room).length == 0) {
                      var index = publicRoomsList.indexOf(room.substring(1));
                      if (index != -1) {
                        publicRoomsList.splice(index, 1);
                        //update public rooms list
                      }
                    }
                }
                io.sockets.emit("populatePublicRooms", {"publicRoomsList": publicRoomsList});
            });
        }
    });
});

function logStr() {
    return "uwcr - " + new Date().toUTCString() + " - ";
}

//Determines whether the given string is a proper username or room
//alphanumeric + underscore + hyphen
function isValidString (string) {
    var valid = /^[a-zA-Z0-9_ ]*$/.test(string) ? true : false;
    return valid;
}

//given a room, generate a list of usernames that represent users in that room
function getUsernamesList(room) {
    var usernamesList = new Array();
    if (room == "Lobby" || room == "") {
        for (var i = 0 ; i < io.sockets.clients().length ; i++) {
            if (usersList[io.sockets.clients()[i].id]) {
                usernamesList.push(usersList[io.sockets.clients()[i].id]);
            }
        }
    }
    else {
        for (var i = 0 ; i < io.sockets.clients(room).length ; i++) {
            if (usersList[io.sockets.clients()[i].id]) {
                usernamesList.push(usersList[io.sockets.clients(room)[i].id]);
            }
        }
    }
    return usernamesList;
}

function getUserRoomList(socket) {
    var roomList = new Array();
    for (room in io.sockets.manager.roomClients[socket.id]) {
        if (room == "") {
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
    if (isValidString(username) && !usersListr[username]) {
        console.log(logStr() + "User logged in as '" + username + "'");
        res.render("main.jade", {"username" : username});
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
