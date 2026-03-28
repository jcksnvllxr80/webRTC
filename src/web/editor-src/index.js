// Rich text chat editor bundle source.
// Built with: npm run build:editor
// Output: src/web/public/js/chat-editor.js

import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import DOMPurify from 'dompurify';
import 'emoji-picker-element';

const lowlight = createLowlight();
lowlight.register('css', css);
lowlight.register('js', javascript);
lowlight.register('javascript', javascript);
lowlight.register('ts', typescript);
lowlight.register('typescript', typescript);
lowlight.register('python', python);
lowlight.register('py', python);
lowlight.register('bash', bash);
lowlight.register('sh', bash);
lowlight.register('shell', bash);
lowlight.register('json', json);
lowlight.register('sql', sql);
lowlight.register('html', xml);
lowlight.register('xml', xml);
lowlight.register('go', go);
lowlight.register('rust', rust);
lowlight.register('java', java);
lowlight.register('cpp', cpp);
lowlight.register('c', cpp);

// ── Emoji shortcode data for autocomplete ──
const EMOJI_SHORTCUTS = [
  ['smile','😊'],['grin','😁'],['laugh','😂'],['lol','😂'],['rofl','🤣'],
  ['wink','😉'],['heart_eyes','😍'],['starstruck','🤩'],['kissing','😘'],
  ['yum','😋'],['sunglasses','😎'],['nerd','🤓'],['monocle','🧐'],
  ['thinking','🤔'],['shushing','🤫'],['zipper','🤐'],['raised_eyebrow','🤨'],
  ['neutral','😐'],['expressionless','😑'],['rolling_eyes','🙄'],
  ['smirk','😏'],['unamused','😒'],['persevere','😣'],['fearful','😨'],
  ['cold_sweat','😰'],['cry','😢'],['sob','😭'],['angry','😠'],['rage','😡'],
  ['exploding_head','🤯'],['flushed','😳'],['dizzy','😵'],['nauseated','🤢'],
  ['sick','🤒'],['mask','😷'],['sleeping','😴'],['yawning','🥱'],
  ['relieved','😌'],['pensive','😔'],['worried','😟'],['confused','😕'],
  ['upside_down','🙃'],['open_mouth','😮'],['astonished','😲'],['scream','😱'],
  ['thumbsup','👍'],['thumbsdown','👎'],['clap','👏'],['raised_hands','🙌'],
  ['wave','👋'],['call_me','🤙'],['muscle','💪'],['punch','👊'],
  ['fist','✊'],['pray','🙏'],['ok_hand','👌'],['pinched_fingers','🤌'],
  ['crossed_fingers','🤞'],['peace','✌️'],['rock_on','🤘'],
  ['point_up','☝️'],['point_down','👇'],['point_left','👈'],['point_right','👉'],
  ['middle_finger','🖕'],['handshake','🤝'],['facepalm','🤦'],['shrug','🤷'],
  ['fire','🔥'],['rocket','🚀'],['star','⭐'],['sparkles','✨'],
  ['boom','💥'],['tada','🎉'],['confetti','🎊'],['trophy','🏆'],
  ['medal','🥇'],['100','💯'],['checkmark','✅'],['x','❌'],
  ['warning','⚠️'],['no_entry','🚫'],['question','❓'],['exclamation','❗'],
  ['heart','❤️'],['broken_heart','💔'],['orange_heart','🧡'],
  ['yellow_heart','💛'],['green_heart','💚'],['blue_heart','💙'],
  ['purple_heart','💜'],['black_heart','🖤'],['eyes','👀'],
  ['ghost','👻'],['skull','💀'],['poop','💩'],['robot','🤖'],['alien','👽'],
  ['computer','💻'],['keyboard','⌨️'],['phone','📱'],['tv','📺'],
  ['camera','📷'],['video','📹'],['microphone','🎤'],['headphones','🎧'],
  ['speaker','🔊'],['mute','🔇'],['bulb','💡'],['battery','🔋'],
  ['disk','💾'],['cd','💿'],['gear','⚙️'],['tools','🛠️'],
  ['hammer','🔨'],['wrench','🔧'],['lock','🔒'],['unlock','🔓'],
  ['key','🔑'],['magnifier','🔍'],['chart','📊'],['pencil','✏️'],
  ['memo','📝'],['clipboard','📋'],['folder','📁'],['file','📄'],
  ['email','📧'],['inbox','📥'],['outbox','📤'],['package','📦'],
  ['sun','☀️'],['moon','🌙'],['cloud','☁️'],['rain','🌧️'],
  ['snow','❄️'],['lightning','⚡'],['rainbow','🌈'],['ocean','🌊'],
  ['tree','🌳'],['rose','🌹'],['cat','🐱'],['dog','🐶'],['fox','🦊'],
  ['bear','🐻'],['panda','🐼'],['penguin','🐧'],['monkey','🐒'],
  ['pizza','🍕'],['burger','🍔'],['sushi','🍣'],['ramen','🍜'],
  ['coffee','☕'],['tea','🍵'],['beer','🍺'],['wine','🍷'],
  ['cake','🎂'],['donut','🍩'],['cookie','🍪'],
  ['dev','👨‍💻'],['technologist','🧑‍💻'],['ninja','🥷'],['cowboy','🤠'],
];

// ── Custom extension: Enter submits, Shift+Enter is newline ──
function makeSubmitExtension(submitFn) {
  return Extension.create({
    name: 'submitOnEnter',
    addKeyboardShortcuts() {
      return {
        Enter: ({ editor }) => {
          if (editor.isActive('codeBlock')) return false; // let CodeBlock handle newline
          submitFn();
          return true;
        },
      };
    },
  });
}

// ── Main factory ──
export function createChatEditor({ editableEl, onSubmit }) {
  const pendingFiles = [];
  let emojiQuery = null;  // active :query string
  let emojiAnchor = null; // doc position of the ':' character

  // Floating toolbar (appended to body, position:fixed)
  const ftEl = buildFloatingToolbar();
  document.body.appendChild(ftEl);

  // Emoji autocomplete dropdown (appended to body)
  const acEl = buildAutocomplete();
  document.body.appendChild(acEl);

  // ── Tiptap editor ──
  const editor = new Editor({
    element: editableEl,
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        codeBlock: false,  // replaced by CodeBlockLowlight
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Highlight.configure({ multicolor: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank', class: 'chat-link' },
      }),
      Placeholder.configure({ placeholder: 'Type a message...' }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: { class: 'chat-inline-img' },
      }),
      makeSubmitExtension(submit),
    ],
    editorProps: {
      handlePaste(_view, event) { return interceptPaste(event); },
      handleDrop(_view, event)  { return interceptDrop(event);  },
    },
  });

  // ── Editor event hooks ──
  editor.on('selectionUpdate', ({ editor }) => {
    positionToolbar(editor);
    scanForEmojiTrigger(editor);
  });
  editor.on('update', ({ editor }) => {
    scanForEmojiTrigger(editor);
  });
  editor.on('focus', () => {
    document.getElementById('rte-container')?.classList.add('focused');
  });
  editor.on('blur', () => {
    document.getElementById('rte-container')?.classList.remove('focused');
    // Small delay so toolbar/autocomplete clicks register before hiding
    setTimeout(() => {
      if (!document.activeElement?.closest('#rte-float-toolbar')) ftEl.style.display = 'none';
      if (!document.activeElement?.closest('#rte-emoji-ac')) acEl.style.display = 'none';
    }, 120);
  });

  // ── Submit ──
  function submit() {
    const html = editor.getHTML();
    const text = editor.getText({ blockSeparator: '\n' }).trim();
    if (!text && !html.includes('<img') && pendingFiles.length === 0) return;

    onSubmit({ html, text, files: [...pendingFiles] });
    editor.commands.clearContent(true);
    editor.commands.focus();
    pendingFiles.length = 0;
    refreshAttachPreview();
    ftEl.style.display = 'none';
    acEl.style.display = 'none';
  }

  // ── Paste / drop ──
  function interceptPaste(event) {
    // 1. items (standard browsers + most Electron builds)
    const items = event.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) { event.preventDefault(); insertImageFile(file); return true; }
        }
      }
    }
    // 2. files fallback (some Electron builds put images here instead)
    const files = event.clipboardData?.files;
    if (files?.length) {
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          event.preventDefault(); insertImageFile(file); return true;
        }
      }
    }
    // 3. Async Clipboard API fallback (Electron screenshots often land here).
    // Only attempt this when items was empty/unavailable — if items has text content
    // we must let the default paste proceed instead of blocking it.
    const hasTextInItems = Array.from(items || []).some(i => i.type === 'text/plain' || i.type === 'text/html');
    if (!hasTextInItems && navigator.clipboard?.read) {
      navigator.clipboard.read().then(clipItems => {
        for (const ci of clipItems) {
          const imgType = ci.types.find(t => t.startsWith('image/'));
          if (imgType) {
            ci.getType(imgType).then(blob => {
              insertImageFile(new File([blob], 'screenshot.png', { type: imgType }));
            });
            return;
          }
        }
      }).catch(() => {});
      // Don't preventDefault here — if no image is found the paste falls through naturally
      return false;
    }
    return false;
  }

  // Document-level fallback: catches paste when editor isn't focused
  document.addEventListener('paste', (e) => {
    const active = document.activeElement;
    // Skip if a real input/textarea has focus (let it handle its own paste)
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    // Skip if editor already handled it via handlePaste
    if (editableEl.contains(active) || editableEl.contains(document.activeElement)) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { e.preventDefault(); editor.commands.focus(); insertImageFile(file); return; }
      }
    }
  });

  function interceptDrop(event) {
    const files = event.dataTransfer?.files;
    if (!files?.length) return false;
    event.preventDefault();
    for (const file of files) {
      if (file.type.startsWith('image/')) insertImageFile(file);
      else addPendingFile(file);
    }
    return true;
  }

  // ── Image insert ──
  function insertImageFile(file) {
    if (file.size > 20 * 1024 * 1024) { alert('Image too large — max 20 MB.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX = 1280;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const scale = Math.min(MAX / width, MAX / height);
          width  = Math.round(width  * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const src = canvas.toDataURL('image/jpeg', 0.82);
        editor.chain().focus().setImage({ src, alt: file.name }).run();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ── Pending (non-image) file attachments ──
  function addPendingFile(file) {
    if (file.size > 5 * 1024 * 1024) { alert('File too large — max 5 MB.'); return; }
    pendingFiles.push(file);
    refreshAttachPreview();
  }

  function removePendingFile(idx) {
    pendingFiles.splice(idx, 1);
    refreshAttachPreview();
  }

  function refreshAttachPreview() {
    const row = document.getElementById('rte-attach-preview');
    if (!row) return;
    row.innerHTML = '';
    if (pendingFiles.length === 0) { row.style.display = 'none'; return; }
    row.style.display = 'flex';
    pendingFiles.forEach((file, i) => {
      const thumb = document.createElement('div');
      thumb.className = 'attach-thumb';
      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.className = 'attach-thumb-img';
        thumb.appendChild(img);
      } else {
        const ext = document.createElement('span');
        ext.className = 'attach-thumb-ext';
        ext.textContent = file.name.split('.').pop().toUpperCase().slice(0, 4);
        thumb.appendChild(ext);
      }
      const rm = document.createElement('button');
      rm.className = 'attach-thumb-remove';
      rm.textContent = '✕';
      rm.type = 'button';
      rm.title = 'Remove';
      rm.addEventListener('click', () => removePendingFile(i));
      thumb.appendChild(rm);
      row.appendChild(thumb);
    });
  }

  // ── Floating toolbar ──
  function buildFloatingToolbar() {
    const el = document.createElement('div');
    el.id = 'rte-float-toolbar';
    el.className = 'rte-float-toolbar';
    el.style.display = 'none';

    const defs = [
      { id: 'bold',       html: '<strong>B</strong>',     title: 'Bold (Ctrl+B)',           cmd: () => editor.chain().focus().toggleBold().run() },
      { id: 'italic',     html: '<em>I</em>',             title: 'Italic (Ctrl+I)',          cmd: () => editor.chain().focus().toggleItalic().run() },
      { id: 'strike',     html: '<s>S</s>',               title: 'Strikethrough',            cmd: () => editor.chain().focus().toggleStrike().run() },
      { sep: true },
      { id: 'code',       html: '`',                       title: 'Inline code',              cmd: () => editor.chain().focus().toggleCode().run(),      mono: true },
      { id: 'codeBlock',  html: '≡',                       title: 'Code block',               cmd: () => editor.chain().focus().toggleCodeBlock().run() },
      { sep: true },
      { id: 'highlight',  html: 'H',                       title: 'Highlight (Ctrl+Shift+H)', cmd: () => editor.chain().focus().toggleHighlight().run(), accent: true },
      { id: 'blockquote', html: '"',                        title: 'Blockquote',               cmd: () => editor.chain().focus().toggleBlockquote().run(), big: true },
      { id: 'link',       html: '🔗',                      title: 'Link (Ctrl+K)',            cmd: () => insertLink() },
    ];

    for (const d of defs) {
      if (d.sep) {
        const s = document.createElement('span');
        s.className = 'ft-sep';
        el.appendChild(s);
        continue;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ft-btn' + (d.mono ? ' ft-btn--mono' : '') + (d.accent ? ' ft-btn--accent' : '') + (d.big ? ' ft-btn--big' : '');
      btn.innerHTML = d.html;
      btn.title = d.title;
      btn.dataset.format = d.id;
      btn.addEventListener('mousedown', (e) => { e.preventDefault(); d.cmd(); });
      el.appendChild(btn);
    }

    return el;
  }

  function positionToolbar(editor) {
    const { from, to } = editor.state.selection;
    if (from === to) { ftEl.style.display = 'none'; return; }

    // Update active states
    for (const btn of ftEl.querySelectorAll('[data-format]')) {
      btn.classList.toggle('active', editor.isActive(btn.dataset.format));
    }

    // Position above selection midpoint
    const startCoords = editor.view.coordsAtPos(from);
    const endCoords   = editor.view.coordsAtPos(to);
    const midX = (startCoords.left + endCoords.left) / 2;
    const topY = Math.min(startCoords.top, endCoords.top);

    // Use fixed positioning (viewport coords)
    ftEl.style.display = 'flex';
    const tbW = ftEl.offsetWidth || 280;
    let left = midX - tbW / 2;
    let top  = topY - (ftEl.offsetHeight || 36) - 10;

    left = Math.max(8, Math.min(left, window.innerWidth - tbW - 8));
    top  = Math.max(8, top);

    ftEl.style.position = 'fixed';
    ftEl.style.left = left + 'px';
    ftEl.style.top  = top  + 'px';
  }

  function insertLink() {
    const prev = editor.getAttributes('link').href || '';
    const url  = window.prompt('Enter URL:', prev || 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
    }
  }

  // ── Emoji autocomplete ──
  function buildAutocomplete() {
    const el = document.createElement('div');
    el.id = 'rte-emoji-ac';
    el.className = 'rte-emoji-ac';
    el.style.display = 'none';
    return el;
  }

  function scanForEmojiTrigger(editor) {
    const { from } = editor.state.selection;
    const lookback = editor.state.doc.textBetween(Math.max(0, from - 32), from, null, null);
    const m = lookback.match(/:(\w+)$/);
    if (m) {
      emojiQuery  = m[1];
      emojiAnchor = from - m[0].length; // position of ':'
      renderAutocomplete(editor, m[1], from);
    } else {
      emojiQuery = null;
      emojiAnchor = null;
      acEl.style.display = 'none';
    }
  }

  let acItems = [];
  let acSelected = 0;

  function renderAutocomplete(editor, query, cursorPos) {
    const matches = EMOJI_SHORTCUTS.filter(([sc]) => sc.startsWith(query.toLowerCase())).slice(0, 8);
    if (matches.length === 0) { acEl.style.display = 'none'; return; }

    acItems    = matches;
    acSelected = 0;
    renderAcItems();

    // Position below cursor
    const coords = editor.view.coordsAtPos(cursorPos);
    acEl.style.position = 'fixed';
    acEl.style.left = Math.max(8, coords.left) + 'px';
    acEl.style.top  = (coords.bottom + 4) + 'px';
    acEl.style.display = 'block';
  }

  function renderAcItems() {
    acEl.innerHTML = '';
    acItems.forEach(([sc, emoji], i) => {
      const row = document.createElement('div');
      row.className = 'emoji-ac-item' + (i === acSelected ? ' selected' : '');
      row.innerHTML = `<span class="emoji-ac-glyph">${emoji}</span><span class="emoji-ac-name">:${sc}:</span>`;
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        applyEmoji(emoji);
      });
      acEl.appendChild(row);
    });
  }

  function applyEmoji(emoji) {
    if (emojiAnchor === null) return;
    const { from } = editor.state.selection;
    editor.chain()
      .focus()
      .deleteRange({ from: emojiAnchor, to: from })
      .insertContent(emoji + '\u00a0') // non-breaking space after emoji so cursor lands outside
      .run();
    acEl.style.display = 'none';
    emojiQuery = null;
    emojiAnchor = null;
  }

  // Intercept keyboard navigation for autocomplete (capture phase — fires before Tiptap)
  editableEl.addEventListener('keydown', (e) => {
    if (acEl.style.display === 'none') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      acSelected = (acSelected + 1) % acItems.length;
      renderAcItems();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      acSelected = (acSelected - 1 + acItems.length) % acItems.length;
      renderAcItems();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      if (acItems[acSelected]) applyEmoji(acItems[acSelected][1]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      acEl.style.display = 'none';
      emojiQuery = null;
    }
  }, true /* capture */);

  // ── Emoji picker panel ──
  function setupEmojiPicker() {
    const panel  = document.getElementById('rte-emoji-panel');
    const btn    = document.getElementById('rte-emoji-btn');
    if (!panel || !btn) return;

    // Point emoji-picker-element at its bundled data if available
    const picker = panel.querySelector('emoji-picker');
    if (picker) {
      picker.addEventListener('emoji-click', (e) => {
        editor.chain().focus().insertContent(e.detail.unicode).run();
        panel.style.display = 'none';
      });
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = panel.style.display !== 'none';
      closeAllPanels();
      if (!isOpen) panel.style.display = 'block';
    });
  }

  // ── GIF panel ──
  function setupGifPanel() {
    const panel = document.getElementById('rte-gif-panel');
    const btn   = document.getElementById('rte-gif-btn');
    if (!panel || !btn) return;

    // Build search UI
    panel.innerHTML = '';
    panel.classList.remove('rte-gif-stub');

    const searchRow = document.createElement('div');
    searchRow.className = 'gif-search-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'gif-search-input';
    input.placeholder = 'Search GIFs…';
    input.setAttribute('autocomplete', 'off');
    searchRow.appendChild(input);

    const attribution = document.createElement('span');
    attribution.className = 'gif-attribution';
    attribution.textContent = 'Powered by GIPHY';
    searchRow.appendChild(attribution);

    const grid = document.createElement('div');
    grid.className = 'gif-grid';

    panel.appendChild(searchRow);
    panel.appendChild(grid);

    let searchTimer = null;
    let currentQuery = null;

    async function loadGifs(query) {
      if (query === currentQuery) return;
      currentQuery = query;
      grid.innerHTML = '<span class="gif-status">Loading…</span>';
      try {
        const url = query
          ? `/api/gifs/search?q=${encodeURIComponent(query)}`
          : '/api/gifs/trending';
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) { grid.innerHTML = `<span class="gif-status gif-error">${data.error}</span>`; return; }
        if (!data.length) { grid.innerHTML = '<span class="gif-status">No results</span>'; return; }
        grid.innerHTML = '';
        for (const gif of data) {
          const img = document.createElement('img');
          img.src = gif.preview;
          img.alt = gif.title;
          img.className = 'gif-item';
          img.loading = 'lazy';
          img.title = gif.title;
          img.addEventListener('click', () => {
            editor.chain().focus().setImage({ src: gif.url, alt: gif.title }).run();
            closeAllPanels();
          });
          grid.appendChild(img);
        }
      } catch {
        grid.innerHTML = '<span class="gif-status gif-error">Failed to load GIFs</span>';
      }
    }

    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => loadGifs(input.value.trim()), 400);
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = panel.style.display !== 'none';
      closeAllPanels();
      if (!isOpen) {
        panel.style.display = 'block';
        currentQuery = null; // force reload
        input.value = '';
        loadGifs('');
        setTimeout(() => input.focus(), 50);
      }
    });
  }

  function closeAllPanels() {
    document.getElementById('rte-emoji-panel')?.style.setProperty('display', 'none');
    document.getElementById('rte-gif-panel')?.style.setProperty('display', 'none');
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#rte-emoji-panel') && !e.target.closest('#rte-emoji-btn')) {
      document.getElementById('rte-emoji-panel')?.style.setProperty('display', 'none');
    }
    if (!e.target.closest('#rte-gif-panel') && !e.target.closest('#rte-gif-btn')) {
      document.getElementById('rte-gif-panel')?.style.setProperty('display', 'none');
    }
  });

  // ── File attach button ──
  function setupFileAttach() {
    const btn   = document.getElementById('rte-attach-btn');
    const input = document.getElementById('rte-file-input');
    if (!btn || !input) return;
    btn.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      for (const file of input.files) {
        if (file.type.startsWith('image/')) insertImageFile(file);
        else addPendingFile(file);
      }
      input.value = '';
    });
  }

  // ── Send button ──
  function setupSendButton() {
    document.getElementById('rte-send-btn')?.addEventListener('click', submit);
  }

  // ── Init ──
  setupEmojiPicker();
  setupGifPanel();
  setupFileAttach();
  setupSendButton();

  return { editor, submit };
}

// ── Syntax highlight code blocks in a rendered message element ──
// Called after sanitizeHtml sets innerHTML so hljs spans are injected post-sanitization.
// Input to lowlight is plain textContent (safe); output spans use lowlight-generated class names only.
function hastToHtml(nodes) {
  return (nodes || []).map(n => {
    if (n.type === 'text') {
      return n.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    if (n.type === 'element') {
      const cls = (n.properties?.className || []).join(' ');
      return `<span class="${cls}">${hastToHtml(n.children)}</span>`;
    }
    return '';
  }).join('');
}

export function highlightCodeBlocks(containerEl) {
  containerEl.querySelectorAll('pre > code').forEach(codeEl => {
    const lang = (codeEl.className.match(/language-(\S+)/) || [])[1];
    if (!lang) return;
    try {
      const tree = lowlight.highlight(lang, codeEl.textContent);
      codeEl.innerHTML = hastToHtml(tree.children);
    } catch { /* unknown language — leave as plain text */ }
  });
}

// ── HTML sanitiser (used in chat.js for received messages) ──
export function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'div', 'span',
      'strong', 'b', 'em', 'i', 's', 'del', 'u',
      'mark', 'code', 'pre', 'blockquote',
      'a', 'img',
      'ul', 'ol', 'li',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel', 'data-language'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    // Allow data: URIs on img (for base64 inline images)
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_DATA_URI_TAGS: ['img'],
  });
}
