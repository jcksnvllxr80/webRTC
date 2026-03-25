import { isInRoom } from './room.js';

const STORAGE_KEY = 'webrtc-onboarding-done';

const LOBBY_STEPS = [
    {
        target: '#create-room-btn',
        text: 'Create a room to start a video call. You\'ll get a shareable link.',
        position: 'bottom'
    },
    {
        target: '#join-room-input',
        text: 'Or paste a room link or ID from someone else to join their call.',
        position: 'bottom'
    },
    {
        target: '#lobby-friends',
        text: 'Your friends list — invite them to a call or manage connections.',
        position: 'top'
    }
];

const CALL_STEPS = [
    {
        target: '#start-camera',
        text: 'Start your camera and mic to share video with the room.',
        position: 'bottom'
    },
    {
        target: '#share-screen',
        text: 'Share your screen instead of your camera.',
        position: 'bottom'
    },
    {
        target: '#copy-room-link',
        text: 'Copy the room link to share with others.',
        position: 'bottom'
    },
    {
        target: '#chat-container',
        text: 'Text chat — send messages to everyone in the room.',
        position: 'top'
    }
];

export function showOnboarding() {
    if (localStorage.getItem(STORAGE_KEY)) return;

    const steps = isInRoom() ? CALL_STEPS : LOBBY_STEPS;
    let current = 0;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'onboarding-overlay';

    const tooltip = document.createElement('div');
    tooltip.className = 'onboarding-tooltip';

    const text = document.createElement('p');
    text.className = 'onboarding-text';

    const footer = document.createElement('div');
    footer.className = 'onboarding-footer';

    const counter = document.createElement('span');
    counter.className = 'onboarding-counter';

    const btnGroup = document.createElement('div');
    btnGroup.className = 'onboarding-btns';

    const skipBtn = document.createElement('button');
    skipBtn.className = 'onboarding-skip';
    skipBtn.textContent = 'Skip';
    skipBtn.addEventListener('click', finish);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'onboarding-next';
    nextBtn.addEventListener('click', () => {
        current++;
        if (current >= steps.length) {
            finish();
        } else {
            showStep();
        }
    });

    btnGroup.appendChild(skipBtn);
    btnGroup.appendChild(nextBtn);
    footer.appendChild(counter);
    footer.appendChild(btnGroup);
    tooltip.appendChild(text);
    tooltip.appendChild(footer);
    overlay.appendChild(tooltip);
    document.body.appendChild(overlay);

    function showStep() {
        const step = steps[current];
        const el = document.querySelector(step.target);
        text.textContent = step.text;
        counter.textContent = `${current + 1} / ${steps.length}`;
        nextBtn.textContent = current === steps.length - 1 ? 'Done' : 'Next';

        if (el) {
            const rect = el.getBoundingClientRect();
            // Position tooltip near the target
            tooltip.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - 320))}px`;
            if (step.position === 'bottom') {
                tooltip.style.top = `${rect.bottom + 12}px`;
                tooltip.style.bottom = '';
            } else {
                tooltip.style.top = '';
                tooltip.style.bottom = `${window.innerHeight - rect.top + 12}px`;
            }

            // Highlight the target
            el.classList.add('onboarding-highlight');
            // Remove highlight from previous
            document.querySelectorAll('.onboarding-highlight').forEach(prev => {
                if (prev !== el) prev.classList.remove('onboarding-highlight');
            });
        }
    }

    function finish() {
        localStorage.setItem(STORAGE_KEY, '1');
        document.querySelectorAll('.onboarding-highlight').forEach(el => {
            el.classList.remove('onboarding-highlight');
        });
        overlay.remove();
    }

    // Small delay so the page renders first
    requestAnimationFrame(() => {
        requestAnimationFrame(() => showStep());
    });
}
