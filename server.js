const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const flash = require('connect-flash');

const app = express();
const port = process.env.PORT || 4242;

const configDB = require('./config/database.js');

// configuration ===============================================================
mongoose.connect(configDB.url, { useNewUrlParser: true }); // connect to our database
const db = mongoose.connection;
db.on('error', (e) => {
  console.log('error', e);
});
db.once('open', () => {
  // we're connected!
  console.log('connected');
});

require('./config/passport')(passport); // pass passport for configuration

// set up our express application
app.use(compression()); // gzip
// app.use(express.logger('dev')); // log every request to the console
app.use(bodyParser.urlencoded({ extended: false })); // get information from html forms

app.set('view engine', 'ejs'); // set up ejs for templating
// app.use(require('express-promise')()); // setup inline promises

const SECRET = 'ilovescotchscotchyscotchscotch';

app.use(express.static(`${ process.cwd() }/public`));
app.use(cookieParser(SECRET));
app.use(session({
  cookie: {
    maxAge: 60000
  },
  secret: SECRET,
  resave: true,
  saveUninitialized: true
}));
app.use(flash()); // use connect-flash for flash messages stored in session
// required for passport
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions


// routes ======================================================================
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
console.log(`The magic happens on port ${ port }`);