# Peer Tilt Test

Minimal PeerJS test - phone accelerometer controls a box on the display.

## How to run

1. Start a local server:
   ```bash
   cd peer-tilt-test
   npx serve .
   ```

2. Open `http://localhost:3000/display.html` on your computer/projector

3. Scan the QR code with your phone

4. Tap "Start" on your phone and tilt to move the box!

## How it works

- Display creates a PeerJS peer with a room code
- QR code contains URL to controller with room code
- Phone connects to display via PeerJS (WebRTC)
- PeerJS cloud handles signaling (finding each other)
- After connection, data flows directly peer-to-peer
- Phone sends tilt data 20x/second
- Display moves the box based on tilt

## Files

- `display.html` - Shows on projector/TV, displays QR and game
- `controller.html` - Phone controller, sends tilt data
