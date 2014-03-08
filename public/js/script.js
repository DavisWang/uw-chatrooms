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
    $("#loginForm").submit();
}

socket.on('message', function(data) {
    addMessage(data['message'], data['username']);
});

socket.on('numConnected', function(data) {
    $('#numConnected').html('Users online: ' + data.numConnected);
});


socket.on('loadUsersList', function(data) {
    // TODO gotta fix this, encode
    $('#usersList').empty();
    for (var i = 0 ; i < data.usersList.length ; i++) {
            $('#usersList').append('<div class="username">' + data.usersList[i] + '</div>');
    }
});

//TODO, when a new message is received, scroll to bottom, maybe only if they are already at the bottom, if not, maybe show a prompt?
//TODO, implement timestamp and history

$(function() {
    $('#setUsername').click(function() {setUsername()});
    $('#submit').click(function() {sentMessage();});
});