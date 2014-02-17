// load mongoose
var mongoose = require('mongoose');

// define the schema for our match model
var roundSchema = mongoose.Schema({
    title: {type: String, required: true },
    announced: { type: Date, default: Date.now },
    deadlines: {
    	post: { type: Date, required: true },
    	signup: { type: Date, required: true }
    },
    paired: {type: Boolean, default: false }
});

module.exports = mongoose.model('Round', roundSchema);
