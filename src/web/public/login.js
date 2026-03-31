function showStatus(message, type) {
    const status = document.getElementById('status-message');
    status.textContent = message;
    status.className = `status-message is-visible ${type === 'success' ? 'is-success' : 'is-error'}`;
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');
    const formData = {
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
    };

    try {
        submitButton.disabled = true;
        showStatus('Logging in...', 'success');

        const response = await fetch('/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'FreeRTC'
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            showStatus('Login successful. Redirecting...', 'success');
            window.location.href = '/';
        } else {
            showStatus('Invalid username or password.', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus('An error occurred during login.', 'error');
    } finally {
        submitButton.disabled = false;
    }
});
