#!/usr/bin/env node

const fs = require("fs");

// load config.json
try {
    var confFile = fs.readFileSync("config.json","utf8");
    var config = JSON.parse(confFile);
}
catch(err) {
    console.log("Could not read configuration from config.json");
    console.log(err);
    return;
}

// set default if value was not set in config
function setVal(confKey, defaultValue) {
    var val;
    if(typeof config[confKey] !== "undefined")
        val = config[confKey];
    else
        val = defaultValue;

    if(confKey.match(/password/i))
        console.log("[config] "+confKey+" -> ********");
    else
        console.log("[config] "+confKey+" ->", val);
    return val;
}

const http = require('http'); // no https because we are behind a proxy
const zlib = require('zlib');
const sqlite3 = require('sqlite3');

const dbops = require("./dbops.js");

const DB_NAME = setVal("DB_NAME", "sheetmusiclib.db");
const SERVER_PORT = setVal("SERVER_PORT", 8001);

const GET_DEFAULT_RESPONSE = setVal("GET_DEFAULT_RESPONSE", {
    "message": "Welcome to sheetmusiclib",
    "doc": "https://github.com/indriApollo/sheetmusiclib"
});

http.createServer(function(request, response) {
    
    var headers = request.headers;
    var method = request.method;
    var url = request.url;
    var body = [];
    
    response.on('error', function(err) {
        console.error(err);
    });
    
    request.on('error', function(err) {
        console.error(err);
        response.statusCode = 500;
        response.end();
    
    }).on('data', function(chunk) {
        body.push(chunk);
    }).on('end', function() {
        body = Buffer.concat(body).toString();
    
        switch(method) {
            case 'GET':
                handleGET(url, headers, body, response);
                break;
    
            /*case 'POST':
                handlePOST(url, headers, body, response);
                break;*/
    
            case 'OPTIONS':
                handleCORS(response);
                break;
    
            default:
                respond(response, "Unsupported http method", 400);
                break;
        }
    });
}).listen(SERVER_PORT);
console.log("server listening on port "+SERVER_PORT);

function handleCORS(response) {
    
    /*
     * Handle Cross-Origin Resource Sharing (CORS)
     *
     * See : https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS#Preflighted_requests
     */
        
    // The preflighted requests expects http 200 for a successful request
    response.statusCode = 200;
    // We allow requests from any origin
    response.setHeader('Access-Control-Allow-Origin', '*');
    // We have to explicitly allow Auth-Token since it's a custom header
    response.setHeader('Access-Control-Allow-Headers', 'Auth-Token,User-Agent,Content-Type'); //can't use * !
    // We allow POST, GET and OPTIONS http methods
    response.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    response.end();
}

function respond(response, data, status) {
    
    // http 200 responses already have json data
    // Other status codes are using a simple json message: <msg> format
    if(status != 200)
        data = { message: data};
    
    // We pretty print the json data and store it in  an utf-8 buffer
    // Storing it in a buffer means that we can easily gzip it later
    if(typeof data !== 'string') data = JSON.stringify(data, null, 4);
    var buf = Buffer.from(data, 'utf-8');
    
    response.statusCode = status;
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-Encoding', 'gzip');
    response.setHeader('Content-Type', 'application/json');
    
    zlib.gzip(buf, function (_, result) {
        response.setHeader('Content-Length',result.length);
        response.end(result);
    });
}

function handleGET(url, headers, body, response) {
    console.log("GET request for "+url);
    
    var matches = url.match(/^\/(titles)$/);
    if(!matches) {
        respond(response, GET_DEFAULT_RESPONSE, 200);
        return
    }

    checkToken(headers, function(err, valid) {
        if(err)
            respond(response, "Internal service error", 500);
        else if(!valid)
            respond(response, "Unknown or expired token", 403);
        else {
            switch(matches[1]) {
                case "titles":
                    returnAllTitles(body, response);
                    break;
            }
        }
    });
}

function dbRequestHandler(func, funcArgs, callback) {
    
    // We use a new db object for every transaction to assure isolation
    // See https://github.com/mapbox/node-sqlite3/issues/304
    var db = new sqlite3.Database(DB_NAME);
    func(db, ...funcArgs, function(cbArgs) { //note ... -> spread operator (I know, right?)
        db.close();
        callback(...cbArgs);
    });
}

function checkJson(jsonString, pnames) {
    var r = {};
    try {
        r.jsonData = JSON.parse(jsonString);

        for(var i = 0; i < pnames.length; i++) {
            var property = pnames[i];
            if(!r.jsonData.hasOwnProperty(property))
                throw "Missing or invalid "+property+" property";
        }
    }
    catch(err) {
        console.log(err);
        r.error = "Invalid json";
    }
    return r;
}
