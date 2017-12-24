#!/usr/bin/env node

const fs = require("fs");
const http = require('http'); // no https for server because we are behind a proxy
const sqlite3 = require('sqlite3');
const urlHelper = require('url');
const pathHelper = require('path');
const querystring = require('querystring');
const conf = require("./configloader.js");
const common = require("./common.js");
const httpGetHandler = require("./httpGetHandler.js")
const httpPostHandler = require("./httpPostHandler.js")
const httpPutHandler = require("./httpPutHandler.js")

console.log("Loading config ...");
conf.load();

http.createServer(function(request, response) {
    
    var headers = request.headers;
    var method = request.method;
    var url = urlHelper.parse(decodeURIComponent(request.url));
    var pathname = url.pathname;
    var query = querystring.parse(url.query);

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
                httpGetHandler(conf, pathname, query, headers, response);
                break;

            case 'POST':
                httpPostHandler(conf, pathname, query, headers, response);
                break;

            case 'PUT':
                httpPutHandler(conf, pathname, query, headers, response);
                break;
                
            /*case 'DELETE':
                handleDelete(url, headers, response);
                break;*/
    
            case 'OPTIONS':
                handleCORS(response);
                break;
    
            default:
                common.respond(response, "Unsupported http method", 400);
                break;
        }
    });
}).listen(conf.get("SERVER_PORT"));
console.log("server listening on port "+conf.get("SERVER_PORT"));

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
    // We allow POST, GET, PUT, DELETE and OPTIONS http methods
    response.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
    response.end();
}

/*function handleDelete(url, headers, response) {
    
    url = urlHelper.parse(url);
    var pathname = url.pathname;

    console.log("DELETE request for "+pathname);

    if(!headers["auth-token"]) {
        common.respond(response, "Missing Auth-Token header", 400);
        return;
    }
    var token = headers["auth-token"];

    common.checkToken(token, "status",function(err, valid, status) {
        if(err)
            common.respond(response, "Internal service error", 500);
        else if(!valid)
            common.respond(response, "Unknown or expired token", 403);
        else if(status != "admin")
            common.respond(response, "You are not allowed to do this", 403);
        else {
            if(/^\/tag\/[\w-%]*$/.test(pathname) )
                deleteTag(response, pathname);
            else
                common.respond(response, "Unknown uri", 404);
        }
    });
}*/

/*function deleteTag(response, pathname) {
    // DELETE tag/<tag>
    var p = decodeURIComponent(pathname).split("/");
    var tag = p[2];
    console.log("remove tag", tag);

    dbRequestHandler(dbops.getTagIdFromDb,tag, function(err, tagId) {
        if(err)
            common.respond(response, "Internal service error", 500);
        else if(!tagId)
            common.respond(response, "unknown tag", 400);
        else
            delTag(tagId);
    });

    function delTag(tagId) {
        dbRequestHandler(dbops.removeTagInDb, tagId, function(err) {
            if(err)
                common.respond(response, "Internal service error", 500);
            else
                common.respond(response, {"message": "del ok"}, 200);
        });
    }
}*/

