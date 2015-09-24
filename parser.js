
(function(global) {
    var Parser, presets, tc;

    tc = function(val, types) {
        var special, type;

        special = {
            "regex": _.isRegExp,
            "array": _.isArray
        };
        if (_.isArray(types)) {
            return _.some(types, function(type) {
                if (_.has(special, type)) {
                    return special[type](val);
                } else {
                    return typeof val === type;
                }
            });
        } else if (_.isString(types)) {
            if (_.has(special, type)) {
                return special[type](val);
            } else {
                return typeof val === type;
            }
        } else {
            type = typeof val;
            _.some(special, function(fnc, t) {
                if (fnc(val)) {
                    return type = t;
                }
            });
            return type;
        }
    };

    presets = {
        break: /([^>\r\n]?)(\r\n|\n\r|\r|\n)/g,
        tag: /\#[\S]+/ig,
        email: /[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/ig,
        url: /(?:(?:https?):\/\/)(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?/gi
    };

    Parser = (function() {
        function Parser() {
            this.rules = [];
        }

        Parser.prototype.addRule = function(match, replace) {
            if (!tc(match, ["string", "regex", "function"])) {
                throw new TypeError("Expecting string, regex, or function for match.");
            }
            if (!tc(replace, ["string", "function", "undefined"])) {
                throw new TypeError("Expecting string or function for replace.");
            }
            return this.rules.push({
                match: match,
                replace: replace
            });
        };

        Parser.prototype.addPreset = function(name, replace) {
            if (!_.has(presets, name)) {
                throw new Error("Preset " + name + " doesn't exist.");
            }
            return this.rules.push({
                match: presets[name],
                replace: function(str) {
                    var ret, val;

                    ret = {
                        type: name,
                        value: str,
                        text: str
                    };
                    if (_.isFunction(replace)) {
                        val = replace(str);
                        if (_.isObject(val)) {
                            _.extend(ret, val);
                        } else if (_.isString(val)) {
                            ret.text = val;
                        }
                    }
                    return ret;
                }
            });
        };

        Parser.prototype.toTree = function(str) {
            var match, tree,
                _this = this;

            tree = [];
            match = _.some(this.rules, function(rule) {
                var i, m, replace, si;

                m = rule.match;
                replace = function(str) {
                    var r, v;

                    r = rule.replace;
                    v = null;
                    switch (tc(r)) {
                        case "function":
                            v = r(str);
                            break;
                        case "string":
                            v = r;
                            break;
                        default:
                            v = str;
                    }
                    if (_.isString(v)) {
                        v = {
                            type: "text",
                            text: v
                        };
                    }
                    return v;
                };
                switch (tc(m)) {
                    case "string":
                        if (!(str.indexOf(m) > -1)) {
                            return;
                        }
                        si = 0;
                        while ((i = str.indexOf(m, si)) > -1) {
                            tree.push(str.substring(si, i));
                            tree.push(replace(str.substr(i, m.length)));
                            si = i + m.length;
                        }
                        tree.push(str.substr(si));
                        break;
                    case "regex":
                        if (!(match = m.exec(str))) {
                            return;
                        }
                        i = 0;
                        while (match != null) {
                            tree.push(str.substring(i, match.index));
                            tree.push(replace(str.substr(match.index, match[0].length)));
                            i = match.index + match[0].length;
                            match = m.exec(str);
                        }
                        tree.push(str.substr(i));
                        break;
                    case "function":
                        match = m(str);
                        si = 0;
                        if (!_.isArray(match)) {
                            return;
                        }
                        if (_.filter(match, _.isNumber).length === 2) {
                            match = [match];
                        }
                        _.each(match, function(part) {
                            part = _.filter(part, _.isNumber);
                            if (_.size(part) !== 2) {
                                return;
                            }
                            if (part[0] < si) {
                                return;
                            }
                            tree.push(str.substring(si, part[0]));
                            tree.push(replace(str.substr(part[0], part[1])));
                            return si = part[0] + part[1];
                        });
                        tree.push(str.substr(si));
                }
                return true;
            });
            if (!match) {
                return [
                    {
                        type: "text",
                        text: str
                    }
                ];
            }
            tree = _.map(tree, function(item) {
                if (!item) {

                } else if (_.isString(item)) {
                    return _this.toTree(item);
                } else {
                    return item;
                }
            });
            return _.compact(_.flatten(tree));
        };

        Parser.prototype.parse = function(str) {
            var tree;

            tree = this.toTree(str);
            return _.map(tree, function(part) {
                if (_.isString(part)) {
                    return part;
                } else if (_.isObject(part)) {
                    return part.text;
                }
            }).join("");
        };

        return Parser;

    })();

    global.StrParser = Parser;

})(this);