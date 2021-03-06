// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');
var userMatch = require('./user-match');

// define the schema for our user model
var userSchema = mongoose.Schema({
    local: {
        email: String,
        password: String
    },
    username: String,
    taste: String,
    address: String,
    lastfm: String,
    country: String,
    shipToMany: Boolean,
    shipAbroad: Boolean,
    matches: [userMatch.schema],
    admin: { type: Boolean, default: false }
});

// generating a hash
userSchema.methods.generateHash = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
userSchema.methods.validPassword = function (password) {
    return bcrypt.compareSync(password, this.local.password);
};

userSchema.methods.currentRound = function (id) {
    return this.matches.filter(function (round) {
        return id.toString() === round.matchId.toString();
    })[0];
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
