# Inside Color Wheel

A browser-based interactive color wheel that lets someone stand "inside" the wheel on a phone. The compass controls hue, forward/back tilt controls tint, and side-to-side tilt adjusts saturation. Desktop range controls are included as a fallback for testing.

## Run Locally

```sh
python3 -m http.server 5174
```

Then open `http://localhost:5174`.

Phone motion and compass APIs usually require a secure context. `localhost` works for local testing; hosted phone testing should use HTTPS.
