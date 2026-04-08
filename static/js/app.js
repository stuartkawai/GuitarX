/* GuitarX — Guitar Bible App */

// ── marked.js configuration ──
marked.use({
  gfm: true,
  breaks: false,
  pedantic: false,
});

// ── State ──
let currentController = null;
let fullResponseText = '';

// ── DOM references ──
const queryInput      = document.getElementById('queryInput');
const searchBtn       = document.getElementById('searchBtn');
const resultsSection  = document.getElementById('resultsSection');
const welcomeSection  = document.getElementById('welcomeSection');
const loadingState    = document.getElementById('loadingState');
const errorState      = document.getElementById('errorState');
const resultsContent  = document.getElementById('resultsContent');
const queryPill       = document.getElementById('queryPill');
const loadingQueryEl  = document.getElementById('loadingQuery');

// ── Entry points ──
function quickSearch(query) {
  queryInput.value = query;
  handleSearch();
}

function handleSearch() {
  const query = queryInput.value.trim();
  if (!query) {
    queryInput.focus();
    return;
  }

  // Cancel any in-flight request
  if (currentController) {
    currentController.abort();
    currentController = null;
  }

  showResultsView(query);
  streamQuery(query);
}

function resetSearch() {
  if (currentController) {
    currentController.abort();
    currentController = null;
  }

  resultsSection.classList.add('hidden');
  welcomeSection.classList.remove('hidden');
  queryInput.value = '';
  queryInput.focus();
}

// ── View management ──
function showResultsView(query) {
  welcomeSection.classList.add('hidden');
  resultsSection.classList.remove('hidden');

  // Update query display
  queryPill.textContent = query;
  loadingQueryEl.textContent = query;

  // Reset states
  loadingState.classList.remove('hidden');
  errorState.classList.add('hidden');
  resultsContent.innerHTML = '';
  resultsContent.classList.remove('hidden');

  // Disable search during streaming
  searchBtn.disabled = true;
}

function showError(message) {
  loadingState.classList.add('hidden');
  errorState.classList.remove('hidden');
  document.getElementById('errorMessage').textContent = message;
  searchBtn.disabled = false;
}

function finalizeResults() {
  loadingState.classList.add('hidden');
  searchBtn.disabled = false;
  // Scroll results into view smoothly
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Streaming ──
async function streamQuery(query) {
  currentController = new AbortController();
  fullResponseText = '';

  try {
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: currentController.signal,
    });

    if (!response.ok) {
      let errMsg = 'Request failed. Please try again.';
      try {
        const data = await response.json();
        errMsg = data.error || errMsg;
      } catch (_) {}
      showError(errMsg);
      return;
    }

    // Hide loading spinner once we have a response
    loadingState.classList.add('hidden');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();

        if (payload === '[DONE]') {
          renderMarkdown(fullResponseText, true);
          finalizeResults();
          return;
        }

        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) {
            showError(parsed.error);
            return;
          }
          if (parsed.text) {
            fullResponseText += parsed.text;
            renderMarkdown(fullResponseText, false);
          }
        } catch (_) {
          // skip malformed JSON fragments
        }
      }
    }

    // Stream ended without [DONE]
    if (fullResponseText) {
      renderMarkdown(fullResponseText, true);
    }
    finalizeResults();

  } catch (err) {
    if (err.name !== 'AbortError') {
      showError('Connection error. Please check your network and try again.');
    }
  }
}

// ── Markdown rendering ──
function renderMarkdown(text, isFinal) {
  let renderText = text;

  // During streaming, close any unclosed fenced code blocks so marked
  // doesn't swallow the rest of the document.
  if (!isFinal) {
    const fenceCount = (renderText.match(/^```/gm) || []).length;
    if (fenceCount % 2 !== 0) {
      renderText += '\n```';
    }
  }

  resultsContent.innerHTML = marked.parse(renderText);

  // Apply syntax highlighting to freshly rendered code blocks
  resultsContent.querySelectorAll('pre code:not([data-highlighted])').forEach(block => {
    hljs.highlightElement(block);
    block.setAttribute('data-highlighted', 'yes');
  });
}

// ── Event listeners ──
document.addEventListener('DOMContentLoaded', () => {
  // Enter key submits search
  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  // Focus input on load
  queryInput.focus();
});
