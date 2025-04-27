let peerConnection;
let localStream;
let remoteStream;

const socket = io(window.location.origin);
let roomId = 'main';

const servers = {
    iceServers:[
        {
            urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
};

let initCamera = async () => {
    try {
        console.log("Requesting camera access...");
        localStream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
        document.getElementById('user-1').srcObject = localStream;

        // Create new peer connection and offer
        if (peerConnection) {
            peerConnection.close();
        }
        await createOffer();
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Could not access camera and/or microphone');
    }
}

let shareScreen = async () => {
    try {
        if (localStream) {
            stopCamera();
        }

        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });

        document.getElementById('user-1').srcObject = localStream;

        localStream.getVideoTracks()[0].addEventListener('ended', () => {
            stopCamera();
        });

        // Create new peer connection and offer
        if (peerConnection) {
            peerConnection.close();
        }
        await createOffer();
    } catch (error) {
        console.error('Error sharing screen:', error);
        alert('Could not share screen');
    }
}


let stopCamera = () => {
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
        document.getElementById('user-1').srcObject = null;
        localStream = null;

        // Notify peers that we stopped our stream
        socket.emit('user-stopped-stream', roomId, socket.id);
    }
}



socket.on('user-connected', (userId) => {
    console.log('User connected:', userId);
    createOffer();
});

socket.emit('join-room', roomId, socket.id);


let createPeerConnection = async () => {
    peerConnection = new RTCPeerConnection(servers);

    // When receiving remote track, store the sender's ID
    peerConnection.ontrack = (event) => {
        const remoteStream = document.getElementById('user-2').srcObject || new MediaStream();
        remoteStream.addTrack(event.track);
        document.getElementById('user-2').srcObject = remoteStream;
        // Store the sender's ID with the remote video element
        document.getElementById('user-2').setAttribute('data-sender-id', remoteUserId);
    };

    remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject = remoteStream;

    // Only add local tracks if we have a local stream
    if (localStream) {
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });
    }

    peerConnection.ontrack = async (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
    };

    peerConnection.onicecandidate = async (event) => {
        if(event.candidate) {
            socket.emit('ice-candidate', event.candidate, roomId);
        }
    };
}

let createOffer = async () => {
    await createPeerConnection();

    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', offer, roomId);
}

let createAnswer = async (offer) => {
    await createPeerConnection();

    await peerConnection.setRemoteDescription(offer);
    
    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', answer, roomId);
}

socket.on('offer', async (offer) => {
    await createAnswer(offer);
});

socket.on('answer', async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(answer);
    }
});

socket.on('ice-candidate', async (candidate) => {
    if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
    }
});


document.getElementById('start-camera').addEventListener('click', initCamera);
document.getElementById('stop-camera').addEventListener('click', stopCamera);
document.getElementById('share-screen').addEventListener('click', shareScreen);
// Add these event listeners for chat
document.getElementById('send-message').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();

    console.log('Attempting to send message:', message); // Debug log

    if (message) {
        socket.emit('chat-message', {
            message: message,
            roomId: roomId
        });

        // Clear input
        messageInput.value = '';
    }

    // Play message sent sound
    const audio = document.getElementById('message-sent');
    audio.play().catch(e => console.log('Audio play failed:', e));
}

function addMessageToChat(username, message) {
    console.log('Adding message to chat:', username, message);
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('p');
    messageElement.style.margin = '5px 0';
    messageElement.innerHTML = `<strong>${username}:</strong> ${message}`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}


// Socket listener for incoming messages
socket.on('chat-message', (data) => {
    console.log('Received chat message:', data); // Debug log
    addMessageToChat(data.username, data.message);

    // Play message received sound
    const audio = document.getElementById('message-receive');
    audio.play().catch(e => console.log('Audio play failed:', e));
});

socket.on('user-stopped-stream', (stoppedUserId) => {
    const remoteVideo = document.getElementById('user-2');
    // Only clear if this remote video belongs to the user who stopped
    if (remoteVideo.getAttribute('data-sender-id') === stoppedUserId) {
        remoteVideo.srcObject = null;
    }
});
