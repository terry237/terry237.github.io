/*********************************************************************************************
 *
 *                                     * * * Xi4s * * *
 *
 *********************************************************************************************
 * Created by afy on 8/24/14.
 *
 * This is the Xi Client for Scratch
 *
 * It follows the Scratch JavaScript Extension Spec
 *
 * http://llk.github.io/scratch-extension-docs/
 *
 * Version v.002
 * Nov 7, 2014
 *
 * @author: Alan Yorinks
 Copyright (c) 2014 Alan Yorinks All right reserved.

 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU General Public
 License as published by the Free Software Foundation; either
 version 3.0 of the License, or (at your option) any later version.

 This library is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 Lesser General Public License for more details.

 You should have received a copy of the GNU General Public
 License along with this library; if not, write to the Free Software
 Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 */

new (function () {
    var ext = this;
    console.log('Xi4s v.003');

    // 0 = no debug
    // 1 = low level debug
    // 2 = high - open the floodgates
    // Variable is set by user through a Scratch command block
    var debugLevel = 0;

    // a variable to set the color of the 'LED' indicator for the extension on the Scratch editor
    var boardStatus = 0; //  0:not ready(RED), 1:partially ready or warning(YELLOW), 2: fully ready(GREEN)

    // Board IP addresses and ports are set by the user with a Scratch command block, and the information
    // is stored in the WebSocket Array

    // WebSocket array
    //   Each board will have an associated WebSocket instance used for communication
    //   with the Xi client. webSocketsArray is an array of objects. Each object has a format of:
    //   {id: BoardID, , ip: IPAddress, port: port, ws: WebSocketReference}

    var webSocketsArray = [];

    // Sensor Data Array
    // This is an array of objects that store the latest sensor or switch value updates received from all Xi servers.
    // The object format is:
    //      key:      generated by genReporterKey()
    //      value:    latest updated value
    // A key is used to uniquely identify each data entry with a specific sensor on a specific server
    var sensorDataArray = [];

    /********************* asynchronous messages from scratch ****************************************/
        // Cleanup function when the extension is unloaded
    ext._shutdown = function () {
        //send a 'resetBoard'  message to each board
        for (var index = 0; index < webSocketsArray.length; index++) {
            if (debugLevel >= 2) {
                console.log('Sending reset to board index ' + index);
            }
            webSocketsArray[index].ws.send('resetBoard');
        }
    };

    // Status reporting code - part of boilerplate provided by Scratch
    // Set the 'LED' on the Scratch Editor
    ext._getStatus = function () {
        return {
            status: boardStatus,
            msg: 'Ready'
        };
    };

    /*****************************************************************************************************/
    /***********************************   Scratch Program Block Handlers, ******************************/
    /*****************************************************************************************************/

    // Associate a handler for each block described in the blocks section below

    /*******************************
     **** Command Block Handlers ****
     *******************************/

        // Accepts IP Address and Port information for each board that the user adds
        // The associated scratch block is a 'wait' command block.
        // We don't want Scratch to continue until the socket is open bidirectionally.
        // When socket.onopen is called the callback is returned so that scratch can proceed processing
    ext.setBoard = function (boardID, ipAddress, port, callback) {
        var timeoutID; // need to set a timeout when a socket is created because we are using a 'wait' block


        if (debugLevel >= 1)
            console.log('setBoard: ' + boardID, ipAddress, port);

        // Check to make sure that this board was not entered previously
        for (var index = 0; index < webSocketsArray.length; index++) {
            if (webSocketsArray[index].id === boardID) {
                // allow user to reset the board to the same value - for stop and start
                if ((webSocketsArray[index].ip != ipAddress) || (webSocketsArray[index].port != port)) {
                    createAlert(12, boardID);
                    callback(); // release the scratch wait block
                    return; // no need to go further
                }
            }
        }
        // This is a confirmed unique entry. Create a websocket for this board
		alert('ws://' + ipAddress + ':' + port);//***//
        var socket = new WebSocket('ws://' + ipAddress + ':' + port);

        // add the entry including the websocket reference just created
        webSocketsArray.push({'id': boardID, 'ip': ipAddress, 'port': port, 'ws': socket});

        // start the timer for a server reply - we wait for up to 2 seconds for the reply
        timeoutID = window.setTimeout(noServerAlert, 2000);


        // attach an onopen handler to this socket. This message is sent by a servers websocket
        socket.onopen = function (event) {
		alert('come in');
            window.clearTimeout(timeoutID);
            if (debugLevel >= 1)
                console.log('onopen message received');
            // change the board status to green with the first board added, since we don't know ahead of time
            // how many boards are attached
            boardStatus = 2;
            socket.send('Xi4sOnline');
            callback(); // tell scratch to proceed processing
        };

        function noServerAlert() {
            createAlert(20, boardID);
            boardStatus = 0;
        }

        /**********************  websocket 'onmessage' handler *************************************/
            //
            // All messages sent from board's socket are handled here.
            // Attach an onmessage event handler to this socket.
            // Process messages received from the server associated with this socket.
        socket.onmessage = function (message) {
            if (debugLevel === 1)
                console.log('onmessage received: ' + message.data);

            // All message components are delimited with '/' character.
            // TODO: Should this be done with JSON?

            // Incoming messages are split into their component pieces and placed into a 'msg' array
            // msg[0] for each message is the message ID.
            var msg = message.data.split('/');

            // process each message ID
            switch (msg[0]) {
                // dataUpdate - server data update data message
                case 'dataUpdate':
                    var index = msg[1]; // unique value used as an index into sensorDataArray
                    var data = msg[2]; // data value to be entered into sensorDataArray
                    if (debugLevel >= 2)
                        console.log('sensorData: index = ' + index + ' data = ' + data);
                    // update the array with the new value
                    sensorDataArray[index].value = data;
                    break;

            /***************************************
             ************** server detected errors
             ****************************************/

                // server detected a problem in setting the mode of this pin
                case 'invalidSetMode':
                case 'invalidPinCommand':
                    console.log('invalid alerts:' + 'index: ' + msg[1] + 'board: ' + msg[2] + 'pin: ' + msg[3]);
                    createAlert(msg[1], msg[2], msg[3]);
                    break;
                default:
                    if (debugLevel >= 1)
                        console.log('onmessage unknown message received');
            }
        };
    };

    // Set the pin mode command block handler
    ext.pinMode = function (boardID, pin, mode) {
        if (debugLevel >= 1)
            console.log('Set Pin Mode - board: ' + boardID + ' Mode: ' + mode + ' Pin: ' + pin);
        // make sure the websocket for the board was previously established
        for (var index = 0; index < webSocketsArray.length; index++) {
            if (webSocketsArray[index].id === boardID) {
                // send message to server to create device(input devices) or set the pin mode (output device)
                var messageToServer; // message to be sent to server
                mode = extractMode(mode);

                // the mode is the value prescribed in block descriptor section
                switch (mode) {
                    // set pin to digital input mode
                    // msg: setDigitalIN - digital service input
                    case 'Digital Input':
                        if (debugLevel >= 1)
                            console.log('pin mode digital input');
                        // build the message to send to the Xi Server
                        // we use the length of the array as the index/device id
                        messageToServer = 'setDigitalIN/' + boardID + '/' + pin + '/' + sensorDataArray.length;
                        sendSetInputPinRequest(messageToServer, 'd', boardID, pin, index);
                        break;
                    // set pin to digital out
                    // msg: setDigitalOUT
                    case 'Digital Output':
                        if (debugLevel >= 1)
                            console.log('pin mode digital output');
                        messageToServer = 'setDigitalOUT/' + boardID + '/' + pin;
                        if (debugLevel >= 2)
                            console.log('pinMode Digital Out Msg to server: ' + messageToServer);
                        webSocketsArray[index].ws.send(messageToServer);
                        break;
                    // set pin to analog in
                    // msg: setAnalogIN
                    case 'Analog Sensor Input':
                        if (debugLevel >= 1)
                            console.log('pin mode analog input');
                        // build the message to send to the Xi Server
                        // we use the length of the array as the index/device id
                        messageToServer = 'setAnalogIN/' + sensorDataArray.length + '/' + boardID + '/' + pin;
                        sendSetInputPinRequest(messageToServer, 'a', boardID, pin, index);
                        break;
                    // set pin mode PWM
                    // msg: setAnalogOUT
                    case 'Analog (PWM) Output':
                        if (debugLevel >= 1)
                            console.log('pin mode PWM');
                        // send out the pwm mode message
                        // the host tests if the pin is PWM and if not will send back an 'xp' exception message
                        messageToServer = 'setAnalogOUT/' + boardID + '/' + pin;
                        if (debugLevel >= 2)
                            console.log('pinMode PWM Out Msg to server: ' + messageToServer);
                        webSocketsArray[index].ws.send(messageToServer);
                        break;
                    case 'Standard Servo (PWM)':
                        if (debugLevel >= 1)
                            console.log('pin mode SERVO');
                        // send out the servo mode message
                        messageToServer = 'setStandardServoMode/' + boardID + '/' + pin;
                        if (debugLevel >= 2)
                            console.log('pinMode Standard Servo Out Msg to server: ' + messageToServer);
                        webSocketsArray[index].ws.send(messageToServer);
                        break;
                    case 'Continuous Servo (PWM)':
                        if (debugLevel >= 1)
                            console.log('pin mode SERVO');
                        // send out the servo mode message
                        messageToServer = 'setContinuousServoMode/' + boardID + '/' + pin;
                        if (debugLevel >= 2)
                            console.log('pinMode ContinuousServo Out Msg to server: ' + messageToServer);
                        webSocketsArray[index].ws.send(messageToServer);
                        break;
                    case 'SONAR Distance - (Digital In)':
                        createAlert(13);
                        messageToServer = 'setSonarMode/' + boardID + '/' + pin + '/' + sensorDataArray.length;
                        if (debugLevel >= 2)
                            console.log('pinMode Sonar Out Msg to server: ' + messageToServer);
                        sendSetInputPinRequest(messageToServer, 'd', boardID, pin, index);
                        break;
                    case 'Infrared Distance (GP2Y0A21YK) - (Analog In)':
                        messageToServer = 'setInfraRedDistanceMode/' + boardID + '/' + pin + '/' + sensorDataArray.length;
                        if (debugLevel >= 2)
                            console.log('pinMode infrared distance Out Msg to server: ' + messageToServer);
                        sendSetInputPinRequest(messageToServer, 'a', boardID, pin, index);
                        break;
                    case 'Tone (Piezo)- (Digital Out)':
                        if (debugLevel >= 1)
                            console.log('pin mode Tone');
                        // send out the servo mode message
                        messageToServer = 'setToneMode/' + boardID + '/' + pin;
                        if (debugLevel >= 2)
                            console.log('pinMode Tone Mode Out Msg to server: ' + messageToServer);
                        webSocketsArray[index].ws.send(messageToServer);
                        break;
                    default:
                        if (debugLevel >= 1)
                            console.log('ext.pinMode: Unknown mode - ', +mode);
                }
                // just return from here after processing the command
                return;
            }
        }
        // board not yet established
        createAlert(14, boardID)
    };


    // Digital output command block
    ext.digitalWrite = function (board, pin, value) {
        if (debugLevel >= 1) {
            console.log('digitalWrite Board: ' + board + ' Pin ' + pin + ' Value ' + value);
        }
        // strip index number off of message to determine value to send to server
        value = extractOffOn(value);
        var msg = 'digitalWrite/' + board + '/' + pin + '/' + value;
        sendCommand(msg, board, 'digitalWrite');
    };

    // PWM output (analog write)  command block
    ext.analogWrite = function (board, pin, value) {
        var msg = 'analogWrite/' + board + '/' + pin + '/' + value;
        sendCommand(msg, board, 'analogWrite');
    };

    // set servo position to position in degrees
    ext.moveStandardServo = function (board, pin, degrees, inversion) {
        inversion = extractInversion(inversion);
        var msg = 'moveStandardServo/' + board + '/' + pin + '/' + degrees + '/' + inversion;
        sendCommand(msg, board, 'moveStandardServo');
    };

    // set servo position to position in degrees
    ext.moveContinuousServo = function (board, pin, direction, inversion, speed) {
        inversion = extractInversion(inversion);
        direction = extractDirection(direction);
        var msg = 'moveContinuousServo/' + board + '/' + pin + '/' + direction + '/' + inversion + '/' + speed;
        sendCommand(msg, board, 'moveContinuousServo');
    };

    // stop servo
    ext.stopServo = function (board, pin) {
        var msg = 'stopServo/' + board + '/' + pin;
        sendCommand(msg, board, 'stopServo');
    };

    // stop stepper
    ext.stopStepper = function (board, pin) {
        var msg = 'stopStepper/' + board + '/' + pin;
        sendCommand(msg, board, 'stopStepper');
    };

    ext.fourWireStepperPins = function (board, pinA, pinB, pinC, pinD, stepsPerRev) {

        createAlert(15);

        var pinArray = [];
        pinArray.push(pinA);
        pinArray.push(pinB);
        pinArray.push(pinC);
        pinArray.push(pinD);

        // check for 4 unique values
        var unique = pinArray.filter(onlyUnique);
        if (unique.length !== 4) {
            createAlert(16);
            return;
        }
        var msg = 'fourWireStepperPins/' + board + '/' + pinA + '/' + pinB + '/' + pinC + '/' + pinD + '/' + stepsPerRev;
        sendCommand(msg, board, 'fourWireStepperPins');
    };

    ext.stepperDriverPins = function (board, pinA, pinB, stepsPerRev) {

        createAlert(15);

        var pinArray = [];
        pinArray.push(pinA);
        pinArray.push(pinB);


        // check for 2 unique values
        var unique = pinArray.filter(onlyUnique);
        if (debugLevel >= 2)
            console.log('stepperDriverPins unique =  ' + unique);

        if (debugLevel >= 2)
            console.log('stepperDriverPins unique length =  ' + unique.length);

        if (unique.length !== 2) {
            createAlert(17);
        }
        var msg = 'stepperDriverPins/' + board + '/' + pinA + '/' + pinB + '/' + stepsPerRev;
        sendCommand(msg, board, 'stepperDriverPins');
    };

    ext.moveStepper = function (board, pin, rpm, direction, accel, decel, steps) {
        direction = extractDirection(direction);
        var msg = 'moveStepper/' + board + '/' + pin + '/' + rpm + '/' + direction + '/' + accel + '/' + decel + '/' + steps;
        sendCommand(msg, board, 'moveStepper');
    };

    // send command to play a tone
    ext.playTone = function (board, pin, frequency, duration) {
        var msg = 'playTone/' + board + '/' + pin + '/' + frequency + '/' + duration;
        sendCommand(msg, board, 'playTone');
    };

    // turn tone off
    ext.noTone = function (board, pin) {
        var msg = 'noTone/' + board + '/' + pin;
        sendCommand(msg, board, 'noTone');
    };

    // Set the debug level
    ext.setDebugLevel = function (level) {
        debugLevel = level;
    };


    /*******************************
     **** Response Block Handlers ****
     *******************************/

        // retrieve digital data from sensorDataArray
    ext.getDigitalInputData = function (board, pin) {
        if (debugLevel >= 1)
            console.log('Digital Input - board: ' + board + ' Pin: ' + pin);
        var key = genReporterKey(board, pin, 'd');
        return retrieveReporterData(board, pin, key);
    };

    // retrieve analog data data from sensorDataArray
    ext.getAnalogSensorData = function (board, pin) {
        if (debugLevel >= 1)
            console.log('Analog Sensor Input - board: ' + board + ' Pin: ' + pin);

        // generate a key for sensorDataArray
        var key = genReporterKey(board, pin, 'a');
        return retrieveReporterData(board, pin, key);
    };


    // retrieve sonar data
    ext.getSonarData = function (board, units, pin) {
        if (debugLevel >= 1)
            console.log('getSonarData - board: ' + board + 'Units' + units + ' Pin: ' + pin);

        // generate a key for sensorDataArray
        var key = genReporterKey(board, pin, 'd');
        var distance = retrieveReporterData(board, pin, key);
        units = extractDistance(units);
        if (units === 'CM') {
            return (distance * 2.54).toFixed(2);
        }
        else {
            return distance;
        }
    };

    // retrieve infrared distance data
    ext.getInfraredDistanceData = function (board, units, pin) {
        if (debugLevel >= 1)
            console.log('getInfraredDistanceData - board: ' + board + 'Units' + units + ' Pin: ' + pin);

        // generate a key for sensorDataArray
        var key = genReporterKey(board, pin, 'a');
        var distance = retrieveReporterData(board, pin, key);
        units = extractDistance(units);
        if (units === 'CM') {
            return (distance * 2.54).toFixed(2);
        }
        else {
            return distance;
        }
    };


    // helper functions

    //genReporterKey
    // Input: Board number
    //        Pin number
    //        Designator to differentiate between analog and digital - either 'a' or 'd'
    //
    // Returns the generated key
    function genReporterKey(boardNum, pinNum, designator) {
        if (debugLevel >= 1)
            console.log('genReporterKey returns: ' + boardNum + designator + pinNum);
        return boardNum + designator + pinNum;
    }

    // Using the supplied key, this function will retrieve the latest data from the sensorDataArray.
    function retrieveReporterData(board, pin, key) {
        if (debugLevel >= 1) {
            console.log('retrieveReporterData: board: ' + board + ' pin ' + pin + ' key ' + key);
        }
        // make sure that this is a unique key in the array
        for (var index = 0; index < sensorDataArray.length; index++) {
            if (sensorDataArray[index].key === key) {
                return sensorDataArray[index].value
            }
        }
        // did not find an entry in the array
        createAlert(18, board, pin);
        ext._shutdown();
    }

    // This function will format a set input pin message (analog or digital) and send it to the server
    function sendSetInputPinRequest(msgToServer, analogOrDigital, board, pin, wsIndex) {
        var reporterArrayEntry = {key: null, data: -1}; // The entry we build to add to the sensorDataArray

        // generate a key so that we can use to retrieve the data from the reporterArrayEntry
        reporterArrayEntry.key = genReporterKey(board, pin, analogOrDigital);

        if (debugLevel >= 1)
            console.log('sendInputPinRequest generated key = ' + reporterArrayEntry.key);

        var found = false;
        // make sure that this is a unique key in the array
        for (var index = 0; index < sensorDataArray.length; index++) {
            if (sensorDataArray[index].key === reporterArrayEntry.key) {
                found = true;
                console.log("sendInputPinReq entry exists");
            }
        }


        // it is unique so go ahead and add the record to the array
        if (found === false) {
            sensorDataArray.push(reporterArrayEntry);
            //}
            // now we can safely send the set pin message to the Xi Server to create the device
            if (debugLevel >= 1)
                console.log('sendInputPinRequest: msg = ' + msgToServer + ' index = ' + wsIndex);
            webSocketsArray[wsIndex].ws.send(msgToServer);
        }
    }

    // This function will check to see if a board has been established and if it has, will send a command
    // message to the server
    function sendCommand(msg, board, type) {
        if (debugLevel >= 1) {
            console.log('sendCommand: ' + msg + ' ' + board + ' ' + type);
        }
        for (var index = 0; index < webSocketsArray.length; index++) {
            if (webSocketsArray[index].id === board) {
                if (debugLevel >= 2)
                    console.log('sendCommand: Message: ' + msg + ' board: ' + board);
                // send out message
                webSocketsArray[index].ws.send(msg);
                return;
            }
        }
        // board was not established
        createAlert(19, board);
    }

    // return unique values contained within an array
    function onlyUnique(value, index, self) {
        return self.indexOf(value) === index;
    }

    // strip off the text to accommodate translations
    function extractOffOn(value) {
        var offOn = value.split('.');
        if (offOn[0] === '1') {
            return "Off"
        }
        else {
            return "On";
        }
    }

    function extractDirection(direction) {
        var dirArray = direction.split('.');
        if (dirArray[0] === '1') {
            return "CW";
        }
        else {
            return "CCW";
        }
    }

    function extractDistance(distance) {
        var distArray = distance.split('.');
        if (distArray[0] === '1') {
            return "CM";
        }
        else {
            return "Inches";
        }
    }

    function extractInversion(inversion) {
        var invArray = inversion.split('.');
        if (invArray[0] === '1') {
            return "False";
        }
        else {
            return "True";
        }
    }

    function extractMode(mode) {
        var modeArray = mode.split('.');
        var serverMode = undefined;
        switch (modeArray[0]) {
            case '1':
                serverMode = 'Digital Input';
                break;
            case '2':
                serverMode = 'Digital Output';
                break;
            case '3':
                serverMode = 'Analog Sensor Input';
                break;
            case '4':
                serverMode = 'Analog (PWM) Output';
                break;
            case '5':
                serverMode = 'Standard Servo (PWM)';
                break;
            case '6':
                serverMode = 'Continuous Servo (PWM)';
                break;
            case '7':
                serverMode = 'Infrared Distance (GP2Y0A21YK) - (Analog In)';
                break;
            case '8':
                serverMode = 'SONAR Distance - (Digital In)';
                break;
            case '9':
                serverMode = 'Tone (Piezo)- (Digital Out)';
                break;
            default:
                console.log("extract mode unknown mode = " + modeArray[0]);
        }
        return serverMode;
    }

    function createAlert(index, board, pin) {
        console.log('createAlert' + index, board, pin);
        var alertStrings = [
            // 0
            "exceeds Maximum Number of Pins on Board.",
            // 1
            "does not support the requested mode.",
            //2
            "was not configured for digital write.",
            //3
            "was not configured for analog write.",
            //4
            "was not configured for TONE OUTPUT Control.",
            //5
            "was not configured for Servo Control.",
            //6
            "was not configured for Standard Servo Control.",
            //7
            "was not configured for Continuous Servo Control.",
            //8
            "was not configured for Stepper Control.",
            //9
            "this pin has already been assigned.",
            //10
            "Speed must be in the range of 0.0 to 1.0.",
            //11
            "does not support analog operation",
            //12
            "An IP entry already exists for this board.",
            //13
            "If you are using an Arduino, this feature requires a special version of StandardFirmata." +
            "See: https://github.com/rwaldron/johnny-five/wiki/Sonar for details.",
            //14
            "IP address must be set before a board is used",
            //15
            "If you are using an Arduino, this feature requires a special version of StandardFirmata." +
            "See: https://github.com/soundanalogous/AdvancedFirmata for details.",
            //16
            "The Four Pin Values Must Be Unique. Try Again!",
            //17
            "The Two Pin Values Must Be Unique. Try Again!",
            //18
            "Pin Mode was not set. ",
            //19
            "IP Address for this board was not set.",
            //20
            "Server not responding. Did you start XiServer for this board?" +
            "Please start the server, reload this page and try again"
        ];

        var headerKeywords = {
            board: "Board: ",
            pin: "Pin: "
        };

        var alertInfo = "";
        if (board != undefined) {
            alertInfo = headerKeywords.board + board;
        }
        if (pin != undefined) {
            alertInfo = alertInfo + ' ' + headerKeywords.pin + pin;
        }
        alertInfo += " ";

        alert(alertInfo + alertStrings[index]);

    }


    // Block and block menu descriptions
    var descriptor = {
        blocks: [
            ['w', 'Board %m.bdNum IPAddress/Port: %s : %s', 'setBoard', '1', 'localhost', '1234'],
            [' ', 'Board: %m.bdNum Set Pin %n as %m.pinMode', 'pinMode', '1', '2', '1. Digital Input'],
            [' ', 'Board: %m.bdNum Digital Write Pin %n = %m.onOff ', 'digitalWrite', '1', '2', '1. Off'],
            [' ', 'Board: %m.bdNum Analog Write(PWM) Pin %n = %n', 'analogWrite', '1', '3', '128'],
            [' ', 'Board: %m.bdNum Move Standard Servo On Pin %n To %n Degrees - Inverted %m.inversion',
                'moveStandardServo', '1', '3', '90', '1. False'],
            [' ', 'Board: %m.bdNum Move Continuous Servo On Pin: %n Dir: %m.motorDirection Inverted %m.inversion Servo Speed (0.0 - 1.0) %n ',
                'moveContinuousServo', '1', '3', '1. CW', '1. False', '.5'],
            [' ', 'Board: %m.bdNum Servo Stop! Pin: %n', 'stopServo', '1', '3'],
            [' ', 'Board: %m.bdNum Play Tone on Pin: %n HZ: %n MS: %n', 'playTone', '1', '3', '1000', '500'],
            [' ', 'Board: %m.bdNum Turn Tone Off For Pin: %n', 'noTone', '1', '3'],
            [' ', 'Set Debug Level %m.dbgLevel', 'setDebugLevel', '0'],
            ['r', 'Board: %m.bdNum Digital Input on Pin %n', 'getDigitalInputData', '1', '2'],
            ['r', 'Board: %m.bdNum Analog Sensor Input on Pin %n', 'getAnalogSensorData', '1', '2'],
            ['r', 'Board: %m.bdNum Infrared Distance %m.distance Pin %n', 'getInfraredDistanceData', '1', '1. CM', '2'],
            ['r', 'Board: %m.bdNum SONAR Distance %m.distance Pin %n', 'getSonarData', '1', '1. CM', '2'],
            [' ', 'Board: %m.bdNum Set Pins For 4 Wire Bipolar Stepper %n   %n   %n   %n Steps Per Rev: %n', 'fourWireStepperPins', '1', '8', '9', '10', '11', '500'],
            [' ', 'Board: %m.bdNum Set Pins For Stepper Driver Board: Step %n Direction %n Steps Per Rev: %n', 'stepperDriverPins', '1', '8', '9', 500],
            [' ', 'Board: %m.bdNum Move Stepper On Pin %n  RPM: %n  Dir: %m.motorDirection  Accel: %n  Decel: %n  # of Steps: %n',
                'moveStepper', '1', '8', '180', '1. CW', '1600', '1600', '2000'],
            [' ', 'Board: %m.bdNum Stepper Stop! Pin: %n', 'stopStepper', '1', '8']


        ],
        menus: {
            bdNum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
            dbgLevel: ['0', '1', '2'],
            onOff: ['1. Off', '2. On'],
            pinMode: ['1. Digital Input', '2. Digital Output', '3. Analog Sensor Input', '4. Analog (PWM) Output',
                '5. Standard Servo (PWM)', '6. Continuous Servo (PWM)', '7. Infrared Distance (GP2Y0A21YK) - (Analog In)',
                '8. SONAR Distance - (Digital In)', '9. Tone (Piezo)- (Digital Out)'],
            motorDirection: ['1. CW', '2. CCW'],
            inversion: ['1. False', '2. True'],
            distance: ['1. CM', '2. Inches']

        },

        url: 'http://mryslab.blogspot.com/'
    };


    // Register the extension
    ScratchExtensions.register('wis_robot', descriptor, ext);

})();
