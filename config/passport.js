// load all the things we need
const LocalStrategy = require('passport-local').Strategy;

// load up the user model
const User = require('../app/models/user');

// load the auth variables
// var configAuth = require('./auth'); // use this one for testing

module.exports = function (passport) {
  // =========================================================================
  // passport session setup ==================================================
  // =========================================================================
  // required for persistent login sessions
  // passport needs ability to serialize and unserialize users out of session

  // used to serialize the user for the session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // used to deserialize the user
  passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
      done(err, user);
    });
  });

  // =========================================================================
  // LOCAL LOGIN =============================================================
  // =========================================================================
  passport.use('local-login', new LocalStrategy({
    // by default, local strategy uses username and password, we will override with email
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
  },
  ((req, email, password, done) => {
    User.findOne({ 'local.email': email }, (err, user) => {
      console.log({ err, user });
      // if there are any errors, return the error
      if (err) {
        return done(err);
      }

      // if no user is found, return the message
      if (!user) {
        return done(null, false, req.flash('loginMessage', 'No user found.'));
      }

      if (!user.validPassword(password)) {
        console.log('wrong pass');
        return done(null, false, req.flash('loginMessage', 'Oops! Wrong password.'));
      }

      console.log('logged in');

      // all is well, return user
      return done(null, user);
    });
  })));

  // =========================================================================
  // LOCAL SIGNUP ============================================================
  // =========================================================================
  passport.use('local-signup', new LocalStrategy({
    // by default, local strategy uses username and password, we will override with email
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
  }, ((req, email, password, done) => {
    console.log(req.user);
    // check if the user is already logged ina
    if (!req.user) {
      User.findOne({ 'local.email': email }, (err, user) => {
        console.log({ err, user });
        // if there are any errors, return the error
        if (err) { return done(err); }

        // check to see if theres already a user with that email
        if (user) {
          return done(null, false, req.flash('signupMessage', 'That email is already taken.'));
        }
        // create the user
        const newUser = new User();

        newUser.local.email = email;
        newUser.local.password = newUser.generateHash(password);
        console.log({ newUser });
        newUser.save((e) => {
          if (e) { throw e; }

          return done(null, newUser);
        });
      });
    } else {
      const { user } = req;
      user.local.email = email;
      user.local.password = user.generateHash(password);
      user.save((err) => {
        if (err) { throw err; }
        return done(null, user);
      });
    }
  })));
};