console.log("script.js loaded successfully!");

let navStack = [0];

// Глобальные переменные для системы весов
let brokenCrystals = {};
let cooldownTimers = {};
let scaleWeights = {
    left: 0,   // Карьера (фиолетовые)
    right: 0   // Семья (синие)
};
let currentScaleState = 'balanced';

// Конфигурация приложения
const CONFIG = {
    COOLDOWN_TIME: 3600000, // 1 час в миллисекундах
    BREAK_THRESHOLD: 15,
    BASE_CRYSTAL_WEIGHT: 3,
    MAX_IMBALANCE_WEIGHT: 2
};

// Веса для разных уровней поломки
const WEIGHT_LEVELS = {
    1: 1,  // 1 сломанный алмаз
    2: 3,  // 2 сломанных алмаза
    3: 6   // 3 сломанных алмаза
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded");
    initializeApp();
    loadAllStates();
});

// Инициализация приложения
function initializeApp() {
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            if (navStack.length > 1) {
                window.navigateBack();
            } else {
                window.closeModal();
            }
        }
    });
    
    initializeAllSliders();
    addDynamicStyles();
    updateWeightDisplay(); // Добавляем отображение весов
}

// Добавление динамических стилей
function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
        }
        
        .broken-crystal-indicator {
            animation: pulse 2s infinite;
        }
        
        .crystal-broken {
            filter: 
                drop-shadow(0 0 25px rgba(255, 0, 0, 0.9)) 
                drop-shadow(0 0 15px rgba(255, 50, 50, 0.7)) !important;
            opacity: 0.85;
        }
        
        .crystal-in-bowl.crystal-broken {
            filter: 
                drop-shadow(0 0 20px rgba(255, 0, 0, 0.8))
                drop-shadow(0 0 10px rgba(255, 50, 50, 0.6)) !important;
            opacity: 0.8;
        }
        
        .crystal-in-bowl.crystal-broken .crystal-text {
            color: rgba(255, 100, 100, 0.9) !important;
        }

        /* Стили для таймера кристалла */
        .crystal-timer {
            font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        }

        .timer-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
        }

        .timer-label {
            font-size: 0.9rem;
            opacity: 0.9;
            font-weight: 500;
        }

        .timer-value {
            font-size: 1.4rem;
            font-weight: bold;
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
        }

        /* Анимация пульсации для привлечения внимания */
        @keyframes timerPulse {
            0% { transform: translateX(-50%) scale(1); }
            50% { transform: translateX(-50%) scale(1.05); }
            100% { transform: translateX(-50%) scale(1); }
        }

        .crystal-timer {
            animation: timerPulse 2s ease-in-out infinite;
        }

        /* Стили для отображения весов */
        .weight-display {
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(32, 30, 42, 0.9);
            color: #e6eef6;
            padding: 8px 16px;
            border-radius: 20px;
            border: 1px solid var(--accent-1);
            font-size: 0.9rem;
            z-index: 100;
            backdrop-filter: blur(10px);
        }

        .weight-left {
            color: var(--accent-3);
            font-weight: bold;
        }

        .weight-right {
            color: var(--accent-2);
            font-weight: bold;
        }

        .weight-difference {
            color: #ff6b6b;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);
}

// Функция для отображения текущих весов
function updateWeightDisplay() {
    // Удаляем старое отображение если есть
    const oldDisplay = document.querySelector('.weight-display');
    if (oldDisplay) oldDisplay.remove();

    const totalLeftWeight = scaleWeights.left;
    const totalRightWeight = scaleWeights.right;
    const weightDifference = Math.abs(totalLeftWeight - totalRightWeight);
    const isLeftHeavier = totalLeftWeight > totalRightWeight;

    const display = document.createElement('div');
    display.className = 'weight-display';
    
    let displayText = '';
    if (weightDifference === 0) {
        displayText = '⚖️ Весы сбалансированы';
    } else {
        const heavierSide = isLeftHeavier ? 'Карьера' : 'Семья';
        displayText = `⚖️ ${heavierSide} тяжелее на <span class="weight-difference">${weightDifference}кг</span>`;
    }
    
    display.innerHTML = `${displayText} | <span class="weight-left">${totalLeftWeight}кг</span> : <span class="weight-right">${totalRightWeight}кг</span>`;
    
    const scaleContainer = document.querySelector('.scale');
    if (scaleContainer) {
        scaleContainer.appendChild(display);
    }
}

// Загрузка всех состояний из localStorage
function loadAllStates() {
    // Загружаем состояния кристаллов
    const savedStates = localStorage.getItem('crystalStates');
    if (savedStates) {
        brokenCrystals = JSON.parse(savedStates);
        updateBrokenCrystalsVisuals();
    }
    
    // Загружаем состояние весов
    const savedScaleState = localStorage.getItem('scaleState');
    if (savedScaleState) {
        try {
            const scaleState = JSON.parse(savedScaleState);
            scaleWeights = scaleState.weights || { left: 0, right: 0 };
            currentScaleState = scaleState.state || 'balanced';
            
            // Применяем сохраненное состояние весов
            setTimeout(() => {
                updateScaleBalance();
                updateWeightDisplay();
            }, 100);
        } catch (e) {
            console.error('Error loading scale state:', e);
        }
    }
}

// Сохранение всех состояний
function saveAllStates() {
    localStorage.setItem('crystalStates', JSON.stringify(brokenCrystals));
    localStorage.setItem('scaleState', JSON.stringify({
        weights: scaleWeights,
        state: currentScaleState
    }));
}

// Функция для подсчета количества сломанных кристаллов в каждой чаше
function countBrokenCrystals() {
    let leftCount = 0; // Карьера (уровни 6,7,8)
    let rightCount = 0; // Семья (уровни 3,4,5)
    
    for (let level = 3; level <= 8; level++) {
        if (brokenCrystals[level]) {
            if (level >= 6) {
                leftCount++;
            } else {
                rightCount++;
            }
        }
    }
    
    return { left: leftCount, right: rightCount };
}

// Функция для расчета веса на основе количества сломанных кристаллов
function calculateBrokenWeight(count) {
    if (count === 0) return 0;
    if (count === 1) return WEIGHT_LEVELS[1];
    if (count === 2) return WEIGHT_LEVELS[2];
    if (count >= 3) return WEIGHT_LEVELS[3];
    return 0;
}

// Обновление весов на основе сломанных кристаллов
function updateWeightsFromBrokenCrystals() {
    const brokenCounts = countBrokenCrystals();
    
    // Рассчитываем новые веса
    const newLeftWeight = calculateBrokenWeight(brokenCounts.left);
    const newRightWeight = calculateBrokenWeight(brokenCounts.right);
    
    // Устанавливаем новые веса
    scaleWeights.left = newLeftWeight;
    scaleWeights.right = newRightWeight;
    
    console.log(`Broken crystals - Left: ${brokenCounts.left} (${newLeftWeight}kg), Right: ${brokenCounts.right} (${newRightWeight}kg)`);
}

// Инициализация всех слайдеров
function initializeAllSliders() {
    const sliders = document.querySelectorAll('.advanced-slider-container');
    sliders.forEach(container => {
        const input = container.querySelector('.advanced-slider-input');
        const initialValue = parseInt(input.value) || 0;
        updateSliderVisuals(container, initialValue);
        setupSliderDrag(container);
    });
}

// Настройка перетаскивания для слайдера
function setupSliderDrag(container) {
    const track = container.querySelector('.slider-track');
    const thumb = container.querySelector('.slider-thumb');
    const input = container.querySelector('.advanced-slider-input');
    
    if (!track || !thumb || !input) return;
    
    let isDragging = false;
    
    const startDrag = (e) => {
        isDragging = true;
        thumb.style.cursor = 'grabbing';
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        if (e.type === 'touchstart') {
            document.addEventListener('touchmove', onDrag);
            document.addEventListener('touchend', stopDrag);
        }
    };
    
    const onDrag = (e) => {
        if (!isDragging) return;
        
        const rect = track.getBoundingClientRect();
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        let percentage = ((clientX - rect.left) / rect.width) * 100;
        percentage = Math.max(0, Math.min(100, percentage));
        
        const value = Math.round((percentage / 100) * 60 - 30);
        updateSliderValue(container, value);
    };
    
    const stopDrag = () => {
        isDragging = false;
        thumb.style.cursor = 'grab';
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('touchend', stopDrag);
        
        const level = container.closest('.nav-level')?.dataset.level;
        if (level) {
            setTimeout(() => checkCrystalBalance(level), 100);
        }
    };
    
    thumb.addEventListener('mousedown', startDrag);
    thumb.addEventListener('touchstart', startDrag);
    track.addEventListener('click', (e) => {
        const rect = track.getBoundingClientRect();
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        let percentage = ((clientX - rect.left) / rect.width) * 100;
        percentage = Math.max(0, Math.min(100, percentage));
        
        const value = Math.round((percentage / 100) * 60 - 30);
        updateSliderValue(container, value);
        
        const level = container.closest('.nav-level')?.dataset.level;
        if (level) {
            setTimeout(() => checkCrystalBalance(level), 100);
        }
    });
}

// Обновление значения слайдера
function updateSliderValue(container, value) {
    const input = container.querySelector('.advanced-slider-input');
    const min = parseInt(input.min) || -30;
    const max = parseInt(input.max) || 30;
    
    value = Math.max(min, Math.min(max, value));
    input.value = value;
    updateSliderVisuals(container, value);
    
    const valueDisplay = container.closest('.facet-input-group')?.querySelector('.current-value-display');
    if (valueDisplay) {
        valueDisplay.textContent = value;
    }
}

// Функция для обновления визуала продвинутого ползунка
function updateSliderVisuals(container, value) {
    const thumb = container.querySelector('.slider-thumb');
    const valueDisplay = container.querySelector('.slider-value');
    const fill = container.querySelector('.slider-fill');
    const headerValue = container.closest('.facet-input-group')?.querySelector('.current-value-display');
    
    const crystalContainer = container.closest('.nav-level');
    const isCareerCrystal = crystalContainer?.querySelector('.career-crystal') !== null;
    
    if (valueDisplay) valueDisplay.textContent = value;
    if (headerValue) headerValue.textContent = value;
    
    const percentage = ((value + 30) / 60) * 100;
    
    if (thumb) thumb.style.left = `${percentage}%`;
    if (fill) fill.style.width = `${percentage}%`;
    
    if (value < 0) {
        if (fill) fill.style.background = 'linear-gradient(90deg, #ff6b6b 0%, #ffa500 100%)';
        if (thumb) thumb.style.background = '#ff6b6b';
        if (headerValue) {
            headerValue.style.borderColor = '#ff6b6b';
            headerValue.style.background = 'rgba(255, 107, 107, 0.2)';
            headerValue.style.color = '#ff6b6b';
        }
    } else if (value > 0) {
        if (isCareerCrystal) {
            if (fill) fill.style.background = 'linear-gradient(90deg, rgba(192,126,224,0.8) 0%, rgba(178,152,220,0.9) 100%)';
            if (thumb) thumb.style.background = 'var(--accent-3)';
            if (headerValue) {
                headerValue.style.borderColor = 'var(--accent-3)';
                headerValue.style.background = 'rgba(192,126,224,0.2)';
                headerValue.style.color = 'var(--accent-3)';
            }
        } else {
            if (fill) fill.style.background = 'linear-gradient(90deg, rgba(124,199,224,0.8) 0%, rgba(78,205,196,0.9) 100%)';
            if (thumb) thumb.style.background = 'var(--accent-2)';
            if (headerValue) {
                headerValue.style.borderColor = 'var(--accent-2)';
                headerValue.style.background = 'rgba(124,199,224,0.2)';
                headerValue.style.color = 'var(--accent-2)';
            }
        }
    } else {
        if (fill) fill.style.background = 'linear-gradient(90deg, #ffa500 0%, #ffa500 100%)';
        if (thumb) thumb.style.background = '#ffa500';
        if (headerValue) {
            headerValue.style.borderColor = '#ffa500';
            headerValue.style.background = 'rgba(255, 165, 0, 0.2)';
            headerValue.style.color = '#ffa500';
        }
    }
}

// Навигационные функции
window.navigateTo = function(level) { 
    console.log("Navigating to level:", level); 
    const current = document.querySelector(".nav-level.active"); 
    if (current) current.classList.remove("active");

    const target = document.querySelector('[data-level="' + level + '"]');
    if (target) {
        target.classList.add("active");
        navStack.push(level);
        
        if (level === 1 || level === 2) {
            updateBrokenCrystalsOnBowlLevel(level);
        }
    } else {
        console.error(`Target level ${level} not found`);
        if (navStack.length > 0) {
            const prevLevel = navStack[navStack.length - 1];
            const prevElement = document.querySelector('[data-level="' + prevLevel + '"]');
            if (prevElement) prevElement.classList.add("active");
        }
    }
};

window.closeModal = function() { 
    console.log("Closing modal - returning to main screen");

    document.querySelectorAll('.nav-level').forEach(function(level) {
        if (level.getAttribute("data-level") !== "0") {
            level.classList.remove("active");
        }
    });

    const mainScreen = document.querySelector('[data-level="0"]');
    if (mainScreen) {
        mainScreen.classList.add("active");
    }

    navStack = [0];
};

window.navigateBack = function() { 
    if (navStack.length > 1) { 
        navStack.pop(); 
        const current = document.querySelector(".nav-level.active"); 
        if (current) current.classList.remove("active");

        const prevLevel = navStack[navStack.length - 1];
        const prevElement = document.querySelector('[data-level="' + prevLevel + '"]');
        if (prevElement) {
            prevElement.classList.add("active");
            
            if (prevLevel === 1 || prevLevel === 2) {
                updateBrokenCrystalsOnBowlLevel(prevLevel);
            }
        }
    }
};

// Функция для продвинутого ползунка
window.changeAdvancedValue = function(button, change) {
    const container = button.closest('.advanced-slider-container');
    const input = container.querySelector('.advanced-slider-input');
    
    let currentValue = parseInt(input.value) || 0;
    let newValue = currentValue + change;
    
    const min = parseInt(input.min) || -30;
    const max = parseInt(input.max) || 30;
    
    if (newValue >= min && newValue <= max) {
        updateSliderValue(container, newValue);
        
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = '';
        }, 150);
        
        const level = container.closest('.nav-level')?.dataset.level;
        if (level) {
            setTimeout(() => checkCrystalBalance(level), 100);
        }
        
        console.log(`Advanced slider value changed to: ${newValue}`);
    }
};

// Функция для проверки баланса и ломки алмаза
function checkCrystalBalance(level) {
    const crystalContainer = document.querySelector(`[data-level="${level}"]`);
    if (!crystalContainer) return;
    
    if (brokenCrystals[level]) return;
    
    const sliders = crystalContainer.querySelectorAll('.advanced-slider-input');
    const values = Array.from(sliders).map(slider => parseInt(slider.value) || 0);
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    console.log(`Level ${level} - SD: ${standardDeviation}, Values: ${values}`);
    
    if (standardDeviation > CONFIG.BREAK_THRESHOLD && !brokenCrystals[level]) {
        breakCrystal(level);
    }
}

// Функция расчета веса кристалла на основе дисбаланса
function calculateCrystalWeight(level) {
    const crystalContainer = document.querySelector(`[data-level="${level}"]`);
    if (!crystalContainer) return 0;
    
    const sliders = crystalContainer.querySelectorAll('.advanced-slider-input');
    const values = Array.from(sliders).map(slider => parseInt(slider.value) || 0);
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    const baseWeight = CONFIG.BASE_CRYSTAL_WEIGHT;
    const imbalanceWeight = Math.min(standardDeviation / 10, CONFIG.MAX_IMBALANCE_WEIGHT);
    
    return baseWeight + imbalanceWeight;
}

// Функция обновления весов
function updateScaleBalance() {
    const totalLeftWeight = scaleWeights.left;
    const totalRightWeight = scaleWeights.right;
    
    const weightDifference = Math.abs(totalLeftWeight - totalRightWeight);
    const isLeftHeavier = totalLeftWeight > totalRightWeight;
    
    console.log(`Weights - Left: ${totalLeftWeight}kg, Right: ${totalRightWeight}kg, Diff: ${weightDifference}kg`);
    
    let tiltIntensity = 'light';
    if (weightDifference >= 3) tiltIntensity = 'medium';
    if (weightDifference >= 6) tiltIntensity = 'heavy';
    
    const scaleContainer = document.querySelector('.scale');
    const leftPan = document.querySelector('.left-pan-btn');
    const rightPan = document.querySelector('.right-pan-btn');
    
    if (!scaleContainer || !leftPan || !rightPan) return;
    
    // Сбрасываем все классы
    scaleContainer.className = 'scale';
    leftPan.className = 'pan-btn left-pan-btn';
    rightPan.className = 'pan-btn right-pan-btn';
    
    if (weightDifference > 0) {
        if (isLeftHeavier) {
            scaleContainer.classList.add(`beam-tilt-left-${tiltIntensity}`);
            leftPan.classList.add(`pan-move-down-${tiltIntensity}`);
            rightPan.classList.add(`pan-move-up-${tiltIntensity}`);
            currentScaleState = 'left_tilt';
        } else {
            scaleContainer.classList.add(`beam-tilt-right-${tiltIntensity}`);
            leftPan.classList.add(`pan-move-up-${tiltIntensity}`);
            rightPan.classList.add(`pan-move-down-${tiltIntensity}`);
            currentScaleState = 'right_tilt';
        }
    } else {
        currentScaleState = 'balanced';
    }
    
    // Обновляем отображение весов
    updateWeightDisplay();
    
    // Сохраняем состояние
    saveAllStates();
}

// Функция ломки алмаза
function breakCrystal(level) {
    console.log(`Breaking crystal at level ${level}`);
    
    const crystalContainer = document.querySelector(`[data-level="${level}"]`);
    if (!crystalContainer) {
        console.error(`Crystal container not found for level ${level}`);
        return;
    }
    
    const crystal = crystalContainer.querySelector('.extra-large-crystal');
    if (!crystal) {
        console.error(`Crystal not found for level ${level}`);
        return;
    }
    
    const isCareerCrystal = crystal.classList.contains('career-crystal');
    
    // Помечаем кристалл как сломанный
    brokenCrystals[level] = true;
    
    // Добавляем класс поломки
    crystal.classList.add('crystal-broken');
    
    // Блокируем взаимодействие
    const sliders = crystalContainer.querySelectorAll('.slider-btn, .slider-track');
    sliders.forEach(slider => {
        slider.style.pointerEvents = 'none';
        slider.style.opacity = '0.5';
    });
    
    // Обновляем веса на основе количества сломанных кристаллов
    updateWeightsFromBrokenCrystals();
    
    // Добавляем таймер на уровень кристалла
    addCrystalTimer(level);
    
    updateScaleBalance();
    showBreakMessage(level, isCareerCrystal);
    saveAllStates();
    updateBrokenCrystalsOnBowlLevel(isCareerCrystal ? 2 : 1);
    
    cooldownTimers[level] = setTimeout(() => {
        restoreCrystal(level);
    }, CONFIG.COOLDOWN_TIME);
    
    console.log(`Crystal at level ${level} broken. Will restore in 1 hour.`);
}

// Функция восстановления кристалла
function restoreCrystal(level) {
    console.log(`Restoring crystal at level ${level}`);
    
    const crystalContainer = document.querySelector(`[data-level="${level}"]`);
    if (crystalContainer) {
        const timer = crystalContainer.querySelector('.crystal-timer');
        if (timer) {
            if (timer.timer) clearInterval(timer.timer);
            timer.remove();
        }
    }
    
    if (!crystalContainer) return;
    
    const crystal = crystalContainer.querySelector('.extra-large-crystal');
    if (!crystal) return;
    
    const isCareerCrystal = crystal.classList.contains('career-crystal');
    
    // Убираем класс поломки
    crystal.classList.remove('crystal-broken');
    
    // Обновляем состояние
    brokenCrystals[level] = false;
    
    // Разблокируем взаимодействие
    const sliders = crystalContainer.querySelectorAll('.slider-btn, .slider-track');
    sliders.forEach(slider => {
        slider.style.pointerEvents = 'auto';
        slider.style.opacity = '1';
    });
    
    // Обновляем веса на основе количества сломанных кристаллов
    updateWeightsFromBrokenCrystals();
    
    // Обновляем визуал
    updateScaleBalance();
    saveAllStates();
    updateBrokenCrystalsOnBowlLevel(isCareerCrystal ? 2 : 1);
    hideBreakMessage(level);
    
    console.log(`Crystal at level ${level} restored.`);
}

// Функция показа сообщения о ломке
function showBreakMessage(level, isCareerCrystal) {
    hideBreakMessage(level);
    
    const message = document.createElement('div');
    message.className = 'break-message';
    message.dataset.level = level;
    
    message.innerHTML = `
        <div class="break-alert">
            <button class="close-break-message">×</button>
            <h3>Кристалл перегружен!</h3>
            <p>Слишком большой дисбаланс в гранях привел к поломке.</p>
            <p>Кристалл восстановится через: <span class="cooldown-timer">60:00</span></p>
            <p class="break-note">Вы можете закрыть это сообщение - кристалл все равно восстановится автоматически через 1 час</p>
        </div>
    `;
    
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 50, 50, 0.95);
        color: white;
        padding: 0;
        border-radius: 12px;
        z-index: 10000;
        text-align: center;
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255, 100, 100, 0.8);
        box-shadow: 0 10px 30px rgba(255, 0, 0, 0.3);
        min-width: 350px;
        max-width: 500px;
    `;
    
    document.body.appendChild(message);
    
    const alertContent = message.querySelector('.break-alert');
    alertContent.style.padding = '25px';
    alertContent.style.position = 'relative';
    
    const closeBtn = message.querySelector('.close-break-message');
    closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 12px;
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.3s ease;
    `;
    
    closeBtn.addEventListener('click', function() {
        hideBreakMessage(level);
    });
    
    closeBtn.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    
    closeBtn.addEventListener('mouseleave', function() {
        this.style.background = 'none';
    });
    
    const note = message.querySelector('.break-note');
    note.style.cssText = `
        font-size: 0.85em;
        opacity: 0.8;
        margin-top: 15px;
        font-style: italic;
    `;
    
    let timeLeft = 3600; // 1 час в секундах
    const timerElement = message.querySelector('.cooldown-timer');
    
    const timer = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        if (timerElement) {
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            if (timerElement) timerElement.textContent = "00:00";
        }
    }, 1000);
    
    message.timer = timer;
}

// Функция скрытия сообщения о ломке
window.hideBreakMessage = function(level) {
    const message = document.querySelector(`.break-message[data-level="${level}"]`);
    if (message) {
        if (message.timer) {
            clearInterval(message.timer);
        }
        message.remove();
    }
};

// Обновление визуального отображения сломанных кристаллов на уровне чаш - БЕЗ ИНДИКАТОРОВ
function updateBrokenCrystalsOnBowlLevel(bowlLevel) {
    let crystalLevels = [];
    if (bowlLevel === 1) {
        crystalLevels = [3, 4, 5];
    } else if (bowlLevel === 2) {
        crystalLevels = [6, 7, 8];
    }
    
    const bowlContainer = document.querySelector(`[data-level="${bowlLevel}"] .crystals-group`);
    if (!bowlContainer) return;
    
    // Удаляем старые индикаторы
    const oldIndicators = bowlContainer.querySelectorAll('.broken-crystal-indicator');
    oldIndicators.forEach(indicator => indicator.remove());
    
    // Убираем классы поломки со всех кристаллов
    const allCrystals = bowlContainer.querySelectorAll('.crystal-in-bowl');
    allCrystals.forEach(crystal => {
        crystal.classList.remove('crystal-broken');
    });
    
    // Добавляем классы только для сломанных кристаллов (БЕЗ ИНДИКАТОРОВ)
    crystalLevels.forEach(crystalLevel => {
        if (brokenCrystals[crystalLevel]) {
            const crystalIndex = crystalLevels.indexOf(crystalLevel) + 1;
            const crystalElement = bowlContainer.querySelector(`.crystal-${crystalIndex}`);
            if (crystalElement) {
                // ТОЛЬКО добавляем класс поломки, НЕ добавляем индикатор
                crystalElement.classList.add('crystal-broken');
            }
        }
    });
}

// Добавление индикатора поломки к кристаллу на уровне чаш
function addBrokenIndicator(crystalElement, crystalLevel) {
    const indicator = document.createElement('div');
    indicator.className = 'broken-crystal-indicator';
    indicator.title = 'Кристалл сломан - восстановление через 1 час';
    
    indicator.style.cssText = `
        position: absolute;
        top: -5px;
        right: -5px;
        font-size: 20px;
        z-index: 10;
        background: rgba(255, 0, 0, 0.8);
        border-radius: 50%;
        width: 25px;
        height: 25px;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: pulse 2s infinite;
    `;
    
    crystalElement.style.position = 'relative';
    crystalElement.appendChild(indicator);
    
    // Добавляем класс поломки
    crystalElement.classList.add('crystal-broken');
}

// Обновление всех визуальных отображений сломанных кристаллов
function updateBrokenCrystalsVisuals() {
    for (let level = 3; level <= 8; level++) {
        if (brokenCrystals[level]) {
            const crystalContainer = document.querySelector(`[data-level="${level}"]`);
            if (crystalContainer) {
                const crystal = crystalContainer.querySelector('.extra-large-crystal');
                if (crystal) {
                    crystal.classList.add('crystal-broken');
                }
                
                const sliders = crystalContainer.querySelectorAll('.slider-btn, .slider-track');
                sliders.forEach(slider => {
                    slider.style.pointerEvents = 'none';
                    slider.style.opacity = '0.5';
                });
            }
        }
    }
    
    updateBrokenCrystalsOnBowlLevel(1);
    updateBrokenCrystalsOnBowlLevel(2);
}

// Функция восстановления всех кристаллов
window.restoreAllCrystals = function() {
    if (confirm('Восстановить все сломанные кристаллы?')) {
        console.log('Восстановление всех кристаллов...');
        
        // Очищаем все таймеры восстановления
        Object.values(cooldownTimers).forEach(timer => {
            if (timer) clearTimeout(timer);
        });
        cooldownTimers = {};
        
        // Восстанавливаем ВСЕ кристаллы
        for (let level = 3; level <= 8; level++) {
            if (brokenCrystals[level]) {
                restoreCrystal(level);
            }
        }
        
        // Удаляем все таймеры
        for (let level = 3; level <= 8; level++) {
            const crystalContainer = document.querySelector(`[data-level="${level}"]`);
            if (crystalContainer) {
                const timer = crystalContainer.querySelector('.crystal-timer');
                if (timer) {
                    if (timer.timer) clearInterval(timer.timer);
                    timer.remove();
                }
            }
        }
        
        // Сбрасываем веса весов
        scaleWeights = { left: 0, right: 0 };
        
        // Сохраняем состояние
        saveAllStates();
        
        // Обновляем визуальное отображение
        updateBrokenCrystalsVisuals();
        updateScaleBalance();
        
        // Закрываем все сообщения о поломке
        document.querySelectorAll('.break-message').forEach(msg => {
            if (msg.timer) {
                clearInterval(msg.timer);
            }
            msg.remove();
        });
        
        console.log('Все кристаллы восстановлены!');
        alert('Все кристаллы восстановлены! Весы сброшены.');
    }
};

// Функция для принудительной поломки кристалла (для тестирования)
window.breakCrystalForTest = function(level) {
    breakCrystal(level);
};

// Новая функция для добавления таймера над алмазом
function addCrystalTimer(level) {
    const crystalContainer = document.querySelector(`[data-level="${level}"]`);
    if (!crystalContainer) return;
    
    const crystalCenter = crystalContainer.querySelector('.crystal-center');
    if (!crystalCenter) return;
    
    // Удаляем старый таймер если есть
    const oldTimer = crystalContainer.querySelector('.crystal-timer');
    if (oldTimer) oldTimer.remove();
    
    // Создаем контейнер для таймера
    const timerContainer = document.createElement('div');
    timerContainer.className = 'crystal-timer';
    timerContainer.innerHTML = `
        <div class="timer-content">
            <div class="timer-label">Восстановление через:</div>
            <div class="timer-value">60:00</div>
        </div>
    `;
    
    timerContainer.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 50, 50, 0.9);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        z-index: 100;
        text-align: center;
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255, 100, 100, 0.8);
        box-shadow: 0 4px 15px rgba(255, 0, 0, 0.3);
        min-width: 200px;
    `;
    
    crystalCenter.style.position = 'relative';
    crystalCenter.appendChild(timerContainer);
    
    // Запускаем таймер
    let timeLeft = 60; // 60 минут
    const timerElement = timerContainer.querySelector('.timer-value');
    
    const timer = setInterval(() => {
        timeLeft--;
        const minutes = timeLeft;
        
        if (timerElement) {
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:00`;
        }
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            if (timerElement) timerElement.textContent = "00:00";
            // Автоматически удаляем таймер после завершения
            setTimeout(() => {
                if (timerContainer.parentNode) {
                    timerContainer.remove();
                }
            }, 2000);
        }
    }, 60000); // Обновляем каждую минуту
    
    // Сохраняем ссылку на таймер для возможности очистки
    timerContainer.timer = timer;
}