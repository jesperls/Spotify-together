const axios = require('axios');

async function getUserQueue(accessToken) {
    try {
        const response = await axios.get('https://api.spotify.com/v1/me/player/queue', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.data.queue;
    } catch (error) {
        console.error('Error fetching user queue:', error);
    }
}

module.exports = { getUserQueue };
