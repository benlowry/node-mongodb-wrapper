var db = require("./mongo-wrapper.js");

// querying with basic caching
var get1  = {filter: {size: {$gte: 1000}}, cache: true, cachetime: 60};
var get2 =  {limit: 10, cache: true, cachetime: 60};
var get3 = {filter: {size: {$gte: 1000}}};
var get4 = {filter: {size: 1000}, limit: 10, skip: 4};

db.get("local", "stuff", get1, function(error, items) {
    console.log("get1: " + error + "\t" + (items || []).length + " items returned");

    db.get("local", "stuff", get2, function(error, items) {
        console.log("get2: " + error + "\t" + (items || []).length + " items returned");

        db.get("local", "stuff", get3, function(error, items) {
            console.log("get3: " + error + "\t" + (items || []).length + " items returned");

            db.get("local", "stuff", get4, function(error, items) {
                console.log("get4: " + error + "\t" + (items || []).length + " items returned");
            });
        });
    });
});

// getAndCount
db.getAndCount("local", "stuff", get1, function(error, items, numitems) {
    console.log("getAndCount1: " + error + "\t" + (items || []).length + " items of " + numitems + " returned");

    db.getAndCount("local", "stuff", get2, function(error, items, numitems) {
        console.log("getAndCount2: " + error + "\t" + (items || []).length + " items of " + numitems + " returned");

        db.getAndCount("local", "stuff", get3, function(error, items, numitems) {
            console.log("getAndCount3: " + error + "\t" + (items || []).length + " items of " + numitems + " returned");

            db.getAndCount("local", "stuff", get4, function(error, items, numitems) {
                console.log("getAndCount4: " + error + "\t" + (items || []).length + " items of " + numitems + " returned");

                db.getAndCount("local", "stuff", {limit: 5}, function(error, items, numitems) {
                    console.log("getAndCount5: " + error + "\t" + (items || []).length + " items of " + numitems + " returned");
                });
            });
        });
    });
});

db.count("local", "stuff", get1, function(error, numitems) {
    console.log("count: " + error + "\t" + numitems + " returned");

    db.count("local", "stuff", get2, function(error, numitems) {
        console.log("count2: " + error + "\t" + numitems + " returned");

        db.count("local", "stuff", get3, function(error, numitems) {
            console.log("count3: " + error + "\t" + numitems + " returned");

            db.count("local", "stuff", get4, function(error, numitems) {
                console.log("count4: " + error + "\t" + numitems + " returned");

                db.count("local", "stuff", {}, function(error, numitems) {
                    console.log("count5: " + error + "\t" + numitems + " returned");
                });
            });
        });
    });
});


// get or inserting
var getorinsert1 = {filter: { color: "red" }, doc: { color: "red" }};
var getorinsert2 = {filter: { color: "red" }, doc: { color: "red" }, safe: true};
var getorinsert3 = {filter: { color: "red", date: new Date() }, doc: { color: "red", color2: "blue", date: new Date()}};

db.getOrInsert("local", "stuff", getorinsert1, function(error, item) {
    console.log("getOrInsert1: " + error + "\t" + item._id);

    db.getOrInsert("local", "stuff", getorinsert2 , function(error, item) {
        console.log("getOrInsert2: " + error + "\t" + item._id);

        db.getOrInsert("local", "stuff", getorinsert3, function(error, item) {
            console.log("getOrInsert3: " + error + "\t" + item._id);
        });
    });
});

// inserting
var insert1 = {doc: {value1: 1, value2: 2, value3: "three", embedded: { color: "red" }}, safe: true};
var insert2 = {doc: {value1: 1, value2: 2, value3: "three", embedded: { color: "red" }}};

db.insert("local", "stuff", insert1, function(error, item) {
    console.log("insert1: " + error + "\t" + (item || {})._id);

    db.insert("local", "stuff", insert2 , function(error, item) {
        console.log("insert2: " + error + "\t" + (item || {})._id);
    });
});

// updating
var update1 = {filter: {value1: 1, value2: 2}, doc: {value1: 1, value2: 2, value3: "three", inserted: true }};
var update2 = {filter: {value1: 7}, doc: {upserted: true }, upsert: true};

db.insert("local", "stuff", update1, function(error, item) {

    if(error) {
        console.log("updating failed: " + error);
        return;
    }

    update1.doc.updated = true;

    db.update("local", "stuff", update1, function(error, success) {
        console.log("update1: " + error + "\t" + success);

        db.update("local", "stuff", update2 , function(error, success) {
            console.log("update2: " + error + "\t" + success);
        });
    });
});

// move a document
var movedoc1 = { "_id" : "505fb7ab865859e6861bba09", "upserted" : true };
var movedoc2 = { "_id" : "505fb7ab865859e6861bba09", "upserted" : true, overwritten: true };

db.move("local", "stuff", "stuff2", {doc: movedoc1}, function(error) {
   console.log("movedoc1:  success? " + (error == null));

    // reinsert it to test overwriting
    db.insert("local", "stuff", {doc: movedoc1}, function(error, item) {
       db.move("local", "stuff", "stuff2", {doc: movedoc2, overwrite: true}, function(error) {
           console.log("movedoc2:  success? " + (error == null));
       });
    });
});

// deleting
db.remove("local", "stuff", {}, function(error, success) {
    console.log("delete1: " + success);
    db.remove("local", "stuff2", {}, function(error, success) {
        console.log("delete2: " + success);
    });;
});