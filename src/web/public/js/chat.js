import { state, socket } from './state.js';

function addMessageToChat(username, message) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('p');
    messageElement.style.margin = '5px 0';
    const strong = document.createElement('strong');
    strong.textContent = username + ':';
    messageElement.appendChild(strong);
    messageElement.appendChild(document.createTextNode(' ' + message));
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

export function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();

    if (message) {
        socket.emit('chat-message', {
            message: message,
            roomId: state.roomId
        });
        messageInput.value = '';
    }

    const audio = document.getElementById('message-sent');
    audio.play().catch(e => console.log('Audio play failed:', e));
}

export function setupChatListeners() {
    document.getElementById('send-message').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    socket.on('chat-message', (data) => {
        addMessageToChat(data.username, data.message);

        const audio = document.getElementById('message-receive');
        audio.play().catch(e => console.log('Audio play failed:', e));
    });
}
