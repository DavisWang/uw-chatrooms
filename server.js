var port = process.env.OPENSHIFT_NODEJS_PORT || 3000
, ip = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";

var express = require("express"), app = express()
, http = require("http")
, server = http.createServer(app).listen(port, ip)
, io = require("socket.io").listen(server);

var bot = require("uwcr-chatbot");

var jade = require("jade");

app.set("views", __dirname + "/views");
app.set("view engine", "jade");
app.set("view options", { layout: false });

// Sass setup
var sass = require("node-sass");

app.use(sass.middleware({
    src: __dirname + '/public/sass',
    dest: __dirname + '/public',
    debug: true,
    outputStyle: 'compressed'
}));

app.use(express.static(__dirname + "/public"));
app.use(express.urlencoded());
app.use(express.cookieParser());
app.use(app.router);

io.enable('browser client minification'); // send minified client
io.enable('browser client etag'); // apply etag caching logic based on version number
io.enable('browser client gzip'); // gzip the file
io.set("log level", 2);

//the username currently being handled
var username;

//usersList: id -> username
//usersListr: username -> id
var usersList = {};
var usersListr = {};

//public rooms list
var publicRoomsList = ["Lobby"];

var botName = "@UWBOT ";
var otherBotName = "@BOT ";

var login_page = 'login_05222014.jade';
var main_page  = 'main_05222014.jade';

//length of the usersList, JS makes it difficult to get the
//length of a dictionary, so we just store a separate variable
var numConnected = 0;

io.sockets.on("connection", function (socket) {
    try {
        //get username from query string
        username = socket.handshake.query.username;
        console.log(logStr() + "User " + username + " is connecting");

        //ensure username is valid
        if (!isValidString(username) || usersListr[username]) {
            //TODO we need to make this description better, since usually, people enter proper names
            //so we want to show unique constraint first, and there is a possibility of someone else taking
            //your name when you have your cookie set, this will also result in the user getting this msg
            console.log(logStr() + "Kicking user: " + username + " due to duplicate/invalid username");
            socket.emit("kickClient", {"url" : "/error2"});
        }
        else if (typeof username !== "undefined" && typeof username != null) {
            //delete client's tabs from previous sessions
            //doesn't do anything if user is first time
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
    } catch (err) {
        console.log(logStr() + err);
    }

    socket.on("sendMessage", function (data) {
        try {
            if (data.messageRoom == "Lobby" || io.roomClients[socket.id]["/" + data.messageRoom]) {
                socket.get("username", function (error, username) {
                    var response = {"message" : data.messageBody, "username" : username, "roomName" : data.messageRoom};
                    if (data.messageRoom == "Lobby") {
                        socket.broadcast.to("").emit("sendMessageResponse", response);
                    }
                    else {
                        socket.broadcast.to(data.messageRoom).emit("sendMessageResponse", response);
                    }
                    console.log(logStr() + "User " + username + " send this : " + data.messageBody + " to room: " + data.messageRoom);

                    //if this is a command addressed to bot
                    if(data.messageBody.slice(0, otherBotName.length).toUpperCase() === otherBotName ||
                        data.messageBody.slice(0, botName.length).toUpperCase() === botName ||
                        data.messageBody.toUpperCase() === otherBotName.trim() ||
                        data.messageBody.toUpperCase() === botName.trim()) {
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
                });
            }
            else {
                console.log(logStr() + "User: " + usersList[socket.id] + " tried to spoof sendMessage! Data: " + JSON.stringify(data));
            }
        } catch (err) {
            console.log(logStr() + err);
        }
    });

    socket.on("createRoom", function (data) {
        try {
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
        } catch (err) {
            console.log(logStr() + err);
        }
    });

    socket.on("joinRoom", function (data) {
        try {
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
        } catch (err) {
            console.log(logStr() + err);
        }
    });

    socket.on("leaveRoom", function (roomName) {
        try {
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
        } catch (err) {
            console.log(logStr() + err);
        }
    });

    //data.username: who to invite
    //data.roomName: the room to invite to
    socket.on("inviteUser", function (data) {
        try {
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
        } catch (err) {
            console.log(logStr() + err);
        }
    });

    socket.on("disconnect", function() {
        try {
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
                        io.sockets.in(room.substring(1)).emit("numConnected", {"roomName" : room.substring(1), "numConnected" : io.sockets.clients(room.substring(1)).length}); //number of clients in a room

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
        } catch (err) {
            console.log(logStr() + err);
        }
    });
});

function logStr() {
    return "uwcr - " + new Date().toUTCString() + " - ";
}

//Determines whether the given string is a proper username or room
//has to have a value and not empty + alphanumeric + underscore + hyphen
function isValidString (string) {
    if(string) {
        return /^[a-zA-Z0-9_ ]*$/.test(string);
    }
    return false;
}

//given a room, generate a list of usernames that represent users in that room
function getUsernamesList(room) {
    try {
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
    } catch (err) {
        console.log(logStr() + err);
    } finally {
        return usernamesList;
    }
}

function getUserRoomList(socket) {
    try {
        var roomList = new Array();
        for (room in io.sockets.manager.roomClients[socket.id]) {
            if (room == "") {
                roomList.push("Lobby");
            }
            else {
                roomList.push(room.substring(1));
            }
        }
    } catch (err) {
        console.log(logStr() + err);
    } finally {
        return roomList;
    }
}

app.post("/main", function(req, res){
    try {
        console.log(logStr() + "POST Request made to " + "/main");
        username = req.body.username.trim();

        //cookie stuff
        if(isValidString(username)) {
            console.log(logStr() + "Setting cookie for username: " + username);
            //set the cookie to be valid for 1 hour
            res.cookie("uwcr", username, {maxAge: 60 * 60 * 1000});
        }
        //end cookie stuff

        if (isValidString(username) && !usersListr[username]) {
            console.log(logStr() + "User logged in as '" + username + "'");
            res.render(main_page, {"username" : username});

        }
        else {
            res.render(login_page, {"usernameInvalid": true});
        }
    } catch (err) {
        console.log(logStr() + err);
        //redirecting back to login page
        res.render(login_page);
    }
});

app.get("/main", function(req, res){
    console.log(logStr() + "GET Request made to " + "/main");
    res.render(login_page);
});

app.get("/error1", function(req, res){
    console.log(logStr() + "GET Request made to " + "/error1");
    res.render(login_page, {"serverRestart": true});
});

app.get("/error2", function(req, res){
    console.log(logStr() + "GET Request made to " + "/error2");
    res.render(login_page, {"usernameInvalid": true});
});

app.get("/", function(req, res){
    //we want to ignore some OpenShift specific stuff that makes requests to the service
    if(req.headers["user-agent"] && req.headers["user-agent"] !== "Ruby") {
        console.log(logStr() + "GET Request made to " + "/");
        console.log("\tRequest headers: " + JSON.stringify(req.headers));

        //try to get username from cookie header
        if(req.headers.cookie && req.headers.cookie.split("=")[0] == "uwcr") {
            var username = req.headers.cookie.split("=")[1];
            console.log(logStr() + "Client has a cookie set, logging in as: " + username);
            res.render(main_page, {"username" : username});
        }
        else {
            res.render(login_page);
        }
    }
});

app.get("/aboutus", function(req, res){
    console.log("GET Request made to " + "/aboutus");
    res.render("aboutus.jade");
});
