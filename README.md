# ROLI Learn 4 All

Learn MIDI songs with falling notes, piano audio, and lights on your ROLI Piano. MIDI files stay on your computer. No Ableton required.

**[Open the player](https://dreamingcat-9.github.io/roli-piano-midi-reader/)**

Based on [ROLILearn4All](https://github.com/ClockworkPirate/ROLILearn4All) by ClockworkPirate, with wait-mode, lighting, hand and fitting improvements.

![ROLI Learn player with falling notes, track controls, and piano keyboard](docs/ui.png)

## Get started

1. Open the player in desktop Chrome and connect your Piano by USB.
2. Accept the notice and allow MIDI/SysEx access when Chrome asks (only the first time). The Piano links by itself, now and whenever it is plugged in again; the Piano button in the top bar shows whether it is linked and opens **Your Piano**, where **Connect ROLI Piano** does the same by hand.
3. Load a `.mid` file and press **Play**, or try the demo.

**Songs** (top left) lists the MIDI files you have opened: they are kept in this browser with where you stopped, and the last one opens by itself next time, paused there. You can also drop a `.mid` file anywhere on the page. The notes fall past numbered bar lines, and **Loop** (the arrows beside the time) plays four bars again and again; the bar numbers beside it change which bars.

Notes and keys take the colour of the hand that plays them: amber for the right hand, cyan for the left. The bar under the notes chooses the hand to practise, turns **Wait for me** on and sets the speed; Settings holds the rest (tracks, your keys, the Piano's lights, sound and display). Piano audio is on by default and also responds to your keyboard, including velocity and sustain. **Disconnect and clear lights**, in Your Piano, sends note releases and turns off key lighting; reconnecting restores brightness.

You may need ROLI's Windows driver. Close Ableton's ROLI control surface while using the player to avoid competing lighting commands. Only notes within your Piano's current octave range can light its keys.

## Run locally

Requires Node.js.

```sh
npm start
```

Open http://localhost:8765. Run `npm test` to check MIDI parsing and lighting messages.

## Code layout

The player is plain ES modules in `src/`, with no build step. `src/app.js` is the entry point and lists what each module does. `midi.js` (including bars and loops), `piano.js`, `lights.js`, `buttons.js`, `practice.js`, `hands.js` and `fit.js` hold the logic that does not touch the page; `test.mjs` covers them. `scripts/stamp-version.mjs` gives the published files versioned URLs when GitHub Pages deploys them.

## Deploy

Push to `main` on this GitHub repo to deploy automatically to Heroku. GitHub Actions runs tests on pushes and pull requests.

## License

[MIT](LICENSE). Includes code adapted from ROLI-for-Live and ROLI BLOCKS protocol helpers; see [third-party notices](THIRD_PARTY_NOTICES.md).

