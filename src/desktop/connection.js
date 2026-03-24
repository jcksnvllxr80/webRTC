async function connect() {
    const ip = document.getElementById('serverIP').value;
    const port = document.getElementById('serverPort').value;

    try {
        const url = `https://${ip}:${port}`;
        await window.electronAPI.connectToServer(url);
    } catch (error) {
        alert('Connection failed: ' + error.message);
    }
}