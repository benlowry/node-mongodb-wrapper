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
	
	// it may be empty because of a collection lookup
	if(module.exports.poolEnabled && collectionname && connections[databasename] && connections[databasename].length) {
		var connection = connections[databasename].pop();
		
		if(connection.state == "disconnected") {
			trace("reopening pooled connection");
			connection.open();
			connections[databasename].push(connection);
		}
		
		if(connection.state == "connected") {
			callback(null, new mongodb.Collection(connection, collectionname), connection);
			return;
		} else {
			trace("pooled connection is " + connection.state);
		}
	}
	
	var database = databases[databasename];

    var db = new mongodb.Db(database.name, new mongodb.Server(database.address, database.port));
    db.open(function (error, connection) {
		
        if(error) {
			
            trace("connection failed to " + databasename + ": "+ error);
            getConnection(databasename, collectionname, operation, callback);

            if(connection && connection.close) {
                connection.close();
                connection = null;
            }
			
            return;
        }

        if(!database.username && !database.password) {
            callback(null, collectionname ? new mongodb.Collection(connection, collectionname) : null, connection);
            return;
        }

        connection.authenticate(database.username, database.password, function(error) {

            if(error) {
                trace("unable to authenticate to " + database.name + " with " + database.username + " / " + database.password);
                getConnection(databasename, collectionname, operation, callback);
				
                if(connection && connection.close) {
                    connection.close();
                    connection = null;
                }
                return;
            }
			
            callback(null, collectionname ? new mongodb.Collection(connection, collectionname) : null, connection);
        });
    });
}

/**
 * Puts a connection back in the pool.
 *
 * @param databasename Database configuration name
 * @param collection The collection name
 * @param connection The database connection
 */
function returnConnection(databasename, connection) {
	
	if(!db.poolEnabled) {
		killConnection(connection);
		return;
	}
	
	if(!connections[databasename]) {
		connections[databasename] = [];
	}
	
	if(connections[databasename].length > db.poolLimit) {
		killConnection(connection);
		return;
	}
	
	connections[databasename].push(connection);
}

/**
 * Terminates a connection.  This is called whenever an error occurs.
 *
 * @param databasename Database configuration name
 * @param collection The collection name
 */
function killConnection(connection) {
	if(connection && connection.close) {
		trace("closing connection to " + connection.databaseName + ": " + connection.state);
		connection.close();
		connection = null;
	}
}

module.exports = db = {
	
	/**
	 * Configuration settings
	 */
	poolEnabled: true,
	cacheEnabled: true,
	defaultCacheTime: 60,
	poolLimit: 20,
	
    /**
     * Import your own connections collection
	 *
     * @param dblist Your databases:  { db1: { address: "", port: , name: "db1" }, ... }
     */
    setDatabases:function(dblist) {
        databases = dblist;
		configureDatabases();
    },

    /**
     * Inserts an object into a collection.
     *
     * @param database Database config name
     * @param collectionname The collection name
     * @param options { doc: {}, safe: false }
     * @param callback Your callback method(error, item)
     */
    insert: function(database, collectionname, options, callback) {
        
        getConnection(database, collectionname, "insert", function(error, collection, connection) {

            collection.insert(options.doc, {safe: options.safe}, function(error, items) {

                if(error) {
					trace("insert error: " + error);
                    killConnection(connection);
					callback(error);
                    return;
                }

                if(callback) {
                    callback(null, items.length > 0 ? items[0] : {});
                }
				
				returnConnection(database, connection);
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

        getConnection(database, collectionname, "update", function(error, collection, connection) {

            collection.update(options.filter, options.doc, {safe: options.safe || false, upsert: options.upsert || true}, function(error) {

                if(callback) {
                    callback(error, error == null);
                }

                if(error) {
                    trace("update error: " + error);
                    killConnection(connection);
                } else {
					returnConnection(database, connection);
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
		
        if(options.cache) {
            var cached = cache.get(database, collectionname, "get", options);

            if(cached) {
                callback(null, cached);
                return;
            }
        }

        getConnection(database, collectionname, "get", function(error, collection, connection) {

            collection.find(options.filter || {}).limit(options.limit || 0).skip(options.skip || 0).sort(options.sort || {}).toArray(function (error, items) {

                if(error) {
					trace("get error: " + error);
                    killConnection(connection);
                } else {
					returnConnection(database, connection);

					if(options.cache) {
	                    cache.set(database, collectionname, "get", options, items);
	                }
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

        getConnection(database, collectionname, "getOrInsert", function(error, collection, connection) {

            collection.find(options.filter).limit(1).toArray(function (error, items) {

                if (error) {

                    if(callback) {
                        callback(error, []);
                    }

					trace("getOrInsert error: " + error);
                    killConnection(connection);
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
                        killConnection(connection);
                        return;
                    }

                    if(callback) {
                        callback(null, item[0]);
                    }
			
					returnConnection(database, connection);
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
		
        if(options.cache) {
            var cached = cache.get(database, collectionname, "getAndCount", options);

            if(cached) {
                callback(null, cached.items, cached.numitems);
                return;
            }
        }

        getConnection(database, collectionname, "getAndCount", function(error, collection, connection) {

            if(error) {

                if(callback) {
                    callback(error, [], 0);
                }

                trace("getAndCount error: " + error);
                killConnection(connection);
                return;
            }

            collection.find(options.filter || {}).limit(options.limit || 0).skip(options.skip || 0).sort(options.sort || {}).toArray(function (error, items) {

                if (error) {

                    if(callback) {
                        callback(error, [], 0);
                    }

                    trace("getAndCount error: " + error);
                    killConnection(connection);
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
                        killConnection(connection);
                        return;
                    }

                    if(options.cache) {
                        cache.set(database, collectionname, "getAndCount", options, {items: items, numitems: numitems});
                    }

                    if(callback) {
                        callback(null, items, numitems);
                    }
					
					returnConnection(database, connection);
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
		
        if(options.cache) {
            var cached = cache.get(database, collectionname, "count", options);

            if(cached) {
                callback(null, cached);
                return;
            }
        }

        getConnection(database, collectionname, "count", function(error, collection, connection) {

            collection.count(options.filter, function (error, numitems) {

                if (error) {
                    if(callback) {
                        callback(error, []);
                    }

                    trace("count error: " + error);
                    killConnection(connection);
                    return;
                }

                if(options.cache) {
                    cache.set(database, collectionname, "count", numitems);
                }

                if(callback) {
                    callback(null, numitems);
                }
				
				returnConnection(database, connection);
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

        getConnection(database, collection1name, "move", function(error, collection1, connection1) {
			
            if(error) {

                if(callback) {
                    callback(error);
                }

                trace("move error: " + error);
                killConnection(connection1);
                return;
            }
			
            getConnection(database, collection2name, "move", function(error, collection2, connection2) {
				
	            if(error) {

	                if(callback) {
	                    callback(error);
	                }

	                trace("remove error: " + error);
	                killConnection(connection1);
	                killConnection(connection2);
	                return;
	            }
				
                collection2.update(options.doc, options.doc, {safe: options.safe || false, upsert: options.upsert || options.overwrite}, function(error) {
					
		            if(error) {

		                if(callback) {
		                    callback(error);
		                }

		                trace("remove error: " + error);
		                killConnection(connection1);
			            killConnection(connection2);
		                return;
		            }
					
                    collection1.remove(options.doc, function(error) {
						
			            if(error) {

			                if(callback) {
			                    callback(error, false);
			                }

			                trace("remove error: " + error);
			                killConnection(connection1);
			                killConnection(connection2);
			                return;
			            }
						
						if(callback) {
							callback(null);
						}
						
						returnConnection(database, connection1);
						returnConnection(database, connection2);
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

        getConnection(database, collectionname, "remove", function(error, collection, connection) {
			
            if(error) {

                if(callback) {
                    callback(error, false);
                }

                trace("remove error: " + error);
                killConnection(connection);
                return;
            }
			
            collection.remove(options.filter, function(error) {
				
				if(error) {
                    trace("remove error: " + error);
                    killConnection(connection);
				} else {				
					returnConnection(database, connection);
				}
				
				if(callback) {
	                callback(error, error == null);
				}
            });
        });
    }
};


/**
 * A very simple, self cleaning, local cache.  If your app runs on multiple threads
 * or a PaaS like Heroku each dyno / worker / whatever will have its own copy
 */
var cache = {

    get: function(databasename, collectionname, operation, options) {
		
		if(!db.cacheEnabled) { 
			return null;
		}
		
		var database = databases[databasename];
        var key = database.name + ":" + database.collectionname + ":" + operation + ":" + JSON.stringify(options);
        return localcache[key] ? localcache[key].data : null;
    },

    set: function(databasename, collectionname, operation, options, obj) {
		
		if(!db.cacheEnabled) {
			return;
		}
		
		var database = databases[databasename];
        var key = database.name + ":" + database.collectionname + ":" + operation + ":" + JSON.stringify(options);
        localcache[key] = { data: obj, time: options.cachetime || db.defaultCacheTime};
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

    /**
     * Initializes a single collection's shorthand
     * @param cdn the collection name
     */
    db[dbn].collection = function(cdn) {

        var ddbn = this.dbn;

        if(db[this.dbn][cdn]) {
            return;
        }

        db[ddbn][cdn] = {};
        db[ddbn][cdn].cdn = cdn;
        db[ddbn][cdn].dbn = ddbn;
        db[ddbn][cdn].get = function(options, callback) { db.get(this.dbn, this.cdn, options, callback); }
        db[ddbn][cdn].getOrInsert = function(options, callback) { db.getOrInsert(this.dbn, this.cdn, options, callback); }
        db[ddbn][cdn].getAndCount = function(options, callback) { db.getAndCount(this.dbn, this.cdn, options, callback); }
        db[ddbn][cdn].count = function(options, callback) { db.count(this.dbn, this.cdn, options, callback); }
        db[ddbn][cdn].move = function(collection2name, options, callback) { db.move(this.dbn, this.cdn, collection2name, options, callback); }
        db[ddbn][cdn].update = function(options, callback) { db.update(this.dbn, this.cdn, options, callback) };
        db[ddbn][cdn].insert = function(options, callback) { db.insert(this.dbn, this.cdn, options, callback) };
        db[ddbn][cdn].remove = function(options, callback) { db.remove(this.dbn, this.cdn, options, callback); }
    };

    /**
     * Initializes the collection shorthand on a database
     * @param opt either an array of collection names or a callback method(error) for
     * loading directly from the db
     */
    db[dbn].collections = function(opt) {

        var callback;

        if(opt) {

            if(typeof opt === 'function') {
                callback = opt;
            } else {
                for(var i=0; i<opt.length; i++) {
                    this.collection(opt[i]);
                }

                return;
            }
        }

        var ddbn = this.dbn;
		getConnection(ddbn, "", "", function(error, collection, connection) {

            if(error) {
                callback(error);
                return;
            }

            connection.collectionNames({namesOnly: true}, function(error, names) {

                if(error) {
                    callback(error);
                    return;
                }

                for(var i=0; i<names.length; i++) {

                    var name = names[i];

                    if(name.indexOf(ddbn + ".system.") == 0)
                        continue;

                    var dcdn = name.substring(ddbn.length + 1);

                    db[ddbn].collection(dcdn);
                }

                connection.close();
                connection = null;
                callback(null);
            });
        });
    }
}

/*
 * Creates the shorthand references to databases and provides methods
 * for including shorthand collection paths too.  You don't need to call
 * this manually, it will automatically apply to the locally defined
 * list of databases, or run again if you pass your own configuration.
 */
function configureDatabases() {

    for(var databasename in databases) {
        console.log(databasename);
        var dbn = databases[databasename].name;
        db[dbn] = databases[databasename];
        db[dbn].dbn = dbn;

        /**
         * Initializes a single collection's shorthand
         * @param cdn the collection name
         */
        db[dbn].collection = function(cdn) {

            var ddbn = this.dbn;

            if(db[this.dbn][cdn]) {
                return;
            }

            db[ddbn][cdn] = {};
            db[ddbn][cdn].cdn = cdn;
            db[ddbn][cdn].dbn = ddbn;
            db[ddbn][cdn].get = function(options, callback) { db.get(this.dbn, this.cdn, options, callback); }
            db[ddbn][cdn].getOrInsert = function(options, callback) { db.getOrInsert(this.dbn, this.cdn, options, callback); }
            db[ddbn][cdn].getAndCount = function(options, callback) { db.getAndCount(this.dbn, this.cdn, options, callback); }
            db[ddbn][cdn].count = function(options, callback) { db.count(this.dbn, this.cdn, options, callback); }
            db[ddbn][cdn].move = function(collection2name, options, callback) { db.move(this.dbn, this.cdn, collection2name, options, callback); }
            db[ddbn][cdn].update = function(options, callback) { db.update(this.dbn, this.cdn, options, callback) };
            db[ddbn][cdn].insert = function(options, callback) { db.insert(this.dbn, this.cdn, options, callback) };
            db[ddbn][cdn].remove = function(options, callback) { db.remove(this.dbn, this.cdn, options, callback); }
        };

        /**
         * Initializes the collection shorthand on a database
         * @param opt either an array of collection names or a callback method(error) for
         * loading directly from the db
         */
        db[dbn].collections = function(opt) {

            var callback;

            if(opt) {

                if(typeof opt === 'function') {
                    callback = opt;
                } else {
                    for(var i=0; i<opt.length; i++) {
                        this.collection(opt[i]);
                    }

                    return;
                }
            }

            var ddbn = this.dbn;
            getConnection(ddbn, "", "", function(error, collection, connection) {

                if(error) {
                    callback(error);
                    return;
                }

                connection.collectionNames({namesOnly: true}, function(error, names) {

                    if(error) {
                        callback(error);
                        return;
                    }

                    for(var i=0; i<names.length; i++) {

                        var name = names[i];

                        if(name.indexOf(ddbn + ".system.") == 0)
                            continue;

                        var dcdn = name.substring(ddbn.length + 1);

                        db[ddbn].collection(dcdn);
                    }

                    connection.close();
                    connection = null;
                    callback(null);
                });
            });
        }
    }
}

configureDatabases();