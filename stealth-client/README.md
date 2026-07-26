# Legilimens Stealth Client

A native desktop overlay (similar to Cluely) that runs silently in the background, captures screen/audio for transcription, and displays the "Marauder's Radar" confusion signals as a floating, draggable, transparent widget.

## How it works
1. **Electron Shell**: Runs a frameless, transparent window `alwaysOnTop`.
2. **Auto-Capture**: The main process automatically intercepts and approves screen capture (`desktopCapturer`) and microphone permission requests without showing any native OS dialogs.
3. **Next.js Engine**: The UI inside the window is powered by our Next.js frontend route `http://localhost:3000/overlay`. 
4. **Real-time Pipeline**: The Next.js overlay automatically opens WebRTC, records audio chunks every 3s, streams them to the FastAPI websocket (`/transcription/live/1`), and listens for `confusion_alert` and `analogy_ready` events to update the UI widget.

## Running the overlay
Make sure your backend and frontend are running, then:

```bash
cd stealth-client
npm install
npm start
```

A small floating 🔮 Legilimens widget will appear on your screen. You can drag it by the title bar, adjust its opacity, and it will automatically show the current topic being transcribed or any confusion alerts!
