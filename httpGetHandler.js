const cm = require("./common.js");
const urlHelper = require('url');
const pathHelper = require('path');
const querystring = require('querystring');
const fs = require("fs");
const Db = require("./db.js");
const glob = require("glob");

function Handler(conf, pathname, query, response) {
    this.conf = conf;
    this.pathname = pathname;
    this.query = query;
    this.response = response;
    this.db = null;
}

Handler.prototype.openDb = function() {
    this.db = new Db(this.conf.get("DB_NAME"), this.conf.get("BUSY_TIMEOUT"));
}

Handler.prototype.respond = function(data, status) {
    if(this.db)
        this.db.close();
    cm.respond(this.response, data, status);
}

Handler.prototype.returnHomepage = function() {
    this.respond(this.conf.get("GET_DEFAULT_RESPONSE"), 200);
}

Handler.prototype.returnAllTitles = function() {
    // GET titles
    var handler = this;

    handler.openDb();
    handler.db.getTitlesFromDb(function(err, titles) {
        if(err)
            handler.respond("Internal service error", 500);
        else
            getTagsOfTitle(titles);
    });

    var index = 0;
    var taggedTitles = {};

    function getTagsOfTitle(titles) {
        handler.db.getTagsOfTitleFromDb(titles[index], function(err, tags) {
            if(err)
                handler.respond("Internal service error", 500);
            else {
                taggedTitles[titles[index]] = tags;
                if(++index < titles.length)
                    getTagsOfTitle(titles); // recursively call ourselves
                else
                    handler.respond({"titles": taggedTitles}, 200);
            }
        });
    }
}

Handler.prototype.returnAllInstruments = function() {
    // GET instruments
    var handler = this;

    handler.openDb();
    handler.db.getInstrumentsFromDb(function(err, instruments) {
        if(err)
            handler.respond("Internal service error", 500);
        else
            handler.respond({"instruments": instruments}, 200);
    });
}

Handler.prototype.returnAllTags = function() {
    // GET tags
    var handler = this;

    handler.openDb();
    handler.db.getTagsFromDb(function(err, tags) {
        if(err)
            handler.respond("Internal service error", 500);
        else
            handler.respond({"tags": tags}, 200);
    });
}

Handler.prototype.returnTitlesWithTags = function(tags) {
    // GET titles?tag=<tag1>&tag=<tag2>&...
    var handler = this;
    var tagIds = [];
    var index = 0;
    var taggedTitles = {};

    handler.openDb();
    function getTagId() {
        console.log("Looking for titles with tag", tags[index]);
        handler.db.getTagIdFromDb(tags[index], function(err, tagId) {
            if(err)
                handler.respond("Internal service error", 500);
            else if(!tagId)
                handler.respond("Unknown tag "+tags[index], 400);
            else {
                tagIds.push(tagId);
                if(++index < tags.length)
                    getTagId(); // recursively call ourselves
                else
                    getTitles();
            }
        });
    }

    function getTitles() {
        handler.db.getTitlesWithTagsFromDb(tagIds, function(err, titles) {
            if(err)
                handler.respond("Internal service error", 500);
            else {
                index = 0;
                getTagsOfTitle(titles);
            }
        });
    }

    function getTagsOfTitle(titles) {
        handler.db.getTagsOfTitleFromDb(titles[index], function(err, tags) {
            if(err)
                handler.respond("Internal service error", 500);
            else {
                taggedTitles[titles[index]] = tags;
                if(++index < titles.length)
                    getTagsOfTitle(titles); // recursively call ourselves
                else
                    handler.respond({"titles": taggedTitles}, 200);
            }
        });
    }

    getTagId();
}

Handler.prototype.titles = function() {
    var p = this.pathname.split("/");
    var title = p[2];
    var params = querystring.parse(this.query);

    if(this.pathname == "/titles") {
        if(!params.tag)
            this.returnAllTitles();
        else {
            if(typeof params.tag !== 'object') {
                // When there is only one tag specified params.tag is a single string
                params.tag = [params.tag]; // returnTitlesWithTags expects an array
            }
            this.returnTitlesWithTags(params.tag);
        }
    }
}

Handler.prototype.getFilenames = function(instruments, title, callback) {
    //<sheet path>/<title>/<title>_<instrument><_*>.pdf
    var tasks = instruments.length;

    if(tasks == 0) {
        callback(null, []);
        return;
    }

    var error;
    var filenames = [];
    for(var i = 0; i < instruments.length; i++) {
        glob(title+"_"+instruments[i]+"*.pdf",
        {cwd: this.conf.get("SHEET_PATH")+title+"/"},
        function(err, files) {
            if(err) {
                console.log(err);
                error = err;
            }
            else
                filenames = filenames.concat(files);
            
            if(--tasks <= 0)
                callback(error, filenames);
        });
    }
}

Handler.prototype.returnFilenames = function(instruments) {
    // GET sheets/<title>
    var handler = this;
    var p = handler.pathname.split("/");
    var title = p[2];

    console.log("Looking for title", title);

    handler.getFilenames(instruments, title, function(err, files) {
        if(err) {
            console.log("Could not return filenames", err);
            handler.respond("Internal service error", 500);
        }
        else
            handler.respond({"sheets": files}, 200);
    });
}

Handler.prototype.download = function() {
    
    var params = querystring.parse(this.query);
    // check if file param is a valid pdf filename
    if(!params.file || !(/^[\w\-]+\.pdf$/gi.test(params.file)) ) {
        this.respond("Missing file param", 400);
        return;
    }

    cm.checkToken(token, "userdata", function(err, valid, userdata) {
        if(err)
            this.respond("Internal service error", 500);
        else if(!valid)
            this.respond("Unknown or expired token", 403);
        else
            returnFile(userdata);
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
            this.respond(response, "You do not have access to this file", 403);
        }
        respondWithPdf(title+"/"+params.file, params.file);
    }

    function respondWithPdf(filepath, filename) {

        var path = this.conf.get("SHEET_PATH")+filepath;
        console.log("Streaming", path);
    
        fs.stat(path, function(err, stats) {
    
            if(err) {
                console.log("Could not get file stats", err);
                this.respond("You do not have access to this file", 403);
                return;
            }
    
            this.response.setHeader('Access-Control-Allow-Origin', '*');
            this.response.setHeader('Content-Type', 'application/pdf');
            this.response.setHeader('Content-Length',stats.size);
            this.response.setHeader('Content-Disposition','attachment; filename="'+filename+'"');
    
            var rs = fs.createReadStream(path);
            
            rs.on('close', function() {
                this.response.statusCode = 200;
                this.response.end();
            }).on('error', function(err) {
                this.response.statusCode = 403;
                console.log("Failed to stream pdf to client",err);
                this.response.end();
            });
        
            rs.pipe(response);
        });
    }
}

function httpGetHandler(conf, pathname, query, headers, response) {

    console.log("GET request for "+pathname);

    var handler = new Handler(conf, pathname, query, response);

    if(pathname == "/") {
        handler.returnHomepage();
        return
    }

    cm.checkToken(headers, "userdata", function(err, valid, userdata) {

        if(err)
            handler.respond("Internal service error", 500);
        else if(!valid)
            handler.respond("Unknown or expired token", 403);
        else {
            routes(userdata)
        }
    });

    function routes(userdata) {

        /*
         * /download?file=<file>
         * 
         * /titles
         * /titles?tag=<tag>
         * /titles/<title>
         * 
         * /instruments
         * 
         * /sheets/<title>
         * 
         * /tags
         * 
         */

        if(pathname == "/download")
            handler.download(response, query);

        else if(/^\/titles(\/[\w-%]*)?$/.test(pathname) )
            handler.titles();

        else if(pathname == "/instruments")
            handler.returnAllInstruments(response);

        else if(/^\/sheets\/[\w-%]*$/.test(pathname) )
            handler.returnFilenames(userdata.instruments);

        else if(pathname == "/tags")
            handler.returnAllTags();
            
        else
            handler.respond("Unknown uri", 404);

    }
}

module.exports = httpGetHandler;