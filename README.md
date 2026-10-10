# Vale

A bite-size Spanish app for your phone. Add words, verbs and phrases; Vale conjugates verbs for you, calls out the patterns worth remembering, and writes fresh short stories that use your words and only the tenses you know.

No App Store, no server: it's a static web app on GitHub Pages that you add to your home screen.

## What it does

- **Add anything**: a verb, a noun, a phrase, or even English. Claude fills in the meaning, an example, and notes only when they're useful (gender traps, false friends, regional differences like *coger*).
- **Verbs conjugate themselves**: a rule-based engine (no AI, works offline) covers 11 tenses, irregulars, stem changers, spelling changes, reflexives and *vos* forms.
- **Tick the tenses you know** in Ajustes. Only those go into drills and stories.
- **Historia**: a new graded story whenever you want. Tap any word for its meaning and tense. Words you tap come back for review.
- **Verbos**: typed drills. Get it right and Vale tells you *why* it looks like that (e.g. "-ir stem-changer: pidió, pidieron").
- **Tarjetas**: quick cards with just "Got it" / "Not yet".
- **Región**: Spain or Central America (vos, ustedes, regional vocabulary).
- **Listen**: uses the Spanish voices built into your phone.

## Set up (once)

1. Push this folder to a GitHub repo called `vale`.
2. Repo **Settings → Pages → Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`.
3. After a minute it's live at `https://<your-username>.github.io/vale/`.
4. On your iPhone, open that link in **Safari**, tap **Share → Add to Home Screen**.
5. Open Vale from the home screen, go to **Ajustes**, paste your Claude API key, tap **Test**.

Get a key at console.anthropic.com and set a monthly spend limit there. Typical use is a couple of euros a month.

## Notes

- Your words, progress and API key are stored only on the phone, inside the home-screen app.
- iPhone keeps home-screen app storage separate from Safari, so always open Vale from the home-screen icon.
- Quick add: copy a word (e.g. in WhatsApp), open Vale and tap the paste button next to the add box.

## Adding a new activity

Create `js/activities/<name>.js` exporting `{ id, title, blurb, icon, status(), start(root, ctx) }`, then list it in `js/activities/index.js`. It appears on the home screen automatically.

## Tests

```
node tests/conjugator.test.mjs
```
