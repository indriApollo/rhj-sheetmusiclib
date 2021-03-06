const zlib = require('zlib');
const https = require('https');

module.exports = {
    
    respond: function(response, data, status) {
    
        // http 200 - 201 responses already have json data
        // Other status codes are using a simple json message: <msg> format
        if(status != 200 && status != 201)
            data = {"message": data};
        
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
    },

    checkJson: function(jsonString, pnames) {
        var r = {};
        try {
            if(!jsonString)
                throw "Missing jsonString";

            r.jsonData = JSON.parse(jsonString);
    
            for(var i = 0; i < pnames.length; i++) {
                var property = pnames[i];
                if(!r.jsonData.hasOwnProperty(property))
                    throw "Missing or invalid "+property+" property";
            }
        }
        catch(err) {
            console.log("checkJson:", err);
            r.error = "Invalid json";
        }
        return r;
    },

    checkToken: function(headers, returnValue, callback) {

        if(returnValue != "userstatus" && returnValue != "userdata") {
            throw "Unknown returnValue "+returnValue+" for checkToken";
        }

        if(!headers["auth-token"]) {
            callback(null, false);
            return;
        }
        var token = headers["auth-token"];

        var options = {
            host: "auth.indriapollo.be",
            path: "/"+returnValue,
            headers: {
                "Auth-Token": token
            }
        };
    
        var body = [];
    
        console.log("check token @ "+options.host+options.path)
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
            console.log("auth: http response", statusCode);

            try {
                var json = JSON.parse(jsonString);
            }
            catch(err) {
                console.log("auth:", err);
                callback(err);
                return;
            }
    
            if(statusCode == 200) {
                switch(returnValue) {
                // handle status
                case "userstatus":
                    if(!json.status) {
                        err = "auth: Missing status property from userstatus";
                        console.log(err);
                        callback(err);
                    } else {
                        callback(null, true, json.status);
                    }
                    break;
                // handle userdata
                case "userdata":
                    if(!json.instruments) {
                        err = "auth: Missing instruments property from userdata";
                        console.log(err);
                        callback(err);
                    } else {
                        callback(null, true, json);
                    }
                    break;
                }
            }
            else if(statusCode == 403)
                callback(null, false);
            else {
                var err;
                if(!json.message) err = "auth: Unspecified error";
                else err = "auth: "+json.message;
                
                console.log(err);
                callback(err);
            }
        }
    }

}
