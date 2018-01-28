
const fs = require("fs");

var confKeys = {
    "DB_NAME":              "sheetmusiclib.db",
    "SERVER_PORT":          8001,
    "SHEET_PATH":           "./musicsheets/",
    "GET_DEFAULT_RESPONSE": {
                                "message": "Welcome to sheetmusiclib",
                                "doc": "https://github.com/indriApollo/rhj-sheetmusiclib"
                            },
    "BUSY_TIMEOUT":         2000,
    "NODEMAILER_FROM":      "no-reply@indriapollo.be",
    "NODEMAILER_SUBJECT":   "RHJ - Partition: %sheet%",
    "NODEMAILER_TEXT":      "Bonjour\r\n\r\nCi-joint vous trouverez le pdf pour la partition: %sheet%.\r\n\r\nBonne journée,\r\n-- Service partitions RHJ --\r\n",
    "SMTP_SERVER":          "",
    "SMTP_PORT":            587,
    "SMTP_USER":            "",
    "SMTP_PASSWORD":        ""
}

function log(...args) {
    console.log("[config]", ...args);
}

module.exports = {

    // load config.json
    load: function() {
        try {
            var confFile = fs.readFileSync("config.json","utf8");
            var config = JSON.parse(confFile);
        }
        catch(err) {
            console.log("Could not read configuration from config.json");
            console.log(err);
            return false;
        }

        for(var k in config) {
            if(confKeys.hasOwnProperty(k)) {
                confKeys[k] = config[k];
            }
            else
                log("Unknown key", k);
        }

        for(var k in confKeys) {
            if(k.match(/password/i))
                log(k,"-> ********");
            else
                log(k, "->", confKeys[k]);
        }
    },

    get: function(confKey) {
        return confKeys[confKey];
    }
}
