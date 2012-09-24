# Node MongoDB Wrapper

This package greatly simplifies working with [MongoDB](http://mongodb.org/) and [Node MongoDB Native](https://github.com/mongodb/node-mongodb-native).

It removes a lot of the callback madness and provides a simple shorthand for common operations.

It also localizes your db configuration within itself so you only specify a name rather than a multitude of properties and has its own very simple connection pooling and caching.

All of these features can be removed or replaced easily.

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
	

## Why 

Because without this you end up with too much boilerplate and nesting:

	var db = new Db("test", new Server("127.0.0.1", 27017));
	db.open(function(error, connection) {
		
		if(error) {
			console.log("error: " + error);
			return;
		}
		
	    connection.authenticate(username,.password, function(error) {
	        var collection = new mongodb.Collection(connection, "stuff");
	        collection.find({x: 1, y: 2, z: 3}, function(error, items) {
				
				if(error) {
					console.log("error2: " + error);
					return;
				}
	            console.log("huzzah!");
	        });
	    });
	});