var socket = io.connect();

//keep a list of rooms that the client is in so we don't make a lot of server requests
var userRoomsList;

//the current room that the user is in.
var currentRoom;

//the client's username
var myUsername;

/**
 * From http://stackoverflow.com/questions/6234773/can-i-escape-html-special-chars-in-javascript
 * Provides a means to escape user inputted messages
 * The rationale to use this is that this is a cleaner, simple, and effective way to escape HTML entities
 * than some hack way with jQuery functions (eg. text()) that may not work cross browsers.
 **/
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

function addMessage(msg, roomName, username) {
    //append to the right div/ie to the right room
    $('div#chatContainer div#room-' + roomName + ' div.chatEntries').append('<div class="message bg-primary"><span class="msgUser">' + username + '</span> : <span class="msgContent">' + escapeHtml(msg) + '</span></div>');

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
        var data = {messageBody : messageBody, messageRoom : currentRoom};
        socket.emit('sendMessage', data);

        //this current implementation is that when you send a message, for you, the message doesn't go to the server, only for others
        addMessage(messageBody, currentRoom ,"Me");
        $('#messageInput').val(''); //clear the input field
    }
}

socket.on('sendMessageResponse', function (data) {
    addMessage(data['message'], data['roomName'], data['username']);
});

socket.on('numConnected', function (data) {
    $('#numConnected').html('Users online: ' + data.numConnected);
});

socket.on('updateRoomsList', function (roomsList) {
    userRoomsList = roomsList;
});

socket.on('saveUsername', function (data) {
    myUsername = data.clientUsername;
});

socket.on('loadUsersList', function (data) {
    $('#usersList-' + data.roomName).empty();
    $('#usersList-' + data.roomName).append('<div class="myUsername"><span class="glyphicon glyphicon-user"></span>' + myUsername + " (You)" + '</div>');
      for (var i = 0 ; i < data.usernamesList.length ; i++) {
        if (data.usernamesList[i] != myUsername) {
          $('#usersList-' + data.roomName).append('<div class="username" draggable="true"><span class="glyphicon glyphicon-user"></span>' + data.usernamesList[i] + '</div>');

          var usernameElement = $('div.username:contains(' + data.usernamesList[i] + ')');
          usernameElement.on({
              dragstart: function(e) {
                  e.dataTransfer.setData("username", $(this).text());
                  $(this).css('opacity', '0.4');
              },
              dragend: function(e) {
                  $(this).css('opacity', '1');
              },
          });
      }
    }
});

socket.on('roomInvite', function (data) {
    window.alert("User " + data.inviter + " invites you to " + data.roomName);
    socket.emit('acceptInvitation', data.roomName);
});

socket.on('createRoomResponse', function (data) {
    if(data.created) {
        //chatContainer DOM creation
        $('div#chatContainer').append('<div id="room-'+ data.roomName + '" class="tab-pane"><div class="chatEntries"></div></div>');
        //room userList DOM creation
        $('div#usersConnected').append('<div id="usersList-' + data.roomName + '" class="usersList"></div>')
        //tab dom creation
        $('ul#tab').append('<li class="span roomTab"><a href="#room-' + data.roomName + '" data-toggle="tab">'+ data.roomName +'<span class="glyphicon glyphicon-remove"></span></a></li>');

        //open tab functionality
        $('ul#tab li:contains(' + data.roomName + ') a').click(function (e) {
            e.preventDefault();
            $(this).tab('show');
            $('div.usersList').hide(); //hide all other usersLists
            $('div#usersList-' + data.roomName).show(); //show the specific room usersList
            currentRoom = data.roomName;
        });

        //close tab functionality
        $('ul#tab li:contains(' + data.roomName + ') span.glyphicon-remove').click(function () {
            $(this).parent().parent().remove(); //removes the li tag
            $('div#room-' + data.roomName).remove(); //remove the main chatpanel
            $('div#userlist-' + data.roomName).remove(); //remove userlist
            socket.emit('leaveRoom', data.roomName);

            $('ul#tab a:contains("Lobby")').click(); //go back to the lobby
            currentRoom = "Lobby";
        });

        //attach dnd event listeners
        $('#tabContainer .roomTab:contains(' + data.roomName + ') a').on({
            dragleave: function(e) {
                $(this).removeClass('over');
                e.preventDefault();
            },
            dragenter: function(e) {
                $(this).addClass('over');
                e.preventDefault();
            },
            dragover: function(e) {
                $(this).addClass('over');
                e.preventDefault();
            },
            drop: function(e) {
                $(this).removeClass('over');
                e.preventDefault();
                socket.emit('inviteUser', {'username' : e.dataTransfer.getData('username'), 'roomName' : data.roomName});
            }
        });

        $('#roomModalCloseButton').click(); //close the window

        //subscribe to room
        socket.emit('joinRoom', data.roomName);

        $('ul#tab li:contains(' + data.roomName + ') a').click();

    }
    else {
        if(data.errorCode == 1) {
            window.alert("Illegal room name! Room name can only contain alphanumeric characters, hyphen, and underscores!");
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

    jQuery.event.props.push('dataTransfer');

    //the default active room is Lobby
    currentRoom = "Lobby";

    $('#messageInput').keypress(function(event){
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if(keycode == '13'){
            $("#submit").click();
        }
    });

    $('ul#tab a:contains("Lobby")').click(function (e) {
        e.preventDefault();
        $(this).tab('show');
        $('div.usersList').hide(); //hide all other usersLists
        $('div#usersList-Lobby').show(); //show the main usersList
        currentRoom = "Lobby"
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

    $('#submit').click(function() {sentMessage();});
});
