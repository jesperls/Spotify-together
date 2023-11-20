# Spotify-together
Welcome to Spotify-together, a Node.js server application that lets users connect and enjoy Spotify music together in real time. Perfect for virtual listening parties or sharing a music experience with friends, Spotify-together brings people together through music.

Demo site is hosted at [https://darkrage.pro](https://darkrage.pro/)

## Features
* Real-time music streaming with friends.
* Host and client roles for shared listening experiences.
* Integration with Spotify's Web API and Web Playback SDK for seamless music control and playback.

## Prerequisites
Before starting, ensure you have the following:

* Node.js installed on your machine.
* A Spotify Developer account and a created Spotify app with access to the Web API and Web Playback SDK.

## Installation
### Step 1: Setting Up Spotify Developer Application
1. Log in to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Create a new application.
3. Note down the SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.
4. Set the REDIRECT_URI in your Spotify app settings to http://localhost:3000/callback (or your preferred callback address).
5. Add any users wanting to use the application in the User Management tab.

### Step 2: Configuring the Server
1. Clone the repository:
```
git clone https://github.com/jesperls/Spotify-together.git
```
2. Navigate to the cloned directory:
```
cd Spotify-together
```
3. Create a .env file in the root of the project and populate it with the following variables:
```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
REDIRECT_URI=http://localhost:3000/callback (or your preferred callback address)
```
### Step 3: Installing Dependencies and Running the Server
1. Install the required Node modules:
```
npm install
```
2. Start the server:
```
npm start
```
The server will start running on http://localhost:3000.

### Step 4: Building and running the server as a webpack (optional)
1. Build the webpack:
```
npm run build
```
2. Run the webpack:
```
npm run babel
```

## Usage
After starting the server and navigating to http://localhost:3000, log in with your Spotify account. You will then have the option to choose between being a host, a client, or neither:

* **Host**: As a host, your music is streamed to all connected clients. Whenever you switch songs, the music is synced up across all listeners.
* **Client**: As a client, you can join a host's session and listen to the music they are playing in real time.
* **Neither**: This option allows you to explore the application without participating in a music session.

