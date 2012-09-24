# Node MongoDB Wrapper

This package greatly simplifies working with [MongoDB](http://mongodb.org/) and [Node MongoDB Native](https://github.com/mongodb/node-mongodb-native).

It removes a lot of the callback madness and provides a simple shorthand for common operations.  It also localizes your db configuration within itself so you only specify a name rather than a multitude of properties and has its own very simple connection pooling and caching.

All of these features can be removed or replaced easily.

This is in use in production at [Playtomic](https://playtomic.com/) as part of the high-volume [api server](https://success.heroku.com/playtomic).

## Requires

1. [MongoDB](http://mongodb.org/) has to be running somewhere.
2. [Node MongoDB Native](https://github.com/mongodb/node-mongodb-native) and [NodeJS](http://nodejs.org/)

## How to use
1. git clone https://github.com/benlowry/node-mongodb-wrapper
2. cd node-mongodb-wrapper
3. node test.js

## Methods

Node MongoDB Wrapper provides methods for:

1. get
2. getAndCount
3. getOrInsert
4. count
5. insert
6. update
7. move
8. remove

## Examples

A complete suite of examples is available in the included test.js file.

	db.get("local", "stuff", {filter: {x: 1, y: 2, z: 3}, cache: true, cachetime: 60}, function(error, items) {
	    console.log("huzzah!");
	});
	
In that short example "local" is one of our configured databases:

	var databases = {
	    local: {
	        address: "127.0.0.1",
	        port: 27017,
	        name: "test",
			//username: "optional",
			//password: "optional"
	    }
	}
 
We're passing an object that contains a nested filter object which is the query criteria and is exactly as you would use directly, it also supports limit, sort and skip in the outer object.  The query is marked as cacheaable and will store the results for 60 seconds.
	

## Why 

Because without this you end up with too much boilerplate and nesting:

	var db = new Db("local", new Server("127.0.0.1", 27017));
	db.open(function(error, connection) {
		
		if(error) {
			console.log("error: " + error);
			return;
		}
		
	    connection.authenticate(username, password, function(error) {
			
			if(error) {
				console.log("error2: " + error);
				return;
			}
			
	        var collection = new mongodb.Collection(connection, "stuff");
	        collection.find({x: 1, y: 2, z: 3}, function(error, items) {
				
				if(error) {
					console.log("error3: " + error);
					return;
				}
				
	            console.log("huzzah!");
	        });
	    });
	});
	
### What's missing
There's one feature that would be great to have that I haven't built in and that is sending a batch of operations in to be processed in the single request.  This could remove code complexity even further although with the connection re-use there may not be much performance gain.
	

### License

Copyright [Playtomic Inc](https://playtomic.com), 2012.  Licensed under the MIT license.  Certain portions may come from 3rd parties and carry their own licensing terms and are referenced where applicable.