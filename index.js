var express = require('express')
var bodyParser = require('body-parser')
var request = require('request')
var MongoClient = require('mongodb').MongoClient
    , assert = require('assert');
var app = express()
var db = null

var accessToken = "CAAGZCjqmOZAN0BAN8MGNUZApQaJfOzYWiQGd9umuqvUio6NQbxtQgBZCiLIuCJwt61dKokZCi4HwqU5TqaYUt5nQwE92vyT4iRYjT9rcu4Q1lDcuXeaTrKK0Pq06A1CrFebxPh0zVZBrJs0hUfHLjWOjERla6ZAS6AGKvTMHjiaKJQuCUpRiZAyc8Th6zfkPeZAdTW1ZBICPTLDwZDZDCAAGZCjqmOZAN0BAN8MGNUZApQaJfOzYWiQGd9umuqvUio6NQbxtQgBZCiLIuCJwt61dKokZCi4HwqU5TqaYUt5nQwE92vyT4iRYjT9rcu4Q1lDcuXeaTrKK0Pq06A1CrFebxPh0zVZBrJs0hUfHLjWOjERla6ZAS6AGKvTMHjiaKJQuCUpRiZAyc8Th6zfkPeZAdTW1ZBICPTLDwZDZD"
var url = "mongodb://friendbot:Nishank@ds019101.mlab.com:19101/friendbotdb"
MongoClient.connect(url, function(err, database) {
  assert.equal(null, err);
  db = database
});

app.use(express.static('fb-website'));

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// for Facebook verification
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === 'test123') {
        res.send(req.query['hub.challenge'])
    }
    res.send('Error, wrong token')
})

// Spin up the server
app.listen(app.get('port'), function() {
    console.log('running on port', app.get('port'))
})

app.post('/webhook/', function (req, res) {
    messaging_events = req.body.entry[0].messaging
    for (i = 0; i < messaging_events.length; i++) {
        event = req.body.entry[0].messaging[i]
        sender = event.sender.id
        if (event.message && event.message.text) {
            text = event.message.text
            addUserIfDoesNotExist(sender)
            if (text == "start") {
                pairUser(sender)
            } else if(text == "quit") {
                sendTextMessage(sender, "The chat has been disconnected")
                sendFriendMessage(sender, "The chat has been disconnected")
                unpairUser(sender)
                res.sendStatus(200)
                return
            } else if (text == "help") {
                text = "Welcome to FriendBot! You can use FriendBot to meet new people.\n\nHere are the commands you can use:\nstart - Start conversation\nquit – End conversation\nhelp - Display this message\n\nHappy chatting!"
                sendTextMessage(sender, text)
                res.sendStatus(200)
                return
            }
            sendFriendMessage(sender, "Anonymous: " + text)
        }
    }
    res.sendStatus(200) //Successful
})

var token = "CAAGZCjqmOZAN0BAHdHJ5KqHuxZCekEMGV0maLkq2UQXDApJ9FEKto041YOE1JLYEHZCRyB3jcb5RAi7p0gAh4HBZAZC798u7axmkAbno9kGF9YZCEdZBk9qK8F68BZBnLatoZAexaIxfwueIWyZCgWFKk9ZA5wmhckKh3LHTju47yiSUPzgLclle9ZBR5ZCHH4KVLmb5ZAZB6h92AIdXiwZDZD"


function sendFriendMessage(sender, text) {
    var collection = db.collection('currentconvos')
    var result1 = collection.find({}).filter({id1: sender})
    result1.count(function(err, numResults) {
        if (numResults != 0) {
            result1.each(function(err, otherUser) {
                if (err) throw err
                if (otherUser != null) {
                    sendTextMessage(otherUser['id2'], text)
                }
            })
        }
    })
    var result2 = collection.find({}).filter({id2: sender})
    result2.count(function(err, numResults) {
        if (numResults != 0) {
            result2.each(function(err, otherUser) {
                if (err) throw err
                if (otherUser != null) {
                    sendTextMessage(otherUser['id1'], text)
                }
            })
        }
    })
}


function sendTextMessage(sender, text) {
    messageData = {
        text:text
    }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:token},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

var addUser = function(user, name) {
    var collection = db.collection('allusers')
    collection.insert({
        Name: name,
        id: user,
        inConvo: false
    }, function(err, returnedUser) {
        if (err) throw err
        //Nothing further we need to do
    })
}

var addUserIfDoesNotExist = function(user) {
    var found = false;
    var collection = db.collection('allusers')
    var cursor = collection.find({}).filter({id:user})
    cursor.count(function(err, numDocs) {
        if (numDocs == 0) {
        	addUser(user, "")     
        }
    })
}


var pairUser = function(user) {
    var otherUserID = null
    var allUsers = db.collection('allusers')
    var cursor = allUsers.find({"id":{$nin:[user]}, inConvo:{$in: [false]}})
    cursor.count(function(err, numDocs) {
        var rand = Math.floor(Math.random()*numDocs)
        var randomUserCursor = allUsers.find({"id":{$nin:[user]}, inConvo:{$in: [false]}}).limit(1).skip(rand)
        randomUserCursor.each(function(err, otherUser) {
            if (err) throw err
            if (otherUser != null) {
                var convos = db.collection('currentconvos')
                otherUserID = otherUser['id']
                convos.insert({
                    id1: user,
                    id2: otherUserID
                }, function(err, convo){
                    if (err) throw err
                    sendTextMessage(otherUserID, "You are now connected. Happy chatting!")
                    sendTextMessage(user, "You are now connected. Happy chatting!")
                })

                allUsers.updateOne(
                    {id:{$in: [user]}},
                    {$set: {"inConvo": true}},
                    function(err, results) {
                        if (err) throw err
                        //Nothing further we need to do
                    }
                )
                allUsers.updateOne({
                    id:{$in: [otherUserID]}},
                    {$set: {"inConvo": true}},
                    function(err, results) {
                        if (err) throw err
                        //Nothing further we need to do
                    }
                )
            }
        })
    })
}

var unpairUser = function(user) {
    var otherUserID = null
    var allUsers = db.collection('allusers')
    var cursor = allUsers.find({"id":{$nin:[user]}, inConvo:{$in: [true]}})
    cursor.count(function(err, numDocs) {
        var userCursor = allUsers.find({"id":{$nin:[user]}, inConvo:{$in: [true]}})
        userCursor.each(function(err, otherUser) {
            if (err) throw err
            if (otherUser != null) {
                var convos = db.collection('currentconvos')
                otherUserID = otherUser['id']
                convos.remove({
                    id1: user,
                    id2: otherUser['id']
                }, function(err, returnedUser){
                    if (err) throw err
                    //Nothing further we need to do
                })
                convos.remove({
                    id1: otherUser['id'],
                    id2: user
                }, function(err, returnedUser){
                    if (err) throw err
                    //Nothing further we need to do
                })
                allUsers.updateOne(
                    {id:{$in: [user]}},
                    {$set: {"inConvo": false}},
                    function(err, results) {
                        if (err) throw err
                        //Nothing further we need to do
                    }
                )
                allUsers.updateOne({
                    id:{$in: [otherUserID]}},
                    {$set: {"inConvo": false}},
                    function(err, results) {
                        if (err) throw err
                        //Nothing further we need to do
                    }
                )
            }
        })
    })
}
