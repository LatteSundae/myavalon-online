//Game Control

//Game State Array
var states = ["wait","randomRole","sendMission","vote","mission",
  "missionSuccess","missionFail","update","findMerlin","evilWin","goodWin"]; 

//Room data
var room_id = null; //if room id is not null, means that this player is in a room (room_list[room_id])
var room_name = "";
var room_owner_id = null;

//Player Information
var player_data = []; //player list
var last_player_data = null; //last games player list
var set_name = false; //check if player's name is set
var join_game = false; //check if player is join a game
var player_id = null; //check if player is in a game
var player_role = null; //this player's role

//Change every time mission end
var leader_id = null;
var leader_name = null;
var team_size = null;
var team_members = [];
var two_fail = false;

//Role set
var max_good = 0;
var max_evil = 0;
var good_characters = [];
var evil_characters = [];

var content_height = 0;

$(function() {
    var content = $('#content');
    var status = $('#status');
    var input = $('#input');
    var playerList = $('#playerList');
    var stateDisplay = $('#stateDisplay');
    var myName = false;

    //Websocket
    socket = io.connect('http://localhost:3000'); //For testing local
    //socket = io.connect('https://myavalon-online.herokuapp.com/');
    //Server
    socket.on('open', function(json) { 
        //socket.emit('open')
        room_id = json.room_id;

        //if room id is null means that player is not in any room, show the room list
        if(room_id==null){
            updateRoomListTable(json.room_list);
            
        }else{
            $('.findRoom').css('display','none');
            $('.room').css('display','initial');
            $('#connectStatus').text('\xa0\xa0\xa0\xa0\xa0Pick a name:');
            $('#title').html('&nbsp;&nbsp;Avalon Online <br> &nbsp;&nbsp;Room Name: ' + json.room_name);
        }
    });

    socket.on('updateRoom', function(json){
        updateRoomListTable(json.room_list);
    });

    //Game Play
    //All State
    socket.on('system', function(json) {
        if(json.room_id==room_id){
            var p = '';
            switch (json.state) {
                case "wait":
                    //new player login
                    if (json.type === 'welcome') {
                        if (myName == json.text) status.text(myName + ': ').css('color', json.color);
                        p = '<p style="background:' + json.color + '">[' + json.time + ']' + ' system ' + ' : Welcome ' + json.text + '</p>';
                    } 
                    
                    //the server is full
                    else if (json.type == 'full') {
                        window.alert(json.text);
                        set_name = false;
                        myName = false;
                        join_game = false;
                    } 
                    
                    else if (json.type == 'ready' && join_game) {
                        //show the ready button
                        $('.wait #readyButton').css('display', 'initial');
                    } 
                    
                    else if (json.type == 'hideReady' && join_game) {
                        //hide the ready button
                        $('.wait #readyButton').css('display', 'none');
                        $('.wait #readyButton').html('ready');
                    } 
                    
                    else if (json.type == 'allReady' && join_game) {
                        //all ready, show the play button for room owner
                        if (room_owner_id == player_id && json.value) {
                            $('.wait #playButton').css('display', 'initial');
                            $('.wait #playButton').html('play');
                        } else {
                            $('.wait #playButton').css('display', 'none');
                            $('.wait #playButton').html('play');
                        }
                    } 
                    
                    //known this player is joined then add needed value
                    else if (json.type == 'join') {
                        
    
                        $('.allStates').css('display', 'initial');
                        $('.setName').css('display', 'none');
                        $('.displayChat').css('display', 'inline-block');
                        $('#gameInformArea').css('display','inline-block');
                        $('#gameArea').css('display','inline-block');
    
                        join_game = json.value;
                        player_id = json.player_id;
                        room_owner_id = json.room_owner_id;
                    }
                    break;

                //Random Role State
                case "randomRole":
                    $('.randomRole').css('display', 'none');
                    if (json.type == 'chooseCharactersSet') {
                        //show choose character form for room owner
    
                        last_player_data=null;
                        if (room_owner_id == player_id) {
                            $('.randomRole').css('display', 'initial');
                            $('.randomRole #charactersInformation').html('&nbsp;&nbsp;There are ' + json.good + ' good and ' + json.evil + ' evil.<br>&nbsp;&nbsp;Choose characters you want to add:<br>&nbsp;&nbsp;Percival and Morgana are a pair<br>');
    
                            max_good = json.good;
                            max_evil = json.evil;
                            updateRolesSet();
                        } else {
                            $('.randomRole').css('display', 'none');
                        }
                    }
                    break;

                //Voting State
                case "vote":
                    //show team members and vote form
                    if (json.type == 'vote') {
                        team_members = json.team_members;
                        voteForm();
                    }
                    break;

                //Assassin try assassinating Merlin Role State 
                case "findMerlin":
                    if (json.type == 'kill') {
                        //check if this player is assassin, show find merlin form
                        var is_assassin = false;
                        for (i = 0; i < player_data.length; i++) {
                            if (player_data[i].id == player_id && player_data[i].role[0] == 'Assassin') {
                                is_assassin = true;
                            }
                        }
                        if (is_assassin) {
                            findMerlinForm(json.kill_list);
                        }
                    }
                    break;
                
                //Vote to send Team Members on Mission  
                case "sendMission":
                    if (json.type == 'setLeader') {
                        //set leader and if this player is leader, show choose members form
                        $('.gameDetails').css('display', 'initial');
                        leader_id = json.leader_id;
                        team_size = json.team_size;
                        $('#turn').html('&nbsp;&nbsp;Round ' + (json.turn + 1));
                        $('#vote_turn').html('&nbsp;&nbsp;Vote ' + (json.vote_turn) + ' times');
                        if (json.two_fail && json.turn == 3) {
                            $('#two_fail').html("Need two fail this time");
                        } else {
                            $('#two_fail').html("");
                        }
    
                        if (player_id == leader_id) {
                            sendMissionForm();
                        } else {
                            //$('.sendMission').html('');
                            $('.sendMission').css('display','none');
                        }
                    }else if(json.type=='updateTeamMember'){
                        for(i=0;i<json.player_data.length;i++){
                            if(json.player_data[i].teammembers){
                                $('#teammember_'+json.player_data[i].id).css('display','initial');
                            }else{
                                $('#teammember_'+json.player_data[i].id).css('display','none');
                            }
                        }
                    }
                    break;

                //Mission State
                case "mission":
                    //check if this player is in the team members, show success and fail button
                    if (json.type == 'vote') {
                        team_members = json.team_members;
                        $('.mission').css('display', 'initial');
                        var to_vote = false;
                        var inner_span = "&nbsp;&nbsp;<span><span>Team members are:</span><br>";
                        for (i = 0; i < team_members.length; i++) {
                            j = i+1;
                            inner_span += "&nbsp;&nbsp;"+ j +". "+ "<span>" + team_members[i][1] + " (" + team_members[i][0] + ")<span><br>";
                            if (team_members[i][0] == player_id) {
                                //inner_span += "<span>You have to vote</span><br>";
                                to_vote = true;
                            }
    
                        }
    
                        if (to_vote) {
                            inner_span += "&nbsp;&nbsp;<button id='successButton'>success</button>&nbsp;&nbsp;";
                            inner_span += "<button id='failButton'>fail</button>";
                        }
                        $('.mission').html(inner_span);
    
    
                    }else if(json.type=='updateTeamMember'){
                        for(i=0;i<json.player_data.length;i++){
                            if(json.player_data[i].teammembers){
                                $('#teammember_'+json.player_data[i].id).css('display','initial');
                            }else{
                                $('#teammember_'+json.player_data[i].id).css('display','none');
                            }
                        }
                    }
                    break;

                //Mission Success State
                case "missionSuccess":
                    //update game detail
                    if (json.type == 'update') {
                        $('.update').css('display', 'initial');
                        var inner_span = "<span>Mission success</span><br>";
                        $('.update').html(inner_span);
                        $('#success_time').html("&nbsp;&nbsp;Success : " + json.detail[2]);
                        $('#fail_time').html("&nbsp;&nbsp;Fail : " + json.detail[3]);
                        $('#lastMissionResult').html('&nbsp;&nbsp;Last mission: <br>'  + '&nbsp;&nbsp; Success: '+ json.detail[0] + '<br>&nbsp;&nbsp; Fail: '+json.detail[1]);
                    }
                    break;
                
                //Mission Failed State
                case "missionFail":
                    //update game detail
                    if (json.type == 'update') {
                        $('.update').css('display', 'initial');
                        var inner_span = "<span>Mission fail</span><br>";
                        inner_span += json.detail[0] + " success " + json.detail[1] + " fail";
                        $('.update').html(inner_span);
                        $('#success_time').html("&nbsp;&nbsp;Success : " + json.detail[2]);
                        $('#fail_time').html("&nbsp;&nbsp;Fail : " + json.detail[3]);
                        $('#lastMissionResult').html('&nbsp;&nbsp;Last mission: ' + json.detail[0] + ' success,' + json.detail[1] + ' fail');
                    }
    
                    break;
                case "update":
                    break;
                
                //Evil Win 
                case "evilWin":
                    if (json.type == 'endGame') {
                        //show last game winner
                        $('#lastGameWinner').html('&nbsp;&nbsp;Evil Wins!');
                        last_player_data = json.last_player_data;
    
                    }
                    break;

                //Good Side Win
                case "goodWin":
                    if (json.type == 'endGame') {
                        //show last game winner
                        $('#lastGameWinner').html('&nbsp;&nbsp;Good Wins!');
                        last_player_data = json.last_player_data;
    
                    }
                    break;
                default:
                    break;
            }
    
            //If player leave the room, system announce
            if (json.type == 'disconnect') {
                if (json.text != false) {
                    p = '<p style="background:' + json.color + '">system  @ ' + json.time + ' : Left ' + json.text + '</p>';
                }
    
            } 
            
            //update player list
            else if (json.type == 'playerList') {
                inner_li = '';
                playerList.html('');

                //update room owner
                room_owner_id = json.room_owner_id;
    
                //find players role and leaders name
                for (i = 0; i < json.playerData.length; i++) {
                    if (json.playerData[i].id == player_id) player_role = json.playerData[i].role;
                    if (leader_id != null && leader_id == json.playerData[i].id) leader_name = json.playerData[i].name;
                }
                if (player_role != null) {
                    $('#playerRole').html('&nbsp;&nbsp;You are ' + player_role[0] + ' (' + player_role[1] + ')!');
                } 
                else {
                    $('#playerRole').html('');
                }
    
                //Show leader
                if (leader_id != null) {
                    $('#leader').html('&nbsp;&nbsp;The leader is ' + leader_name + ' (' + leader_id + ')<br>');
                } 
                else {
                    $('#leader').html('<br>');
                }
    
                if (room_owner_id == null) {
                    $('#roomOwner').html('');
                }

                for (i = 0; i < json.playerData.length; i++) {
                    if (json.playerData[i].id == room_owner_id) {
                        $('#roomOwner').html('Room owner: ' + json.playerData[i].name + ' (' + (json.playerData[i].id+1) + ')');
                    }
                    if (json.playerData[i].id == player_id) inner_li += '<tr style="font-weight:bold;color:' + json.playerData[i].color + ';">';
                    else inner_li += '<tr style="color:' + json.playerData[i].color + ';">';
    
                    inner_li += '<td style="width:20px;">';
                    if (player_role != null) {
                        if (player_role[0] == 'Merlin') {
                            if (json.playerData[i].role[1] == 'Evil' && json.playerData[i].role[0] != 'Mordred') {
                                inner_li += 'Evil ';
                            }
                        } else if (player_role[0] == 'Percival') {
                            if (json.playerData[i].role[0] == 'Merlin' || json.playerData[i].role[0] == 'Morgana') {
                                inner_li += 'Merlin ';
                            }
                        } else if (player_role[1] == 'Evil') {
                            if (json.playerData[i].role[1] == 'Evil' && json.playerData[i].role[0] != 'Oberon') {
                                inner_li += 'Evil ';
                            }
                        }
                        if (player_role[0] == 'Oberon') {
                            if (json.playerData[i].id == player_id) {z
                                inner_li += 'Evil ';
                            }
                        }
                    }
                    inner_li += '</td>';
    
                    inner_li += '<td style="width:5px;">' + (json.playerData[i].id+1) + '</td><td style="width:80px;">' + json.playerData[i].name + "hgjhgj" + '</td>';
    
                    inner_li += '<td style="width:10px;">';
                    if (json.playerData[i].vote == true) {
                        inner_li += " agree ";
                    } else if (json.playerData[i].vote == false) {
                        inner_li += " disagree ";
                    }
                    if (json.playerData[i].ready) inner_li += ' ready';
                    inner_li += '</td>';
                    inner_li += '</tr>';
                }
                playerList.html(inner_li);
                player_data = json.playerData;
                updateBoard();
            } 
            
            else if (json.type == 'changeState') {
                //update state
                stateDisplay.html('state : ' + json.state);
                for (i = 0; i < states.length; i++) {
                    if (states[i] != json.state) {
                        $("." + states[i]).css('display', 'none');
                    }
                }
                $("." + json.state).css('display', 'initial');
                if (json.state == "wait") init();
            }
            
            else if(json.type=='exitRoom'){
                window.alert("This room is deleted!");
                room_id = null;

                $('.findRoom').css('display','initial');
                $('.room').css('display','none');

                updateRoomListTable(json.room_list);
            }
    
            if (p != '') content_height += 20;
            content.append(p);
            content.scrollTop(content_height); //auto scroll chat to bottom
    
        }
    });

    //Function
    var init = function() {
        for (i = 0; i < states.length; i++) {
            $("." + states[i]).css('display', 'none');
        }
        $('.wait').css('display', 'initial');

        //Game Details
        $('.gameDetails').css('display', 'none');
        $('#playerRole').html("");
        $('#leader').html("");
        $('#turn').html("");
        $('#vote_turn').html("");
        $('#team_size').html("");
        $('#two_fail').html("");
        $('#success_time').html("");
        $('#fail_time').html("");
        $('#lastMissionResult').html('');
        leader_id = null;
        player_role = null;

        //Wait State
        $('.wait #playButton').html("play");
        $('.wait #readyButton').html("ready");

        //randomRole
        $('.randomRole #Merlin').attr('checked', true);
        $('.randomRole #Percival').attr('checked', false);
        $('.randomRole #Morgana').attr('checked', false);
        $('.randomRole #Assassin').attr('checked', true);
        $('.randomRole #Mordred').attr('checked', false);
        $('.randomRole #Oberon').attr('checked', false);


    };

    //Update Board when player join or leave
    var updateBoard = function(){
        if(player_id!=null){
            //create show list
            $('#gameTableUp').html('');
            $('#gameTableDown').html('');
            var show_list = rotateArray(player_data,player_id);
            if(last_player_data!=null) var last_show_list = rotateArray(last_player_data,player_id);

            //show on the board
            var change_index = Math.ceil(show_list.length/2);

            //alert(change_index);
            for(i=0;i<show_list.length;i++){
                var inner_html = '<td>';
                if(show_list[i].id==room_owner_id) inner_html += '<span>Room Owner</span><br>';
                else inner_html += '<span></span><br>';

                if(show_list[i].id==leader_id) inner_html += '<span>Leader</span><br>';
                else inner_html += '<span></span><br>';

                inner_html += '<span>';
                if(last_player_data==null){
                    if(player_role!=null){
                        if(player_id!=show_list[i].id){
                            if(player_role[0]=='Merlin'){
                                if(show_list[i].role[1]=='Evil'&&show_list[i].role[0]!='Mordred'){
                                    inner_html += 'Evil';
                                }
    
                            }
                            
                            else if(player_role[0]=='Percival'){
                                if(show_list[i].role[0]=='Merlin'||show_list[i].role[0]=='Morgana'){
                                    inner_html += 'Merlin';
                                }
    
                            }
                            
                            else if(player_role[1]=='Evil'){
                                if(show_list[i].role[1]=='Evil'&&show_list[i].role[0]!='Oberon'){
                                    inner_html += 'Evil';
                                }
    
                            }
                        }

                        if(player_id==show_list[i].id){
                            inner_html += show_list[i].role[0]+' ('+show_list[i].role[1]+')';
    
                        }
                    }
                }
                
                else{
                    inner_html += last_show_list[i].role[0]+' ('+last_show_list[i].role[1]+')';
                }

                inner_html += '</span><br>';
                inner_html += '<span style="color:'+show_list[i].color+';">'+show_list[i].name+' ('+(show_list[i].id+1)+')'+'</span><br>';

                inner_html += "<div class='sendMission'><input type='checkbox' id='member_" + (show_list[i].id+1) + "' value='" + (show_list[i].id+1) + "' class='member_check'>";
                inner_html += "</div><br>";

                inner_html += '<span id="teammember_'+(show_list[i].id+1)+'" style="display:none">Team member</span><br>';
                
                if(show_list[i].vote==true){
                    inner_html += '<span>agree</span><br>';
                }
                
                else if(show_list[i].vote==false){
                    inner_html += '<span>disagree</span><br>';
                }

                inner_html += '</td>';
                if(i>=change_index){
                    //table up
                    $('#gameTableUp').prepend(inner_html);
                }
                
                else{
                    //table down
                    $('#gameTableDown').append(inner_html);
                }
            }
        }
    };

    var rotateArray = function(array,id){
        show_list = array;
        //window.alert(player_id);
        while(show_list[0].id!=player_id){
            //window.alert(show_list[0].id);
            var one_player_data = show_list.shift();
            show_list.push(one_player_data);
        }
        if(player_data.length>=5){
            //rotate back one time
            var one_player_data = show_list.pop();
            show_list.unshift(one_player_data);
        }
        if(player_data.length>=9){
            //rotate back one time
            var one_player_data = show_list.pop();
            show_list.unshift(one_player_data);
        }
        return show_list;

    }

    //Home Screen create room and join room from list
    var updateRoomListTable = function(room_list){
        inner_table = "<span><b><h3>Create room: &nbsp;</b></h3></span>";
        inner_table += "<input type='text' id='roomInput' autocomplete='off' placeholder='Your room name'/><br><br>";
        inner_table += "<b><h3>Room List:</b></h3>";
        inner_table += "<table><tr>";
        inner_table += "<td>Room name</td><td>&nbsp; No. of players </td>"
        inner_table += "</tr>";
        //console.log(json.room_list);
        for(var key in room_list){
            if(room_list[key].player_data.length>0){
                inner_table += "<tr><td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
                inner_table += room_list[key].room_name;
                inner_table += "</td><td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
                inner_table += room_list[key].player_data.length;
                inner_table += "</td><td>&nbsp;&nbsp;&nbsp;";
                if(room_list[key].state=='wait')
                    inner_table += "<button value='"+key+"' class='roomJoin'>&nbsp;join&nbsp;</button>";
                inner_table += "</td>";
                inner_table += "</tr>";
            }
        }

        inner_table += "</table>";
        $('.findRoom').html(inner_table);
    }

    //Put selected role to the list
    var updateRolesSet = function() {
        $('.randomRole').css('display', 'initial');
        good_characters = [];
        evil_characters = [];
        if ($('.randomRole #Merlin').is(":checked")) good_characters.push("Merlin");
        if ($('.randomRole #Percival').is(":checked")) good_characters.push("Percival");
        if ($('.randomRole #Morgana').is(":checked")) evil_characters.push("Morgana");
        if ($('.randomRole #Assassin').is(":checked")) evil_characters.push("Assassin");
        if ($('.randomRole #Mordred').is(":checked")) evil_characters.push("Mordred");
        if ($('.randomRole #Oberon').is(":checked")) evil_characters.push("Oberon");

    };

    //sendMssion
    var sendMissionForm = function() {
        $('.sendMission').css('display', 'initial');
        $('.member_check').css('display','initial');

        var inner_input = "<br>&nbsp;&nbsp;<span>Choose the team: (team size is " + team_size + ")</span><br>";
        /*for (i = 0; i < player_data.length; i++) {
            inner_input += "<input type='checkbox' id='member_" + player_data[i].id + "' value='" + player_data[i].id + "' class='member_check'>";
            inner_input += "<label for='member_" + player_data[i].id + "'>" + player_data[i].name + " (" + player_data[i].id + ")</label><br>";
        }
        inner_input += "<button id='memberDoneButton'>Done</button>";*/
        $('#sendMissionInform').html(inner_input);
    };

    //Push selected player to team member list
    var updateTeamMembers = function() {
        team_members = [];
        for (i = 0; i < player_data.length; i++) {
            if ($('.sendMission #member_' + player_data[i].id).is(":checked")) team_members.push([player_data[i].id, player_data[i].name]);
        }
    };

    //Vote State
    var voteForm = function() {
        $('.vote').css('display', 'initial');
        var inner_span = "&nbsp;&nbsp;<span>Team members are:</span><br>";
        for (i = 0; i < team_members.length; i++) {
            j = i+1;
            inner_span += "&nbsp;&nbsp;"+ j +". "+ "<span>" + team_members[i][1] + " (" + team_members[i][0] + ")<span><br>";
        }

        //Agree and Disagree Button
        inner_span += "&nbsp;&nbsp;<button id='voteAgreeButton'>agree</button>&nbsp;&nbsp;";
        inner_span += "&nbsp;&nbsp;<button id='voteDisagreeButton'>disagree</button>";
        $('.vote').html(inner_span);
    };

    //Find Merlin State
    var findMerlinForm = function(kill_list) {
        $('.findMerlin').css('display', 'initial');
        var inner_input = "&nbsp;&nbsp;<span>Find merlin:</span><br>";
        inner_input += "&nbsp;&nbsp;<select id='selectMerlin'>";
        for (i = 0; i < kill_list.length; i++) {
            inner_input += "<option value='" + kill_list[i][0] + "'>" + kill_list[i][1] + " (" + kill_list[i][0] + ")</option>";
        }
        inner_input += "</select><br>";
        inner_input += "&nbsp;&nbsp;<button id='findButton'>done</button><br>";
        $('.findMerlin').html(inner_input);
    };


    //Player sending message in chat
    socket.on('message', function(json) {
        if(json.room_id == room_id){
            //Player color, time, player name, text message
            var p = '<p><span style="color:' + json.color + '">[' + json.time + '] ' + json.author + ' : ' + json.text + '</p>';
            content_height += 20;
            content.append(p);
            content.scrollTop(content_height); //auto scroll chat to bottom
        }   
    });

    //Button or Input or Form or Others
    //FindMerlin State
    $('.findMerlin').on('click', '#findButton', function() {
        //alert('click');
        $('.findMerlin').css('display', 'none');
        var obj = { type: 'find',room_id:room_id };
        obj['value'] = $('#selectMerlin').val();
        socket.emit('player', obj); //state = findMerlin
    });

    //Mission State
    $('.mission').on('click', '#successButton', function() {
        $('.mission #successButton').css('display', 'none');
        $('.mission #failButton').css('display', 'none');
        var obj = { type: 'vote', value: true,room_id:room_id };
        socket.emit('player', obj); //state = mission
    });

    $('.mission').on('click', '#failButton', function() {
        $('.mission #successButton').css('display', 'none');
        $('.mission #failButton').css('display', 'none');
        var obj = { type: 'vote', value: false ,room_id:room_id};
        socket.emit('player', obj); //state = mission
    });


    //Vote State
    $('.vote').on('click', '#voteAgreeButton', function() {
        $('.vote').css('display', 'none');
        var obj = { type: 'vote', value: true ,room_id:room_id};
        socket.emit('player', obj); //state = vote
    });

    $('.vote').on('click', '#voteDisagreeButton', function() {
        $('.vote').css('display', 'none');
        var obj = { type: 'vote', value: false ,room_id:room_id};
        socket.emit('player', obj); //state = vote

    });

    //Send Mssion State
    $('#gameArea').on('click', '.member_check', function() {
        //window.alert('checked!!');
        if ($('.sendMission .member_check:checked').length > team_size) {
            window.alert('You can only choose ' + team_size + ' team members');
            $(this).attr('checked', false);
        }else if($('.sendMission .member_check:checked').length == team_size){
            var inner_input = "&nbsp;&nbsp;<button id='memberDoneButton'>Done</button>";
            $('#sendMissionInform').append(inner_input);
        }else{
            var inner_input = "<br>&nbsp;&nbsp;<span>Choose the team: (team size is " + team_size + ")</span><br>";
            $('#sendMissionInform').html(inner_input);
        }

        //update player list in server
        var obj={type:'update',room_id:room_id};
        obj['value']=$(this).attr('checked');
        obj['id']=$(this).val();
        socket.emit('player',obj);
        
        updateTeamMembers();
    });

    $('.sendMission').on('click', '#memberDoneButton', function() {
            if ($('.sendMission .member_check:checked').length < team_size) {
                window.alert("You have to choose " + team_size + ' team members');
            } else if ($('.sendMission .member_check:checked').length == team_size) {
                $('.sendMission').css('display', 'none');
                var obj = { type: 'ready' ,room_id:room_id};
                obj['team_members'] = team_members;
                socket.emit('player', obj); //state = sendMission
            }
        })

    //random Role State
    $('.randomRole .good_check').click(function() {
        //Alert if some good role are select and not select
        if ($(this).val() == 'Merlin' && !$(this).is(":checked")) {
            window.alert('Merlin should always be included');
            $(this).attr('checked', true);
        }
        if ($('.randomRole .good_check:checked').length > max_good) {
            window.alert('You can only choose ' + max_good + ' good characters');
            $(this).attr('checked', false);
        }
        else if($(this).val() == 'Percival' && $(this).is(":checked")){
            $('.randomRole #Morgana').attr('checked', true);
            if($('.randomRole .evil_check:checked').length > max_evil){
                window.alert('Percival and Morgana are a pair, please uncheck one evil character');
                $(this).attr('checked',false);
                $('.randomRole #Morgana').attr('checked', false);
            }
        }
        else if($(this).val() == 'Percival' && !$(this).is(":checked")){
            $('.randomRole #Morgana').attr('checked', false);
        }
        updateRolesSet();
    });

    //Alert if some good role are select and not select
    $('.randomRole .evil_check').click(function() {
        if ($(this).val() == 'Assassin' && !$(this).is(":checked")) {
            window.alert('Assassin should always be included');
            $(this).attr('checked', true);
        }
        if ($('.randomRole .evil_check:checked').length > max_evil) {
            window.alert('You can only choose ' + max_evil + ' evil characters');
            $(this).attr('checked', false);
        }
        else if($(this).val() == 'Morgana' && $(this).is(":checked")){
            $('.randomRole #Percival').attr('checked', true);
            if($('.randomRole .good_check:checked').length > max_good){
                window.alert('Percival and Morgana are a pair, please uncheck one good character');
                $(this).attr('checked',false);
                $('.randomRole #Percival').attr('checked', false);
            }
        }
        else if($(this).val() == 'Morgana' && !$(this).is(":checked")){
            $('.randomRole #Percival').attr('checked', false);
        }
        updateRolesSet();
    });

    //When all role are select and press done
    $('.randomRole #charactersDoneButton').click(function() {
        //window.alert('clicked');
        var obj = { type: 'ready' ,room_id:room_id};
        obj['good_characters'] = good_characters;
        obj['evil_characters'] = evil_characters;
        socket.emit('player', obj); //state = randomRole
    });


    //Wait State, waiting for player to press play
    $('.wait #playButton').click(function() {
        if ($('.wait #playButton').html() == 'play') {
            $('.wait #playButton').html('not yet');
            socket.emit('player', { type: 'playButton' ,room_id:room_id}); //state = wait
        } else if ($('.wait #playButton').html() == 'not yet') {
            $('.wait #playButton').html('play');
        }
    });

    $('.wait #readyButton').click(function() {
        if ($('.wait #readyButton').html() == 'ready') {
            $('.wait #readyButton').html('not yet');
            socket.emit('player', { value: true, type: 'readyButton' ,room_id:room_id}); //state = wait
        } else if ($('.wait #readyButton').html() == 'not yet') {
            $('.wait #readyButton').html('ready');
            socket.emit('player', { value: false, type: 'readyButton' ,room_id:room_id}); //state = wait
        }

    });

    //Enter pressed
    input.keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = $(this).val();
            if (!msg) return;
            socket.emit('message', {msg:msg,room_id:room_id});
            $(this).val('');
        }
    });

    $('.findRoom').on('keydown', '#roomInput',function(e) {
        if(e.KeyCode === 13||e.which===13){
            var msg = $(this).val();
            if(!msg) return;
            socket.emit('createRoom', {name:msg,room_id:room_id});
            $(this).val('');
        }
    });

    $('#nameInput').keydown(function(e) {
        if (e.keyCode === 13) {
            var msg = $(this).val();
            if (!msg) return;
            if (!set_name) {
                socket.emit('player', { name: msg, type: 'setName' ,room_id:room_id});
                set_name = true;
            }
            $(this).val('');
            if (myName === false) {
                myName = msg;
            }
        }
    });

    $('.findRoom').on('click', '.roomJoin', function(){
        //alert($(this).val());
        socket.emit('joinRoom', {room_id:$(this).val()});
    });
});

