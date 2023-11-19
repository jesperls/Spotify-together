function login() {
  window.location.href = "/login";
}

function logout() {
  fetch("/logout")
    .then(() => {
      document.getElementById("user-info").innerText = "Not logged in";
      // Optionally, reset the current track info
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

// Add a function to update user info on page load
function fetchUserInfo() {
  fetch("/user-info")
    .then((response) => response.json())
    .then((data) => {
      if (data.user) {
        document.getElementById(
          "user-info"
        ).innerText = `Logged in as ${data.user}`;
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
        const progress = formatProgress(data.progressMs);
        document.getElementById(
          "current-track"
        ).innerText = `Now playing: ${data.track} by ${data.artist} - ${progress}`;

        if (document.getElementById("master-checkbox").checked) {
          broadcastCurrentTrack(data);
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

function formatProgress(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

function syncWithMaster(trackData) {
  if (document.getElementById("master-checkbox").checked) {
    return; // Do not sync if the user is the master
  }

  // Fetch current user's track
  fetch("/current-track")
    .then((response) => response.json())
    .then((userData) => {
      if (userData.track) {
        if (trackData.track && trackData.trackUri !== userData.trackUri) {
          // Do not sync if the tracks are the same
          fetch("/sync-track")
            .then((response) => response.text())
            .then((message) => {
              console.log(message);
            })
            .catch((error) =>
              console.error("Error syncing with master track:", error)
            );
          return;
        }
      } else {
        // Sync if the user is not playing anything
        fetch("/sync-track")
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

setInterval(updateCurrentTrack, 5000);
fetchUserInfo();
updateCurrentTrack();
