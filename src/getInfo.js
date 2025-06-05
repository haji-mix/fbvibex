"use strict";

const axios = require('axios');
const log = require("npmlog");
const utils = require('../utils');

function formatProfileData(data, userID) {
  if (!data.name) {
    return {
      name: null,
      userid: null,
      profile_img: null,
      profile_url: null,
    };
  }

  return {
    name: data.name,
    userid: userID,
    profile_img: `https://graph.facebook.com/${userID}/picture?width=1500&height=1500&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
    profile_url: `https://facebook.com/${userID}`,
  };
}

function fetchProfileData(userID, retryCount, callback) {
  axios
    .get(`https://www.facebook.com/profile.php?id=${userID}`, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://www.facebook.com/",
        "User-Agent": utils.generateUserAgent(),
        "Connection": "keep-alive",
        "Host": "www.facebook.com",
        "Origin": "https://www.facebook.com",
        "sec-fetch-site": "same-origin",
        "Sec-Fetch-User": "?1",
      },
      maxRedirects: 5,
    })
    .then((response) => {
      if (response.status === 302 || response.request.res.statusCode === 302) {
        if (retryCount < 3) {
          setTimeout(() => {
            fetchProfileData(userID, retryCount + 1, callback);
          }, 1000);
        } else {
          callback(null, null); // Return null after max retries
        }
        return;
      }

      const titleMatch = response.data.match(/<title>(.*?)<\/title>/);
      if (!titleMatch || titleMatch[1].includes("Redirecting...")) {
        if (retryCount < 3) {
          setTimeout(() => {
            fetchProfileData(userID, retryCount + 1, callback);
          }, 1000);
        } else {
          callback(null, null); // Return null after max retries
        }
        return;
      }

      const profileData = formatProfileData(
        {
          name: titleMatch[1].trim(),
        },
        userID
      );

      if (profileData.name && profileData.name.includes("Facebook") && retryCount < 3) {
        setTimeout(() => {
          fetchProfileData(userID, retryCount + 1, callback);
        }, 1000);
        return;
      }

      callback(null, profileData);
    })
    .catch((err) => {
      if (err.message.includes('Unsupported protocol intent')) {
        callback(null, null); // Return null for unsupported protocol
      } else {
        callback(err, null); // Return null with error
      }
    });
}

module.exports = (defaultFuncs, api, ctx) => {
  return function getInfo(id, callback) {
    const userID = id || ctx.userID;

    if (!callback) {
      return new Promise((resolve, reject) => {
        const finalCallback = (err, profileData) => {
          if (err) {
            return reject(err);
          }
          resolve(profileData);
        };
        fetchProfileData(userID, 0, finalCallback);
      });
    } else {
      fetchProfileData(userID, 0, callback);
    }
  };
};