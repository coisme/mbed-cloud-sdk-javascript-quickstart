var ioLib = require('socket.io');
var http = require('http');
var path = require('path');
var express = require('express');
var mbed = require("mbed-cloud-sdk");
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var fs = require('fs');
var fileUpload = require('express-fileupload');

// CONFIG (change these)
var accessKey = process.env.MBED_CLOUD_API_KEY || "<access_key>";
var port = process.env.PORT || 8080;

// Argument parser
var arg_manifest_upload = false;
var args = process.argv.splice(process.execArgv.length + 2);
args.forEach(function (val) {

    if (val.indexOf("uploadManifest")>=0)
        arg_manifest_upload = true;

    if (val.indexOf("apiKey")>=0)
        accessKey = val.substr(val.search("=")+1);
});

// Paths to resources on the devices
var blinkResourceURI = '/3201/0/5850';
var blinkPatternResourceURI = '/3201/0/5853';
var buttonResourceURI = '/3200/0/5501';

var image_name = '<undefined>';
var image_url = '<undefined>';
var manifest_id = '<undefined>';

// Instantiate an mbed Cloud device API object
var connectApi = new mbed.ConnectApi({
    apiKey: accessKey
});

// Instantiate an mbed Cloud device API object
var updateApi = new mbed.UpdateApi({
    apiKey: accessKey
});

// Create the express app
var app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());

app.get('/', function(req, res) {
    connectApi.listConnectedDevices({ filter: { deviceType: "quickstart" } } )
        .then(function(devices) {
            res.render('index', {
                uploadManifest: arg_manifest_upload ? "true" : "",
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

    /*
     * Generate manifest security files
     */
    socket.on('generate-manifest', function() {
        exec('manifest-tool init -d "vendor.com" -m "qs v1" -q --force', function(error) {

            // Error reporting
            if (error) {
                socket.emit('console-log', '<font color="red">Error initializing manifest-tool<br>' + error + '<br></font>');
                return;
            }

            // Move the credential file to the public folder so a user has access to download it
            socket.emit('console-log', 'manifest-tool executed<br>');
            exec('mv update_default_resources.c public/.', function(error) {

                // Error reporting
                if (error) {
                    socket.emit('console-log', '<font color="red">Error generating update_default_resources.c<br>' + error + '<br></font>');
                    return;
                }

                // Send the front webserver the command to download the credential file to the user
                socket.emit('console-log', '<font color="green">Command run: manifest-tool init<br></font>');
                socket.emit('console-log', 'manifest-tool generated update_default_resources.c file and downloaded to user<br>');
                socket.emit('generated-manifest', {});
            });

        });
    });

    app.post('/uploadFile', function(req, res) {
        res.status(200).json({ status: "ok" });
        var file = Object.keys(req.files)[0];
        image_name = req.files[file].name.substring(0, req.files[file].name.length - 4);
        socket.emit('console-log', 'Server received file with file name: ' + image_name + '<br>');
        if (file === 'image')
            uploadImage(req.files[file]);
        else if (file === 'manifest')
            uploadManifest(req.files[file]);
    });

    /**
     * Image uploaded via 'Upload' button
     * @param file Firmware binary to upload to mbed cloud
     **/
    function uploadImage(file) {
        // Save the uploaded image on the server
        fs.writeFile(file.name, file.data, function(error) {

            // Error reporting
            if (error) {
                socket.emit('console-log', '<font color="red">Error saving image binary to disk. ' + error + '<br></font>');
                return;
            } else {
                socket.emit('console-log', 'Server saved image binary to disk<br>');

                // Use mbed SDK to upload the firmware image
                updateApi.addFirmwareImage({
                    name: image_name,
                    dataFile: fs.createReadStream(file.name)
                }, function(error, image) {

                    // Error reporting
                    if (error) {
                        socket.emit('console-log', '<font color="red">Error uploading image to mbed Cloud. ' + error + '<br></font>');
                        return;
                    }

                    // Use the image URL returned to create a manifest file
                    socket.emit('console-log', '<font color="green">Command run: addFirmwareImage from Update API<br></font>');
                    socket.emit('console-log', 'Image uploaded to mbed Cloud. URL: ' + image.url + '<br>');
                    image_url = image.url;
                    createManifest(image_url, file.name);
                });
            }
        });
    }

    /**
     * Create manifest file after receiving the image url
     * @param deviceURL URL returned by the mbed SDK where the firmware binary was uploaded to
     * @param fileName local file instance that was uploaded
     **/
    function createManifest(deviceURL, fileName) {

        var manifestExec = spawn("manifest-tool", ['create', '-u', deviceURL, '-p', fileName, '-o', 'quickstart.manifest', '-i', 'null.file']);
        manifestExec.on('close', function(code) {

            // Error Reporting
            if (code != 0) {
                socket.emit('console-log', '<font color="red">Error creating a manifest file. ' + error + '<br></font>');
                return;
            }

            socket.emit('console-log', 'Manifest file created and saved to disk<br>');
            // Upload the manifest file to mbed Cloud
            updateApi.addFirmwareManifest({
                name: image_name,
                dataFile: fs.createReadStream('quickstart.manifest')
            }, function(error, manifest) {

                // Error reporting
                if (error) {
                    socket.emit('console-log', '<font color="red">Error uploading manifest to mbed Cloud. ' + error + '<br></font>');
                    return;
                }

                // Save manifest ID for starting a campaign
                socket.emit('console-log', '<font color="green">Command run: manifest-tool create<br></font>');
                socket.emit('console-log', '<font color="green">Command run: addFirmwareManifest from Update API<br></font>');
                socket.emit('console-log', 'Manifest uploaded to mbed Cloud. URL: ' + manifest.url + '<br>');
                manifest_id = manifest.id;
            });

        });
    }

    /**
     * Upload manifest.json file to create necessary manifest security files
     * @param file Manifest json file which has the contents of the 3 security files needed
     **/
    function uploadManifest(file) {
        fs.writeFile(file.name, file.data, function(error) {

            // Error reporting
            if (error) {
                socket.emit('console-log', '<font color="red">Error saving manifest JSON file to disk. ' + error + '<br></font>');
                return;
            } else {

                // Parse json structure for pem, der, and json file contents
                var jsonData = JSON.parse(file.data.toString('utf8'));
                if (!fs.existsSync('.update-certificates')) {
                    fs.mkdirSync('.update-certificates');
                }
                fs.writeFile('.manifest_tool.json', JSON.stringify(jsonData.json));
                fs.writeFile('.update-certificates/default.key.pem', jsonData.pem);
                fs.writeFile('.update-certificates/default.der', new Buffer(jsonData.der, 'base64'));
                socket.emit('console-log', 'Saved PEM, DER and JSON file data to disk<br>');
            }
        });
    }

    /**
     * Start campaign
     **/
    socket.on('start-campaign', function() {
        // Way to generate deviceClass automatically:
        // uuid(model, uuid(vendor, uuid.DNS)).replace(new RegExp('-', 'g'), '')

        // Instead, read the classId object from the manifest json file
        var classId = JSON.parse(fs.readFileSync('.manifest_tool.json', 'utf8'))['classId'];
        classId = classId.replace(new RegExp('-', 'g'), '');

        // Add a campaign via the mbed Cloud SDK
        updateApi.addCampaign({
            name: image_name,
            deviceFilter: {
                state: {
                    $eq: "registered"
                },
                deviceClass: classId
            },
            manifestId: manifest_id
        }, function(error, campaign) {

            // Error reporting
            if (error) {
                socket.emit('console-log', '<font color="red">Error adding a campaign to mbed Cloud. ' + error + '<br></font>');
                return;
            }
            socket.emit('console-log', '<font color="green">Command run: addCampaign from Update API<br></font>');
            socket.emit('console-log', 'Campaign added to mbed Cloud. ID: ' + campaign.id + '<br>');

            // Start the previously added campaign
            updateApi.startCampaign(campaign.id, function(error) {

                // Error reporting
                if (error) {
                    socket.emit('console-log', '<font color="red">Error starting campaign. ' + error + '<br></font>');
                    return;
                }
                socket.emit('console-log', '<font color="green">Command run: startCampaign from Update API<br></font>');
                socket.emit('console-log', 'Campaign started. Started at ' + campaign.startedAt + '<br>');
            });
        });
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
