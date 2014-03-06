var socket = io.connect();

function addMessage(msg, username) {
    $("#chatEntries").append('<div class="message bg-primary"><span class="msgUser">' + username + '</span> : <span class="msgContent">' + msg + '</span>');
}

function sentMessage() {
    if ($('#messageInput').val() != "") {
        socket.emit('message', $('#messageInput').val());
        addMessage($('#messageInput').val(), "Me", new Date().toISOString(), true);
        $('#messageInput').val('');
    }
}

function setUsername() {
    if ($("#usernameInput").val() != "") {
        socket.emit('setUsername', $("#usernameInput").val());
    }
    $("#loginForm").submit();

}

// TODO we need a better way to determine if a user is logged in or not
// this is to avoid the case where thare are >2 windows open and they both log in
// the second to log in will list the first username twice since even though
// the second window is not logged in, it still handles the log-in event, maybe there is a soln
function loggedIn() {
    if($('#chatContainer').is(':visible')) {
        return true;
    }
    else {
        return false;
    }
}

socket.on('message', function(data) {
    addMessage(data['message'], data['username']);
});

socket.on('numConnected', function(data) {
    $('#numConnected').html('Users online: ' + data.numConnected);
});

socket.on('loadUsersList', function(data) {
    if(loggedIn) {
        for (var i = 0 ; i < data.usersList.length ; i++) {
            $('#usersConnected').append('<div class="username">' + data.usersList[i] + '</div>');
        }
    }
});

socket.on('userConnected', function(data) {
    // html inject? gotta fix this
    if(loggedIn()) {
        $('#usersConnected').append('<div class="username">' + data.username + '</div>')

        // Add msg buffer logic here
    }
});

socket.on('userDisconnected', function(data) {
    // html inject? gotta fix this
    setTimeout(function () {
         //do something
        $('#usersConnected div:contains(' + data.username + ')').remove();

    }, 10000);
});

$(function() {
    $('#setUsername').click(function() {setUsername()});
    $('#submit').click(function() {sentMessage();});
});