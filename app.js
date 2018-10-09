var http = require('http');
var path = require('path');
var express = require('express');
var mbed = require("mbed-cloud-sdk");

var port = process.env.PORT || 8080;

// Create the express app
var app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
    res.render('index');
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

var server = http.Server(app);

// Start the app
server.listen(port, function() {
    console.log('mbed Cloud Quickstart listening at http://localhost:%s', port);
});
