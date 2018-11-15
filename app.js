var ioLib = require('socket.io');
var http = require('http');
var path = require('path');
var express = require('express');
var mbed = require("mbed-cloud-sdk");

// CONFIG (change these)
var accessKey = process.env.MBED_CLOUD_API_KEY || "<< YOUR API KEY >>";
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
var blinkResourceURI = '/3201/0/5850';
var blinkPatternResourceURI = '/3201/0/5853';
var buttonResourceURI = '/3200/0/5501';
var distanceResourceURI = '/3330/0/5700';
var temperatureResourceURI = '/3303/0/5700';
var humidityResourceURI = '/3304/0/5700';

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

app.get('/', function(req, res) {
    connectApi.listConnectedDevices({ filter: { deviceType: "default", state: {$eq: "registered"} } } )
        .then(function(devices) {
            res.render('index', {
                devices: devices.data
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

    socket.on('subscribe-to-presses', function(data) {
        // Subscribe to all changes of resource /3200/0/5501 (button presses)
        var deviceId = data.device;
        connectApi.addResourceSubscription(deviceId, buttonResourceURI, function(data) {
            socket.emit('presses', {
                device: deviceId,
                value: data
            });
        }, function(error) {
            if (error) throw error;
        });
    });

    socket.on('unsubscribe-to-presses', function(data) {
        // Unsubscribe from the resource /3200/0/5501 (button presses)
        connectApi.deleteResourceSubscription(data.device, buttonResourceURI, function(error) {
            if (error) throw error;
            socket.emit('unsubscribed-to-presses', {
                device: data.device
            });
        });
    });

    socket.on('get-presses', function(data) {
        // Read data from GET resource /3200/0/5501 (num button presses)
        connectApi.getResourceValue(data.device, buttonResourceURI, function(error, value) {
            if (error) throw error;
            socket.emit('presses', {
                device: data.device,
                value: value
            });
        });
    });

    socket.on('subscribe-to-distance', function(data) {
        // Subscribe to all changes of resource /3330/0/5700 (distance)
        var deviceId = data.device;
        connectApi.addResourceSubscription(deviceId, distanceResourceURI, function(data) {
            socket.emit('distance', {
                device: deviceId,
                value: data
            });
        }, function(error) {
            if (error) throw error;
        });
    });

    socket.on('unsubscribe-to-distance', function(data) {
        // Unsubscribe from the resource /3330/0/5700 (distance)
        connectApi.deleteResourceSubscription(data.device, distanceResourceURI, function(error) {
            if (error) throw error;
            socket.emit('unsubscribed-to-distance', {
                device: data.device
            });
        });
    });

    socket.on('get-distance', function(data) {
        // Read data from GET resource /3300/0/5700 (distance)
        connectApi.getResourceValue(data.device, distanceResourceURI, function(error, value) {
            if (error) throw error;
            socket.emit('distance', {
                device: data.device,
                value: value
            })
        })
    });

    socket.on('subscribe-to-temperature', function(data) {
        // Subscribe to all changes of resource /3303/0/5700 (temperature)
        var deviceId = data.device;
        connectApi.addResourceSubscription(deviceId, temperatureResourceURI, function(data) {
            socket.emit('temperature', {
                device: deviceId,
                value: data
            });
        }, function(error) {
            if (error) throw error;
        });
    });

    socket.on('unsubscribe-to-temperature', function(data) {
        // Unsubscribe from the resource /3303/0/5700 (temperature)
        connectApi.deleteResourceSubscription(data.device, temperatureResourceURI, function(error) {
            if (error) throw error;
            socket.emit('unsubscribed-to-temperature', {
                device: data.device
            });
        });
    });

    socket.on('get-temperature', function(data) {
        // Read data from GET resource /3303/0/5700 (distance)
        connectApi.getResourceValue(data.device, temperatureResourceURI, function(error, value) {
            if (error) throw error;
            socket.emit('temperature', {
                device: data.device,
                value: value
            })
        })
    });

    socket.on('subscribe-to-humidity', function(data) {
        // Subscribe to all changes of resource /3304/0/5700 (humidity)
        var deviceId = data.device;
        connectApi.addResourceSubscription(deviceId, humidityResourceURI, function(data) {
            socket.emit('humidity', {
                device: deviceId,
                value: data
            });
        }, function(error) {
            if (error) throw error;
        });
    });

    socket.on('unsubscribe-to-humidity', function(data) {
        // Unsubscribe from the resource /3304/0/5700 (distance)
        connectApi.deleteResourceSubscription(data.device, humidityResourceURI, function(error) {
            if (error) throw error;
            socket.emit('unsubscribed-to-humidity', {
                device: data.device
            });
        });
    });

    socket.on('get-humidity', function(data) {
        // Read data from GET resource /3304/0/5700 (distance)
        connectApi.getResourceValue(data.device, humidityResourceURI, function(error, value) {
            if (error) throw error;
            socket.emit('humidity', {
                device: data.device,
                value: value
            })
        })
    });

    socket.on('update-blink-pattern', function(data) {
        // Set data on PUT resource /3201/0/5853 (pattern of LED blink)
        connectApi.setResourceValue(data.device, blinkPatternResourceURI, data.blinkPattern, function(error) {
            if (error) throw error;
        });
    });

    socket.on('blink', function(data) {
        // POST to resource /3201/0/5850 (start blinking LED)
        connectApi.executeResource(data.device, blinkResourceURI, function(error) {
            if (error) throw error;
        });
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
