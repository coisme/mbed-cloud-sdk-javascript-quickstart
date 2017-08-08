# mbed Cloud Node.js Quickstart

[![CircleCI](https://circleci.com/gh/ARMmbed/mbed-cloud-sdk-javascript-quickstart/tree/master.svg?style=shield&circle-token=b89e3cc6281d5aa7cd95021d0969c60456603ce6)](https://circleci.com/gh/ARMmbed/mbed-cloud-sdk-javascript-quickstart/tree/master)
[![Github All Releases](https://img.shields.io/github/downloads/atom/atom/total.svg)](https://github.com/ARMmbed/mbed-cloud-sdk-javascript-quickstart)
[![npm](https://img.shields.io/npm/v/npm.svg)](https://github.com/ARMmbed/mbed-cloud-sdk-javascript-quickstart)

Javascript quickstart guide for mbed Cloud. 10 minute guide to get you up and running.

## Getting Started

### Installing Node.js and npm

You need to have Node.js and npm installed.

To check if you have them installed, open a terminal or command prompt and run the following commands:

```
node --version
npm --version
```

If you see an number output similar to x.x.x for each command, then they are both installed and you can continue to the next section.

To install on Windows or Mac, you can download the installer [here](https://nodejs.org/en/download).

To install on Linux, you can use a package manager. Instructions for installing Node.js on your distribution can be found [here](https://nodejs.org/en/download/package-manager)

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

Once you've [configured the app](#configuring-the-app), you need to install its dependencies. Open a terminal or command prompt and run this command:
```
npm install
```

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

### Creating an Access Key

1. Login to your account at [https://portal.mbedcloud.com/access/keys).
