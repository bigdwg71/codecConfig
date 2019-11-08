const xapi = require('xapi');


const bitrateInterval = 128;

var currentBitrate = [];
var max = [];
var min = [];
var maxId;
var minId;

//set min and max values for bitrates
min.transmit = 64;
min.receive = 64;
max.transmit = 6000;
max.receive = 6000;

//Hold available inputs
var availableInputs = [];
var currentInputId = "0";
var currentInput = [];

function setBitrate(transmitReceive,newBitrate){
  const capTransmitReceive = transmitReceive.charAt(0).toUpperCase() + transmitReceive.slice(1);
  //console.log('Capitalized: ' + capTransmitReceive);
  
  if (currentBitrate[transmitReceive] != newBitrate){
      xapi.config.set('Conference Max' + capTransmitReceive + 'CallRate', newBitrate).then((result) => {
      console.log('Set new ' + transmitReceive + ' bitrate: ' + newBitrate);
	  if (newBitrate == min[transmitReceive]){
		 xapi.command("UserInterface Extensions Widget SetValue", {WidgetId: transmitReceive + '.Readout', Value: 'Audio Only'});
	  } else {
		xapi.command("UserInterface Extensions Widget SetValue", {WidgetId: transmitReceive + '.Readout', Value: newBitrate + ' kbps'});
	  }
    });
  
    currentBitrate[transmitReceive] = newBitrate;
  } else {
    console.log('Current bitrate and new bitrate are the same. Skipping...');
  }
}

function calcBitrate(action,transmitReceive){
  console.log('Current ' + transmitReceive + ' bitrate: ' + currentBitrate[transmitReceive]);

  var bitrate = currentBitrate[transmitReceive];
  
  if (currentBitrate[transmitReceive] === 6000){
    bitrate = 6016
  }

  var bitrateRemainder = bitrate % bitrateInterval;
  var roundedBitrate = bitrate - bitrateRemainder;
  var newBitrate = 0;
  
  //console.log('bitrateRemainder: ' + bitrateRemainder);
  //console.log('roundedBitrate: ' + roundedBitrate);

  if (action == 'Plus'){
    
    if (bitrateRemainder === 0){
      newBitrate = parseFloat(bitrate) + parseFloat(bitrateInterval);
    } else {
      newBitrate = parseFloat(roundedBitrate) + parseFloat(bitrateInterval);
    }
    
  } else if (action == 'Minus'){
    
    if (bitrateRemainder === 0){
      newBitrate = parseFloat(bitrate) - parseFloat(bitrateInterval);
    } else {
      newBitrate = roundedBitrate;
    }
  }
  
  //console.log('newBitrate: ' + newBitrate);
  
  if (newBitrate < min[transmitReceive] ){
    newBitrate = min[transmitReceive];
  } else if (newBitrate > max[transmitReceive]){
    newBitrate = max[transmitReceive];
  }

  setBitrate(transmitReceive,newBitrate);
  
}

function changeInput(action){
  
  let newInputId = 0;

  if (action == 'Plus') {
    if (currentInput.id == maxId) {
      newInputId = minId;
    } else {
      newInputId = parseInt(currentInput.id) + 1;
    }
  } else if (action == 'Minus') {
    if (currentInput.id == minId) {
      newInputId = maxId;
    } else {
      newInputId = parseInt(currentInput.id) - 1;
    }
  } else if (action == 'HDMI1') {
    newInputId = 1;
  } else {
    newInputId = currentInput.id;
  }
  
  //console.log("Current Input ID: " + currentInput.id);
  //console.log("New Input ID: " + newInputId);
  
  let newInput = availableInputs.find(obj => obj.id == newInputId);
  
  xapi.command("Video Input SetMainVideoSource", {ConnectorId: newInputId});
  xapi.config.set('Video DefaultMainSource', newInputId);
  xapi.command("UserInterface Extensions Widget SetValue", {WidgetId: 'input.Readout', Value: newInput.Name});
  currentInput = newInput;
}

xapi.config.get('Conference MaxTransmitCallRate').then((result) => {
  //console.log('Transmit: ' + result);

  if (result == 64){
    xapi.command("UserInterface Extensions Widget SetValue", {WidgetId: 'transmit.Readout', Value: 'Audio Only'});
  } else {
    xapi.command("UserInterface Extensions Widget SetValue", {WidgetId: 'transmit.Readout', Value: result + ' kbps'});
  }    
  currentBitrate['transmit'] = result;
});

xapi.config.get('Conference MaxReceiveCallRate').then((result) => {
  //console.log('Receive: ' + result);
	if (result == 64){
		xapi.command("UserInterface Extensions Widget SetValue", {WidgetId: 'receive.Readout', Value: 'Audio Only'});
	} else {
		xapi.command("UserInterface Extensions Widget SetValue", {WidgetId: 'receive.Readout', Value: result + ' kbps'});
	}  
  currentBitrate['receive'] = result;
});

xapi.config.get('Video Input Connector').then((result) => {
  //console.log('Inputs: ' + JSON.stringify(result));
  //console.log('Count: ' + Object.keys(result).length);
  
  result.forEach((element, index, array) => {
    //console.log(element.id);
    //console.log(element.Name);
    //console.log(index);
    //console.log(array);
    
    availableInputs.push({
        id:   element.id,
        Name: element.Name
    })
  });

  maxId = Math.max.apply(Math, availableInputs.map(function(o) {return o.id;}));
  minId = Math.min.apply(Math, availableInputs.map(function(o) {return o.id;}));
  
  //console.log('Highest Input: ' + maxId);
  //console.log('Available Inputs: ' + JSON.stringify(availableInputs));
});

xapi.status.get('Video Input MainVideoSource').then((result) => {
  //console.log('Current Main Source ID: ' + result);
  currentInputId = result;
  currentInput = availableInputs.find(obj => obj.id == currentInputId);
  //console.log('Current Main Source: ' + JSON.stringify(currentInput));
  changeInput("Set");
});

xapi.event.on('UserInterface Extensions Widget Action', (event) => {
	//console.log('event caught: ' + JSON.stringify(event));
	if(event.Type == 'pressed'){

	  const widget = event.WidgetId.split(".");
	  const config2Change = widget[0];
	  const action = widget[1];
	  
	  //console.log('Config: ' + config2Change);
	  //console.log('Action: ' + action);
	  
	  if (config2Change == 'transmit' || config2Change == 'receive'){
      if (action == 'Plus' || action == 'Minus'){
        calcBitrate(action,config2Change);
      } else if (action == 'max'){
        setBitrate(config2Change,max[config2Change]);
      }
	  } else if (config2Change == 'input') {
      changeInput(action);
	  }
	}
});