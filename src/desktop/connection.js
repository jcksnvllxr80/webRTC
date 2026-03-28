async function connect() {
    const ipInput   = document.getElementById('serverIP');
    const portInput = document.getElementById('serverPort');
    const btn       = document.getElementById('connect-btn');
    const errorEl   = document.getElementById('error-msg');

    const ip   = ipInput.value.trim();
    const port = portInput.value.trim();

    errorEl.textContent = '';

    if (!ip || !port) {
        errorEl.textContent = 'Please enter both an IP address and port.';
        (ip ? portInput : ipInput).focus();
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Connecting…';
    ipInput.disabled = true;
    portInput.disabled = true;

    try {
        const url = `https://${ip}:${port}`;
        await window.electronAPI.connectToServer(url);
    } catch (error) {
        const msg = (error && error.message) ? error.message : String(error);
        errorEl.textContent = 'Connection failed: ' + msg;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Connect';
        ipInput.disabled = false;
        portInput.disabled = false;
        ipInput.focus();
        ipInput.select();
    }
}
