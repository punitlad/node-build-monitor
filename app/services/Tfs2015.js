var request = require('request');
var ntlm = require('httpntlm');

module.exports = function () {
    var self = this,
        makeUrl = function (url, odata) {
            var baseUrl = self.configuration.url + '/_apis/build' + url;

            if (odata) {
                baseUrl += '?' + odata;
            }

            return baseUrl;
        },
        makeRequest = function (url, callback) {
            if (self.configuration.authentication.trim() === 'ntlm') {
                ntlm.get({
                    'url': url,
                    'username': self.configuration.username,
                    'password': self.configuration.password
                }, function (error, response) {
                    var body = JSON.parse(response.body)
                    callback(error, body);
                });
            } else {
                request({
                        'url': url,
                        'rejectUnauthorized': false,
                        'headers': { 'Accept': 'application/json' },
                        'json': true,
                        'auth': { 'user': self.configuration.username, 'pass': self.configuration.password }
                    },
                    function (error, response, body) {
                        callback(error, body);
                    });
            }
        },
        parseDate = function (dateAsString) {
            return dateAsString ? new Date(dateAsString) : null;
        },
        forEachResult = function (body, callback) {
            for (var i = 0; i < body.value.length; i++) {
                callback(body.value[i]);
            }
        },
        isNullOrWhiteSpace = function (string) {
            if (!string) {
                return true;
            }

            return string === null || string.match(/^ *$/) !== null;
        },
        getStatus = function (statusText, resultText) {
            if (statusText === "completed" && resultText === "succeeded") return "Green";
            if (statusText === "completed" && resultText === "failed") return "Red";
            if (statusText === "completed" && resultText === "canceled") return "Gray";
            if (statusText === "inProgress") return "Blue";
            if (statusText === "stopped") return "Gray";

            return "'#FFA500'";
        },
        getStatusText = function (statusText, resultText) {
            if (statusText === "completed" && resultText === "succeeded") return "Succeeded";
            if (statusText === "completed" && resultText === "failed") return "Failed";
            if (statusText === "inProgress") return "In Progress";
            if (statusText === "stopped") return "Stopped";

            return statusText + "/" + resultText;
        },
        simplifyBuild = function (res) {
            return {
                id: res.id,
                project: res.project.name,
                definition: res.definition.name,
                number: res.buildNumber,
                isRunning: !res.finishTime,
                startedAt: parseDate(res.startTime),
                finishedAt: parseDate(res.finishTime),
                requestedFor: res.requestedFor.displayName,
                statusText: getStatusText(res.status, res.result),
                status: getStatus(res.status, res.result),
                reason: res.reason,
                hasErrors: !isNullOrWhiteSpace(res.Errors),
                hasWarnings: !isNullOrWhiteSpace(res.Warnings),
                url: res._links.web.href
            };
        },
        queryBuilds = function (callback) {
            makeRequest(makeUrl('/Definitions', 'name=' + self.configuration.definition), function (error, body) {
                if (error) {
                    callback(error);
                    return;
                }

                for (var i = 0; i < body.value.length; i++) {
                    makeRequest(makeUrl('/Builds', '$top=30&definitions=' + body.value[i].id), function (error, body) {
                        if (error) {
                            callback(error);
                            return;
                        }

                        var builds = [];

                        forEachResult(body, function (res) {
                            builds.push(simplifyBuild(res));
                        });

                        callback(error, builds);
                    });
                }
            });
        };

    self.configure = function (config) {
        self.configuration = config;
    };

    self.check = function (callback) {
        queryBuilds(callback);
    };
};