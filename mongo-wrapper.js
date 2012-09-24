var mongodb = require("mongodb"),
    localcache = {},
    connections = {},
	debug = process.env.trace || false;

/**
 * Database configurations, this way your api calls are more simple
 * like:  mdb.get("local", "mystuff", ....
 */
var databases = {
    test: {
        address: "127.0.0.1",
        port: 27017,
        name: "test"
    },
    local2: {
        address: "127.0.0.1",
        port: 27017,
        name: "local2"
    }

};

/**
 * Helper functions
 */
function trace(message) {
	
	if(!trace) {
		return;
	}
		
	console.log("mongowrapper: " + message);
}

function getKey(database, collectionname, operation) {
	return database.address + ":" + database.port + "/" + database.name + "/" + collectionname + "/" + operation;
}

/**
 * Nice and simple persistant connections.  If your application runs on
 * a PaaS or multiple instances each worker/whatever will have its own
 * connection pool.
 *
 * @param databasename Database configuration name
 * @param collectionname The collection name
 * @param operation The api operation
 * @param callback The callback function
 */
function getConnection(databasename, collectionname, operation, callback) {

    var database = databases[databasename];
    var key = getKey(database, collectionname, operation);

    if(connections[key]) {
		callback(null, new mongodb.Collection(connections[key], collectionname));
        return;
    }

    var db =  new mongodb.Db(database.name, new mongodb.Server(database.address, database.port));
    db.open(function (error, connection) {
        
        if(error) {
            trace("unable to connect to " + database.name + " with " + database.username + " / " + database.password);
            getConnection(database, collectionname, operation, callback);

            if(connection && connection.close) {
                connection.close();
                connection = null;
            }
            return;
        }

        if(!database.username && !database.password) {
            connections[key] = connection;
            callback(null, collectionname ? new mongodb.Collection(connection, collectionname) : null, connection);
            return;
        }

        connection.authenticate(database.username, database.password, function(error) {

            if(error) {
                trace("unable to authenticate to " + database.name + " with " + database.username + " / " + database.password);
                getConnection(database, collectionname, operation, callback);
                if(connection && connection.close) {
                    connection.close();
                    connection = null;
                }
                return;
            }

            connections[key] = connection;
            callback(null, collectionname ? new mongodb.Collection(connection, collectionname) : null, connection);
        });
    });
}

/**
 * Terminates a connection.  This is called whenever an error occurs.
 *
 * @param databasename Database configuration name
 * @param collection The collection name
 * @param operation The api operation
 */
function killConnection(databasename, collectionname, operation) {

    var database = databases[databasename];
    var key = getKey(database, collectionname, operation);

    if(connections[key]) {
        connections[key].close();
    }
	
    connections[key] = null;
    delete connections[key];
}

module.exports = db = {

    /**
     * Inserts an object into a collection.
     *
     * @param database Database config name
     * @param collectionname The collection name
     * @param options { doc: {}, safe: false }
     * @param callback Your callback method(error, item)
     */
    insert: function(database, collectionname, options, callback) {
        
        getConnection(database, collectionname, "insert", function(error, collection) {

            collection.insert(options.doc, {safe: options.safe}, function(error, items) {

                if(error) {
					trace("insert error: " + error);
                    killConnection(database, collectionname, "insert");
                    return;
                }

                if(callback) {
                    callback(null, items.length > 0 ? items[0] : {});
                }
            });
        });
    },

    /**
     * Updates / Upserts an object into a collection.
     *
     * @param database Database config name
     * @param collectionname The collection name
     * @param options { filter: {}, doc: {}, safe: false, upsert: true }
     * @param callback Your callback method(error, success)
     */
    update: function(database, collectionname, options, callback) {

        getConnection(database, collectionname, "update", function(error, collection) {

            collection.update(options.filter, options.doc, {safe: options.safe || false, upsert: options.upsert || true}, function(error) {

                if(callback) {
                    callback(error, error == null);
                }

                if(error) {
                    trace("update error: " + error);
                    killConnection(database, collectionname, "update");
                }
            });
        });
    },

    /**
     * Selects one or more items
     *
     * @param database Database config name
     * @param collectionname The collection name
     * @param options { filter: {}, limit: 0, skip: 0, sort: {}, cache: false, cachetime: 60 }
     * @param callback Your callback method(error, items)
     */
    get: function(database, collectionname, options, callback) {

        getConnection(database, collectionname, "get", function(error, collection) {

            if(options.cache) {
                var cached = cache.get(database, collectionname, "get", options);

                if(cached) {
                    callback(null, cached);
                    return;
                }
            }

            collection.find(options.filter || {}).limit(options.limit || 0).skip(options.skip || 0).sort(options.sort || {}).toArray(function (error, items) {

                if(error) {
					trace("get error: " + error);
                    killConnection(database, collectionname, "get");
                } else if(options.cache) {
                    cache.set(database, collectionname, "get", items, options.cachetime);
                }

                if(callback) {
                    callback(error, items || []);
                }
            });

        });
    },

    /**
     * Selects a single item or inserts it
     *
     * @param database Database config name
     * @param collectionname The collection name
     * @param options { filter: {}, doc: {}, safe: true or false }
     * @param callback Your callback method(error, item)
     */
    getOrInsert: function(database, collectionname, options, callback) {

        getConnection(database, collectionname, "getOrInsert", function(error, collection) {

            collection.find(options.filter).limit(1).toArray(function (error, items) {

                if (error) {

                    if(callback) {
                        callback(error, []);
                    }

					trace("getOrInsert error: " + error);
                    killConnection(database, collectionname, "getOrInsert");
                    return;
                }

                if(items.length > 0) {
                    callback(null, items[0]);
                    return;
                }

                collection.insert(options.doc, {safe: options.safe || false}, function(error, item) {

                    if(error) {

                        if(callback) {
                            callback(error, null);
                        }

                        trace("getOrInsert error2: " + error);
                        killConnection(database, collectionname, "getOrInsert");
                        return;
                    }

                    if(callback) {
                        callback(null, item[0]);
                    }
                });
            });
      });
    },

    /**
     * Selects a subset of items and returns the total number
     *
     * @param database Database config name
     * @param collectionname The collection name
     * @param options { filter: {}, limit: 0, skip: 0, sort: {}, cache: false, cachetime: 60 }
     * @param callback Your callback method(error, items, numitems)
     */
    getAndCount: function(database, collectionname, options, callback) {

        getConnection(database, collectionname, "getAndCount", function(error, collection) {

            if(error) {

                if(callback) {
                    callback(error, [], 0);
                }

                trace("getAndCount error: " + error);
                killConnection(database, collectionname, "getAndCount");
                return;
            }

            if(options.cache) {
                var cached = cache.get(database, collectionname, "getAndCount", options);

                if(cached) {
                    callback(null, cached.items, cached.numitems);
                    return;
                }
            }

            collection.find(options.filter || {}).limit(options.limit || 0).skip(options.skip || 0).sort(options.sort || {}).toArray(function (error, items) {

                if (error) {

                    if(callback) {
                        callback(error, [], 0);
                    }

                    trace("getAndCount error: " + error);
                    killConnection(database, collectionname, "getAndCount");
                    return;
                }

                // note we could use the api here but it would potentially
                // establish a second connection and change the cache key
                collection.count(options.filter, function(error, numitems) {

                    if (error) {

                        if(callback) {
                            callback(error, [], 0);
                        }

                        trace("getAndCount error: " + error);
                        killConnection(database, collectionname, "getAndCount");
                        return;
                    }

                    if(options.cache) {
                        cache.set(database, collectionname, "getAndCount", {items: items, numitems: numitems}, options.cachetime);
                    }

                    if(callback) {
                        callback(null, items, numitems);
                    }
                });
            });
        });
    },

    /**
     * Counts the number of items matching a query
     *
     * @param database Database config name
     * @param collectionname The collection name
     * @param options { filter: {}, cache: false, cachetime: 60 }
     * @param callback Your callback method(error, numitems)
     */
    count: function(database, collectionname, options, callback) {

        getConnection(database, collectionname, "count", function(error, collection) {

            if(options.cache) {
                var cached = cache.get(database, collectionname, "count", options);

                if(cached) {
                    callback(null, cached);
                    return;
                }
            }

            collection.count(options.filter, function (error, numitems) {

                if (error) {
                    if(callback) {
                        callback(error, []);
                    }

                    trace("count error: " + error);
                    killConnection(database, collectionname, "count");
                    return;
                }

                if(options.cache) {
                    cache.set(database, collectionname, "count", numitems);
                }

                if(callback) {
                    callback(null, numitems);
                }
            });
        });
    },

    /**
     * Moves a document from one collection to another
     * @param database Database config name
     * @param collection1name The source collection name
     * @param collection2name The destination collection name
     * @param options { doc: {... }, overwrite: true, safe: false, }
     * @param callback Your callback method(error, success)
     */
    move: function(database, collection1name, collection2name, options, callback) {

        getConnection(database, collection1name, "move", function(error, collection1) {
            getConnection(database, collection2name, "move", function(error, collection2) {
                collection2.update(options.doc, options.doc, {safe: options.safe || false, upsert: options.upsert || options.overwrite}, function(error) {
                    collection1.remove(options.doc, function(error) {
                        callback(error);
                    });
                });
            });
        })
    },

    /**
     * Removes one or more documents from a collection
     * @param database Database config name
     * @param collectionname The collection name
     * @param options { filter: {} }
     * @param callback Your callback method(error, success)
     */
    remove: function(database, collectionname, options, callback) {

        getConnection(database, collectionname, "remove", function(error, collection) {
            collection.remove(options.filter, function(error) {
                callback(error, error == null);
            });
        });
    }
};


/**
 * A very simple, self cleaning, local cache.  If your app runs on multiple threads
 * or a PaaS like Heroku each dyno / worker / whatever will have its own copy
 */
var cache = {

    get: function(database, collectionname, operation, options) {
        var key = getKey(database, collectionname, operation) + JSON.stringify(options);
        return localcache[key] ? localcache[key].data : null;
    },

    set: function(database, collectionname, operation, options, obj, time) {
        var key = getKey(database, collectionname, operation) + JSON.stringify(options);
        localcache[key] = { data: obj, time: time};
    }
}

setInterval(function() {

    for(var key in localcache) {

        localcache[key].time--;

        if(localcache[key].time > 0) {
            continue;
        }

        localcache[key] = null;
        delete localcache[key];
    }

}, 1000);

/*
 * Shorthand access to functions via db and collections
 */
for(var databasename in databases) {
    console.log(databasename);
    var dbn = databases[databasename].name;
    db[dbn] = databases[databasename];
    db[dbn].dbn = dbn;
    db[dbn].collection = function(cdn) {

        var ddbn = this.dbn;
        trace(ddbn + "." + cdn);

        if(db[this.dbn][cdn]) {
            trace("already set up");
            return;
        }

        db[ddbn][cdn] = {};
        db[ddbn][cdn].cdn = cdn;
        db[ddbn][cdn].dbn = ddbn;
        db[ddbn][cdn].get = function(options, callback) { trace("hello: " + this.dbn + "." + this.cdn); db.get(this.dbn, this.cdn, options, callback); }
        db[ddbn][cdn].getOrInsert = function(options, callback) { db.getOrInsert(this.dbn, this.cdn, options, callback); }
        db[ddbn][cdn].getAndCount = function(options, callback) { db.getAndCount(this.dbn, this.cdn, options, callback); }
        db[ddbn][cdn].count = function(options, callback) { db.count(this.dbn, this.cdn, options, callback); }
        db[ddbn][cdn].move = function(collection2name, options, callback) { db.move(this.dbn, this.cdn, collection2name, options, callback); }
        db[ddbn][cdn].update = function(options, callback) { db.update(this.dbn, this.cdn, options, callback) };
        db[ddbn][cdn].insert = function(options, callback) { db.insert(this.dbn, this.cdn, options, callback) };
        db[ddbn][cdn].remove = function(options, callback) { db.remove(this.dbn, this.cdn, options, callback); }
    };;

    db[dbn].collections = function(arr) {

        if(arr) {
            for(var i=0; i<arr.length; i++) {
                this.collection(arr[i]);
            }

            return;
        }

        var ddbn = this.dbn;

        var connection = getConnection(ddbn, "", "", function(error, collection, connection) {

            if(error) {

            }

            connection.collectionNames({namesOnly: true}, function(error, names) {

                for(var i=0; i<names.length; i++) {

                    var name = names[i];

                    if(name.indexOf(ddbn + ".system.") == 0)
                        continue;

                    var dcdn = name.substring(ddbn.length + 1);

                    db[ddbn].collection(dcdn);
                }

                connection.close();
                connection = null;
            });
        });
    }
}