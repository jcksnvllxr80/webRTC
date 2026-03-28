window.addEventListener('DOMContentLoaded', async () => {
    try {
        const url = await window.electronAPI.getDefaultServerUrl();
        if (url) document.getElementById('serverUrl').value = url;
    } catch { /* ignore */ }
    document.getElementById('serverUrl').focus();
});

async function connect() {
    const urlInput = document.getElementById('serverUrl');
    const btn      = document.getElementById('connect-btn');
    const errorEl  = document.getElementById('error-msg');

    const url = urlInput.value.trim();

    errorEl.textContent = '';

    if (!url) {
        errorEl.textContent = 'Please enter a server URL.';
        urlInput.focus();
        return;
    }

    btn.disabled      = true;
    btn.textContent   = 'Connecting…';
    urlInput.disabled = true;

    try {
        await window.electronAPI.connectToServer(url);
    } catch (error) {
        const msg = (error && error.message) ? error.message : String(error);
        errorEl.textContent = 'Connection failed: ' + msg;
    } finally {
        btn.disabled      = false;
        btn.textContent   = 'Connect';
        urlInput.disabled = false;
        urlInput.focus();
        urlInput.select();
    }
}
