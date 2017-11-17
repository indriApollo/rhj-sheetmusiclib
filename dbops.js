module.exports = {
    
    getTitlesFromDb: function(db, callback) {
        var result = [];
        db.each("SELECT title FROM titles ORDER BY title LIMIT 300", [], function(err,row) {
            if(err) {
                console.log(err);
                callback(err);
            }
            else result.push(row.title);
        }, function(err,nrows) {
            if(err) {
                console.log(err);
                callback(err);
            }
            else callback(null, result);
        });
    },

    getInstrumentsFromDb: function(db, callback) {
        var result = [];
        db.each("SELECT instrument FROM instruments ORDER BY instrument LIMIT 300", [], function(err,row) {
            if(err) {
                console.log(err);
                callback(err);
            }
            else result.push(row.instrument);
        }, function(err,nrows) {
            if(err) {
                console.log(err);
                callback(err);
            }
            else callback(null, result);
        });
    },

    getTagsFromDb: function(db, callback) {
        var result = [];
        db.each("SELECT tag FROM tags ORDER BY tag LIMIT 300", [], function(err,row) {
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
            else callback(null, result);
        });
    },

    getTitlesWithTagFromDb: function(db, tag, callback) {
        var result = [];
        db.each("SELECT title FROM titles \
                INNER JOIN title_tag_join ON titles.id = titleId \
                INNER JOIN tags ON tags.id = tagId WHERE tag = ? \
                ORDER BY title LIMIT 300", tag, function(err,row) {
            if(err) {
                console.log(err);
                callback(err);
            }
            else result.push(row.title);
        }, function(err,nrows) {
            if(err) {
                console.log(err);
                callback(err);
            }
            else callback(null, result);
        });
    },

    getTitleIdFromDb: function(db, title, callback) {
        db.get("SELECT id FROM titles WHERE title = ? LIMIT 1", title, function(err, row) {
            if(err) {
                console.log(err);
                callback(err);
            }
            else if(!row)
                callback();
            else
                callback(null, row.id);
        });
    },

    getTagIdFromDb: function(db, tag, callback) {
        db.get("SELECT id FROM tags WHERE tag = ? LIMIT 1", tag, function(err, row) {
            if(err) {
                console.log(err);
                callback(err);
            }
            else if(!row)
                callback();
            else
                callback(null, row.id);
        });
    },

    storeTitleWithTagInDb: function(db, titleId, tagId, callback) {
        db.run("INSERT INTO title_tag_join(titleId, tagId) VALUES(?,?)", titleId, tagId, function(err) {
            if(!err && this.changes !== 1) err = this.sql+" was run successfully but made no changes";
            if(err) console.log(err);
            callback(err);
        });
    },

    removeTitleWithTagInDb: function(db, title, tag, callback) {
        db.run("DELETE FROM title_tag_join WHERE titleId = ? AND tagId = ?", titleId, tagId, function(err) {
            if(err) console.log(err);
            callback(err);
        });
    },

    modifyTagInDb: function(db, tagId, newTagName, callback) {
        db.run("UPDATE tags SET tag = ? WHERE id = ?", newTagName, tagId, function(err) {
            if(!err && this.changes !== 1) err = this.sql+" was run successfully but made no changes";
            if(err) console.log(err);
            callback(err);
        });
    },

    removeTagInDb: function(db, tagId, callback) {

        function rollbackTx() {
            db.exec("ROLLBACK", function(err) {
                if(err) console.log(err);
                console.log("rolled back faulty query");
                callback(true);
            })
        }

        function beginTx() {
            db.exec("BEGIN", function(err) {
                if(err) {
                    console.log(err);
                    callback(err);
                }
                else deleteTagTx();
            })
        }
    
        function deleteTagTx() {
            db.run("DELETE FROM tags WHERE id = ?", tagId, function(err) {
                if(err) {
                    console.log(err);
                    rollbackTx();
                }
                else
                    deleteTagJoinsTx();
            });
        }

        function deleteTagJoinsTx() {
            db.run("DELETE FROM title_tag_join WHERE tagId = ?", tagId, function(err) {
                if(err) {
                    console.log(err);
                    rollbackTx();
                }
                else
                    commitTx();
            });
        }

        function commitTx() {
            db.exec("COMMIT", function(err) {
                if(err) {
                    console.log(err);
                    callback(err);
                }
                else callback(); // empty callback means everything went well
            });
        }
    
        beginTx();
    },

    storeNewTagInDb: function(db, tag, callback) {
        db.run("INSERT INTO tags(tag) VALUES(?)", tag, function(err) {
            if(!err && this.changes !== 1) err = this.sql+" was run successfully but made no changes";
            if(err) console.log(err);
            callback(err);
        });
    }

}