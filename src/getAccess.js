'use strict';

const axios = require('axios');
const log = require('npmlog');

//credits Kenneth Panio
// if original credits changed or remove this fca will no longer have a future updates

/**
 * Fetches the Facebook access token using a provided cookie.
 * 
 * @param {string} cookie - The user's authentication cookie.
 * @param {function} [callback] - Optional callback function.
 * @returns {Promise<string>|void} - Returns a promise resolving to the access token or calls the callback.
 */
module.exports = function (defaultFuncs, api, ctx) {
  return async function getAccess(cookie, callback) {
      
    try {
      if (!cookie) throw new Error('Cookie is required');
      
      const response = await axios.get('https://business.facebook.com/business_locations', {
        headers: {
          'User-Agent': atob("ZmFjZWJvb2tleHRlcm5hbGhpdC8xLjEgKCtodHRwOi8vd3d3LmZhY2Vib29rLmNvbS9leHRlcm5hbGhpdF91YXRleHQucGhwKQ=="),
          'Cookie': cookie
        }
      });
      
      const tokenMatch = response.data.match(/(EAAG\w+)/);
      if (!tokenMatch) throw new Error('Access token not found');
      
      const accessToken = tokenMatch[1];
      ctx.access_token = accessToken;
      
      if (typeof callback === 'function') {
        return callback(null, accessToken);
      }
      
      return accessToken;
    } catch (error) {
      log.error('getAccess', error.message || error);
      if (typeof callback === 'function') {
        return callback(error);
      }
    }
  };
};
