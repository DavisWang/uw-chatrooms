var socket = io.connect();

function addMessage(msg, roomName, username) {
    //append to the right div/ie to the right room
    // window.alert(msg + " " + roomName + " " + username);
    $('div#chatContainer div#room-' + roomName + ' div.chatEntries').append('<div class="message bg-primary"><span class="msgUser">' + username + '</span> : <span class="msgContent">' + msg + '</span></div>');

    var roomChatEntries = $('div#chatContainer div#room-' + roomName + ' div.chatEntries');
    if (Math.abs((roomChatEntries[0].scrollHeight - roomChatEntries.scrollTop() - roomChatEntries.outerHeight()) < 200) ) {
        roomChatEntries.animate({
            scrollTop: roomChatEntries[0].scrollHeight
        }, 200);
    }
    else {
        $('#moreMsgs').filter(':hidden').fadeIn(1000).delay(3000).fadeOut(3000);
    }
}

function sentMessage() {
    if ($('#messageInput').val() != "") {
        var messageBody = $('#messageInput').val();
        var roomName = $('ul#tab li.active').text();
        var data = {messageBody : messageBody, messageRoom : roomName};
        socket.emit('message', data);

        addMessage(messageBody, roomName ,"Me", new Date().toISOString(), true);
        $('#messageInput').val(''); //clear the input field
    }
}

function setUsername() {
    $("#loginForm").submit();
}

socket.on('message', function (data) {
    addMessage(data['message'], data['roomName'], data['username']);
});

socket.on('numConnected', function (data) {
    $('#numConnected').html('Users online: ' + data.numConnected);
});


socket.on('loadUsersList', function (usernamesList) {
    // TODO gotta fix this, encode
    $('#usersList').empty();
    for (var i = 0 ; i < usernamesList.length ; i++) {
        $('#usersList').append('<div class="username">' + usernamesList[i] + '</div>');
    }
});

socket.on('createRoomResponse', function (data) {
    if(data.created) {
        //chatContainer DOM creation
        $('div#chatContainer').append('<div id="room-'+ data.roomName + '" class="tab-pane"><div class="chatEntries"></div></div>');

        //tab dom creation
        $('ul#tab').append('<li class="span"><a href="#room-' + data.roomName + '" data-toggle="tab">'+ data.roomName +' <span class="glyphicon glyphicon-remove"></span></a></li>');
        $('ul#tab li:contains(' + data.roomName + ')').click(function (e) {
            e.preventDefault();
            $(this).tab('show');
        });
        $('ul#tab li:contains(' + data.roomName + ') span.glyphicon-remove').click(function () {
            $(this).parent().parent().remove(); //removes the li tag
            $('div#room-' + data.roomName).remove();
            socket.emit('leaveRoom', data.roomName);
        });

        $('#roomModalCloseButton').click(); //close the window
        //subscribe to room
        socket.emit('joinRoom', data.roomName);
    }
    else {
        if(data.errorCode == 1) {
            window.alert("Illegal room name! Room name can only contain alphanumeric characters, hyphen, and spaces!");
        }
        else if (data.errorCode == 2) {
            window.alert("A room with that name already exists! Please choose another name!");
        }
        else if (data.errorCode == 3) {
            window.alert("Room name 'Lobby' is reserved, please choose another name!");
        }
        else {
            window.alert("Unknown error! Room cannot be created!");
        }
    }
});


$(function() {
    $('#messageInput').keypress(function(event){
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if(keycode == '13'){
            $("#submit").click();
        }
    });

    $('ul#tab a:contains("Lobby")').click(function (e) {
        e.preventDefault()
        $(this).tab('show')
    });
    //by default, show the Lobby tab
    $('ul#tab a:contains("Lobby")').tab('show');

    $('ul#tab li span.glyphicon-remove').click(function () {
        $(this).parent().parent().remove(); //removes the li tag
        var roomName = $(this).parent().text();
        $('div#room-' + roomName).remove();
        socket.emit('leaveRoom', roomName);
    });

    //Modal related functionality
    $('#addRoom').click(function () {
        $('#createRoomModal').modal('show')
    });

    $('#createRoomButton').click(function () {
        var roomName = $('input#modalInput').val();
        if(roomName) {
            socket.emit('createRoom', roomName);
            $('input#modalInput').val('');
        }
    });

    $("#modalInput").keypress(function(event){
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if(keycode == '13'){
            $("#createRoomButton").click();
        }
    });
    //Modal box login ends here

    $('#setUsername').click(function() {setUsername()});
    $('#submit').click(function() {sentMessage();});
});
