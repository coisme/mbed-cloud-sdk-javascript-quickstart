var ioLib = require('socket.io');
var http = require('http');
var path = require('path');
var express = require('express');
var mbed = require("mbed-cloud-sdk");

// CONFIG (change these)
var accessKey = process.env.MBED_CLOUD_API_KEY || "<access_key>";
var port = process.env.PORT || 8080;
var apiHost = process.env.MBED_CLOUD_HOST || null;

// Argument parser
var args = process.argv.splice(process.execArgv.length + 2);
args.forEach(function (val) {

    if (val.indexOf("apiKey")>=0)
        accessKey = val.substr(val.search("=")+1);

    if (val.indexOf("host")>=0)
        apiHost = val.substr(val.search("=")+1);
});

// Paths to resources on the devices
var switchResourceURI = '/3311/0/5850';
var powerResourceURI = '3311/0/5800';

var connectOptions = {
    apiKey: accessKey
}

if (apiHost) {
    connectOptions['host'] = apiHost;
}

// Instantiate an mbed Cloud device API object
var connectApi = new mbed.ConnectApi(connectOptions);

// Instantiate an mbed Cloud update API object
var updateApi = new mbed.UpdateApi(connectOptions);

// Create the express app
var app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));

// serve index.hbs page
app.get('/', function(req, res) {
    connectApi.listConnectedDevices({ filter: { deviceType: "tutorial-industrial-lighting" } } )
        .then(function(devices) {
            res.render('index', {
                devices: devices.data
            });
            for(let device of devices.data){
                console.log("Subscribing to "+device.id);
                connectApi.addResourceSubscription(device.id, powerResourceURI,
                    function(error) {console.log("Error: "+error);},
                    function(payload) {powerMesured(device.id, payload);}
                    );
                console.log("Subscribing to "+device.id);
                connectApi.addResourceSubscription(device.id, switchResourceURI,
                    function(error) {console.log("Error: "+error);},
                    function(payload) {switchFlipped(device.id, payload);}
                    );
            }
        })
        .catch(function(error) {
            res.send(String(error));
        });
});

// Handle unexpected server errors
app.use(function(err, req, res, next) {
    if (req.xhr) {
        res.status(err.status || 500).send({ error: 'Something failed!' });
        res.render('error', {
            message: err.stack,
            error: err
        });
    } else {
        next(err);
    }
});

// Callback for when the switch is pressed and the subscription service catches the switch callback
// (device -> webapp)
function switchFlipped(device, payload) {
    sockets.forEach(function(socket) {
        socket.emit('switchFlip', {
            device: device,
            value: payload
        });
    });
}

// Callback for when the power value is updated, (device -> webapp)
function powerMesured(device, payload) {
    console.log("Device :"+device+" with payload :"+payload);
    console.log(payload)
    sockets.forEach(function(socket) {
        socket.emit('updateChart', {
            device: device, // device to update
            value: payload  // value to update
        });
    });
}

var sockets = [];
var server = http.Server(app);
var io = ioLib(server);

// Setup sockets for updating web UI
io.on('connection', function(socket) {
    // Add new client to array of client upon connection
    sockets.push(socket);

    // send data from webapp -> embedded device
    socket.on('switch-on-off', function(data) {
        console.log("switch pressed, setting device "+data.device+" to value "+data.status);
        // set switch value on device from web app
        connectApi.setResourceValue(data.device,switchResourceURI,data.status);
    });

    socket.on('disconnect', function() {
        // Remove this socket from the array when a user closes their browser
        var index = sockets.indexOf(socket);
        if (index >= 0) {
            sockets.splice(index, 1);
        }
    });

});

// Start the app
server.listen(port, function() {
    // Set up the notification channel (pull notifications)
    connectApi.startNotifications(function(error) {
        if (error) throw error;
        else {
            console.log('mbed Cloud Quickstart listening at http://localhost:%s', port);
        }
    });
});
