/**
 * From http://stackoverflow.com/questions/13745519/send-custom-data-along-with-handshakedata-in-socket-io
 * Provides a means to pass custom data to socket io
 * This fixes the user A/B concurrent request bug
 **/
var socket = io.connect("", {query : "username=" + username});

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

function toClassStringr(str) {
    return str.replace(/-/g, " ");
}

/**
 * Handles putting the message in the DOM
 * msg = the actual message, pre sanitation
 * roomName = the room which this msg was sent to
 * username = the user who sent this msg
 * other = a boolean to differentiate a message sent by self/others
 **/
function addMessage(msg, roomName, username, other) {
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
    var bgCSSClass = other ? "bg-primary" : "bg-info";
    $('div#chat-panel div#room-' + roomNameClass + ' div.chat-entries').append('<div class="message ' + bgCSSClass + '"><span class="msgUser">'
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

    emojify.run(); //enable emojis
}

function sentMessage() {
    if ($('#message-input').val() != "") {
        var messageBody = $('#message-input').val();
        var data = {"messageBody" : messageBody, "messageRoom" : currentRoom};
        socket.emit('sendMessage', data);

        //this current implementation is that when you send a message, for you, the message doesn't go to the server, only for others
        addMessage(messageBody, currentRoom ,"Me", false);
        $('#message-input').val(''); //clear the input field
    }
}

//populates public rooms list in the lobby
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
              roomName = toClassStringr(roomName);
              var index = userRoomsList.map(function(e) { return e.roomName; }).indexOf(roomName);
              if (index == -1) {
                socket.emit("joinRoom", {"roomName" : roomName, "hasAccepted" : true});
              } else {
                $('a[href="#room-' + toClassString(roomName) + '"]').click();
              }
            }
        });
    }
}

socket.on('disconnect', function (data) {
    socket.socket.reconnect();
});

socket.on('kickClient', function (data) {
    window.location.href = data.url;
});

socket.on('sendMessageResponse', function (data) {
    addMessage(data['message'], data['roomName'], data['username'], true);
});

socket.on('numConnected', function (data) {
    if (data.roomName == "Lobby") {
      $('#num-connected-Lobby').html('Users online: ' + data.numConnected);
    } else {
      $('#num-connected-' + data.roomName).html('Users in room: ' + data.numConnected);
    }
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

    //we only want to update all-users-list when Lobby's usersList is updated, ie. someone joined or left uwcr
    if(data.roomName == "Lobby") {
        $('#all-users-list').empty();
        if (data.usernamesList.length == 1) {
            $('#all-users-list').append("(No one's online...)");
        }
    }

    $('#usersList-' + roomNameClass).append('<div class="my-username"><span class="glyphicon glyphicon-user"></span>' + myUsername + " (You)" + '</div>');
    for (var i = 0 ; i < data.usernamesList.length ; i++) {
      if (data.usernamesList[i] != myUsername) {
          $('#usersList-' + roomNameClass).append('<div class="username"><span class="glyphicon glyphicon-user"></span>' + data.usernamesList[i] + '</div>');
          if(data.roomName == "Lobby") {
              $('#all-users-list').append('<div class="username"><span class="glyphicon glyphicon-user"></span>' + data.usernamesList[i] + '</div>');
              $('#all-users-list div.username:contains(' + data.usernamesList[i] + ')').click(function (e) {
                  socket.emit('inviteUser', {'username' : $(this).text(), 'roomName' : currentRoom});
              });
          }
      }
    }
    
  //populate create-room modal's users list - START
  //allUsernamesList is undefined when a user joins/leaves/creates a room - no new users are introduced so no need to update the list
  //allUsernamesList is defined when a user connects/disconnects - needs to update the list
    if (data.allUsernamesList !== undefined) {
      if (data.allUsernamesList.length == 1) { //if there are no other users online, the user will be presented with "no one's online"
          $('#create-room-modal-invite-user-container').empty();
          $('#create-room-modal-invite-user-container').append("(No one's online...)");
      } else {
          $('#create-room-modal-invite-user-container').empty();
          for (var i = 0 ; i < data.allUsernamesList.length ; i++) {
            if (data.allUsernamesList[i] != myUsername) {
                //populate the create-new-room modal's users list
                $('#create-room-modal-invite-user-container').append('<div class="create-room-modal-username" data-username="' 
                  + data.allUsernamesList[i] + '" data-selected="false"> <span class="glyphicon glyphicon-user"></span>' + data.allUsernamesList[i] + '</div>');
            }
          }

          //create username button behaviour
          $('div.create-room-modal-username').click(function() {
            if ($(this).data("selected") == "true"){
              $(this).removeClass("create-room-modal-username-selected");
              $(this).data("selected", "false");
            } else {
              $(this).addClass("create-room-modal-username-selected");
              $(this).data("selected", "true");
            }
          });
      }
    }
  //populate create-room modal's users list - END
});

socket.on('roomInvite', function (data) {
    $('#invitation-modal>div>div>div.modal-body').text("User " + data.inviter + " has invited you to " + data.roomName);
    $('#invitation-modal-accept-button').data("roomName", data.roomName);
    $('#invitation-modal').modal('show');
});

socket.on('joinRoomResponse', function (data) {
    if (data.created) {
        //adds room to client's userRoomsList array
        userRoomsList.push({'roomName' : data.roomName, 'numNewMsgs': 0});
        var roomNameClass = toClassString(data.roomName);

        //chat container DOM creation
        $('div#chat-panel').append('<div id="room-'+ roomNameClass + '" class="tab-pane"><div class="chat-entries"></div></div>');
        //room num-connected DOM creation
        $('div#num-connected-container').append('<div id="num-connected-' + roomNameClass + '" class="num-connected"></div>');
        //room userList DOM creation
        $('div#username-container').append('<div id="usersList-' + roomNameClass + '" class="usersList"></div>')
        //tab dom creation
        $('ul#tab').append('<li class="span roomTab"><a href="#room-' + roomNameClass + '" data-toggle="tab">' +
          '<span id = "' + roomNameClass + '-badge" class="badge tab-badge"></span>' + data.roomName + '<span class="glyphicon glyphicon-remove"></span></a></li>');

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
            
            //hide number of users connected in all other rooms
            $('div.num-connected').hide();

            //show number of users connected in this specific room
            $('div#num-connected-' + roomNameClass).show();

            //show the all-users-list, since we are in a user created room now
            $('div#all-users-list-container').show();
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

        $('ul#tab li:contains(' + data.roomName + ') a').click();
    }
    else {
        if (data.errorCode == 1) {
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

socket.on('populatePublicRooms', function (data) {
    populatePublicRoomsList(data);
});

$(function() {
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
        
        //hide number of users connected in all other rooms
        $('div.num-connected').hide();
        //show number of users connected in Lobby
        $('div#num-connected-Lobby').show();

        //hide the all-users-list-container
        $('div#all-users-list-container').hide();
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

    $('#create-room-button').click(function () {
        var roomName = $('input#create-room-modal-input').val();
        //set isPublic to true (1) if checkbox is checked, otherwise false (0)
        var isPublic = $('input#public-room-checkbox').prop("checked") ? 1 : 0;
        if (roomName) {
            socket.emit('createRoom', {"roomName" : roomName, "isPublic" : isPublic});
            $('input#create-room-modal-input').val('');
            //reset the checkbox
            $('input#public-room-checkbox').prop("checked", false);
            //close the window
            $('#room-modal-close-button').click();
            
            //send room invitations to other users if any
            var usersToInvite = new Array();
            $.each($("#create-room-modal-invite-user-container>div"), function() {
              if ($(this).data("selected") == "true") {
                usersToInvite.push($(this).data("username"));
                //reset button properties
                $(this).removeClass("create-room-modal-username-selected");
                $(this).data("selected", "false");
              }
            });
            for (var i = 0; i < usersToInvite.length; i++) {
              socket.emit('inviteUser', {'username' : usersToInvite[i], 'roomName' : roomName});
            }
        }
    });

    $("#create-room-modal-input").keypress(function(event){
        var keycode = (event.keyCode ? event.keyCode : event.which);
        if(keycode == '13'){
            $("#create-room-button").click();
        }
    });
    
    $('#invitation-modal-accept-button').click(function () {
        var roomName = $('#invitation-modal-accept-button').data("roomName");
        socket.emit('joinRoom', {"roomName" : roomName, "hasAccepted" : true});
        $('#invitation-modal').modal('hide'); //close the window
    });
    
    $('#invitation-modal-decline-button').click(function () {
        var roomName = $('#invitation-modal-accept-button').data("roomName");
        socket.emit('joinRoom', {"roomName" : roomName, "hasAccepted" : false});
    });
    //Modal box login ends here

    $('#submit').click(function() {
        sentMessage();
    });

    emojify.setConfig({
        emojify_tag_type : "span.msgContent",
        img_dir : "/img/emoji/"
    });
});
