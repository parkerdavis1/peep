[⬅️ Back to peep](/)

# About Peep

**peep** is a simple web app for editing recordings before uploading to eBird.

It is designed to be a fast and easy way to perform the most [common editing tasks](https://ebird.freshdesk.com/en/support/solutions/articles/48001064341-audio-preparation-and-upload-guidelines):
- Trimming the beginning and end of the recording
- Applying a light high-pass filter to remove low-frequency noise
- Normalizing the gain to -3dB

<!--The app is written in Svelte and TypeScript. It is open source and the code is available on [GitHub](https://github.com/parker-davis/peep).-->

## Usage

1. Load an audio file. 
    - If you are loading audio from the Merlin app, you must first save it to your phone (`Files` on iOS)
2. Drag the start and end trim handles
3. Select the options you'd like to apply to your recording (High-pass filter, fades, normalization)
4. Click `Export` to save the processed WAV file to your phone
5. Upload the edited file to eBird!

###  Tips & Tricks

As you drag the trim handles, a blue 3-second visual buffer appears so you can easily leave [lead-in and lead-out time](https://ebird.freshdesk.com/en/support/solutions/articles/48001064341-audio-preparation-and-upload-guidelines#:~:text=When,sounds%2E%29).

When audio is stopped, you can tap anywhere on the spectrogram to move the playback position, which will appear as an orange bar. Next time you press play, it will start there.


## Keyboard Shortcuts

- <kbd>space</kbd>: play/stop
- <kbd>up/down</kbd>: zoom in/out
- <kbd>left/right</kbd>: nudge playback position

## Privacy

All processing is done in your browser. Your audio files are never uploaded to a server.

## Coffee

Created by me, [Parker Davis](https://parkerdavis.dev). If you enjoy this app, consider [buying me a coffee ☕️](https://ko-fi.com/parkerdavisaz).
