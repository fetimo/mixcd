const moment = require('moment');

const Round = require('../app/models/round');
const Users = require('../app/models/user');
const Post = require('../app/models/post');
const UserMatch = require('../app/models/user-match');


// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.redirect('/');
}

function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.admin) {
    return next();
  }

  return res.redirect('/');
}

async function setCurrentRound() {
  const round = await Round.findOne({ 'deadlines.post': { $gt: Date.now() } });
  if (!round) {
    return null;
  }
  return {
    id: round._id,
    title: round.title,
    announced: round.announced,
    paired: round.paired,
    deadlines: {
      post: {
        date: moment(round.deadlines.post).calendar(),
        from: moment(round.deadlines.post).fromNow(),
        raw: round.deadlines.post
      },
      signup: {
        date: moment(round.deadlines.signup).calendar(),
        from: moment(round.deadlines.signup).fromNow(),
        raw: round.deadlines.signup
      }
    },
    total: await Users.count({ 'matches.matchId': round._id })
  };
}
let currentRound;
setCurrentRound().then((round) => currentRound = round);

module.exports = function (app, passport) {
  // normal routes ===============================================================

  // show the home page
  app.get('/', async (req, res) => {
    res.render('index.ejs', {
      post: await Post.findOne({}, {}, { sort: { '_id': -1 } }),
      user: req.user
    });
  });

  // PROFILE SECTION =========================
  app.get('/profile', isLoggedIn, async (req, res) => {
    const { user } = req;

    if (user.matches.length) {
      return res.render('profile.ejs', {
        user,
        pairs: await Users.where({ 'matches.matchId': currentRound.id }).where('_id').in(user.currentRound(currentRound.id).pair).select('username'),
        round: currentRound,
        message: req.flash('profileMessage')
      });
    }
    return res.render('profile.ejs', {
      user,
      message: req.flash('profileMessage'),
      pairs: [],
      round: currentRound
    });
  });

  app.get('/user/:username', isLoggedIn, (req, res) => {
    const you = req.user;

    // do look up on username, find user ID then see if it matches one of your pairs
    // find current match
    if (you.username !== req.params.username) {
      Round.findOne({ 'deadlines.post': { $gt: Date.now() } }, (err, round) => {
        if (err) console.log(err);

        res.render('user.ejs', {
          user: Users.findOne({ username: req.params.username }).where({ 'matches.matchId': round._id }).where({ 'matches.pair': you._id }).select('username address taste')
            .exec()
        });
      });
    } else {
      // you've gone to your own profile
      res.render('user.ejs', {
        user: you
      });
    }
  });

  app.get('/admin', isAdmin, (req, res) => {
    res.render('admin.ejs', {
      user: req.user,
      round: currentRound,
      message: req.flash('adminMessage')
    });
  });

  app.get('/pair', isAdmin, (req, res) => {
    const pairing = require('./pair.js');
    Round.findOne({ 'deadlines.post': { $gt: Date.now() } }, (err, round) => {
      round.paired = true;
      round.save();
    });
    res.render('pair.ejs', {
      pair: pairing
    });
  });

  // LOGOUT ==============================
  app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
  });

  // =============================================================================
  // AUTHENTICATE (FIRST LOGIN) ==================================================
  // =============================================================================

  // locally --------------------------------
  // LOGIN ===============================
  // show the login form
  app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
      res.redirect('/profile');
    } else {
      res.render('login.ejs', {
        user: req.user,
        message: req.flash('loginMessage')
      });
    }
  });

  // process the login form
  app.post('/login', passport.authenticate('local-login', {
    successRedirect: '/profile', // redirect to the secure profile section
    failureRedirect: '/login', // redirect back to the signup page if there is an error
    failureFlash: true // allow flash messages
  }));

  // SIGNUP =================================
  // show the signup form
  app.get('/signup', (req, res) => {
    res.render('signup.ejs', { message: req.flash('loginMessage') });
  });

  // process the signup form
  app.post('/signup', passport.authenticate('local-signup', {
    successRedirect: '/profile', // redirect to the secure profile section
    failureRedirect: '/signup', // redirect back to the signup page if there is an error
    failureFlash: true // allow flash messages
  }));

  // =============================================================================
  // AUTHORIZE (ALREADY LOGGED IN / CONNECTING OTHER SOCIAL ACCOUNT) =============
  // =============================================================================

  // locally --------------------------------
  app.get('/connect/local', (req, res) => {
    res.render('connect-local.ejs', { message: req.flash('loginMessage') });
  });

  app.post('/connect/local', passport.authenticate('local-signup', {
    successRedirect: '/profile', // redirect to the secure profile section
    failureRedirect: '/connect/local', // redirect back to the signup page if there is an error
    failureFlash: true // allow flash messages
  }));

  // =============================================================================
  // UNLINK ACCOUNTS =============================================================
  // =============================================================================
  // used to unlink accounts. for social accounts, just remove the token
  // for local account, remove email and password
  // user account will stay active in case they want to reconnect in the future

  // local -----------------------------------
  app.get('/account/remove', isLoggedIn, (req, res) => {
    req.user.remove((err) => {
      res.redirect('/logout');
    });
  });

  // =============================================================================
  // UPDATE PROFILE ==============================================================
  // =============================================================================
  app.post('/account/update', isLoggedIn, (req, res) => {
    const { user } = req;
    const {
      username,
      address,
      taste,
      lastfm,
      country,
      shipToMany,
      shipAbroad
    } = req.body;

    user.username = username;
    user.address = address;
    user.taste = taste;
    user.lastfm = lastfm;
    user.country = country;
    user.shipToMany = shipToMany === 'on';
    user.shipAbroad = shipAbroad === 'on';

    user.save(() => {
      req.flash('profileMessage', 'Succesfully updated your information.');
      res.redirect('/profile');
    });
  });

  // =============================================================================
  // JOIN ROUND ==================================================================
  // =============================================================================

  app.get('/round/join', isLoggedIn, (req, res) => {
    const signup = new UserMatch.model();

    const { user } = req;

    if (!user) return;

    if (!user.address || !user.username) {
      req.flash('profileMessage', 'Add at least your Reddit username and address to join this round.');
      res.redirect('/profile');
      return;
    }

    signup.matchId = currentRound.id;
    user.matches.push(signup);

    user.save(() => {
      req.flash('profileMessage', 'You\'re now signed up to the latest round! Keep an eye on the subreddit and this site for announcements.');
      res.redirect('/profile');
    });
  });

  // remove the current round from the users list of people
  app.get('/round/remove', isLoggedIn, (req, res) => {
    const { user } = req;
    user.matches.forEach((match, i) => {
      if (currentRound.id.toString() === match.matchId.toString()) {
        user.matches.splice(i, 1);
      }
    });

    user.save(() => {
      req.flash('profileMessage', 'You\'ve been removed from the latest round.');
      res.redirect('/profile');
    });
  });

  // =============================================================================
  // ADMIN ACTIONS ===============================================================
  // =============================================================================
  app.post('/create/round', isAdmin, (req, res) => {
    const round = new Round();

    round.title = req.body.name;
    round.deadlines.signup = new Date(req.body.signup);
    round.deadlines.post = new Date(req.body.post);

    if (req.body.start) round.announced = new Date(req.body.start);

    round.save((err) => {
      if (!err) {
        req.flash('adminMessage', `Succesfully created match ${ round.title }.`);
        res.redirect('/admin');
      } else {
        req.flash('adminMessage', `There was an error: ${ err }`);
        res.redirect('/admin');
      }
    });
  });

  app.post('/create/post', isAdmin, (req, res) => {
    const post = new Post();

    const { title, body } = req.body;

    post.title = title;
    post.body = body;
    post.author = req.user.username;

    post.save((err) => {
      if (!err) {
        req.flash('adminMessage', 'Succesfully created post.');
        res.redirect('/admin');
      } else {
        req.flash('adminMessage', `There was an error: ${ err }`);
        res.redirect('/admin');
      }
    });
  });
};