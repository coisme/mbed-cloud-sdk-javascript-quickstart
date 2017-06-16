// Load .env config (silently fail if no .env present)
require('dotenv').config({ silent: true });

// Require necessary libraries
var async = require('async');
var ioLib = require('socket.io');
var http = require('http');
var path = require('path');
var express = require('express');
var mbed = require("mbed-cloud-sdk");
var exec = require('child_process').exec;
var fs = require('fs');
var dl = require('delivery');

// CONFIG (change these)
var accessKey = process.env.ACCESS_KEY || "ChangeMe";
var port = process.env.PORT || 8081;

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

// Instantiate an mbed Cloud device API object
var deviceApi = new mbed.DeviceDirectoryApi({
    apiKey: accessKey
});

// Create the express app
var app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
  // Get all of the devices and necessary info to render the page
  connectApi.listConnectedDevices("quickstart", function(error, devices) {
    if (error) throw error;
    else {
      // Setup the function array
      var functionArray = devices.map(function(device) {
        return function(mapCallback) {
          deviceApi.updateDevice({
            id: device.id,
            description: 'Quickstart device',
            customAttributes: {
              device_type: 'quickstart'
            }
          }, function(error, device) {
              if (error) throw error;
              connectApi.getResourceValue(device.id, blinkPatternResourceURI, function(error, value) {
                mapCallback(error);
                device.blinkPattern = value;
              });
          });
        };
      });
      // Fetch all blink patterns in parallel, finish when all HTTP
      // requests are complete (uses Async.js library)
      async.parallel(functionArray, function(error) {
        if (error) {
          res.send(String(error));
        } else {
          res.render('index', {
            devices: devices
          });
        }
      });
    }
  });
});

// Handle unexpected server errors
app.use(function(err, req, res, next) {
  console.log(err.stack);
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: err
  });
});

var sockets = [];
var server = http.Server(app);
var io = ioLib(server);

// Callback for when the button is pressed and the subscription service catches the button callback
function buttonPressed(device, payload) {
  sockets.forEach(function(socket) {
    socket.emit('presses', {
      device: device,
      value: payload
    });
  });
}

// Setup sockets for updating web UI
io.on('connection', function (socket) {
  // Add new client to array of client upon connection
  sockets.push(socket);

  socket.on('subscribe-to-presses', function (data) {
    // Subscribe to all changes of resource /3200/0/5501 (button presses)
    connectApi.addResourceSubscription(data.device, buttonResourceURI, function(error) {
      if (error) throw error;
      socket.emit('subscribed-to-presses', {
        device: data.device
      });
    }, function(payload) {
      buttonPressed(data.device, payload);
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
  socket.on('generate-manifest', function(data) {
    exec('rm -rf .update-certificates/; manifest-tool init -d "vendor.com" -m "qs v1" -q --force', function(error, stdout, stderr) {

      // Error reporting
      if (error) {
        socket.emit('console-log', 'Error initializing manifest-tool<br>' + error + '<br>');
        return console.log(error);
      }

      // Move the credential file to the public folder so a user has access to download it
      socket.emit('console-log', 'manifest-tool executed<br>');
      exec('mv update_default_resources.c public/.', function(error, stdout, stderr) {

        // Error reporting
        if (error) {
          socket.emit('console-log', 'Error generating update_default_resources.c<br>' + error + '<br>');
          return console.log(error);
        }

        // Send the front webserver the command to download the credential file to the user
        socket.emit('console-log', 'manifest-tool generated update_default_resources.c file and downloaded to user<br>');
        socket.emit('generated-manifest', {});
      });

    });
  });

  /**
  * File uploaded
  **/
  var delivery = dl.listen(socket);
  delivery.on('receive.success',function(file) {
    var params = file.params;
    image_name = file.name.substring(0, file.name.length - 4);
    socket.emit('console-log', 'Server received file with file name: ' + file.name + '<br>');
    if (params.name == 'image')
      uploadImage(file);
    else if (params.name == 'manifest')
      uploadManifest(file);
  });

  /**
  * Image uploaded via 'Upload' button
  * @param file Firmware binary to upload to mbed cloud
  **/
  function uploadImage(file) {

    // Save the uploaded image on the server
    fs.writeFile(file.name,file.buffer, function(error) {

      // Error reporting
      if(error) {
        socket.emit('console-log', 'Error saving image binary to disk. ' + error + '<br>');
        return console.log(error);
      } else {
        socket.emit('console-log', 'Server saved image binary to disk<br>');

        // Use mbed SDK to upload the firmware image
        updateApi.addFirmwareImage({
          name: image_name,
          dataFile: fs.createReadStream(file.name)
        }, function(error, image) {

          // Error reporting
          if (error) {
            socket.emit('console-log', 'Error uploading image to mbed Cloud. ' + error + '<br>');
            return console.log(error);
          }

          // Use the image URL returned to create a manifest file
          socket.emit('console-log', 'Image uploaded to mbed Cloud. URL: ' + image.url + '<br>');
          image_url = image.url;
          createManifest(image_url, file.name);
        });
      };
    });
  }

  /**
  * Create manifest file after receiving the image url
  * @param deviceURL URL returned by the mbed SDK where the firmware binary was uploaded to
  * @param fileName local file instance that was uploaded
  **/
  function createManifest(deviceURL, fileName) {

    // Run the manifest-tool locally and create a manifest file
    var tty = process.platform === 'win32' ? 'CON' : '/dev/tty';
    var cmd = 'manifest-tool create -u ' + deviceURL + ' -p ' + fileName + ' -o quickstart.manifest < ' + tty;
    exec(cmd, function(error, stdout, stderr) {

      // Error reporting
      if (error) {
        socket.emit('console-log', 'Error creating a manifest file. ' + error + '<br>');
        return console.log(error);
      }

      socket.emit('console-log', 'Manifest file created and saved to disk<br>');
      // Upload the manifest file to mbed Cloud
      updateApi.addFirmwareManifest({
        name: image_name,
        dataFile: fs.createReadStream('quickstart.manifest')
      }, function(error, manifest) {

        // Error reporting
        if (error) {
          socket.emit('console-log', 'Error uploading manifest to mbed Cloud. ' + error + '<br>');
          return console.log(error);
        }

        // Save manifest ID for starting a campaign
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
    fs.writeFile(file.name,file.buffer, function(error) {

      // Error reporting
      if(error) {
        socket.emit('console-log', 'Error saving manifest JSON file to disk. ' + error + '<br>');
        return console.log(error);
      } else {

        // Parse json structure for pem, der, and json file contents
        var jsonData = JSON.parse(file.buffer.toString('utf8'));
        if (!fs.existsSync('.update-certificates')) {
          fs.mkdirSync('.update-certificates');
        }
        fs.writeFile('.manifest_tool.json', JSON.stringify(jsonData.json));
        fs.writeFile('.update-certificates/default.key.pem', jsonData.pem);
        fs.writeFile('.update-certificates/default.der', new Buffer(jsonData.der, 'base64'));
        socket.emit('console-log', 'Saved PEM, DER and JSON file data to disk<br>');
      };
    });
  }

  /**
  * Start campaign
  **/
  socket.on('start-campaign', function(data) {

    // Add a campaign via the mbed Cloud SDK
    updateApi.addCampaign({
      name: image_name,
      deviceFilter: {
        state: { $eq: "registered" },
        createdAt: { $gte: new Date("01-01-2017"), $lte: new Date("01-01-2020") },
        updatedAt: { $gte: new Date("01-01-2017"), $lte: new Date("01-01-2020") },
        customAttributes: {
          device_type: { $eq: "quickstart" }
        }
      },
      manifestId: manifest_id
    }, function(error, campaign) {

      // Error reporting
      if (error) {
        socket.emit('console-log', 'Error adding a campaign to mbed Cloud. ' + error + '<br>');
        return console.log(error);
      }
      socket.emit('console-log', 'Campaign added to mbed Cloud. ID: ' + campaign.id + '<br>');

      // Start the previously added campaign
      updateApi.startCampaign(campaign.id, function(error, data) {

        // Error reporting
        if (error) {
          socket.emit('console-log', 'Error starting campaign. ' + error + '<br>');
          return console.log(error);
        }

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
