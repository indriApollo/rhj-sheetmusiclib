const cm = require("./common.js");
const Db = require("./db.js");
const fs = require("fs");

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

Handler.prototype.addNewTag = function() {
    // POST tags/<tag>
    var handler = this;

    var p = handler.pathname.split("/");
    var newTag = p[2];
    if(newTag.length < 2) {
        handler.respond("Tag name must be at least 2 chars", 400);
        return;
    }

    console.log("Add new tag", newTag);

    handler.openDb();
    handler.db.getTagIdFromDb(newTag, function(err, tagId) {
        if(err)
            handler.respond("Internal service error", 500);
        else if(tagId)
            handler.respond("Tag already exists", 400);
        else
            addNewTag();
    });

    function addNewTag() {
        handler.db.storeNewTagInDb(newTag, function(err) {
            if(err)
                handler.respond("Internal service error", 500);
            else
                handler.respond({"message": "add ok"}, 201);
        });
    }
}

Handler.prototype.addTagToTitle = function() {
    // POST /titles/<title>?tag=<tag>
    var handler = this;

    var p = handler.pathname.split("/");
    var title = p[2];

    var params = handler.query;
    if(!params.tag) {
        handler.respond("Missing tag parameter", 400);
        return;
    }

    if(typeof params.tag === 'object') {
        handler.respond("Please post a single tag", 400);
        return;
    }

    console.log("Add new tag <-> title join", params.tag, title);

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
            else if(tags.indexOf(params.tag) !== -1)
                handler.respond("Title tag join already exists", 400);
            else
                addNewTagToTitle(tagId, titleId);
        });
    }

    function addNewTagToTitle(tagId, titleId) {
        handler.db.storeTagOfTitleJoinInDb(tagId, titleId, function(err) {
            if(err)
                handler.respond("Internal service error", 500);
            else
                handler.respond({"message": "add join ok"}, 201);
        });
    }
}

Handler.prototype.shareSheet = function(body, smtp) {
    // POST share {sheet: string, email: string, comment: string}
    var handler = this;

    var checkedJson = cm.checkJson(body, ["sheet", "email", "comment"]);
    if(checkedJson.error) {
        handler.respond(checkedJson.error, 400);
        return;
    }

    var email = checkedJson.jsonData.email;
    var sheet = checkedJson.jsonData.sheet;
    var comment = checkedJson.jsonData.comment;

    // <any but @>@<any but @>.<any but @>
    if(!/[^@]*@[^@]*\.[^@]*/.test(email)) {
        handler.respond("Invalid email", 400);
        return;
    }

    // <title>_<instrument><_0-9>.pdf
    var m = sheet.match(/^([a-zA-Z-']+)_[a-zA-Z-]+(_\d)?\.pdf$/i);
    if(!m) {
        handler.respond("Invalid sheet", 400);
        return;
    }

    var path = handler.conf.get("SHEET_PATH")+m[1]+"/"+sheet;
    console.log("Sharing", path);
    // check the file exists
    fs.stat(path, function(err, stats) {
        if(err) {
            console.log("Could not get file stats", err);
            handler.respond("Unknown sheet", 404);
            return;
        }
        sendSheetEmail();
    });

    function sendSheetEmail() {
        console.log("Sending sheet to", email);
        
        if(!comment) {
            comment = handler.conf.get("NODEMAILER_TEXT").replace(/%sheet%/g, sheet);
        }
        else {
            // translate newlines to force \r\n
            comment.replace("\r", "").replace("\n", "\r\n");
        }

        smtp.sendMail({
            from: handler.conf.get("NODEMAILER_FROM"),
            to: email,
            subject: handler.conf.get("NODEMAILER_SUBJECT").replace(/%sheet%/g, sheet),
            text: comment,
            attachments: [{
                filename: sheet,
                path: path,
                contentType: "application/pdf"
            }]
        }, function(err, info) {
            if(err) {
                console.log("Could not send email", err);
                handler.respond("Internal service error", 500);
            }
            else if(!info.accepted || !info.accepted[0] == email) {
                console.log("Email was rejected", info);
                handler.respond("Email was rejected", 500);
            }
            else
                handler.respond({"message": "Email successfully sent"}, 200);
        });
    }
}

function httpPostHandler(conf, pathname, query, headers, body, smtp, response) {

    console.log("POST request for" ,pathname);

    var handler = new Handler(conf, pathname, query, response);

    cm.checkToken(headers ,"userstatus", function(err, valid, status) {

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
         * /tags/<newtag>
         * 
         * /titles/<title>?tag=<newtag>
         * 
         * /share
         * 
         */

        if(/^\/tags\/[\w-]*$/.test(pathname) )
            handler.addNewTag();

        else if(/^\/titles\/[\w-]*$/.test(pathname))
            handler.addTagToTitle();

        else if(pathname == "/share")
            handler.shareSheet(body, smtp);

        else
            handler.respond("Unknown uri", 404);

    }
}

module.exports = httpPostHandler;
