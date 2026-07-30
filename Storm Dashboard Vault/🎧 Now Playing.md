---
tags:
  - nowplaying
folder: Audio
playlist: ""
audio: ""
track: ""
artist: ""
progress: 0
link: ""
---

# 🎧 Now Playing

The **Now playing** card on your [[Dashboard|Home]] is a real audio player for files kept in your vault — play, pause, skip, and scrub, all offline.

## Add music
1. Put audio files (`.mp3`, `.m4a`, `.ogg`, `.wav`, `.flac`, `.opus`) into the **`Audio/`** folder.
2. They appear in the Now playing card automatically — press ▶ to play, ⏮ / ⏭ to move between tracks, and click the bar to scrub.
3. Name a file **`Artist - Title.mp3`** and the card splits it into artist + title for you.

## Playlists
- **By folder:** make subfolders like `Audio/Focus/` or `Audio/Lofi/`, then set the **folder** property above to that path (e.g. `Audio/Focus`) to play just that set. Leave it as `Audio` to play everything.
- **By note:** set **playlist** to a note that lists tracks as `![[track.mp3]]` embeds, and it plays those in order.
- **Pin one track:** set **audio** to a single `[[track.mp3]]`.

You can also play any file inline in any note by embedding it: `![[Audio/song.mp3]]`.

> Note: the player lives in the dashboard. When the dashboard reloads (e.g. after you add a task), playback keeps going — it only resets if you change the track list.
