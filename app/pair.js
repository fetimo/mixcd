const mongoose = require('mongoose');
const shuffle = require('lodash/shuffle');

const Round = require('../app/models/round');
const Users = require('../app/models/user');
// require('../config/database.js');

/*
* Loop through all people
*
* Make list of those in each country not willing to ship abroad
* Make list of those willing to ship abroad
* In each list go through again and make a new sub-list for users willing to make more than one
*
* Shuffle each list
* Pair off each odd/even person
* Update pairs in database (key = pair, value = [user id, n])
*
* remove from list until no people
* if there is a remainder then look for users to send more than one
* else log person
*/

module.exports = (function () {
  const messages = [];
  return new Promise((resolve) => {
    // get users
    Round.findOne({ 'deadlines.signup': { $lt: Date.now() } }, (err, round) => {
      if (!round) {
        console.info('No round is past signup');
        messages.push('No round is past signup');
        return;
      }

      Users.find({ 'matches.matchId': round._id }, (err, users) => {
        const countries = [];
        const groups = [];
        const abroad = [];

        const save = function (user, pair) {
          user.matches.forEach((match) => {
            if (match.matchId.toString() === round._id.toString()) {
              match.pair.push(pair._id);
            }
          });

          pair.matches.forEach((match) => {
            if (match.matchId.toString() === round._id.toString()) {
              match.pair.push(user._id);
            }
          });

          user.save((e) => {
            if (e) {
              console.error(e);
              messages.push('ERROR: Could not save user');
            }
          });
          pair.save((e) => {
            if (e) {
              console.error(e);
              messages.push('ERROR: Could not save pair');
            }
          });
        };

        users.forEach((user) => {
          user.pair = [];

          if (user.shipAbroad) {
            abroad.push(user);
          }
          if (countries.indexOf(user.country) === -1) {
          // push a new country so we know it's been added
            countries.push(user.country);
            // add the country as a group to the groups list
            groups.push({ country: user.country, members: [user] });
          } else {
          // country/group exists, add user to it
            groups.forEach((item) => {
              if (item.country === user.country) {
                item.members.push(user);
              }
            });
          }
        });

        // shuffle each group
        groups.forEach((item) => {
          shuffle(item.members);
        });

        // pair each person
        groups.forEach((group) => {
          group.members.forEach((member, i) => {
            if (group.members[i + 1]) {
              // pair 2 at a time so we don't encounter any weird errors
              member.pair.push(group.members[i + 1].username);
              group.members[i + 1].pair.push(member.username);
              save(member, group.members[i + 1]);
            } else if (!member.pair.length) {
              // loop through members of country again and see if anyone's willing to shipToMany
              // this is preferable to shipping abroad
              shuffle(group.members);
              for (let j = group.members.length - 1; j >= 0; j--) {
                const mem = group.members[j];
                if (mem.shipToMany && mem.username !== member.username) {
                  mem.pair.push(member.username);
                  member.pair.push(mem.username);
                  save(member, mem);
                  break;
                }
              }

              if (!member.pair.length) {
              // haven't found a pair in own country, try to find one that'll ship abroad
                shuffle(abroad); // make sure we don't always give the same person the rejects
							
                for (let k = abroad.length - 1; k >= 0; k--) {
                  const m = abroad[k];
                  if ((!m.pair.length || m.shipToMany) && m.username !== member.username) {
                    m.pair.push(member.username);
                    member.pair.push(m.username);
                    save(member, m);

                    break;
                  }
                }

                if (!member.pair.length) {
                  // may have to find someone that ships to many and abroad, alert user that action will be needed as prefs not met
                  console.info(`${ member.username } is still lonely`);
                  messages.push(`ACTION: ${ member.username } is still lonely`);
                }
              }
            }
          });
        });

        // see who's paired with who
        groups.forEach((group) => {
          group.members.forEach((member) => {
            console.info(`${ member.username } is with ${ member.pair.join(', ') }`);
            messages.push(`INFO: ${ member.username } is with ${ member.pair.join(', ') }`);
          });
        });

        messages.push('INFO: Pairing completed');

        resolve(messages);
      });
    });
  });
}());