var socket = io.connect();

function addMessage(msg, username) {
    $("#chatEntries").append('<div class="message bg-primary"><span class="msgUser">' + username + '</span> : <span class="msgContent">' + msg + '</span>');
}

function sentMessage() {
    if ($('#messageInput').val() != "") {
        socket.emit('message', $('#messageInput').val());

        if (Math.abs(($('#chatEntries')[0].scrollHeight - $('#chatEntries').scrollTop() - $('#chatEntries').outerHeight()) < 20) ) {
            $("#chatEntries").animate({
                scrollTop: $('#chatEntries')[0].scrollHeight
            }, 200);
        }
        else {
            $('#moreMsgs').filter(':hidden').fadeIn(1000).delay(3000).fadeOut(3000);
        }

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

$(function() {
    $('#messageInput').keypress(function(event){
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if(keycode == '13'){
            $("#submit").click();
        }
    });

    $('#setUsername').click(function() {setUsername()});
    $('#submit').click(function() {sentMessage();});
});
