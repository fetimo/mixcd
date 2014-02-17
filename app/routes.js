
module.exports = function(app, passport) {

	var Round = require('../app/models/round');
	var Users = require('../app/models/user');

	var currentRound;
	var setCurrentRound = function () {
		Round.findOne({ 'deadlines.post': { $gt: Date.now() } }, function (err, round) {
			if (!round) return;
			var moment = require('moment');
			currentRound = {
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
			    total: Users.count( { 'matches.matchId': round._id })
			};
		});
	};
	setCurrentRound();

// normal routes ===============================================================

	// show the home page
	app.get('/', function(req, res) {
		var Post = require('../app/models/post');
		res.render('index.ejs', {
			post: Post.findOne({}, {}, { sort: { '_id' : -1 } }),
			user: req.user
		});
	});

	// PROFILE SECTION =========================
	app.get('/profile', isLoggedIn, function(req, res) {
		var user = req.user;

		if (user.matches.length) {
			res.render('profile.ejs', {
				user: user,
				pairs: Users.where({ 'matches.matchId': currentRound.id }).where('_id').in(user.currentRound(currentRound.id).pair).select('username'),
				round: currentRound,
				message: req.flash('profileMessage')
			});
		}
	});

	app.get('/user/:username', isLoggedIn, function(req, res) {
		var you = req.user;
		
		//do look up on username, find user ID then see if it matches one of your pairs
		//find current match
		if (you.username !== req.params.username) {
			Round.findOne({ 'deadlines.post': { $gt: Date.now() }  }, function (err, round) {
				if (err) console.log(err);

				res.render('user.ejs', {
					user: Users.findOne({ username: req.params.username }).where( { 'matches.matchId': round._id } ).where({ 'matches.pair': you._id }).select('username address taste').exec()
				});
			});
		} else {
			//you've gone to your own profile
			res.render('user.ejs', {
				user: you
			});
		}
	});

	app.get('/admin', isAdmin, function(req, res) {
		setCurrentRound();
		res.render('admin.ejs', {
			user: req.user,
			round: currentRound,
			message: req.flash('adminMessage')
		});
	});

	app.get('/pair', isAdmin, function(req, res) {
		var pairing = require('./pair.js');
		Round.findOne({ 'deadlines.post': { $gt: Date.now() } }, function (err, round) {
			round.paired = true;
			round.save();
		});
		res.render('pair.ejs', {
			pair: pairing
		});
	});

	// LOGOUT ==============================
	app.get('/logout', function(req, res) {
		req.logout();
		res.redirect('/');
	});

// =============================================================================
// AUTHENTICATE (FIRST LOGIN) ==================================================
// =============================================================================

	// locally --------------------------------
	// LOGIN ===============================
	// show the login form
	app.get('/login', function(req, res) {
		if (req.isAuthenticated()) {
			res.redirect('/profile');
		} else {
			res.render('login.ejs', { message: req.flash('loginMessage') });
		}
	});

	// process the login form
	app.post('/login', passport.authenticate('local-login', {
		successRedirect : '/profile', // redirect to the secure profile section
		failureRedirect : '/login', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

	// SIGNUP =================================
	// show the signup form
	app.get('/signup', function(req, res) {
		res.render('signup.ejs', { message: req.flash('loginMessage') });
	});

	// process the signup form
	app.post('/signup', passport.authenticate('local-signup', {
		successRedirect : '/profile', // redirect to the secure profile section
		failureRedirect : '/signup', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

// =============================================================================
// AUTHORIZE (ALREADY LOGGED IN / CONNECTING OTHER SOCIAL ACCOUNT) =============
// =============================================================================

	// locally --------------------------------
	app.get('/connect/local', function(req, res) {
		res.render('connect-local.ejs', { message: req.flash('loginMessage') });
	});

	app.post('/connect/local', passport.authenticate('local-signup', {
		successRedirect : '/profile', // redirect to the secure profile section
		failureRedirect : '/connect/local', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

// =============================================================================
// UNLINK ACCOUNTS =============================================================
// =============================================================================
// used to unlink accounts. for social accounts, just remove the token
// for local account, remove email and password
// user account will stay active in case they want to reconnect in the future

	// local -----------------------------------
	app.get('/account/remove', isLoggedIn, function(req, res) {
		req.user.remove(function(err) {
			res.redirect('/logout');
		});
	});

// =============================================================================
// UPDATE PROFILE ==============================================================
// =============================================================================
	app.post('/account/update', isLoggedIn, function(req, res) {
		var user = req.user;
		user.username = req.body.username;
		user.address = req.body.address;
		user.taste = req.body.taste;
		user.lastfm = req.body.lastfm;
		user.country = req.body.country;
		user.shipToMany = req.body.shipToMany;
		user.shipAbroad = req.body.shipAbroad;
		
		user.save(function(err) {
			req.flash('profileMessage', 'Succesfully updated your information.')
			res.redirect('/profile');
		});
	});

// =============================================================================
// JOIN ROUND ==================================================================
// =============================================================================

	app.get('/round/join', isLoggedIn, function(req, res) {
		var UserMatch = require('../app/models/user-match'),
			signup = new UserMatch.model(),
			user = req.user;

		if (!user) return;

		if (!user.address || !user.username) {
			req.flash('profileMessage', 'Add at least your Reddit username and address to join this round.');
			res.redirect('/profile');
			return;
		}

		signup.matchId = currentRound.id;
		user.matches.push(signup);

		user.save(function(err, data) {
			req.flash('profileMessage', 'You\'re now signed up to the latest round! Keep an eye on the subreddit and this site for announcements.');
			res.redirect('/profile');
		});
	});

	//remove the current round from the users list of people
	app.get('/round/remove', isLoggedIn, function(req, res) {
		var user = req.user;
		user.matches.forEach(function(match, i) {
			if (currentRound.id.toString() === match.matchId.toString()) {
				user.matches.splice(i, 1);
			}
		});

		user.save(function(err, data) {
			req.flash('profileMessage', 'You\'ve been removed from the latest round.');
			res.redirect('/profile');
		});
	});

// =============================================================================
// ADMIN ACTIONS ===============================================================
// =============================================================================
	app.post('/create/round', isAdmin, function(req, res) {
		var round = new Round();

		round.title = req.body.name;
		round.deadlines.signup = new Date(req.body.signup);
		round.deadlines.post = new Date(req.body.post);

		if (req.body.start) round.announced = new Date(req.body.start);

		round.save(function(err) {
			if (!err) {
				req.flash('adminMessage', 'Succesfully created match ' + round.title + '.')
				res.redirect('/admin');
			} else {
				req.flash('adminMessage', 'There was an error: ' + err)
				res.redirect('/admin');
			}
		});
	});

	app.post('/create/post', isAdmin, function(req, res) {
		var Post = require('../app/models/post');
		var post = new Post();

		post.title = req.body.title;
		post.body = req.body.body;
		post.author = req.user.username;

		post.save(function(err) {
			if (!err) {
				req.flash('adminMessage', 'Succesfully created post.')
				res.redirect('/admin');
			} else {
				req.flash('adminMessage', 'There was an error: ' + err)
				res.redirect('/admin');
			}
		});
	});
};

// route middleware to ensure user is logged in
function isLoggedIn (req, res, next) {
	if (req.isAuthenticated())
		return next();

	res.redirect('/');
}

function isAdmin (req, res, next) {
	if (req.isAuthenticated() && req.user.admin)
		return next();

	res.redirect('/');
}
