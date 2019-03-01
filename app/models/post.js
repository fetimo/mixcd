// load mongoose
const mongoose = require('mongoose');

// define the schema for our post model
const postSchema = mongoose.Schema({
  title: String,
  body: String,
  author: String,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);