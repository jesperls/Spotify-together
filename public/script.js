let role = "neither";
let roomName = null;
const socket = io();

socket.on("master-track-updated", (trackData) => {
  syncWithMaster(trackData);
});

socket.on("add-to-queue", (trackData) => {
  if (role === "host") {
    fetch("/add-to-queue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trackUri: trackData.uri }),
    })
      .then((response) => response.text())
      .then((message) => {
        console.log(message);
      })
      .catch((error) => console.error("Error adding to queue:", error));
  }
});

function login() {
  window.location.href = "/login";
}

function logout() {
  fetch("/logout")
    .then(() => {
      document.getElementById("user-info").innerText = "Not logged in";
      document.getElementById("current-track").innerText = "No track playing";
    })
    .catch((error) => console.error("Logout failed:", error));
}

function playMusic() {
  fetch("/play");
}

function pauseMusic() {
  fetch("/pause");
}

function nextTrack() {
  fetch("/next");
}

function previousTrack() {
  fetch("/previous");
}

function fetchUserInfo() {
  fetch("/user-info")
    .then((response) => response.json())
    .then((data) => {
      if (data.user) {
        document.getElementById(
          "user-info"
        ).innerText = `Logged in as ${data.user}`;
        setInterval(updateCurrentTrack, 5000);
        updateCurrentTrack();
      } else {
        document.getElementById("user-info").innerText = "Not logged in";
      }
    })
    .catch((error) => {
      console.error("Error fetching user info:", error);
      document.getElementById("user-info").innerText =
        "Error fetching user info";
    });
}

function updateCurrentTrack() {
  fetch("/current-track")
    .then((response) => response.json())
    .then((data) => {
      if (data.track) {
        document.getElementById(
          "current-track"
        ).innerText = `Now playing: ${data.track} by ${data.artist}`;

        if (role === "host" && roomName !== null) {
          broadcastCurrentTrack(data); // Broadcast current track to clients
        }
      } else {
        document.getElementById("current-track").innerText = "No track playing";
      }
    })
    .catch((error) => console.error("Error fetching current track:", error));
}

function broadcastCurrentTrack(trackData) {
  fetch("/broadcast-track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(trackData),
  });
}

function syncWithMaster(hostData) {
  trackData = hostData["current"];
  if (hostData["queue"] && hostData["queue"].length > 0) {
    updateQueue(hostData["queue"]);
  }
  if (role !== "client") {
    return; // Do not sync if the user is not a client
  }
  // Fetch current user's track
  fetch("/current-track")
    .then((response) => response.json())
    .then((userData) => {
      const isTrackDataAvailable = trackData.track;
      const isTrackChanged = userData.track !== trackData.track;
      const isProgressDifferenceSignificant =
        Math.abs(userData.progressMs - trackData.progressMs) > 1000;
      if (
        isTrackDataAvailable &&
        (isTrackChanged || isProgressDifferenceSignificant)
      ) {
        fetch("/sync-track", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(trackData),
        })
          .then((response) => response.text())
          .then((message) => {
            console.log(message);
          })
          .catch((error) =>
            console.error("Error syncing with master track:", error)
          );
      }
    })
    .catch((error) => console.error("Error fetching user track:", error));
}

function updateQueue(queue) {
  const queueElement = document.getElementById("queue");
  while (queueElement.firstChild) {
    queueElement.removeChild(queueElement.firstChild);
  }
  queue.forEach((track) => {
    const trackElement = document.createElement("div");
    trackElement.innerText = track.name;
    trackElement.classList.add("queue-track");
    queueElement.appendChild(trackElement);
  });
}

function addToQueue() {
  const trackName = document.getElementById("queue-input").value;
  if (!trackName) {
    alert("Please enter a track URI");
    return;
  }
  fetch("/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trackName: trackName }),
  })
    .then((response) => response.text())
    .then((response) => {
      fetch("/client-to-queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uri: response }),
      })
        .then((response) => response.text())
        .then((message) => {
          console.log(message);
        })
        .catch((error) => console.error("Error adding to queue:", error));
    });
}

function setRole(newRole) {
  document
    .querySelectorAll(".toggle-switch")
    .forEach((el) => el.classList.remove("active"));
  document.querySelector("#" + newRole + "-toggle").classList.add("active");
  role = newRole;
}

function joinRoom() {
  const roomInput = document.getElementById("room-name").value;
  roomName = roomInput;
  if (!roomInput) {
    alert("Please enter a room name");
    return;
  }
  fetch("/join-room", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ roomName: roomInput }),
  })
    .then((response) => response.text())
    .then((message) => {
      console.log(message);
      socket.emit("join-room", { roomName: roomInput });
      document.getElementById("room-info").innerText = `Room: ${roomInput}`;
    })
    .catch((error) => console.error("Error joining room:", error));
}

setRole("neither");
fetchUserInfo();
