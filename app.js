const express = require("express");
const http = require('http');
const socketIo = require('socket.io');
const SpotifyWebApi = require("spotify-web-api-node");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server); // Setup Socket.io

// Serve static files from the 'public' folder
app.use(express.static("public"));
app.use(express.json());

const session = require("express-session");

let currentMasterTrack = null;

io.on('connection', (socket) => {
    console.log('A client connected');
  
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('A client disconnected');
    });
  });

app.use(
  session({
    secret: "wowth15IS4secret", // Use a secret key for your session
    resave: false,
    saveUninitialized: true,
    cookie: { secure: !true }, // Set secure to true in production with HTTPS
  })
);

app.get("/login", (req, res) => {
  const spotifyApi = new SpotifyWebApi({
    redirectUri: process.env.REDIRECT_URI,
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });
  const scopes = [
    "user-read-private",
    "user-read-email",
    "streaming",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "user-read-playback-state",
  ];
  const loginUrl = spotifyApi.createAuthorizeURL(scopes);
  res.redirect(loginUrl);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const spotifyApi = new SpotifyWebApi({
      redirectUri: process.env.REDIRECT_URI,
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    });

    const data = await spotifyApi.authorizationCodeGrant(code);
    req.session.spotifyTokens = {
      accessToken: data.body["access_token"],
      refreshToken: data.body["refresh_token"],
    };

    res.redirect("/");
  } catch (err) {
    res.redirect("/#error=" + err.message);
  }
});

app.get("/play", async (req, res) => {
  if (req.session.spotifyTokens) {
    const spotifyApi = new SpotifyWebApi({
      accessToken: req.session.spotifyTokens.accessToken,
    });
    try {
      await spotifyApi.play();
      const track = await spotifyApi.getMyCurrentPlayingTrack();
      res.json({
        track: track.body.item ? track.body.item.name : "No track playing",
      });
    } catch (err) {
      console.error(err);
      res.status(500).send(err);
    }
  } else {
    res.status(401).send("User not authenticated");
  }
});

app.get("/pause", async (req, res) => {
  if (req.session.spotifyTokens) {
    const spotifyApi = new SpotifyWebApi({
      accessToken: req.session.spotifyTokens.accessToken,
    });
    try {
      await spotifyApi.pause();
      res.send("Paused");
    } catch (err) {
      console.error(err);
      res.status(500).send(err);
    }
  } else {
    res.status(401).send("User not authenticated");
  }
});

app.get("/next", async (req, res) => {
  if (req.session.spotifyTokens) {
    const spotifyApi = new SpotifyWebApi({
      accessToken: req.session.spotifyTokens.accessToken,
    });
    try {
      await spotifyApi.skipToNext();
      res.send("Skipped to next");
    } catch (err) {
      console.error(err);
      res.status(500).send(err);
    }
  } else {
    res.status(401).send("User not authenticated");
  }
});

app.get("/previous", async (req, res) => {
  if (req.session.spotifyTokens) {
    const spotifyApi = new SpotifyWebApi({
      accessToken: req.session.spotifyTokens.accessToken,
    });
    try {
      await spotifyApi.skipToPrevious();
      res.send("Skipped to previous");
    } catch (err) {
      console.error(err);
      res.status(500).send(err);
    }
  } else {
    res.status(401).send("User not authenticated");
  }
});

app.get("/user-info", async (req, res) => {
  if (req.session.spotifyTokens) {
    const spotifyApi = new SpotifyWebApi({
      accessToken: req.session.spotifyTokens.accessToken,
    });
    try {
      const data = await spotifyApi.getMe();
      console.log(data);
      res.json({ user: data.body.display_name });
    } catch (err) {
      console.error(err);
      res.json({ user: null });
    }
  } else {
    res.json({ user: null });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Could not log out");
    }
    res.send("Logged out");
  });
});

async function refreshAccessToken(refreshToken) {
  spotifyApi.setRefreshToken(refreshToken);
  try {
    const data = await spotifyApi.refreshAccessToken();
    return data.body["access_token"];
  } catch (err) {
    console.error("Could not refresh access token", err);
  }
}

app.get("/current-track", async (req, res) => {
  if (req.session.spotifyTokens) {
    const spotifyApi = new SpotifyWebApi({
      accessToken: req.session.spotifyTokens.accessToken,
    });

    try {
      const trackData = await spotifyApi.getMyCurrentPlayingTrack();
      if (trackData.body && trackData.body.is_playing) {
        const trackName = trackData.body.item.name;
        const artistName = trackData.body.item.artists
          .map((artist) => artist.name)
          .join(", ");
        const progressMs = trackData.body.progress_ms;
        const trackUri = trackData.body.item.uri; // Get the track URI

        res.json({
          track: trackName,
          artist: artistName,
          progressMs: progressMs,
          trackUri: trackUri, // Include the track URI in the response
        });
      } else {
        res.json({ track: null });
      }
    } catch (err) {
      console.error(err);
      res.status(500).send(err);
    }
  } else {
    res.status(401).send("User not authenticated");
  }
});

app.post("/broadcast-track", (req, res) => {
    if (req.session.spotifyTokens) {
      currentMasterTrack = req.body;
      io.emit('master-track-updated', currentMasterTrack); // Emit to all clients
      res.status(200).send("Track info broadcasted");
    } else {
      res.status(401).send("User not authenticated");
    }
});

app.get("/sync-track", async (req, res) => {
  if (req.session.spotifyTokens && currentMasterTrack) {
    const spotifyApi = new SpotifyWebApi({
      accessToken: req.session.spotifyTokens.accessToken,
    });

    try {
      await spotifyApi.play({
        uris: [currentMasterTrack.trackUri],
        position_ms: currentMasterTrack.progressMs,
      });
      res.send("Synced with master track");
    } catch (err) {
      console.error(err);
      res.status(500).send(err);
    }
  } else {
    res
      .status(401)
      .send("User not authenticated or no master track info available");
  }
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
