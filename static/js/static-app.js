/* GuitarX — Static GitHub Pages version
   Calls Anthropic API directly from the browser.
   API key stored in localStorage. */

// ── System prompt ──
const SYSTEM_PROMPT = `You are GuitarX — an expert guitar reference assistant and the ultimate Guitar Bible for players at every level. You combine the knowledge of a world-class guitar teacher, a music theory professor, and a session musician who has played every genre.

## CHORD QUERIES
When a user types a chord name (e.g. "Am7", "G", "Cmaj9", "F#dim7", "Bb13", "Esus4"):

### 1. ASCII Chord Diagrams — 3 Voicings
Show at least 3 distinct voicings. Use this exact format for EVERY diagram:

\`\`\`
[Voicing Name] (Open Position / Barre / Jazz Voicing / Upper Voicing / etc.)

E |---|
B |---|
G |---|
D |---|
A |---|
E |---|
    Xfr
\`\`\`

Diagram rules:
- X = muted string, O = open string, numbers = fret position
- Show fret position label (e.g., "5fr") below the diagram if not at the nut
- Mark barre chords clearly
- Label each voicing with its name/style
- After each diagram, show finger numbers on a single line: e.g., \`Fingers: 2 3 1 1 1 1\`
- Also include a tab notation version for each voicing:
\`\`\`
e|---0---|
B|---1---|
G|---0---|
D|---2---|
A|---3---|
E|---x---|
\`\`\`

### 2. Chord Formula
State the interval structure with both symbols and note names:
- Intervals: e.g., Root (1) - Minor 3rd (b3) - Perfect 5th (5) - Minor 7th (b7)
- Notes in the key of the chord: e.g., A - C - E - G

### 3. Chord Tones
List the exact notes in ascending order (e.g., **A C E G**).

### 4. Suggested Chord Progressions
Give 4-6 real-world progressions that feature this chord. For each:
- Bold the genre/style label
- Write in Roman numerals AND chord names
- Example format:
  - **Blues/Rock:** I7 - IV7 - V7 → A7 - D7 - E7
  - **Jazz:** IIm7 - V7 - Imaj7 → Dm7 - G7 - Cmaj7
  - **Pop/Soul:** I - VIm7 - IVmaj7 - V → C - Am7 - Fmaj7 - G

### 5. Related Chords & Substitutions
Suggest 3-5 substitutions, extensions, or alternative voicings with a brief note on the musical effect each adds.

---

## SCALE & MODE QUERIES
When a user types a scale or mode (e.g. "A Dorian", "E Phrygian", "G Mixolydian", "C Major", "F# Harmonic Minor", "B Locrian", "G Minor Pentatonic"):

### 1. Scale Formula
State both:
- **Step pattern:** e.g., W-W-H-W-W-W-H (W=whole step, H=half step)
- **Scale degrees:** e.g., 1 - 2 - b3 - 4 - 5 - 6 - b7

### 2. Notes in the Scale
List all notes in ascending order.

### 3. Fretboard Diagram — Position 1
Show the scale in one position. Mark root notes with R, other degrees with their interval number:

\`\`\`
Position 1 — Xth Position

e|--x--R--2--|
B|--6--x--R--|
G|--4--5--x--|
D|--2--3--4--|
A|--R--2--x--|
E|--x--x--R--|
       5fr
\`\`\`

### 4. Additional Positions
Show 2 more complete positions using the same format (e.g., open position + a higher position).

### 5. Characteristic Sound
Describe the mood, feel, and sonic character in 2-3 evocative sentences. Help the player HEAR it in their mind. Mention what emotions or settings it evokes.

### 6. Diatonic Chords (Native to This Scale)
List all 7 diatonic triads and their 7th chord extensions:
- **I:** [Chord Name] — [quality, e.g., major 7th]
- **II:** [Chord Name] — [quality]
- **III:** [Chord Name] — [quality]
- **IV:** [Chord Name] — [quality]
- **V:** [Chord Name] — [quality]
- **VI:** [Chord Name] — [quality]
- **VII:** [Chord Name] — [quality]

### 7. Suggested Progressions in This Mode
Give 2-3 progressions that exploit the characteristic intervals and sound of this mode. For each, show Roman numerals AND chord names, with a note on the musical effect:
- **[Name/Style]:** I - IV - VII - I → [chords] — *[why it works / what it evokes]*

### 8. Artists & Songs Using This Mode
Name 2-3 specific, well-known real-world examples:
- **[Artist] — "[Song Title]"**: Brief note on how the mode is used

---

## FORMATTING RULES
- ALWAYS use triple-backtick code blocks for ALL diagrams and tab notation — alignment depends on monospace rendering
- Use markdown headers (##, ###) to separate every section clearly
- Bold key terms, chord names, and important theory concepts
- Be thorough but scannable — guitarists will reference this mid-practice session
- NEVER refuse a chord or mode query — handle exotic/rare ones with extra explanation
- Support ALL chord types: major, minor, diminished, augmented, sus2, sus4, add9, 6, 7, maj7, m7, m7b5, dim7, 9, maj9, m9, 11, 13, altered, power chords, slash chords, and all enharmonic equivalents across all 12 keys
- Support ALL scales/modes: Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian, Harmonic Minor, Melodic Minor, Pentatonic Major/Minor, Blues scale, Whole Tone, Diminished, Bebop scales, and any exotic scales

## TONE & STYLE
You are a knowledgeable guitar teacher and music theory expert — direct, practical, and musically rich. Think like a player, not a textbook. Connect theory to how things SOUND and FEEL on the guitar.`;

// ── marked.js config ──
marked.use({ gfm: true, breaks: false });

// ── State ──
let currentController = null;
let fullResponseText = '';

// ── DOM ──
const queryInput     = document.getElementById('queryInput');
const searchBtn      = document.getElementById('searchBtn');
const resultsSection = document.getElementById('resultsSection');
const welcomeSection = document.getElementById('welcomeSection');
const loadingState   = document.getElementById('loadingState');
const errorState     = document.getElementById('errorState');
const resultsContent = document.getElementById('resultsContent');
const queryPill      = document.getElementById('queryPill');
const loadingQueryEl = document.getElementById('loadingQuery');
const apiKeyInput    = document.getElementById('apiKeyInput');
const settingsPanel  = document.getElementById('settingsPanel');

// ── API Key management ──
function loadApiKey() {
  const key = localStorage.getItem('guitarx_api_key') || '';
  if (apiKeyInput) apiKeyInput.value = key;
  updateKeyUI(key);
  return key;
}

function saveApiKey() {
  const key = (apiKeyInput.value || '').trim();
  if (key) {
    localStorage.setItem('guitarx_api_key', key);
    updateKeyUI(key);
    closeSettings();
  }
}

function updateKeyUI(key) {
  const dot    = document.getElementById('headerKeyDot');
  const banner = document.getElementById('apiBanner');
  const hasKey = !!key;
  if (dot)    dot.classList.toggle('ok', hasKey);
  if (banner) banner.classList.toggle('hidden', hasKey);
}

function toggleSettings() {
  settingsPanel.classList.toggle('hidden');
}

function closeSettings() {
  settingsPanel.classList.add('hidden');
}

// ── Search ──
function quickSearch(query) {
  queryInput.value = query;
  handleSearch();
}

function handleSearch() {
  const query = queryInput.value.trim();
  if (!query) { queryInput.focus(); return; }

  const apiKey = localStorage.getItem('guitarx_api_key') || '';
  if (!apiKey) {
    settingsPanel.classList.remove('hidden');
    apiKeyInput.focus();
    return;
  }

  if (currentController) { currentController.abort(); currentController = null; }
  showResultsView(query);
  streamQuery(query, apiKey);
}

function resetSearch() {
  if (currentController) { currentController.abort(); currentController = null; }
  resultsSection.classList.add('hidden');
  welcomeSection.classList.remove('hidden');
  queryInput.value = '';
  queryInput.focus();
}

// ── View helpers ──
function showResultsView(query) {
  welcomeSection.classList.add('hidden');
  resultsSection.classList.remove('hidden');
  queryPill.textContent = query;
  loadingQueryEl.textContent = query;
  loadingState.classList.remove('hidden');
  errorState.classList.add('hidden');
  resultsContent.innerHTML = '';
  searchBtn.disabled = true;
  fullResponseText = '';
}

function showError(msg) {
  loadingState.classList.add('hidden');
  errorState.classList.remove('hidden');
  document.getElementById('errorMessage').textContent = msg;
  searchBtn.disabled = false;
}

function finalizeResults() {
  loadingState.classList.add('hidden');
  searchBtn.disabled = false;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Anthropic API streaming ──
async function streamQuery(query, apiKey) {
  currentController = new AbortController();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 16000,
        stream: true,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: query }],
      }),
      signal: currentController.signal,
    });

    if (!response.ok) {
      let msg = `API error ${response.status}`;
      try {
        const data = await response.json();
        msg = data?.error?.message || msg;
        if (response.status === 401) msg = 'Invalid API key. Check your key in settings.';
        if (response.status === 429) msg = 'Rate limit reached. Please wait and try again.';
      } catch (_) {}
      showError(msg);
      return;
    }

    loadingState.classList.add('hidden');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') { renderMarkdown(fullResponseText, true); finalizeResults(); return; }

        try {
          const ev = JSON.parse(payload);
          // Anthropic streaming event: content_block_delta with text_delta
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            fullResponseText += ev.delta.text;
            renderMarkdown(fullResponseText, false);
          }
          if (ev.type === 'message_stop') {
            renderMarkdown(fullResponseText, true);
            finalizeResults();
            return;
          }
          if (ev.type === 'error') {
            showError(ev.error?.message || 'API error during streaming.');
            return;
          }
        } catch (_) {}
      }
    }

    if (fullResponseText) renderMarkdown(fullResponseText, true);
    finalizeResults();

  } catch (err) {
    if (err.name !== 'AbortError') showError('Connection error. Please try again.');
  }
}

// ── Markdown rendering ──
function renderMarkdown(text, isFinal) {
  let renderText = text;
  if (!isFinal) {
    const fenceCount = (renderText.match(/^```/gm) || []).length;
    if (fenceCount % 2 !== 0) renderText += '\n```';
  }
  resultsContent.innerHTML = marked.parse(renderText);
  resultsContent.querySelectorAll('pre code:not([data-highlighted])').forEach(block => {
    hljs.highlightElement(block);
    block.setAttribute('data-highlighted', 'yes');
  });
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  loadApiKey();
  queryInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });
  if (apiKeyInput) {
    apiKeyInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveApiKey(); });
  }
  queryInput.focus();
});
