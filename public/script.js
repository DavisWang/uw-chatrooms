var socket = io.connect();

function addMessage(msg, username) {
    $("#chatEntries").append('<div class="message"><p>' + username + ' : ' + msg + '</p></div>');
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

        $('#chatContainer').show();
        $('#login').hide();
    }
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
            $('#usersConnected').append('<div>' + data.usersList[i] + '</div>');
        }
    }
});

socket.on('userConnected', function(data) {
    // html inject? gotta fix this
    if(loggedIn()) {
        $('#usersConnected').append('<div>' + data.username + '</div>')
    }
});

socket.on('userDisconnected', function(data) {
    // html inject? gotta fix this
    $('#usersConnected div:contains(' + data.username + ')').remove();
});

$(function() {
    $("#chatContainer").hide();
    $("#setUsername").click(function() {setUsername()});
    $("#submit").click(function() {sentMessage();});
});