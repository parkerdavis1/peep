# About peep

**peep** is a web app for editing recordings before uploading to eBird.

It is tailor-made to quickly perform [common editing tasks suggested by eBird](https://ebird.freshdesk.com/en/support/solutions/articles/48001064341-audio-preparation-and-upload-guidelines):
- Trim the beginning and end of the recording
- Apply a light high-pass filter to remove low-frequency noise
- Normalize gain to -3dB

## Usage

1. Open an audio file
    - If you are loading audio from the Merlin app, you must first save it to your phone (**`Files`** on iOS)
2. Drag the <span style="color:var(--handle-color)">red</span> start and end trim handles
3. Select the options you'd like to apply to your recording (high-pass filter, fades, normalization)
4. Click **`Export`** to save the processed WAV file to your phone
5. Upload the edited file to eBird!

###  Tips & Tricks

As you drag the trim handles, a <span style="color:var(--accent)">blue</span> 3-second visual buffer appears so you can easily leave [lead-in and lead-out time](https://ebird.freshdesk.com/en/support/solutions/articles/48001064341-audio-preparation-and-upload-guidelines#:~:text=When,sounds%2E%29).

When audio is stopped, you can tap anywhere on the spectrogram to move the <span style="color:var(--marker-color)">orange</span> playback position. Next time you press play, it will start there.


### Keyboard Shortcuts

- <kbd>space</kbd> -  play/stop
- <kbd>up/down</kbd> -  zoom in/out
- <kbd>left/right</kbd> -  nudge playback position

## Privacy

All processing is done in the browser. Your audio files never leave your device.

The app is written in TypeScript and Svelte. It is open source under the [GAL license](https://gal.gay/) and the code is available on [GitHub](https://github.com/parkerdavis1/peep).

## Credits

Created by me, [Parker Davis](https://parkerdavis.dev). If you enjoy this app, consider [buying me a coffee ☕️](https://ko-fi.com/parkerdavisaz).
