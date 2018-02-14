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
var latitudeResourceURI = '/5514/0/0';
var longitudeResourceURI = '/5515/0/0';
var temperatureResourceURI = '/3303/0/0';
var altitudeResourceURI = '/3321/0/0';
var pressureResourceURI = '/3315/0/0';

var connectOptions = {
    apiKey: accessKey
}

if (apiHost) {
    connectOptions['host'] = apiHost;
}

// Instantiate an mbed Cloud device API object
var connectApi = new mbed.ConnectApi(connectOptions);

// Create the express app
var app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
    connectApi.listConnectedDevices({ filter: { deviceType: "tutorial-location-tracking" } } )
        .then(function(devices) {
            devices.data.forEach(function(device) {
                device.updatedAt = new Date(device.updatedAt).toISOString();
            });
            res.render('index', {
                devices: devices.data
            });
            devices.data.forEach(function(device) {
                var deviceId = device.id;

                connectApi.addResourceSubscription(deviceId, latitudeResourceURI, function(value) {
                    var latitude = value;
                    connectApi.getResourceValue(deviceId, longitudeResourceURI, function(error, value) {
                        if (error) throw error;
                        var longitude = value;
                        sockets.forEach(function(socket) {
                            socket.emit('coordinate', {
                                device: deviceId,
                                latitude: latitude,
                                longitude: longitude
                            });
                        });
                    });
                });

                connectApi.addResourceSubscription(deviceId, temperatureResourceURI, function(value) {
                    if (error) throw error;
                    console.log(value);
                    var temperature = value;
                    sockets.forEach(function(socket) {
                        socket.emit('temp', {
                            device: deviceId,
                            temp: temperature
                        });
                    });
                });

                connectApi.addResourceSubscription(deviceId, altitudeResourceURI, function(value) {
                    if (error) throw error;
                    var altitude = value;
                    sockets.forEach(function(socket) {
                        socket.emit('altitude', {
                            device: deviceId,
                            altitude: altitude
                        });
                    });
                });

                connectApi.addResourceSubscription(deviceId, pressureResourceURI, function(value) {
                    if (error) throw error;
                    var pressure = value;
                    sockets.forEach(function(socket) {
                        socket.emit('pressure', {
                            device: deviceId,
                            pressure: pressure
                        });
                    });
                });
            });
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

var sockets = [];
var server = http.Server(app);
var io = ioLib(server);

// Setup sockets for updating web UI
io.on('connection', function(socket) {
    // Add new client to array of client upon connection
    sockets.push(socket);

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
