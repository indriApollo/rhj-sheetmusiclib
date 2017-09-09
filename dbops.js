module.exports = {
    
    getTitlesFromDb: function(db, callback) {
        var result = [];
        db.each("SELECT title FROM titles LIMIT 300", [], function(err,row) {
            if(err) {
                console.log(err);
                callback([err]);
            }
            else result.push(row.title);
        }, function(err,nrows) {
            if(err) {
                console.log(err);
                callback([err]);
            }
            else callback([null,result]);
        });
    },

    getInstrumentsFromDb: function(db, callback) {
        var result = [];
        db.each("SELECT instrument FROM instruments LIMIT 300", [], function(err,row) {
            if(err) {
                console.log(err);
                callback([err]);
            }
            else result.push(row.instrument);
        }, function(err,nrows) {
            if(err) {
                console.log(err);
                callback([err]);
            }
            else callback([null,result]);
        });
    }

}