'use strict';

const axios = require('axios');
const log = require('npmlog');

// Credits: Kenneth Panio
// If the original credits are changed or removed, this module will no longer receive future updates.

// Note: The shared post can be configured to be visible or invisible depending on the privacy settings.
const agent = atob("ZmFjZWJvb2tleHRlcm5hbGhpdC8xLjEgKCtodHRwOi8vd3d3LmZhY2Vib29rLmNvbS9leHRlcm5hbGhpdF91YXRleHQucGhpKQ==");

/**
 * Converts a cookie input (JSON array, object, or string) to a cookie string.
 * @param {string|Array|Object} cookieInput - The cookie input to convert.
 * @returns {string} - The cookie string in the format "key1=value1; key2=value2".
 */
function cookieToString(cookieInput) {
    try {
      if (typeof cookieInput === "string" && cookieInput.trim()) {
        try {
          const parsed = JSON.parse(cookieInput);
          if (Array.isArray(parsed)) {
            const importantKeys = new Set([
              "datr",
              "sb",
              "ps_l",
              "ps_n",
              "m_pixel_ratio",
              "c_user",
              "fr",
              "xs",
              "i_user",
              "locale",
              "fbl_st",
              "vpd",
              "wl_cbv",
            ]);
            return parsed
              .map((val) =>
                val.cookieString ? val.cookieString() : `${val.key || val.name}=${val.value}`
              )
              .map((cookie) => cookie.split(";")[0])
              .filter(Boolean)
              .filter((cookie) => importantKeys.has(cookie.split("=")[0]))
              .join("; ");
          } else if (typeof parsed === "object" && parsed !== null) {
            return Object.entries(parsed)
              .filter(([key, value]) => key && value)
              .map(([key, value]) => `${key}=${value}`)
              .join("; ");
          }
        } catch (jsonError) {
          return cookieInput
            .trim()
            .replace(/[\r\n\t\0-\x1F\x7F]+/g, "")
            .replace(/;{2,}/g, ";")
            .replace(/;+\s*$/, "");
        }
      }
      if (Array.isArray(cookieInput)) {
        const importantKeys = new Set([
          "datr",
          "sb",
          "ps_l",
          "ps_n",
          "m_pixel_ratio",
          "c_user",
          "fr",
          "xs",
          "i_user",
          "locale",
          "fbl_st",
          "vpd",
          "wl_cbv",
        ]);
        return cookieInput
          .map((val) =>
            val.cookieString ? val.cookieString() : `${val.key || val.name}=${val.value}`
          )
          .map((cookie) => cookie.split(";")[0])
          .filter(Boolean)
          .filter((cookie) => importantKeys.has(cookie.split("=")[0]))
          .join("; ");
      } else if (typeof cookieInput === "object" && cookieInput !== null) {
        return Object.entries(cookieInput)
          .filter(([key, value]) => key && value)
          .map(([key, value]) => `${key}=${value}`)
          .join("; ");
      }
      return "";
    } catch (err) {
      return "";
    }
  }

/**
 * Share a post on Facebook using a cookie to fetch an access token.
 *
 * @param {string} postUrl - The URL of the post to be shared.
 * @param {string|Array|Object} cookie - A valid Facebook cookie (string, JSON array, or object) to fetch the access token.
 * @param {number} [shareAmount=1] - The number of times to share the post (default is 1).
 * @param {number} [intervalSeconds=0] - The interval in seconds between each share (default is 0, no interval).
 * 
 * @returns {Promise<Object>} - Returns an object with success status, post IDs, and share count or an error message.
 *
 * @example
 * // Share a post once with no interval using a cookie string (visible only to you)
 * sharePost('https://example.com', 'cookie1=value1; cookie2=value2');
 *
 * @example
 * // Share a post using a JSON array cookie
 * sharePost('https://example.com', [{key: 'cookie1', value: 'value1'}, {key: 'cookie2', value: 'value2'}]);
 *
 * @example
 * // Share a post 5 times with a 2-second interval using a cookie (visible to friends)
 * sharePost('https://example.com', [{key: 'cookie1', value: 'value1'}], 5, "ALL_FRIENDS", 2);
 */
module.exports = function (defaultFuncs, api, ctx) {
    return async function sharePost(postUrl, cookie, shareAmount = 1, intervalSeconds = 0) {
        let shareCount = 0;

        try {
            if (!postUrl || !cookie) {
                throw new Error('Missing required parameters: postUrl or cookie');
            }

            // Convert cookie (string, array, or object) to string
            const appstate = cookieToString(cookie);
            if (!appstate) {
                throw new Error('Invalid cookie format provided');
            }

            // Fetch access token using cookie
            const tokenResponse = await axios.get(
                "https://business.facebook.com/business_locations",
                {
                    headers: {
                        "user-agent": agent,
                        "cookie": appstate
                    }
                }
            );

            const tokenMatch = tokenResponse.data.match(/EAAG\w+/);
            if (!tokenMatch) {
                throw new Error('Failed to retrieve access token. Invalid or expired cookie.');
            }
            const accessToken = tokenMatch[0];

            const url = "https://graph.facebook.com/v22.0/me/feed";

            const headers = {
                "authority": "graph.facebook.com",
                "cache-control": "max-age=0",
                "sec-ch-ua-mobile": "?0",
                "user-agent": agent,
                "content-type": "application/x-www-form-urlencoded",
                "authorization": `Bearer ${accessToken}`,
                "cookie": appstate
            };

            const postIds = [];

            for (let i = 0; i < shareAmount; i++) {
                const payload = {
                    link: postUrl,
                    published: 0,
                    limit: 1,
                    fields: "id",
                    privacy: { value: "SELF" },
                    no_story: true
                };

                const response = await axios.post(url, payload, { headers });

                if (response.data.id) {
                    shareCount++;
                    log.info('sharePost', `Share ${shareCount}/${shareAmount}: Post shared successfully: ${response.data.id}`);
                    postIds.push(response.data.id);
                } else {
                    log.error('sharePost', `Share ${shareCount + 1}/${shareAmount}: Failed to share post: No post ID returned.`);
                }

                if (intervalSeconds > 0 && i < shareAmount - 1) {
                    await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
                }
            }

            return { success: true, postIds, shareCount };
        } catch (error) {
            log.error('sharePost', error.response?.data || error.message || error);

            return {
                success: false,
                error: error.response?.data?.error?.message || error.message || 'An unknown error occurred',
                shareCount
            };
        }
    };
};