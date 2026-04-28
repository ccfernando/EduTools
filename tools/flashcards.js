const STORAGE_KEY = 'edutools_flashcards';

let decks = [];
let currentDeckIndex = 0;
let currentCardIndex = 0;

function getDecks() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveDecks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

function renderDecksList() {
    const decksList = document.getElementById('decks-list');
    const deckSelect = document.getElementById('deck-select');
    
    if (!decksList) return;
    
    if (decks.length === 0) {
        decksList.innerHTML = '<p class="empty-state">No decks yet. Create one to get started!</p>';
        deckSelect.innerHTML = '<option>No decks</option>';
        return;
    }
    
    deckSelect.innerHTML = decks.map((d, i) => 
        `<option value="${i}">${d.name} (${d.cards.length} cards)</option>`
    ).join('');
    
    decksList.innerHTML = decks.map((d, i) => `
        <div class="deck-item">
            <h3>${d.name} <span style="font-size:14px;color:#666">${d.cards.length} cards</span></h3>
            <div class="deck-actions">
                <button class="btn small" onclick="loadDeck(${i})">Study</button>
                <button class="btn small danger" onclick="deleteDeck(${i})">Delete</button>
            </div>
        </div>
    `).join('');
    
    if (deckSelect.options.length > 0) {
        deckSelect.selectedIndex = currentDeckIndex;
    }
}

function loadDeck(index) {
    currentDeckIndex = index;
    currentCardIndex = 0;
    renderDeckSelect();
    showCard(0);
}

function renderDeckSelect() {
    const select = document.getElementById('deck-select');
    if (!select || decks.length === 0) return;
    
    select.innerHTML = decks.map((d, i) => 
        `<option value="${i}">${d.name} (${d.cards.length} cards)</option>`
    ).join('');
    
    if (select.options.length > currentDeckIndex) {
        select.selectedIndex = currentDeckIndex;
    }
}

function showCard(index) {
    const flashcard = document.getElementById('flashcard');
    const currentNum = document.getElementById('current-num');
    const totalNum = document.getElementById('total-num');
    const contents = flashcard.querySelectorAll('.card-content');
    const numbers = flashcard.querySelectorAll('.card-number');
    
    flashcard.classList.remove('flipped');
    
    if (decks.length === 0 || decks[currentDeckIndex].cards.length === 0) {
        contents.forEach(c => c.textContent = 'No cards');
        numbers.forEach(n => n.textContent = '0');
        currentNum.textContent = '0';
        totalNum.textContent = '0';
        return;
    }
    
    const deck = decks[currentDeckIndex];
    const cardIndex = Math.max(0, Math.min(index, deck.cards.length - 1));
    const card = deck.cards[cardIndex];
    
    contents[0].textContent = card.front;
    contents[1].textContent = card.back;
    numbers[0].textContent = cardIndex + 1;
    numbers[1].textContent = cardIndex + 1;
    
    currentNum.textContent = cardIndex + 1;
    totalNum.textContent = deck.cards.length;
    
    currentCardIndex = cardIndex;
}

function flipCard() {
    const flashcard = document.getElementById('flashcard');
    flashcard.classList.toggle('flipped');
}

function prevCard() {
    const deck = decks[currentDeckIndex];
    if (deck && deck.cards.length > 0) {
        const newIndex = currentCardIndex - 1 >= 0 ? currentCardIndex - 1 : deck.cards.length - 1;
        showCard(newIndex);
    }
}

function nextCard() {
    const deck = decks[currentDeckIndex];
    if (deck && deck.cards.length > 0) {
        const newIndex = (currentCardIndex + 1) % deck.cards.length;
        showCard(newIndex);
    }
}

function createDeck() {
    const nameInput = document.getElementById('deck-name');
    const name = nameInput.value.trim();
    
    if (!name) return;
    
    if (decks.find(d => d.name === name)) {
        alert('Deck already exists!');
        return;
    }
    
    decks.push({ name, cards: [] });
    saveDecks();
    nameInput.value = '';
    renderDecksList();
}

function addCard() {
    const frontInput = document.getElementById('card-front');
    const backInput = document.getElementById('card-back');
    
    const front = frontInput.value.trim();
    const back = backInput.value.trim();
    
    if (!front || !back) {
        alert('Please fill in both sides of the card.');
        return;
    }
    
    if (decks.length === 0) {
        alert('Please create a deck first.');
        return;
    }
    
    decks[currentDeckIndex].cards.push({ front, back });
    saveDecks();
    
    frontInput.value = '';
    backInput.value = '';
    
    renderDecksList();
    renderDeckSelect();
}

function deleteDeck(index) {
    if (confirm('Are you sure you want to delete this deck?')) {
        decks.splice(index, 1);
        saveDecks();
        currentDeckIndex = 0;
        currentCardIndex = 0;
        renderDecksList();
        renderDeckSelect();
        showCard(0);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    decks = getDecks();
    renderDecksList();
    showCard(0);
    
    const tabs = document.querySelectorAll('.tabs .tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            tabContents.forEach(c => c.classList.add('hidden'));
            document.getElementById(`${tab.dataset.tab}-tab`).classList.remove('hidden');
        });
    });
    
    document.getElementById('flashcard')?.addEventListener('click', flipCard);
    document.getElementById('flip-card')?.addEventListener('click', flipCard);
    document.getElementById('prev-card')?.addEventListener('click', prevCard);
    document.getElementById('next-card')?.addEventListener('click', nextCard);
    document.getElementById('create-deck-btn')?.addEventListener('click', createDeck);
    document.getElementById('add-card-btn')?.addEventListener('click', addCard);
    
    document.getElementById('deck-select')?.addEventListener('change', (e) => {
        loadDeck(parseInt(e.target.value));
    });
});