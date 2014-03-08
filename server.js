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

var numConnected = 0;
var usersList = Array();
var msgBuffer = Array();

io.sockets.on('connection', function (socket) {

    //at this point the user is guarenteed to have a valid username, TODO I should add vaildation login before this point
    socket.set('username', username);

    console.log('User ' + username + ' connected');
    usersList.push(username);
    io.sockets.emit('loadUsersList', {usersList : usersList});  
    numConnected++;
    io.sockets.emit('numConnected', {numConnected : numConnected});
    console.log(numConnected + ' connected');

    socket.on('message', function (message) {
        socket.get('username', function (error, name) {
            var data = { 'message' : message, username : name };
            socket.broadcast.emit('message', data);
            console.log('user ' + name + ' send this : ' + message);

            //Add msg buffer logic here, maybe oop
        });
    });

    socket.on('disconnect', function() {
        socket.get('username', function (error, name) {
            console.log('User ' + name + ' has disconnected');
            numConnected--;
            io.sockets.emit('numConnected', {numConnected : numConnected});
                //remove user from the user array
            var index = usersList.indexOf(name);
            console.log("INDEX IS  " + index);
            if(index > -1) {
                console.log("usersList was " + usersList);
                usersList.splice(index, 1);
                console.log("usersList is now " + usersList);
            }
            console.log("Users left on the service " + usersList);
            socket.broadcast.emit('loadUsersList', {usersList : usersList});  
        });
    });
});

var params = new Array(numConnected);
var username;
app.post('/main', function(req, res){
    console.log("POST Request made to " + '/main');
    username = req.body.username;
    res.render('main.jade', {needSocketIo: true});
});

app.get('/main', function(req, res){
    console.log("GET Request made to " + '/main');
    res.render('login.jade', {needSocketIo: false});
});

app.get('/', function(req, res){
    console.log("GET Request made to " + '/');
    res.render('login.jade', {needSocketIo: false});
});






