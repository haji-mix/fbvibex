'use strict';

const axios = require('axios');
const log = require('npmlog');

const agent = atob("ZmFjZWJvb2tleHRlcm5hbGhpdC8xLjEgKCtodHRwOi8vd3d3LmZhY2Vib29rLmNvbS9leHRlcm5hbGhpdF91YXRleHQucGhwKQ==");

// Credits: Kenneth Panio
// If the original credits are changed or removed, this module will no longer receive future updates.

/**
 * Extracts an access token from a Facebook cookie.
 *
 * @param {string} cookie - The Facebook cookie.
 * @returns {Promise<string>} - The extracted access token.
 * @throws {Error} - If the token extraction fails.
 */

async function extractAccessToken(cookie) {
    try {
        const tokenResponse = await axios.get(
            "https://business.facebook.com/business_locations",
            {
                headers: {
                    "user-agent": agent,
                    "cookie": cookie
                }
            }
        );

        const tokenMatch = tokenResponse.data.match(/EAAG\w+/);
        if (!tokenMatch) {
            throw new Error('Failed to retrieve access token. Invalid or expired cookie.');
        }
        return tokenMatch[0];
    } catch (error) {
        throw new Error(`Token extraction failed: ${error.message}`);
    }
}

module.exports = function (defaultFuncs, api, ctx) {
    return async function postVideo(videoUrl, caption, cookieorToken) {
        try {
      
            if (!videoUrl || !caption || !cookieorToken) {
                throw new Error('Missing required parameters: videoUrl, caption, or cookie/token.');
            }

            let accessToken = cookieorToken;

    
            if (!cookieorToken.startsWith('EAAG')) {
                accessToken = await extractAccessToken(cookieorToken);
            }

            const uploadResponse = await axios.post(
                'https://graph-video.facebook.com/me/videos',
                {
                    access_token: accessToken,
                    file_url: videoUrl,
                    description: caption,
                },
                {
                    headers: {
                        "User-Agent": agent,
                        "Content-Type": "application/json",
                        "cookie": accessToken.startsWith('EAAG') ? '' : accessToken
                    },
                }
            );

            if (!uploadResponse.data.id) {
                throw new Error('Failed to upload video: No video ID returned.');
            }

            const videoId = uploadResponse.data.id;
            log.info('postVideo', `Video uploaded successfully. Video ID: ${videoId}`);

            // Post the video to the timeline
            const postResponse = await axios.post(
                'https://graph.facebook.com/me/feed',
                {
                    access_token: accessToken,
                    attached_media: [{ media_fbid: videoId }],
                },
                {
                    headers: {
                        "User-Agent": agent,
                        "Content-Type": "application/json",
                        "cookie": accessToken.startsWith('EAAG') ? '' : accessToken
                    },
                }
            );

            if (!postResponse.data.id) {
                throw new Error('Failed to post video to timeline: No post ID returned.');
            }

            const postId = postResponse.data.id;
            log.info('postVideo', `Video posted to timeline successfully. Post ID: ${postId}`);

            return {
                success: true,
                videoId,
                postId,
            };
        } catch (error) {
            log.error('postVideo', error.response?.data || error.message || error);

            return {
                success: false,
                error: error.response?.data?.error?.message || error.message || 'An unknown error occurred',
            };
        }
    };
};