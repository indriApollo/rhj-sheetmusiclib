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
            else callback(null,result);
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
            else callback(null,result);
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
            else callback(null,result);
        });
    },

    getTitlesWithTagFromDb: function(db, tag,callback) {
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
            else callback(null,result);
        });
    }

}