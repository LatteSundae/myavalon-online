
//Game State Array
var states = ["wait","randomRole","sendMission","vote","mission",
  "missionSuccess","missionFail","update","findMerlin","evilWin","goodWin"]; 

//Set Game Rule
//Count of Good Side and Evil Side
var good_evil_count = [[3,2],[4,2],[4,3],[5,3],[6,3],[6,4]]; //good roles numbers and evil roles numbers
//number of team members for every Mission (5 players to 10 players), true/false means the 4th turn, need two failure or not
var team_assignment = [[[2,3,2,3,3],false],[[2,3,4,3,4],false],[[2,3,3,4,4],true],[[3,4,4,5,5],true],[[3,4,4,5,5],true],[[3,4,4,5,5],true]]; //rule

//Room data
var room_list = {}; //List of Available Roo,
var room_id = 0; //Creating unique room id

//For debug
//emit = send a message to all the connected players
var show_emit = false;

var express = require('express')
  , path = require('path')
  , app = express()
  , server = require('http').createServer(app);

var io = require('socket.io').listen(server);

//0 - error, 1 - warn, 2 - info, 3 - debug
io.set('log level', 1); 


//gameplay programming here!!
//WebSocket listening
io.sockets.on('connection', function (socket) {
  if(show_emit) console.log('emit socket open (one player)');
  socket.emit('open',{room_list:room_list,room_id:null});//player is connect, not in a room yet

  // player class
  var player = {
    socket:socket,
    name:false,
    color:getColor(),
    id:null, //same as player_data[index]['id']
    room_id:null //to check which room the player is in
  };

//States
  socket.on('createRoom', function(json){
    //player create a room
    console.log('create new room');
    //room class
    var room = {
      room_name : "",
      turn : 0, //mission turn count
      success_time : 0, //total success time
      fail_time : 0, //total fail time
      vote_turn : 0, //voting turn
      vote_success : 0, //number of agreement
      vote_fail : 0, //number of disagreement
      
      //for roles setting
      max_good : 0, //maximum number of good roles
      max_evil : 0, //maximum number of evil roles
      good_roles : [], //list all good roles 
      evil_roles : [], //list all evil roles
      all_role : [], //all role
      
      //for mission sending (number of ppl of team & the 4th mission need 2 fail or not)
      team_members : [], //team members to do the mission
      
      state : states[0], //initial states
      
      //player information
      player_data : [], //id, name, role[special role, evil/good], ready, color, teammembers
      player_id : 0, //for creating unique id
      room_owner_id : null, //room owner
      leader_id : null //leader to choose members
    };

    //add new room in room list
    room_list[room_id] = room;

    //set the room's name
    room_list[room_id].room_name = json.name;

    //update player's room id, so this player know which room it is in
    player.room_id=room_id;

    //send player room data
    sendRoomData();

    room_id++;//for create unique room id
  });

  //player join a room
  socket.on('joinRoom', function(json){
    //update player's room id, so this player know which room it is in
    player.room_id=json.room_id;
    //send player room data
    sendRoomData();
  });

  socket.on('player', function(json){
    //if player not in any room
    if(player.room_id==null){
      console.log("this player is still not in any room!");
    }
    
    //if player is in one of the room
    else if(player.room_id in room_list){
      console.log("state : "+room_list[player.room_id].state);
      switch(room_list[player.room_id].state){
        case "wait":
          if(json.type=='setName'){
            //player login
            if(room_list[player.room_id].player_data.length>=0&&room_list[player.room_id].player_data.length<10){
              //insert player into player_data
              insertPlayerData(json.name);
              console.log("player "+player.name+" ("+player.id+") login");
              //update player list
              updatePlayerList();
              //update ready state
              updateAllReadyState();
              //update room list
              updateRoomList();
  
            }else{
              console.log("player login failed (server is full)");
              //the server is full!
              var obj = {state:room_list[player.room_id].state, type:'full',room_id:player.room_id};
              obj['text']='Sorry, the server is full';
              if(show_emit){
                console.log("emit server full (one player)");
              }
              socket.emit('system',obj);
              //update player list
              updatePlayerList();
              //update ready state
              updateAllReadyState();
              
            }
          }else if(json.type=='readyButton'){
            console.log(player.name+" ("+player.id+") ready");
            //player press ready or not yet
            updateReadyState(json.value);
            //update player list
            updatePlayerList();
            //update ready state
            updateAllReadyState();
          }else if(json.type=='playButton'){
            console.log(player.name+ " ("+player.id+")(room owner) press start game");
            //room owner press play!
            //tell player to change state
            changeState(states[1]);
            setGoodEvil();
            askrolesSet();
          }
  
          break;

        //Random Role State
        case "randomRole":
          if(json.type=='ready'){
            room_list[player.room_id].good_roles = json.good_roles;
            room_list[player.room_id].evil_roles = json.evil_roles;
            console.log(player.name + ' ('+player.id+')(room owner) done roles choosing');
  
            //random roles to players
            randomSetroles();
            
            changeState(states[2]);
  
            setLeader();
  
          }
          break;

        //Voting State 
        case "vote":
          if(json.type=='vote'){
            console.log("(vote)"+player.name+" ("+player.id +") : "+ json.value);
            updateVote(json.value);
          }          
          break;

        //Assassin try assassinating Merlin Role State 
        case "findMerlin":
          if(json.type=='find'){
            console.log(player.name+' ('+player.id + ") think " + json.value + " is Merlin");
            var find=false;
            var new_state;
  
            find = findMerlinOrNot(json.value);
            
            if(find){
              //evil win
              console.log("Merlin is killed!");
              new_state = states[9];
            }else{
              //good win
              console.log("Merlin is alive!");
              new_state = states[10];
            }
            changeState(new_state);
            endGame();
            init();
            changeState(states[0]);
            updatePlayerList();
          }
          break;

        //Vote to send Team Members on Mission  
        case "sendMission":
          if(json.type=='ready'){
            room_list[player.room_id].team_members = json.team_members;
            console.log(player.name+' ('+player.id+')done team members choosing');
  
            resetVote();
            if(room_list[player.room_id].vote_turn==4){
              //no need to vote
              console.log("5th team members setting, no need to vote");
              room_list[player.room_id].vote_turn = 0;
              changeState(states[4]);
              missionVote();
              updatePlayerList();
              updateTeamMemberList();
            }else{
              console.log("voting for team members");
              changeState(states[3]);
              voting();
            }
          }
          //update if teammembers or not
          else if(json.type=='update'){
            
            for(i=0;i<room_list[player.room_id].player_data.length;i++){
              if(room_list[player.room_id].player_data[i]['id']==json.id){
                room_list[player.room_id].player_data[i]['teammembers']=json.value;            }
            }
            updateTeamMemberList();
  
          }
          break;

        //Mssion State
        case "mission":
            if(json.type=='vote'){
              console.log("(mission)"+player.name+" ("+player.id +") : "+ json.value);
              updateMissionVote(json.value);
            }
          break;

        //Mssion Success
        case "missionSuccess":
          console.log("Mission Success");
          break;

        //Mssion Fail
        case "missionFail":
          console.log("Mission Failed");
          break;

        case "update":
          break;
        
        default:
          break;
      }
    }else{
      if(show_emit) console.log("emit exit the room, and room list (one player)");
      socket.emit('system',{type:'exitRoom',room_id:player.room_id,room_list:room_list});
    }

  });



  //Chatting in Avalon Online
  socket.on('message', function(json){
    if(player.room_id in room_list){
      var obj = {time:getTime(),color:player.color,room_id:player.room_id}; //get time, player colors, room id
      obj['text']=json.msg; 
      obj['author']=player.name; //player name
      obj['type']='message';

      socket.emit('message',obj);
      socket.broadcast.emit('message',obj);
    }
  });

  //If player get disconnected
  socket.on('disconnect', function () {  
    var obj = {
      time:getTime(),
      color:player.color,
      author:'System',
      text:player.name,
      type:'disconnect',
      room_id:player.room_id
    };
    //remove this disconnected from player_data
    if(player.room_id!=null && player.room_id in room_list) {
      removePlayer();
      if(show_emit) console.log('emit player disconnect (all players)');
      socket.broadcast.emit('system',obj);
      console.log(player.name + '(' + player.id+ ') Disconnect');
      //console.log('total player number: '+player_data.length);

      //If number of player less than 5 player, hide ready button
      if(room_list[player.room_id].player_data.length<5){
        //set all ready to false
        if(show_emit) console.log("emit hide ready (all players)");
        socket.emit('system',{state:room_list[player.room_id].state,type:'hideReady',room_id:player.room_id});
        socket.broadcast.emit('system',{state:room_list[player.room_id].state,type:'hideReady',room_id:player.room_id});
        resetPlayerData();
      }

      //If player disconnect during game time, reset game
      if(room_list[player.room_id].state != "wait"){
        resetPlayerData();
        changeState(states[0]);
      }

      init();
      //update player list
      updatePlayerList();
      //update ready state
      updateAllReadyState();

      if(room_list[player.room_id].player_data.length==0){
        delete room_list[player.room_id];
      }
      player.room_id = null;
      updateRoomList();
    }
  });


//Functions
  //initial all
  var init=function(){
    room_list[player.room_id].leader_id = null;
    room_list[player.room_id].turn = 0;
    room_list[player.room_id].vote_turn = 0;
    room_list[player.room_id].success_time = 0;
    room_list[player.room_id].fail_time = 0;
    room_list[player.room_id].max_good = 0;
    room_list[player.room_id].max_evil = 0;
    room_list[player.room_id].good_roles = [];
    room_list[player.room_id].evil_roles = [];
    room_list[player.room_id].all_role = [];
    room_list[player.room_id].team_members = [];
    room_list[player.room_id].state = states[0];
    room_list[player.room_id].vote_fail = 0;
    room_list[player.room_id].vote_success = 0;
    resetVote();
    resetPlayerData();
    updateAllReadyState();
  };



  //update player list
  var updatePlayerList=function(){
    updateObj={state:room_list[player.room_id].state,type:'playerList',room_owner_id:room_list[player.room_id].room_owner_id,room_id:player.room_id};
    updateObj['playerData']=room_list[player.room_id].player_data;
    if(show_emit) console.log("emit new player data (all players)");
    socket.emit('system',updateObj);
    socket.broadcast.emit('system',updateObj);
  };

  //update room list
  var updateRoomList=function(){
    
    if(show_emit) console.log('emit update room, and room list (all players)');
    socket.broadcast.emit('updateRoom',{room_list:room_list});
  };

  var changeState=function(new_state){
    room_list[player.room_id].state = new_state;
    if(show_emit) console.log("emit new state : "+room_list[player.room_id].state+" (all players)");
    socket.emit('system',{state:room_list[player.room_id].state,type:'changeState',room_id:player.room_id});
    socket.broadcast.emit('system',{state:room_list[player.room_id].state,type:'changeState',room_id:player.room_id});

    //call function update room list
    updateRoomList();
  };

  var resetPlayerData=function(){
    for(i=0;i<room_list[player.room_id].player_data.length;i++){
      room_list[player.room_id].player_data[i]['role']=null;
      room_list[player.room_id].player_data[i]['ready']=false;
      room_list[player.room_id].player_data[i]['vote']=null;
      room_list[player.room_id].player_data[i]['teammembers']=false;
    }
  };

  //send players room data
  var sendRoomData=function(){
    if(show_emit) console.log('emit the room data, player join the room (one player)');
    socket.emit('open',{room_list:room_list,room_id:player.room_id, room_name:room_list[player.room_id].room_name}); 
  };

  //send end game message to all players in this room
  var endGame=function(){
    if(show_emit) console.log("emit end game (all players)");
    socket.emit('system',{state:room_list[player.room_id].state,type:'endGame',last_player_data:room_list[player.room_id].player_data,room_id:player.room_id});
    socket.broadcast.emit('system',{state:room_list[player.room_id].state,type:'endGame',last_player_data:room_list[player.room_id].player_data,room_id:player.room_id});            
  }

  //remove player from player list
  var removePlayer=function(){
    for(i=0;i<room_list[player.room_id].player_data.length;i++){
      if(player.id==room_list[player.room_id].player_data[i]['id']){
        room_list[player.room_id].player_data.splice(i,1);
      }
    }

    //if the room owner disconnected, set new room owner
    if(player.id==room_list[player.room_id].room_owner_id && room_list[player.room_id].player_data.length>0)
      room_list[player.room_id].room_owner_id = room_list[player.room_id].player_data[0]['id'];
    else if(player.id==room_list[player.room_id].room_owner_id && room_list[player.room_id].player_data.length==0)
      room_list[player.room_id].room_owner_id = null;
  }


  //Wait State
  var insertPlayerData=function(name){
    if(room_list[player.room_id].room_owner_id==null) room_list[player.room_id].room_owner_id = room_list[player.room_id].player_id;

    //tell player they are join
    if(show_emit) console.log("emit player is join (one player)");
    socket.emit('system',{state:room_list[player.room_id].state,type:'join',value:true,player_id:room_list[player.room_id].player_id,room_owner_id:room_list[player.room_id].room_owner_id,room_id:player.room_id});
    
    player.name = name;

    var obj = {time:getTime(),color:player.color,room_id:player.room_id};
    obj['text']=player.name;
    obj['author']='System';
    obj['type']='welcome';
    obj['state']=room_list[player.room_id].state;    


    //add this player into player data
    var one_player_data = {id:room_list[player.room_id].player_id,name:player.name,role:null,ready:false,vote:null,color:player.color,teammembers:false}; //id & name & role & ready
    player.id = one_player_data['id'];
    player.index = room_list[player.room_id].player_data.length;
    room_list[player.room_id].player_data.push(one_player_data);
    room_list[player.room_id].player_id ++;

    socket.emit('system',obj);
    socket.broadcast.emit('system',obj);

    if(room_list[player.room_id].player_data.length>=5){
      if(show_emit) console.log("emit player can show ready (all players)");
      socket.emit('system',{state:room_list[player.room_id].state,type:'ready',room_id:player.room_id});
      socket.broadcast.emit('system',{state:room_list[player.room_id].state,type:'ready',room_id:player.room_id});
    }   
  };

  var updateReadyState=function(player_state){
    var obj={time:getTime(),color:player.color};
    obj['author']='System';
    obj['type']='ready';
    obj['state']=room_list[player.room_id].state;
    for(i=0;i<room_list[player.room_id].player_data.length;i++){
      if(player.id==room_list[player.room_id].player_data[i]['id'])
        room_list[player.room_id].player_data[i]['ready']=player_state;
    }
  };

  var setGoodEvil=function(){
    room_list[player.room_id].max_good = good_evil_count[room_list[player.room_id].player_data.length-5][0];
    room_list[player.room_id].max_evil = good_evil_count[room_list[player.room_id].player_data.length-5][1];
  };
  
  //clear last player data
  var askrolesSet=function(){
    updatePlayerList();
    var ask = {type:'chooserolesSet',state:room_list[player.room_id].state,good:room_list[player.room_id].max_good,evil:room_list[player.room_id].max_evil,room_id:player.room_id};
    if(show_emit) console.log('emit ask room owner '+player.name+' ('+player.id+') to set roles (one player)');
    socket.emit('system',ask);
    socket.broadcast.emit('system',ask);
    
  };
  var updateAllReadyState=function(){
    all_ready = true; //check if all the players are ready
    for(i=0;i<room_list[player.room_id].player_data.length;i++){
      all_ready = all_ready & room_list[player.room_id].player_data[i]['ready'];
    }

    //All players is ready
    if(all_ready){
      if(show_emit) console.log("emit tell all players everyone is ready (all players)");
      socket.emit('system',{state:room_list[player.room_id].state,type:'allReady',value:true,room_id:player.room_id});
      socket.broadcast.emit('system',{state:room_list[player.room_id].state,type:'allReady',value:true,room_id:player.room_id});
    }
    
    //Some players are not ready
    else{
      if(show_emit) console.log("emit tell all players someone is not ready (all players)");
      socket.emit('system',{state:room_list[player.room_id].state,type:'allReady',value:false,room_id:player.room_id});
      socket.broadcast.emit('system',{state:room_list[player.room_id].state,type:'allReady',value:false,room_id:player.room_id});
    }
  };

  //Random Role State
  var randomSetroles=function(){
    while(room_list[player.room_id].good_roles.length<room_list[player.room_id].max_good){
      room_list[player.room_id].good_roles.push('Good Slave');
    }

    //insert good role to all role
    for(i=0;i<room_list[player.room_id].good_roles.length;i++){
      room_list[player.room_id].all_role.push([room_list[player.room_id].good_roles[i],'Good']);
    }

    while(room_list[player.room_id].evil_roles.length<room_list[player.room_id].max_evil){
      room_list[player.room_id].evil_roles.push('Evil Minion');
    }

    //insert evil role to all role
    for(i=0;i<room_list[player.room_id].evil_roles.length;i++){
      room_list[player.room_id].all_role.push([room_list[player.room_id].evil_roles[i],'Evil']);
    }

    //Shuffle and Assign Role to player
    shuffleArray();

    //console.log(all_role);
    for(i=0;i<room_list[player.room_id].player_data.length;i++){
      room_list[player.room_id].player_data[i]['ready']=false;
      room_list[player.room_id].player_data[i]['role']=room_list[player.room_id].all_role[i];
    }
  };

  var shuffleArray=function(){
    var counter = room_list[player.room_id].all_role.length;
    while(counter>0){
      var index = Math.floor(Math.random()*counter);
      counter--;
      var temp = room_list[player.room_id].all_role[counter];
      room_list[player.room_id].all_role[counter] = room_list[player.room_id].all_role[index];
      room_list[player.room_id].all_role[index] = temp;
    }
  };

  //Send Mssion State
  var setLeader=function(){
    resetTeamMembers();
    updateTeamMemberList();

    //Set Team Leader
    if(room_list[player.room_id].leader_id==null){
      room_list[player.room_id].leader_id = room_list[player.room_id].player_data[ Math.floor((Math.random() * room_list[player.room_id].player_data.length)) ]['id'];
    }
    
    else{
      if(room_list[player.room_id].leader_id == room_list[player.room_id].player_data[room_list[player.room_id].player_data.length-1]['id']){
        room_list[player.room_id].leader_id = room_list[player.room_id].player_data[0]['id'];
      }else{
        for(i=0;i<room_list[player.room_id].player_data.length;i++){
          if(room_list[player.room_id].leader_id == room_list[player.room_id].player_data[i]['id']){
            room_list[player.room_id].leader_id = room_list[player.room_id].player_data[i+1]['id'];
            break;
          }
        }
      }
    }

    num_of_team = team_assignment[room_list[player.room_id].player_data.length-5][0][room_list[player.room_id].turn];
    two_fail = team_assignment[room_list[player.room_id].player_data.length-5][1];

    if(show_emit) console.log("emit set leader (all players)");
    socket.emit('system',{state:room_list[player.room_id].state,type:'setLeader',leader_id:room_list[player.room_id].leader_id,team_size:num_of_team,two_fail:two_fail,turn:room_list[player.room_id].turn,vote_turn:room_list[player.room_id].vote_turn,room_id:player.room_id});
    socket.broadcast.emit('system',{state:room_list[player.room_id].state,type:'setLeader',leader_id:room_list[player.room_id].leader_id,team_size:num_of_team,two_fail:two_fail,turn:room_list[player.room_id].turn,vote_turn:room_list[player.room_id].vote_turn,room_id:player.room_id});
    
    //update player list
    updatePlayerList();
    if(show_emit) console.log('emit set leader (all players)');
    socket.emit('system',{state:room_list[player.room_id].state,type:'setLeader',leader_id:room_list[player.room_id].leader_id,team_size:num_of_team,two_fail:two_fail,turn:room_list[player.room_id].turn,vote_turn:room_list[player.room_id].vote_turn,room_id:player.room_id});
    socket.broadcast.emit('system',{state:room_list[player.room_id].state,type:'setLeader',leader_id:room_list[player.room_id].leader_id,team_size:num_of_team,two_fail:two_fail,turn:room_list[player.room_id].turn,vote_turn:room_list[player.room_id].vote_turn,room_id:player.room_id});
    
  };

  var resetVote=function(){
    for(i=0;i<room_list[player.room_id].player_data.length;i++){
      room_list[player.room_id].player_data[i]['vote']=null;
    }
  }
  var resetTeamMembers=function(){
    for(i=0;i<room_list[player.room_id].player_data.length;i++){
      room_list[player.room_id].player_data[i]['teammembers']=false;
    }

  }
  var updateTeamMemberList=function(){
    if(show_emit) console.log('emit update team members (all players)');
    socket.emit('system',{state:room_list[player.room_id].state, type:'updateTeamMember', player_data:room_list[player.room_id].player_data,room_id:player.room_id});
    socket.broadcast.emit('system',{state:room_list[player.room_id].state, type:'updateTeamMember', player_data:room_list[player.room_id].player_data,room_id:player.room_id});
  }

  //Vote States
  var voting=function(){
    if(show_emit) console.log('emit start voting (all players)');
    socket.emit('system',{state:room_list[player.room_id].state,type:'vote',team_members:room_list[player.room_id].team_members, player_data:room_list[player.room_id].player_data,room_id:player.room_id});
    socket.broadcast.emit('system',{state:room_list[player.room_id].state,type:'vote',team_members:room_list[player.room_id].team_members, player_data:room_list[player.room_id].player_data,room_id:player.room_id});

    };

  //update vote (true/false) into player_data
  var updateVote=function(value){
    var agree = 0;
    var disagree = 0;

    for(i=0;i<room_list[player.room_id].player_data.length;i++){
      if(room_list[player.room_id].player_data[i]['id']==player.id){
        room_list[player.room_id].player_data[i]['vote']=value;
      }

      if(room_list[player.room_id].player_data[i]['vote']==true){
        agree++;

      }else if(room_list[player.room_id].player_data[i]['vote']==false){
        disagree++;
      }
    }

    if((agree+disagree)==room_list[player.room_id].player_data.length){//if all players have voted

      //if disagree>=agree, Mssion Fail
      if(disagree>=agree){
        room_list[player.room_id].vote_turn++;
        changeState(states[2]);
        setLeader();

      }else if(agree>disagree){
      //if disagree>=agree, Mssion Fail
        room_list[player.room_id].vote_turn = 0;
        changeState(states[4]);
        missionVote();
        updatePlayerList();
        updateTeamMemberList();
      }
    }
  }


//Mission states
  var missionVote=function(){
    if(show_emit) console.log('emit to do mission (all players)');
    socket.emit('system',{state:room_list[player.room_id].state,type:'vote',team_members:room_list[player.room_id].team_members,room_id:player.room_id});
    socket.broadcast.emit('system',{state:room_list[player.room_id].state,type:'vote',team_members:room_list[player.room_id].team_members,room_id:player.room_id}); 

  }
  var updateMissionVote=function(value){
    var two_fail = team_assignment[room_list[player.room_id].player_data.length-5][1];
    if(value) room_list[player.room_id].vote_success++;
    else room_list[player.room_id].vote_fail++;

    if((room_list[player.room_id].vote_success+room_list[player.room_id].vote_fail)==room_list[player.room_id].team_members.length){
      room_list[player.room_id].turn++;
      var new_state;
      if(room_list[player.room_id].turn==4 && two_fail){
        if(room_list[player.room_id].vote_fail>=2){
          //fail
          new_state = states[6];
          room_list[player.room_id].fail_time++;

        }else{
          //success
          new_state = states[5];
          room_list[player.room_id].success_time++;

        }
      }else{
        if(room_list[player.room_id].vote_fail>=1){
          //fail
          new_state = states[6];
          room_list[player.room_id].fail_time++;

        }else{
          //success
          new_state = states[5];
          room_list[player.room_id].success_time++;

        }
      }
      changeState(new_state);
      if(show_emit) console.log('emit to update new game details (all players)');
      socket.emit('system',{state:room_list[player.room_id].state,type:'update',detail:[room_list[player.room_id].vote_success,room_list[player.room_id].vote_fail,room_list[player.room_id].success_time,room_list[player.room_id].fail_time],room_id:player.room_id});
      socket.broadcast.emit('system',{state:room_list[player.room_id].state,type:'update',detail:[room_list[player.room_id].vote_success,room_list[player.room_id].vote_fail,room_list[player.room_id].success_time,room_list[player.room_id].fail_time],room_id:player.room_id}); 
      changeState(states[7]);
      updateGame();
    }

      
  }

//update states
var updateGame=function(){
  room_list[player.room_id].vote_success = 0;
  room_list[player.room_id].vote_fail = 0;

  //Fail 3 or more, Evil win
  if(room_list[player.room_id].fail_time>=3){
    changeState(states[9]);
    endGame();
    init();

    changeState(states[0]);
    updatePlayerList();

  //Success 3 or more, Let assassin find Merlin
  }else if(room_list[player.room_id].success_time>=3){
    changeState(states[8]);
    var kill_list = [];
    for(i=0;i<room_list[player.room_id].player_data.length;i++){
      if(room_list[player.room_id].player_data[i]['role'][1]=='Good'){
        kill_list.push([room_list[player.room_id].player_data[i]['id'], room_list[player.room_id].player_data[i]['name']]);
      }
    }

    if(show_emit) console.log('emit kill Merlin and kill list (all players)');
    socket.emit('system',{state:room_list[player.room_id].state,type:'kill',kill_list:kill_list,room_id:player.room_id});
    socket.broadcast.emit('system',{state:room_list[player.room_id].state,type:'kill',kill_list:kill_list,room_id:player.room_id});
    updatePlayerList();
  }else{
    changeState(states[2]);
    setLeader();
  }
}

//findMerlin State
var findMerlinOrNot=function(id){
  for(i=0;i<room_list[player.room_id].player_data.length;i++){
    if(room_list[player.room_id].player_data[i]['id']==id && room_list[player.room_id].player_data[i]['role'][0]=="Merlin"){
      //evil win
      return true;
    }
  }
  return false;
}
});


//express
app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.resolve(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

//webscoket
app.get('/', function(req, res){
  res.sendfile('views/game.html');
});

server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});


var getTime=function(){
  var date = new Date();
  return date.getHours()+":"+date.getMinutes()+":"+date.getSeconds();
}

var getColor=function(){
  //var colors = ['#EA047E','#C47AFF','#905E96','#5C2E7E','#9C2C77','#645CAA','#EE6983','#AC7088','#F637EC','#F190B7'];
  //return colors[Math.round(Math.random() * 10000 % colors.length)];
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++ ) {
    if(i%2==0){
      color += letters[Math.floor(Math.random() * 10)+6];
    }else{
      color += letters[Math.floor(Math.random() * 16)];
    }
  }
  //console.log(color);
  return color;
}