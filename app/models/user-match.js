// load mongoose
var mongoose = require('mongoose');

// define the schema for our match model
var userMatchSchema = mongoose.Schema({
    pair: Array,
    shipped: Boolean,
    received: Boolean,
    matchId: Object
});

// create the model for users and expose it to our app
module.exports = {
	model: mongoose.model('UserMatch', userMatchSchema),
	schema: userMatchSchema
};