function showStatus(message, type) {
    const status = document.getElementById('status-message');
    status.textContent = message;
    status.className = `status-message is-visible ${type === 'success' ? 'is-success' : 'is-error'}`;
}

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = e.target.querySelector('button[type="submit"]');

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
        showStatus('Passwords do not match.', 'error');
        return;
    }

    try {
        submitButton.disabled = true;
        showStatus('Creating account...', 'success');

        const response = await fetch('/register', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            showStatus('Account created. Redirecting...', 'success');
            window.location.href = '/';
        } else {
            let message = 'Registration failed.';
            try {
                const data = await response.json();
                message = data.error || message;
            } catch (_err) {
            }
            showStatus(message, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showStatus('An error occurred during registration.', 'error');
    } finally {
        submitButton.disabled = false;
    }
});
