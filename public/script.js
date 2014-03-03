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
        $('#chatControls').show();
        $('#login').hide();
    }
}

socket.on('message', function(data) {
    addMessage(data['message'], data['username']);
});

socket.on('numConnected', function(data) {
    $('#numConnected').html('Users online: ' + data.numConnected);
});

socket.on('loadUsersList', function(data) {
    for (var i = 0 ; i < data.usersList.length ; i++) {
        $('#usersConnected').append('<div>' + data.usersList[i] + '</div>');
        console.log(data.usersList[i]);
    }
});

socket.on('userConnected', function(data) {
    // html inject? gotta fix this
    $('#usersConnected').append('<div>' + data.username + '</div>')
});

socket.on('userDisconnected', function(data) {
    // html inject? gotta fix this
    $('#usersConnected div:contains(' + data.username + ')').remove();
});

$(function() {
    $("#chatControls").hide();
    $("#setUsername").click(function() {setUsername()});
    $("#submit").click(function() {sentMessage();});
});