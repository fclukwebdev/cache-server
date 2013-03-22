/*global require*/

(function () {

    "use strict";

    // Load dependencies
    var http = require('http');
    var fs = require('fs');
    var util = require('util');
    var config = require('./config.json');

    // Setup globals
    var scope = this;
    var cacheBase = config.cacheBase || '';
    var remoteServer = config.remoteServer || '';
    var serverPort = config.serverPort || 80;

    function processUrl(url) {

        if (url.indexOf('?') > 0) {
            var urlParts = url.split('?');
            var queryParts = urlParts[1].split('&');
            var requestUri = urlParts[0];
            var queryString = {};
            for (var t = 0; t < queryParts.length; t++) {
                var parts = queryParts[t].split('=');
                queryString[parts[0]] = parts[1];
            }
            return { requestUri: requestUri, queryString: queryString };
        } else {
            return { requestUri: url, queryString: {} };
        }

    }

    function checkSubdirectory(path) {

        var exists = fs.existsSync(path);

        if (exists === true) {
            console.log('Checking for subdirectory: ' + path + ' [FOUND]');
        } else {
            console.log('Checking for subdirectory: ' + path + ' [NOT FOUND]. Creating...');
            fs.mkdir(path, '0777');
        }

        return;

    }

    function retrieveFromCache(cachePath, callback) {

        console.log('Retrieving from cache: ' + cachePath);

        var htmlContent = '';

        callback = callback || function () { return false; };

        htmlContent += fs.readFileSync(cachePath);

        callback.call(scope, htmlContent);

    }

    function retrieveFromRemote(requestHost, requestPath, basePath, refParts, requestMethod, postContent, cachePath, callback) {

        console.log('Retrieving from remote server: ' + requestPath);

        var htmlContent = '';
        requestMethod = requestMethod || 'GET';

        callback = callback || function () { return false; };

        var requestOptions = {
            hostname: 'int.' + requestHost,
            port: 80,
            path: requestPath,
            method: requestMethod
        };

        if (requestMethod === 'POST') {
            requestOptions.headers = {
                "content-type": "application/x-www-form-urlencoded",
                "content-length": postContent.length.toString()
            };
        }

        var req = http.request(requestOptions, function (res) {
            res.setEncoding('utf8');

            res.on('data', function (chunk) {
                htmlContent += chunk;
            });

            res.on('end', function () {

                //check if cache folder exists
                checkSubdirectory(basePath);

                //create directories for each layer of reference
                var incrementPath = basePath;
                for (var v = 1; v < (refParts.length - 1); v++) {
                    incrementPath = incrementPath + '/' + refParts[v];
                    checkSubdirectory(incrementPath);
                }

                if (typeof cachePath !== 'undefined' && cachePath !== null) {
                    var _this = this;
                    console.log('Saving into cache: ' + cachePath);
                    fs.writeFile(cachePath, htmlContent, function (err) {
                        console.log('File saved');
                        callback.call(_this, true, htmlContent);
                    });
                } else {
                    console.log('Not being cached - returning content');
                    callback.call(this, true, htmlContent);
                }
            });
        });

        req.on('error', function (e) {
            console.log('Problem with request: ' + e.message);
            callback.call(this, false, htmlContent);
        });

        if (requestMethod === 'POST') {
            console.log('Writing post content: ' + postContent);
            req.write(postContent);
        }

        req.end();
    }

    function init() {

        var server = http.createServer(function (request, response) {

            var postContent = '';

            request.on('data', function (chunk) {
                postContent += chunk.toString();
            });

            request.on('end', function () {

                // Process URL and query params into suitable object
                var urlObj = processUrl(request.url);
                var requestUrl = request.url;
                var refParts = [];

                // Request URL cleansing to stop 301 response
                if (requestUrl.substr(-1, 1) === '/') {
                    requestUrl = requestUrl.substr(0, (requestUrl.length - 1));
                }

                // Base path for vhost
                var serverName = request.headers['x-forwarded-host'].replace(/[^\.]+\./, '');
                var basePath = cacheBase.replace('{server_name}', serverName);
                var requestPath = remoteServer.replace('{server_name}', serverName) + requestUrl;

                console.log('Request recieved: ' + requestPath + ' (' + request.method + ')');
                console.log('Request ref: ' + urlObj.queryString.ref);

                if (typeof urlObj.queryString.ref === 'undefined') {
                    console.log('No REF parameter found - retrieving from remote: ' + requestPath);
                    retrieveFromRemote(serverName, requestUrl, basePath, refParts, request.method, postContent, null, function (result, htmlContent) {
                        if (result !== false) {
                            console.log('Writing out content length of ' + htmlContent.length);
                            response.writeHead(200, { "Content-Type": "text/html" });
                            response.end(htmlContent);
                        }
                    });
                } else {
                    // Ref cleansing
                    if (urlObj.queryString.ref.indexOf('/') === 0) {
                        urlObj.queryString.ref = urlObj.queryString.ref.replace('/', '');
                    }
                    if (urlObj.queryString.ref.substr(-1, 1) === '/') {
                        urlObj.queryString.ref = urlObj.queryString.ref.substr(0, (urlObj.queryString.ref.length - 1));
                    }
                    refParts = urlObj.queryString.ref.split('/');

                    var cachePath = basePath;
                    for (var v = 1; v < refParts.length; v++) {
                        cachePath += '/' + refParts[v];
                    }

                    console.log('cachePath: ' + cachePath);

                    fs.exists(cachePath, function (exists) {
                        if (exists) {
                            console.log('File exists get from cache');
                            retrieveFromCache(cachePath, function (htmlContent) {
                                console.log('Writing out content length of ' + htmlContent.length);
                                response.writeHead(200, { "Content-Type": "text/html" });
                                response.end(htmlContent);
                            });
                        } else {
                            console.log('File does NOT exist get from remote');
                            retrieveFromRemote(serverName, requestUrl, basePath, refParts, request.method, postContent, cachePath, function (result, htmlContent) {
                                if (result !== false) {
                                    console.log('Writing out content length of ' + htmlContent.length);
                                    response.writeHead(200, { "Content-Type": "text/html" });
                                    response.end(htmlContent);
                                }
                            });
                        }
                    });
                }
            });
        });

        // Listen on port defined in config, IP defaults to 127.0.0.1
        server.listen(serverPort);
        console.log('Server running at http://127.0.0.1:' + serverPort + '/');

    }

    init();

})();
