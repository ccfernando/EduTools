let timerInterval = null;
let totalSeconds = 0;
let isRunning = false;

const timerDisplay = document.getElementById('timer');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const durationInput = document.getElementById('duration');
const setDurationBtn = document.getElementById('set-duration-btn');

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [hrs, mins, secs]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');
}

function updateDisplay() {
    timerDisplay.textContent = formatTime(totalSeconds);
    
    timerDisplay.classList.remove('warning', 'danger');
    if (totalSeconds <= 60 && totalSeconds > 0) {
        timerDisplay.classList.add('danger');
    } else if (totalSeconds <= 300 && totalSeconds > 0) {
        timerDisplay.classList.add('warning');
    }
}

function startTimer() {
    if (!isRunning) {
        isRunning = true;
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        durationInput.disabled = true;
        
        timerInterval = setInterval(() => {
            if (totalSeconds > 0) {
                totalSeconds--;
                updateDisplay();
            } else {
                stopTimer();
                timerDisplay.classList.remove('warning', 'danger');
            }
        }, 1000);
    }
}

function stopTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

function resetTimer() {
    stopTimer();
    const minutes = parseInt(durationInput.value) || 30;
    totalSeconds = minutes * 60;
    updateDisplay();
}

function setDuration() {
    const minutes = parseInt(durationInput.value) || 30;
    totalSeconds = minutes * 60;
    updateDisplay();
}

startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', stopTimer);
resetBtn.addEventListener('click', resetTimer);
setDurationBtn.addEventListener('click', setDuration);

durationInput.addEventListener('change', setDuration);

resetTimer();