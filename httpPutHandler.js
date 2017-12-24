const cm = require("./common.js");
const Db = require("./db.js");

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

Handler.prototype.modifyTag = function(response, pathname) {
    // PUT tag/<tag>?newtagname=<new tag name>
    var handler = this;

    var p = handler.pathname.split("/");
    var tag = p[2];
    
    var params = handler.query;
    if(!params.newtagname) {
        handler.respond("Missing newtagname parameter", 400);
        return;
    }

    if(params.newtagname.length < 2) {
        handler.respond("Tag name must be at least 2 chars", 400);
        return;
    }

    console.log("Modify tag", tag, params.newtagname);

    handler.openDb();
    handler.db.getTagIdFromDb(params.newtagname, function(err, tagId) {
        if(err)
            handler.respond("Internal service error", 500);
        else if(tagId)
            handler.respond("That tag name is already taken", 400);
        else
            checkCurrentTag();
    });

    function checkCurrentTag() {
        handler.db.getTagIdFromDb(tag, function(err, tagId) {
            if(err)
                handler.respond("Internal service error", 500);
            else if(!tagId)
                handler.respond("Unknown tag", 400);
            else
                changeTagName(tagId);
        });
    }

    function changeTagName(tagId) {
        handler.db.modifyTagInDb(tagId, params.newtagname, function(err) {
            if(err)
                handler.respond("Internal service error", 500);
            else
                handler.respond({"message":"modify ok"}, 200);
        });
    }
}

function httpPutHandler(conf, pathname, query, headers, response) {

    console.log("PUT request for", pathname);

    var handler = new Handler(conf, pathname, query, response);

    cm.checkToken(headers, "userstatus", function(err, valid, status) {

        if(err)
            handler.respond("Internal service error", 500);
        else if(!valid)
            handler.respond("Unknown or expired token", 403);
        else if(status != "admin")
            handler.respond("You are not allowed to do this", 403);
        else
            routes();
    });

    function routes() {

        /*
         * /tags/<tag>?newtagname=<new tag name>
         * 
         */

        if(/^\/tags\/[\w-]*$/.test(pathname) )
            handler.modifyTag();
        
        else
            handler.respond("Unknown uri", 404);
    }
}

module.exports = httpPutHandler;
