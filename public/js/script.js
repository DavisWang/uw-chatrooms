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

/**
 * Transforms a string into an HTML attribute
 * ie. replaces all spaces with dashes
 **/
function toClassString(str) {
    return str.replace(/\s/g, "-");
}

function addMessage(msg, roomName, username) {
    var roomNameClass = toClassString(roomName);

    //check if user is in the room. If not, add 1 new unread message.
    if (currentRoom != roomName) {
      var index = userRoomsList.map(function(e) { return e.roomName; }).indexOf(roomName);
      userRoomsList[index].numNewMsgs++;
      //show badge if it is hidden
      if($('#' + roomNameClass + '-badge').is(":hidden")){
        $('#' + roomNameClass + '-badge').parent().addClass("tab-badge-notification-bg");
        $('#' + roomNameClass + '-badge').show();
      }
      $('#' + roomNameClass + '-badge').text(userRoomsList[index].numNewMsgs);
    }
    
    //create message timestamp
    var time = new Date();
    var hour = time.getHours();
    var minute = time.getMinutes();
    var second = time.getSeconds();
    var sign = "am";
    if (hour > 11) {
      sign = "pm";
      if (hour > 12) {
        hour = hour % 12;
      }
    }
    if (minute < 10) {
      minute = "0" + minute;
    }
    if (second < 10) {
      second = "0" + second;
    }
    time = hour + ":" + minute + ":" + second + " " + sign;

    //append to the right div/ie to the right room
    $('div#chat-panel div#room-' + roomNameClass + ' div.chat-entries').append('<div class="message bg-primary"><span class="msgUser">' 
      + username + '</span> : <span class="msgContent">' + escapeHtml(msg) + '</span>' + '<span class="message-timestamp">' 
      + time + '</span>' + '</div>');

    var roomChatEntries = $('div#chat-panel div#room-' + roomNameClass + ' div.chat-entries');
    if (Math.abs((roomChatEntries[0].scrollHeight - roomChatEntries.scrollTop() - roomChatEntries.outerHeight()) < 200)) {
        roomChatEntries.animate({
            scrollTop: roomChatEntries[0].scrollHeight
        }, 200);
    }
    else {
        $('#more-msgs').filter(':hidden').fadeIn(1000).delay(3000).fadeOut(3000);
    }
}

function sentMessage() {
    if ($('#message-input').val() != "") {
        var messageBody = $('#message-input').val();
        var data = {"messageBody" : messageBody, "messageRoom" : currentRoom};
        socket.emit('sendMessage', data);

        //this current implementation is that when you send a message, for you, the message doesn't go to the server, only for others
        addMessage(messageBody, currentRoom ,"Me");
        $('#message-input').val(''); //clear the input field
    }
}

socket.on('disconnect', function (data) {
    console.log('reconnect');
    socket.socket.reconnect();
});

socket.on('kickClient', function (data) {
    window.location.href = data.url;
});

socket.on('sendMessageResponse', function (data) {
    addMessage(data['message'], data['roomName'], data['username']);
});

socket.on('numConnected', function (data) {
    $('#num-connected').html('Users online: ' + data.numConnected);
});

socket.on('initRoomsList', function (roomsList, publicRoomsList) {
    userRoomsList = [{'roomName': roomsList[0], numNewMsgs: 0}];
    $('#public-rooms-title').text("Public Rooms:");
    populatePublicRoomsList({"publicRoomsList": publicRoomsList});
});

socket.on('saveUsername', function (data) {
    myUsername = data.clientUsername;
});

socket.on('loadUsersList', function (data) {
    var roomNameClass = toClassString(data.roomName);

    $('#usersList-' + roomNameClass).empty();
    $('#usersList-' + roomNameClass).append('<div class="my-username"><span class="glyphicon glyphicon-user"></span>' + myUsername + " (You)" + '</div>');
      for (var i = 0 ; i < data.usernamesList.length ; i++) {
        if (data.usernamesList[i] != myUsername) {
            $('#usersList-' + roomNameClass).append('<div class="username" draggable="true"><span class="glyphicon glyphicon-user"></span>' + data.usernamesList[i] + '</div>');

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
        //adds room to client's userRoomsList array
        userRoomsList.push({'roomName' : data.roomName, 'numNewMsgs': 0});
        var roomNameClass = toClassString(data.roomName);

        //chat container DOM creation
        $('div#chat-panel').append('<div id="room-'+ roomNameClass + '" class="tab-pane"><div class="chat-entries"></div></div>');
        //room userList DOM creation
        $('div#username-container').append('<div id="usersList-' + roomNameClass + '" class="usersList"></div>')
        //tab dom creation
        $('ul#tab').append('<li class="span roomTab"><a href="#room-' + roomNameClass + '" data-toggle="tab">' +
          '<span id = "' + roomNameClass + '-badge" class="badge badge-tab"></span>' + data.roomName + '<span class="glyphicon glyphicon-remove"></span></a></li>');

        //open tab functionality
        $('ul#tab li:contains(' + data.roomName + ') a').click(function (e) {
            e.preventDefault();
            $(this).tab('show');
            $('div.usersList').hide(); //hide all other usersLists
            $('div#usersList-' + roomNameClass).show(); //show the specific room usersList
            currentRoom = data.roomName;

            //hide badge for the room after user clicks on the room
            var index = userRoomsList.map(function(e) { return e.roomName; }).indexOf(currentRoom);
            userRoomsList[index].numNewMsgs = 0;
            $('#' + roomNameClass + '-badge').hide();
            $('#' + roomNameClass + '-badge').parent().removeClass("tab-badge-notification-bg");
            
            //hide the public rooms list for rooms other than "Lobby"
            $('#public-rooms-container').hide();
        });

        //close tab functionality
        $('ul#tab li:contains(' + data.roomName + ') span.glyphicon-remove').click(function () {
            $(this).parent().parent().remove(); //removes the li tag
            $('div#room-' + roomNameClass).remove(); //remove the main chatpanel
            $('div#userlist-' + roomNameClass).remove(); //remove userlist
            socket.emit('leaveRoom', data.roomName);

            $('ul#tab a:contains("Lobby")').click(); //go back to the lobby
            currentRoom = "Lobby";
            
            //removes room from client's userRoomsList array
            var index = userRoomsList.map(function(e) { return e.roomName; }).indexOf(data.roomName);
            userRoomsList.splice(index, 1);
        });

        //attach dnd event listeners
        $('#tab-container .roomTab:contains(' + data.roomName + ') a').on({
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

        $('#room-modal-close-button').click(); //close the window

        //subscribe to room
        socket.emit('joinRoom', data.roomName);

        $('ul#tab li:contains(' + data.roomName + ') a').click();

    }
    else {
        if(data.errorCode == 1) {
            window.alert("Illegal room name! Room name can only contain alphanumeric characters, spaces, and underscores!");
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

function populatePublicRoomsList(data) {
  $('#public-rooms-list').empty();
  for (var i = 0 ; i < data.publicRoomsList.length ; i++) {
    $('#public-rooms-list').append('<div class="public-room-entry" id=' + toClassString(data.publicRoomsList[i]) + 
      '-public-room><span class="glyphicon glyphicon-home public-room-icon"></span>' + data.publicRoomsList[i] + '</div>');
    var publicRoomElement = $('div.public-room-entry:contains(' + data.publicRoomsList[i] + ')');
    publicRoomElement.on({
        click: function(e) {
          //join the public room if it hasn't been joined yet, otherwise open the public room's tab
          var roomName = this.id;
          var index = roomName.indexOf("-public-room");
          var roomName = roomName.slice(0, index);
          roomName = roomName.replace("-", " ");
          var index = userRoomsList.map(function(e) { return e.roomName; }).indexOf(roomName);
          if (index == -1) {
            socket.emit("joinPublicRoom", roomName);
          } else {
            $('a[href="#room-' + toClassString(roomName) + '"]').click();
          }
        }
    });
  }
}

socket.on('populatePublicRooms', function (data) {
  populatePublicRoomsList(data);
});

$(function() {

    jQuery.event.props.push('dataTransfer');

    //the default active room is Lobby
    currentRoom = "Lobby"

    $('#message-input').keypress(function(event){
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

        //hide badge for the room after user clicks on the room
        var index = userRoomsList.map(function(e) { return e.roomName; }).indexOf(currentRoom);
        userRoomsList[index].numNewMsgs = 0;
        $('#' + currentRoom + '-badge').hide();
        $('#' + currentRoom + '-badge').parent().removeClass("tab-badge-notification-bg");
        
        //show the public rooms list
        $('#public-rooms-container').show();
    });
    //by default, show the Lobby tab
    $('ul#tab a:contains("Lobby")').tab('show');

    $('ul#tab li span.glyphicon-remove').click(function () {
        $(this).parent().parent().remove(); //removes the li tag
        var roomName = $(this).parent().text();
        $('div#room-' + toClassString(roomName)).remove();
        socket.emit('leaveRoom', roomName);
    });

    //Modal related functionality
    $('#add-room').click(function () {
        $('#create-room-modal').modal('show');
    });

    $('#create-room-buttom').click(function () {
        var roomName = $('input#create-room-modal-input').val();
        //set isPublic to true (1) if checkbox is checked, otherwise false (0)
        var isPublic = $('input#public-room-checkbox').prop("checked") ? 1 : 0;
        if (roomName) {
            socket.emit('createRoom', {"roomName" : roomName, "isPublic" : isPublic});
            $('input#create-room-modal-input').val('');
            //reset the checkbox
            $('input#public-room-checkbox').prop("checked", false);
        }
    });

    $("#create-room-modal-input").keypress(function(event){
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if(keycode == '13'){
            $("#create-room-buttom").click();
        }
    });
    //Modal box login ends here

    $('#submit').click(function() {
        sentMessage();
    });
});
