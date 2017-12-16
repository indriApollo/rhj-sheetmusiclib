const sqlite3 = require('sqlite3');

function Db(DB_NAME, BUSY_TIMEOUT) {
    // We have to use a new db object for every transaction to assure isolation
    // See https://github.com/mapbox/node-sqlite3/issues/304
    this.db = new sqlite3.Database(DB_NAME);
    this.db.configure("busyTimeout", BUSY_TIMEOUT);
}

Db.prototype.close = function() {
    this.db.close();
}

Db.prototype.getTitlesFromDb = function(callback) {
    
    var result = [];
    this.db.each("SELECT title FROM titles ORDER BY title LIMIT 300", [], function(err,row) {
        if(err) {
            console.log(err);
            callback(err);
        }
        else
            result.push(row.title);
    }, function(err,nrows) {
        if(err) {
            console.log(err);
            callback(err);
        }
        else
            callback(null, result);
    });
}

Db.prototype.getInstrumentsFromDb = function(callback) {
    
    var result = [];
    this.db.each("SELECT instrument FROM instruments ORDER BY instrument LIMIT 300", [], function(err,row) {
        if(err) {
            console.log(err);
            callback(err);
        }
        else
            result.push(row.instrument);
    }, function(err,nrows) {
        if(err) {
            console.log(err);
            callback(err);
        }
        else
            callback(null, result);
    });
}

Db.prototype.getTagsFromDb = function(callback) {
    
    var result = [];
    this.db.each("SELECT tag FROM tags ORDER BY tag LIMIT 300", [], function(err,row) {
        if(err) {
            console.log(err);
            callback(err);
        }
        else
            result.push(row.tag);
    }, function(err,nrows) {
        if(err) {
            console.log(err);
            callback(err);
        }
        else
            callback(null, result);
    });
}

Db.prototype.getTitlesWithTagsFromDb = function(tagIds, callback) {
    
    var result = [];
    
    var clause = "WHERE tagId = ?";
    for(var i = 1; i < tagIds.length; i++) {
        clause += " OR tagId = ?";
    }
    
    this.db.each("SELECT title FROM titles \
        INNER JOIN title_tag_join ON titles.id = titleId "+clause+" \
        ORDER BY title LIMIT 300", tagIds, function(err,row) {
        if(err) {
            console.log(err);
            callback(err);
        }
        else
            result.push(row.title);
    }, function(err,nrows) {
        if(err) {
            console.log(err);
            callback(err);
        }
        else
            callback(null, result);
    });
}

Db.prototype.getTitleIdFromDb = function(title, callback) {
    
    this.db.get("SELECT id FROM titles WHERE title = ? LIMIT 1", title, function(err, row) {
        if(err) {
            console.log(err);
            callback(err);
        }
        else if(!row)
            callback();
        else
            callback(null, row.id);
    });
}

Db.prototype.getTagIdFromDb = function(tag, callback) {
    
    this.db.get("SELECT id FROM tags WHERE tag = ? LIMIT 1", tag, function(err, row) {
        if(err) {
            console.log(err);
            callback(err);
        }
        else if(!row)
            callback();
        else
            callback(null, row.id);
    });
}

Db.prototype.storeTitleWithTagInDb = function(titleId, tagId, callback) {
    
    this.db.run("INSERT INTO title_tag_join(titleId, tagId) VALUES(?,?)", titleId, tagId, function(err) {
        if(!err && this.changes !== 1) err = this.sql+" was run successfully but made no changes";
        if(err) console.log(err);
            callback(err);
    });
}

Db.prototype.removeTitleWithTagInDb = function(title, tag, callback) {
    
    this.db.run("DELETE FROM title_tag_join WHERE titleId = ? AND tagId = ?", titleId, tagId, function(err) {
        if(err) console.log(err);
            callback(err);
    });
}

Db.prototype.modifyTagInDb = function(tagId, newTagName, callback) {
    
    this.db.run("UPDATE tags SET tag = ? WHERE id = ?", newTagName, tagId, function(err) {
        if(!err && this.changes !== 1) err = this.sql+" was run successfully but made no changes";
        if(err) console.log(err);
            callback(err);
    });
}

Db.prototype.removeTagInDb = function(tagId, callback) {
    

    function rollbackTx() {
        this.db.exec("ROLLBACK", function(err) {
            if(err) console.log(err);
            console.log("rolled back faulty query");
            callback(true);
        })
    }
    
    function beginTx() {
        this.db.exec("BEGIN", function(err) {
            if(err) {
                console.log(err);
                callback(err);
            }
            else
                deleteTagTx();
        })
    }
    
    function deleteTagTx() {
        this.db.run("DELETE FROM tags WHERE id = ?", tagId, function(err) {
            if(err) {
                console.log(err);
                rollbackTx();
            }
            else
                deleteTagJoinsTx();
        });
    }
    
    function deleteTagJoinsTx() {
        this.db.run("DELETE FROM title_tag_join WHERE tagId = ?", tagId, function(err) {
            if(err) {
                console.log(err);
                rollbackTx();
            }
            else
            commitTx();
        });
    }
    
    function commitTx() {
        this.db.exec("COMMIT", function(err) {
            if(err) {
                console.log(err);
                callback(err);
            }
            else
                callback(); // empty callback means everything went well
        });
    }
    
    beginTx();
}

Db.prototype.storeNewTagInDb = function(tag, callback) {
    
    this.db.run("INSERT INTO tags(tag) VALUES(?)", tag, function(err) {
        if(!err && this.changes !== 1) err = this.sql+" was run successfully but made no changes";
        if(err) console.log(err);
            callback(err);
    });
}

Db.prototype.getTagsOfTitleFromDb = function(title, callback) {
    
    var result = [];
    this.db.each("SELECT tag FROM tags \
        INNER JOIN title_tag_join ON tags.id = tagId \
        INNER JOIN titles ON titles.id = titleId \
        WHERE title = ? \
        ORDER BY tag LIMIT 300", title, function(err,row) {
        if(err) {
            console.log(err);
            callback(err);
        }
        else result.push(row.tag);
    }, function(err,nrows) {
        if(err) {
            console.log(err);
            callback(err);
        }
        else
            callback(null, result);
    });
}

module.exports = Db;
