from flask import Flask, redirect, url_for, session, request, render_template
from flask_oauthlib.client import OAuth

app = Flask(__name__)
app.secret_key = 'RANDOM_SECRET_KEY'  # Change to a random secret key

oauth = OAuth(app)
spotify = oauth.remote_app(
    'spotify',
    consumer_key='YOUR_SPOTIFY_CLIENT_ID',
    consumer_secret='YOUR_SPOTIFY_CLIENT_SECRET',
    request_token_params={'scope': 'user-read-playback-state user-modify-playback-state'},
    base_url='https://api.spotify.com/v1/',
    request_token_url=None,
    access_token_method='POST',
    access_token_url='https://accounts.spotify.com/api/token',
    authorize_url='https://accounts.spotify.com/authorize'
)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/login')
def login():
    return spotify.authorize(callback=url_for('authorized', _external=True))

@app.route('/logout')
def logout():
    session.pop('oauth_token', None)
    return redirect(url_for('home'))

@app.route('/login/authorized')
def authorized():
    resp = spotify.authorized_response()
    if resp is None or resp.get('access_token') is None:
        return 'Access denied: reason={0} error={1}'.format(
            request.args['error_reason'],
            request.args['error_description']
        )
    session['oauth_token'] = (resp['access_token'], '')
    return redirect(url_for('home'))

@spotify.tokengetter
def get_spotify_oauth_token():
    return session.get('oauth_token')

@app.route('/play')
def play_music():
    # Example: Playing music
    spotify.request('me/player/play', method='PUT')
    return 'Music playback started'

@app.route('/pause')
def pause_music():
    # Example: Pausing music
    spotify.request('me/player/pause', method='PUT')
    return 'Music playback paused'


# Other routes and logic...

if __name__ == '__main__':
    app.run(debug=True)
