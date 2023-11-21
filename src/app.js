const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const SpotifyWebApi = require("spotify-web-api-node");
const queue = require("./queue/queue");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the 'public' folder
app.use(express.static("public"));
app.use(express.json());

const session = require("express-session");

io.on("connection", (socket) => {
  console.log("A client connected");

  socket.on("join-room", (data) => {
    console.log(`Client ${socket.id} joined room ${data.roomName}`);
    socket.leaveAll();
    socket.join(data.roomName);
  });

  socket.on("disconnect", () => {
    console.log("A client disconnected");
  });
});

app.use(
  session({
    secret: process.env.APP_SECRET, // Use a secret key for your session, you
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

/*
  Callback endpoint for Spotify auth.
*/
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

/*
  Returns a JSON object with the current track info.
*/
app.get("/current-track", async (req, res) => {
  if (req.session.spotifyTokens) {
    const spotifyApi = new SpotifyWebApi({
      accessToken: req.session.spotifyTokens.accessToken,
    });

    try {
      const trackData = await spotifyApi.getMyCurrentPlaybackState();
      if (trackData.body && trackData.body.item) {
        const trackName = trackData.body.item.name;
        const artistName = trackData.body.item.artists
          .map((artist) => artist.name)
          .join(", ");
        const progressMs = trackData.body.progress_ms;
        const trackUri = trackData.body.item.uri;
        const playbackState = trackData.body.is_playing;
        const timeSent = Date.now();

        res.json({
          track: trackName,
          artist: artistName,
          progressMs: progressMs,
          trackUri: trackUri,
          playbackState: playbackState,
          timeSent: timeSent,
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

/*
  Broadcasts the track info and queue to every user in the room.
*/
app.post("/broadcast-track", async (req, res) => {
  if (req.session.spotifyTokens && req.session.roomName) {
    hostQueue = await queue.getUserQueue(req.session.spotifyTokens.accessToken);
    io.to(req.session.roomName).emit("master-track-updated", { "current": req.body, "queue": hostQueue});
    res.status(200).send("Track info broadcasted");
  } else {
    res.status(401).send("User not authenticated");
  }
});

/*
  Searches for a track and returns the track URI of the first result.
*/
app.post("/search", async (req, res) => {
  if (req.session.spotifyTokens) {
    const spotifyApi = new SpotifyWebApi({
      accessToken: req.session.spotifyTokens.accessToken,
    });
    try {
      const data = await spotifyApi.searchTracks(req.body.trackName);
      res.status(200).send(data.body.tracks.items[0].uri);
    } catch (err) {
      console.error(err);
      res.status(500).send(err);
    }
  } else {
    res.status(401).send("User not authenticated");
  }
});

/*
  Emits an event to all clients in the room to add the track to their queue,
  if the receiver then is the host, the host will call add-to-queue to add the
  track to their queue.
*/
app.post("/client-to-queue", async (req, res) => {
  if (req.session.spotifyTokens && req.session.roomName) {
    io.to(req.session.roomName).emit("add-to-queue", req.body);
    res.status(200).send("Added to queue");
  } else {
    res.status(401).send("User not authenticated or no room name available");
  }
});

/*
  Adds the track to the host's queue.
*/
app.post("/add-to-queue", async (req, res) => {
  if (req.session.spotifyTokens) {
    const spotifyApi = new SpotifyWebApi({
      accessToken: req.session.spotifyTokens.accessToken,
    });
    try {
      await spotifyApi.addToQueue(req.body.trackUri);
      res.send("Added to queue");
    } catch (err) {
      console.error(err);
      res.status(500).send(err);
    }
  } else {
    res.status(401).send("User not authenticated");
  }
});

/*
  Syncs the client's track with the master track with some
  minor time correction.
*/
app.post("/sync-track", async (req, res) => {
  if (req.session.spotifyTokens && req.session.roomName) {
    const spotifyApi = new SpotifyWebApi({
      accessToken: req.session.spotifyTokens.accessToken,
    });
    data = req.body;
    try {
      if (data.playbackState) {
        await spotifyApi.play({
          uris: [data.trackUri],
          position_ms: data.progressMs + (Date.now() - data.timeSent),
        });
      }
      else {
        await spotifyApi.pause();
      }
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

/*
  Joins a room.
*/
app.post("/join-room", async (req, res) => {
  req.session.roomName = req.body.roomName;
  req.session.save((err) => {
    if (err) {
      console.log(err);
      res.status(500).send("Could not save session");
    } else {
      console.log(req.session.roomName);
      res.send("Joined room " + req.body.roomName);
    }
  });
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
