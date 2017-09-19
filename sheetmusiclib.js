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

const http = require('http'); // no https for server because we are behind a proxy
const https = require('https');
const zlib = require('zlib');
const sqlite3 = require('sqlite3');
const urlHelper = require('url');
const pathHelper = require('path');
const querystring = require('querystring');
const glob = require("glob");

const dbops = require("./dbops.js");

const DB_NAME = setVal("DB_NAME", "sheetmusiclib.db");
const SERVER_PORT = setVal("SERVER_PORT", 8001);

const SHEET_PATH = setVal("SHEET_PATH", "./musicsheets/");

const GET_DEFAULT_RESPONSE = setVal("GET_DEFAULT_RESPONSE", {
    "message": "Welcome to sheetmusiclib",
    "doc": "https://github.com/indriApollo/rhj-sheetmusiclib"
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
    
    response.setHeader('Access-Control-Allow-Origin', '*');
    
    zlib.gzip(buf, function (err, result) {
        if(err) {
            console.log("Could not gzip response", err);
            response.statusCode = 500;
            response.end();
        }
        else {
            response.statusCode = status;
            response.setHeader('Content-Encoding', 'gzip');
            response.setHeader('Content-Type', 'application/json');
            response.setHeader('Content-Length',result.length);
            response.end(result);
        }
    });
}

function respondWithPdf(response, filepath, filename) {

    var path = SHEET_PATH+filepath;
    console.log("Streaming "+path);

    fs.stat(path, function(err, stats) {

        if(err) {
            console.log("Could not get file stats", err);
            respond(response, "You do not have access to this file", 403);
            return;
        }

        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Content-Type', 'application/pdf');
        response.setHeader('Content-Length',stats.size);
        response.setHeader('Content-Disposition','attachment; filename="'+filename+'"');

        var rs = fs.createReadStream(path);
        
        rs.on('close', function() {
            response.statusCode = 200;
            response.end();
        }).on('error', function(err) {
            response.statusCode = 403;
            console.log("Failed to stream pdf to client",err);
            response.end();
        });
    
        rs.pipe(response);
    });
}

function handleGET(url, headers, body, response) {
    
    url = urlHelper.parse(url);
    var pathname = url.pathname;
    var query = url.query;

    console.log("GET request for "+pathname);

    if(pathname == "/") {
        respond(response, GET_DEFAULT_RESPONSE, 200);
        return
    }

    if(pathname == "/download") {
        handleDownload(response, query);
        return;
    }

    if(!headers["auth-token"]) {
        respond(response, "Missing Auth-Token header", 400);
        return;
    }
    var token = headers["auth-token"];

    checkToken(token, function(err, valid, userdata) {
        if(err)
            respond(response, "Internal service error", 500);
        else if(!valid)
            respond(response, "Unknown or expired token", 403);
        else {
            if(pathname == "/titles")
                returnAllTitles(response);
            else if(pathname == "/instruments")
                returnAllInstruments(response);
            else if(/sheets\/[\w-%]*$/.test(pathname) )
                returnFilenames(response, pathname, userdata.instruments);
            else
                respond(response, "Unknown uri", 404);
        }
    });
}

function handleDownload(response, query) {
    
    var params = querystring.parse(query);
    if(!params.file || !(/^[\w\-]+\.pdf$/gi.test(params.file)) ) {
        respond(response, "Missing file param", 400);
        return;
    }

    if(!params.token) {
        respond(response, "Missing token param", 400);
        return;
    }

    var token = decodeURIComponent(params.token);

    checkToken(token, function(err, valid, userdata) {
        if(err)
            respond(response, "Internal service error", 500);
        else if(!valid)
            respond(response, "Unknown or expired token", 403);
        else {
            returnFile(userdata);
        }
    });

    function returnFile(userdata) {
        // <title>_<instrument><_*>.pdf
        var parsedFilename = params.file.split("_");
        try {
            var title = parsedFilename[0];
            var instrument = pathHelper.basename(parsedFilename[1], '.pdf');
            if(userdata.instruments.indexOf(instrument) == -1) {
                throw "Instrument not in userdata";
            }
        }
        catch(err) {
            console.log("Could not return file", err);
            respond(response, "You do not have access to this file", 403);
        }
        respondWithPdf(response, title+"/"+params.file, params.file);
    }
}

function getFilenames(instruments, title, callback) {
    //<sheet path>/<title>/<title>_<instrument><_*>.pdf
    var tasks = instruments.length;

    if(tasks == 0) {
        callback(null, []);
        return;
    }

    var error;
    var filenames = [];
    for(var i = 0; i < instruments.length; i++) {
        glob(title+"_"+instruments[i]+"*.pdf", {cwd: SHEET_PATH+title+"/"}, function(err, files) {
            if(err) {
                console.log(err);
                error = err;
            } else {
                filenames = filenames.concat(files);
            }
            if(--tasks <= 0)
                callback(error, filenames);
        });
    }
}

function returnFilenames(response, pathname, instruments) {
    var p = pathname.split("/");
    var title = decodeURIComponent(p[2]);

    console.log("Looking for title", title);

    getFilenames(instruments, title, function(err, files) {
        if(err) {
            console.log("Could not return filenames", err);
            respond(response, "Internal service error", 500);
        }
        respond(response, {sheets: files}, 200);
    });
}

function returnAllTitles(response) {
    dbRequestHandler(dbops.getTitlesFromDb, [], function(err, titles) {
        if(err)
            respond(response, "Internal service error", 500);
        else
            respond(response, {"titles": titles}, 200);
    });
}

function returnAllInstruments(response) {
    dbRequestHandler(dbops.getInstrumentsFromDb, [], function(err, instruments) {
        if(err)
            respond(response, "Internal service error", 500);
        else
            respond(response, {"instruments": instruments}, 200);
    });
}

function dbRequestHandler(func, funcArgs, callback) {
    
    // We use a new db object for every transaction to assure isolation
    // See https://github.com/mapbox/node-sqlite3/issues/304
    var db = new sqlite3.Database(DB_NAME);
    func(db, ...funcArgs, function(cbArgs) {
        db.close();
        callback(...cbArgs);
    });
}

function checkToken(token, callback) {

    var options = {
        host: "auth.indriapollo.be",
        path: "/userdata",
        headers: {
            "Auth-Token": token
        }
    };

    var body = [];

    https.get(options, function(response) {

        var gunzip = zlib.createGunzip();
    
        gunzip.on('data', function(data) {
            body += data.toString();
        }).on('end', function() {
            handleResponse(response.statusCode, body);
        }).on('error', function(err) {
            console.log("Token gunzip error. Remote auth service might be down")
            callback(err)
        });
    
        response.pipe(gunzip);
      
    }).on('error', function(err) {
        console.log(err);
        callback(err);
    });

    function handleResponse(statusCode, jsonString) {
        try {
            var json = JSON.parse(jsonString);
        }
        catch(err) {
            console.log(err);
            callback(err);
            return;
        }

        if(statusCode == 200) {
            if(!json.instruments) {
                err = "Missing instruments property from userdata";
                console.log(err);
                callback(err);
            } else {
                callback(null, true, json);
            }
        }
        else if(statusCode == 403)
            callback(null, false);
        else {
            var err;
            if(!json.message) err = "Unspecified error";
            else err = json.message
            
            console.log(err);
            callback(err);
        }
    }
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
