# Person record schema

The installer accepts one UTF-8 JSON object. Paths ending in `File` are resolved relative to the JSON file and copied into the website.

## Identity and profile

- `id`: stable lowercase slug using `a-z`, digits, and hyphens.
- `featured`: optional Boolean; the featured person opens first.
- `name`, `chinese`, `years`, `role`, `relation`, `location`, `occupation`: display strings.
- `status`: exactly `Living` or `Remembered`.
- `color`: hexadecimal accent colour.
- `avatarFile`: optional local portrait path.
- `personality`, `personalityNote`: label and its provenance or limitation.
- `interests`, `smallThings`: non-empty string arrays.
- `overview`, `quote`: reviewed profile text.

## Life record and writing

- `timeline`: array of `{ year, place, title, copy }`. Use only supported dates; an unknown date may be written as `Date uncertain`.
- `perspectives`: array of `{ speaker, relationship, source, text }`. Do not merge different speakers into one quotation.
- `storyTitle`, `storyDeck`, `story`: title, deck, and paragraph array for the complete life story.
- `letterTo`, `letter`: addressee and paragraph array for the cross-generational letter.

## Film and voice

`film` is optional. When present it contains:

- `sourceFile`: local MP4.
- `posterFile`: optional JPG or PNG.
- `captionsFile`: optional WebVTT captions.
- `duration`, `chapters`, `language`, `description`: user-facing metadata.

`voice` is required because the site always renders a voice-archive state. It contains `language`, `label`, `duration`, `note`, optional `sourceFile`, and optional `transcript`.

The installed JSON uses browser fields `avatar`, `film.src`, `film.poster`, `film.captions`, and `voice.src`. Do not write these browser paths manually when local `*File` fields are available; let the installer normalize them.
