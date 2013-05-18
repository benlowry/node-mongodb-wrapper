var db = require("../mongo-wrapper.js"),
	assert = require("assert");
	
describe("node-mongodb-wrapper", function() {
	
	it("insert", function(done) {

		db.setDatabases({
		    test: {
		        address: "127.0.0.1",
		        port: 27017,
		        name: "test"
		    }
		});

		db.cacheEnabled = true;
		db.test.collections(["stuff", "stuff2"]);
		db.test.collections(function(error) {
			
			db.test.stuff.remove({}, function(error) {
				db.test.stuff2.remove({}, function(error) {
				
					var inserted = 0;

					function insert() {
				
						inserted++;
				
						db.test.stuff.insert({doc: {this: "is", a: "sample", doc: inserted }}, function(error, item) {
				
							if(inserted == 100) {
								done();
							} else {
								insert();
							}
						});
					}
				
					insert();
				});
			});
		});
	});
	
	
	it("get", function(done) {
	
		// querying with basic caching
		db.test.stuff.get({filter: {doc: {$gt: 50}}, cache: true, cachetime: 60}, function(error, items) {
			assert.equal(error, null);
			assert.notEqual(items, null);
			assert.equal(items.length, 50);
			
			// again using the cache
			db.test.stuff.get({filter: {doc: {$gt: 50}}, cache: true, cachetime: 60}, function(error2, items2) {
				assert.equal(error2, null);
				assert.notEqual(items2, null);
				assert.equal(items2.length, 50);
				assert.equal(items.length, items2.length);
				
				var i;
				
				for(i=0; i<items.length; i++) {
					assert.equal(items[i]._id, items2[i]._id);
					assert.equal(items[i].this, items2[i].this);
					assert.equal(items[i].a, items2[i].a);
					assert.equal(items[i].doc, items2[i].doc);
				}
				
				// again without a cache
				db.test.stuff.get({filter: {doc: {$lte: 50}}, cache: false, sort: { doc: 1}}, function(error3, items3) {
					assert.equal(error3, null);
					assert.notEqual(items3, null);
					assert.equal(items3.length, 50);
					
					for(i=0; i<items3.length; i++) {
						assert.equal(items3[i].doc, i+1);
					}
					
					done();
				});
			});
		});
	});
	
	it("getAndCount", function(done) {
		
		// querying with basic caching
		db.test.stuff.getAndCount({filter: {doc: {$gt: 50}}, cache: true, cachetime: 60, limit: 10}, function(error, items, numitems) {
			assert.equal(error, null);
			assert.notEqual(items, null);
			assert.equal(items.length, 10);
			assert.equal(numitems, 50);
			
			// again using the cache
			db.test.stuff.getAndCount({filter: {doc: {$gt: 50}}, cache: true, cachetime: 60, limit: 10}, function(error2, items2, numitems2) {
				assert.equal(error2, null);
				assert.notEqual(items2, null);
				assert.equal(items2.length, 10);
				assert.equal(items.length, items2.length);
				
				// again without a cache
				db.test.stuff.getAndCount({filter: {doc: {$lte: 50}}, cache: false}, function(error3, items3, numitems3) {
					assert.equal(error3, null);
					assert.notEqual(items3, null);
					assert.equal(items3.length, 50);
					assert.equal(numitems3, 50);
					done();
				});
			});
		});
	});
	
	it("count", function(done) {
		
		// querying with basic caching
		db.test.stuff.count({filter: {doc: {$gt: 50}}, cache: true, cachetime: 60, limit: 10}, function(error, numitems) {
			assert.equal(error, null);
			assert.equal(numitems, 50);
			
			// again using the cache
			db.test.stuff.count({filter: {doc: {$gt: 50}}, cache: true, cachetime: 60, limit: 10}, function(error2, numitems2) {
				assert.equal(error2, null);
				assert.equal(numitems2, 50)

				// again without a cache
				db.test.stuff.count({filter: {doc: {$lte: 50}}, cache: false}, function(error3, numitems3) {
					assert.equal(error3, null);
					assert.equal(numitems3, 50);
					done();
				});
			});
		});
	});
	
	it("getOrInsert", function(done) {
		
		// get/inserting a doc that does exist
		db.test.stuff.getOrInsert({filter: {doc: 100}, doc: {this: "is", a: "test", doc: 100}}, function(error, item) {
			assert.equal(error, null);
			assert.notEqual(item, null);
			assert.equal(item.doc, 100);
			
			db.test.stuff.count({filter: { doc: 100}, cache: false}, function(error2, numitems2) {
				assert.equal(error2, null);
				assert.equal(numitems2, 1);
			});
			
			// again using a 'doc' that doesn't exist
			db.test.stuff.getOrInsert({filter: {doc: 101}, doc: {this: "is", a: "test", doc: 101}}, function(error3, item3) {
				assert.equal(error3, null);
				assert.notEqual(item3, null);
				assert.equal(item3.doc, 101);

				// again with a doc that does exist
				db.test.stuff.getOrInsert({filter: {doc: 101}, doc: {this: "is", a: "test", doc: 101}}, function(error4, item4) {
					assert.equal(error4, null);
					assert.notEqual(item4, null);
					assert.equal(item4.doc, 101);
					
					db.test.stuff.count({filter: { doc: 101}, cache: false}, function(error5, numitems5) {
						assert.equal(error5, null);
						assert.equal(numitems5, 1);
						done();
					});
				});
			});
		});
	});
	

	it("update", function(done) {
		
		// updating a doc that does exist
		db.test.stuff.update({filter: { doc: 101 }, doc: { this: "was", a: "updated", doc: 102 }}, function(error) {
			assert.equal(error, null);
			
			// upserting a doc that doesn't exist
			db.test.stuff.update({filter: { doc: 103 }, doc: { this: "was", a: "updated", doc: 103 }, upsert: true }, function(error2) {
				assert.equal(error2, null);
				done();
			});
		});
	});
	
	it("move", function(done) {
		
		// move a doc that doesn't exist in the destination
		db.test.stuff.get({filter: { doc: 103}, cache: false}, function(error, items) {
		
			assert.equal(error, null);
			assert.notEqual(items, null);
			assert.equal(items.length, 1);
			
			var item = items[0];
			assert.notEqual(item, null);
			assert.equal(item.doc, 103);
			
			// move it
			delete item._id;
			
			db.test.stuff.move("stuff2", {doc: item}, function(error2) {
				
				assert.equal(error2, null);
				
				// save it again so we can test overwriting
				db.test.stuff.insert({doc: item}, function(error3) {
				
					assert.equal(error3, null);
					delete item._id;
					
					// fails for already existing without allowing overwriting
					db.test.stuff.move("stuff2", {doc: item}, function(error4) {
						assert.notEqual(error4, null);
						
						// overwrites
						db.test.stuff.move("stuff2", {doc: item, overwrite: true}, function(error5) {
							assert.equal(error5, null);
							done();
						});	
					});
				});
			});
		});
	});

	
	it("delete", function(done) {
		db.remove("test", "stuff", {filter: { doc: { $gt: 50}}}, function(error) {
			assert.equal(error, null);
			
			db.test.stuff.count({}, function(error, items) {
				assert.equal(error, null);
				assert.equal(items, 50);
				done();
			});
		});
	});
	
	it("aggregate", function(done) {
		// TODO: tests
		done();
	});
	
	it("aggregateAndCount", function(done) {
		// TODO: tests
		done();
	});
});