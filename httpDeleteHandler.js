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

Handler.prototype.deleteTag = function() {
    // DELETE tags/<tag>
    var handler = this;

    var p = handler.pathname.split("/");
    var tag = p[2];

    console.log("Remove tag", tag);

    handler.openDb();
    handler.db.getTagIdFromDb(tag, function(err, tagId) {
        if(err)
            handler.respond("Internal service error", 500);
        else if(!tagId)
            handler.respond("Unknown tag", 400);
        else
            delTag(tagId);
    });

    function delTag(tagId) {
        handler.db.removeTagInDb(tagId, function(err) {
            if(err)
                handler.respond("Internal service error", 500);
            else
                handler.respond({"message": "del ok"}, 200);
        });
    }
}

Handler.prototype.deleteTagOfTitleJoin = function() {
    // DELETE /titles/<title>?tag=<tag to remove>
    var handler = this;

    var p = handler.pathname.split("/");
    var title = p[2];

    var params = handler.query;
    if(!params.tag) {
        handler.respond("Missing tag parameter", 400);
        return;
    }

    if(typeof params.tag === 'object') {
        handler.respond("Please delete a single tag", 400);
        return;
    }

    console.log("Delete tag from title", params.tag, title);

    handler.openDb();
    handler.db.getTagIdFromDb(params.tag, function(err, tagId) {
        if(err)
            handler.respond("Internal service error", 500);
        else if(!tagId)
            handler.respond("Unknown tag", 400);
        else
            checkTitle(tagId);
    });

    function checkTitle(tagId) {
        handler.db.getTitleIdFromDb(title, function(err, titleId) {
            if(err)
                handler.respond("Internal service error", 500);
            else if(!titleId)
                handler.respond("Unknown title", 400);
            else
                checkJoin(tagId, titleId);
        });
    }

    function checkJoin(tagId, titleId) {
        handler.db.getTagsOfTitleFromDb(title, function(err, tags) {
            if(err)
                handler.respond("Internal service error", 500);
            else if(tags.indexOf(params.tag) === -1)
                handler.respond("Title tag join doesn't exist", 400);
            else
                removeTagFromTitle(tagId, titleId);
        });
    }

    function removeTagFromTitle(tagId, titleId) {
        handler.db.removeTagOfTitleJoinInDb(tagId, titleId, function(err) {
            if(err)
                handler.respond("Internal service error", 500);
            else
                handler.respond({"message": "del join ok"}, 200);
        });
    }
}

function httpDeleteHandler(conf, pathname, query, headers, response) {
    
    console.log("DELETE request for", pathname);

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
         * /tags/<tag>
         * 
         * /titles/<title>?tag=<tag to remove>
         * 
         */

        if(/^\/tags\/[\w-]*$/.test(pathname) )
            handler.deleteTag();

        else if(/^\/titles\/[\w-]*$/.test(pathname))
            handler.deleteTagOfTitleJoin();
        
        else
            handler.respond("Unknown uri", 404);
    }
}

module.exports = httpDeleteHandler;
