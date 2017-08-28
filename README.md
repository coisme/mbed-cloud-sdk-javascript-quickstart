# mbed Cloud JavaScript Quickstart

[![CircleCI](https://circleci.com/gh/ARMmbed/mbed-cloud-sdk-javascript-quickstart/tree/master.svg?style=shield&circle-token=b89e3cc6281d5aa7cd95021d0969c60456603ce6)](https://circleci.com/gh/ARMmbed/mbed-cloud-sdk-javascript-quickstart/tree/master)

This is a quickstart application for the [mbed-cloud-sdk-javascript](https://github.com/ARMmbed/mbed-cloud-sdk-javascript) package.
The goal of this application is to get the user up and running, using the mbed-cloud javascript sdk package and talking to devices through mbed cloud client in under 15 min.
The quickstart webapp is meant to be paired with [mbed cloud client](https://github.com/mbartling/mbed-cloud-client-example-internal).

## Getting Started

### Installing Node.js and npm

You need to have Node.js and npm installed.

To check if you have them installed, open a terminal or command prompt and run the following commands:

```
node --version
npm --version
```

### Pre-requisites
- A [mbed cloud portal](https://portal.mbedcloud.com/) account and have generated an [API token](https://portal.mbedcloud.com/access/keys)
- A endpoint running the [mbed cloud client example](https://github.com/mbartling/mbed-cloud-client-example-internal)
- Install the required packages `npm install`

## Configuring the App

Before running the app, you need to set some config options. This is done through environment variables, by modifying the app directly, or by input arguments as shown in the [Input Arguments](#input-arguments) section.

The following variables are available to be configured:

- **MBED_CLOUD_API_KEY** - *(required)* Set this to your API Key you created in mbed Cloud. If you do not have an API Key, see the section [Creating an Access Key](#creating-an-access-key)
- **PORT** - Set this to override the default port for the app. The default port is **8080**.

The application has the following code which can be modified:

```
var accessKey = process.env.MBED_CLOUD_API_KEY || "<access_key>";
var port = process.env.PORT || 8080;
```

## Running the App

You can now run the app by using the following command:

```
node app.js
```

You should receive the following output:

```
mbed Cloud Quickstart listening at http://localhost:8080
```

Copy and paste the printed URL into your browser and you should see a page listing all of your connected mbed Clients.

### Input arguments

The following input arguments are supported:

`--uploadManifest` - Allows you to upload a `.JSON` file containing manifest `.pem`, `.der`, and `.json` files from the UI instead of generating new credentials

`--apiKey=<MBED_CLOUD_API_KEY>` - Overrides or replaces the environment variable for `MBED_CLOUD_API_KEY`

## Appendix

## Running the Docker image
1. copy your `id_rsa` key file to project folder
1. `docker build -t webapp-node .`
1. `docker run -p 8080:8080 webapp-node --apiKey=ACCESS_KEY`
