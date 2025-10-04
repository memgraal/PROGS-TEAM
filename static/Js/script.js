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
    BREAK_THRESHOLD: 20, // Увеличили с 15 до 20
    WARNING_THRESHOLD: 17, // Порог предупреждения
    CRITICAL_VALUE: -25, // Критическое отрицательное значение
    NEGATIVE_SUM_BREAK: -35, // Порог поломки по отрицательной сумме
    NEGATIVE_SUM_WARNING: -25, // Порог предупреждения по отрицательной сумме
    BASE_CRYSTAL_WEIGHT: 3,
    MAX_IMBALANCE_WEIGHT: 2
};

// Веса для разных уровней поломки
const WEIGHT_LEVELS = {
    1: 1,  // 1 сломанный алмаз
    2: 3,  // 2 сломанных алмаза
    3: 6   // 3 сломанных алмаза
};

// Конфигурация кристаллов
const CRYSTAL_CONFIG = {
    FAMILY_LEVELS: [3, 4, 5],
    CAREER_LEVELS: [6, 7, 8],
    BOWL_LEVELS: {
        FAMILY: 1,
        CAREER: 2
    },
    SLIDER: {
        MIN: -30,
        MAX: 30,
        STEP: 5
    }
};

// Менеджер кристаллов
class CrystalManager {
    constructor() {
        this.brokenCrystals = {};
        this.cooldownTimers = {};
    }
    
    breakCrystal(level) {
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
        
        // Убираем предупреждение перед поломкой
        removeCrystalWarning(level);
        
        const isCareerCrystal = crystal.classList.contains('career-crystal');
        
        // Помечаем кристалл как сломанный
        this.brokenCrystals[level] = true;
        
        // Добавляем класс поломки
        crystal.classList.add('crystal-broken');
        
        // Блокируем взаимодействие
        const sliders = crystalContainer.querySelectorAll('.slider-btn, .slider-track');
        sliders.forEach(slider => {
            slider.style.pointerEvents = 'none';
            slider.style.opacity = '0.5';
        });
        
        // Обновляем веса на основе количества сломанных кристаллов
        window.scaleManager.updateWeightsFromBrokenCrystals();
        
        // Добавляем таймер на уровень кристалла
        this.addCrystalTimer(level);
        
        window.scaleManager.updateScaleBalance();
        this.showBreakMessage(level, isCareerCrystal);
        window.stateManager.saveAllStates();
        this.updateBrokenCrystalsOnBowlLevel(isCareerCrystal ? 2 : 1);
        
        this.cooldownTimers[level] = setTimeout(() => {
            this.restoreCrystal(level);
        }, CONFIG.COOLDOWN_TIME);
        
        console.log(`Crystal at level ${level} broken. Will restore in 1 hour.`);
    }
    
    // В классе CrystalManager обновите метод restoreCrystal:
restoreCrystal(level) {
    console.log(`Restoring crystal at level ${level}`);
    
    // Скрываем сообщение о поломке
    this.hideBreakMessage(level);
    
    const crystalContainer = document.querySelector(`[data-level="${level}"]`);
    if (crystalContainer) {
        // Удаляем таймер
        const timer = crystalContainer.querySelector('.crystal-timer');
        if (timer) {
            if (timer.timer) clearInterval(timer.timer);
            timer.remove();
        }
        
        // Убираем класс поломки с большого кристалла
        const crystal = crystalContainer.querySelector('.extra-large-crystal');
        if (crystal) {
            crystal.classList.remove('crystal-broken');
        }
        
        // Разблокируем слайдеры
        const sliders = crystalContainer.querySelectorAll('.slider-btn, .slider-track');
        sliders.forEach(slider => {
            slider.style.pointerEvents = 'auto';
            slider.style.opacity = '1';
        });
    }
    
    // Обновляем состояние
    this.brokenCrystals[level] = false;
    
    // Обновляем веса на основе количества сломанных кристаллов
    window.scaleManager.updateWeightsFromBrokenCrystals();
    
    // Обновляем визуал
    window.scaleManager.updateScaleBalance();
    window.stateManager.saveAllStates();
    
    // Определяем тип кристалла для обновления чаши
    const isCareerCrystal = level >= 6;
    this.updateBrokenCrystalsOnBowlLevel(isCareerCrystal ? 2 : 1);
    
    console.log(`Crystal at level ${level} restored.`);
}
    
    addCrystalTimer(level) {
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
        
        // Запускаем таймер с секундами
        let timeLeft = 3600; // 1 час в секундах
        const timerElement = timerContainer.querySelector('.timer-value');
        
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
                // Автоматически удаляем таймер после завершения
                setTimeout(() => {
                    if (timerContainer.parentNode) {
                        timerContainer.remove();
                    }
                }, 2000);
            }
        }, 1000); // Обновляем каждую секунду
        
        // Сохраняем ссылку на таймер для возможности очистки
        timerContainer.timer = timer;
    }
    
    updateBrokenCrystalsOnBowlLevel(bowlLevel) {
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
            if (this.brokenCrystals[crystalLevel]) {
                const crystalIndex = crystalLevels.indexOf(crystalLevel) + 1;
                const crystalElement = bowlContainer.querySelector(`.crystal-${crystalIndex}`);
                if (crystalElement) {
                    // ТОЛЬКО добавляем класс поломки, НЕ добавляем индикатор
                    crystalElement.classList.add('crystal-broken');
                }
            }
        });
    }
    
    showBreakMessage(level, isCareerCrystal) {
        this.hideBreakMessage(level);
        
        // Создаем отдельное сообщение по центру экрана
        const message = document.createElement('div');
        message.className = 'break-notification-center';
        message.dataset.level = level;
        
        message.innerHTML = `
            <div class="break-notification-content">
                <button class="break-notification-close" aria-label="Закрыть уведомление">×</button>
                <div class="break-notification-text">
                    Слишком большой дисбаланс в гранях привел к поломке кристалла.
                </div>
                <div class="break-timer-container">
                    <span class="break-timer-label">Кристалл восстановится через:</span>
                    <span class="break-timer">60:00</span>
                </div>
            </div>
        `;
        
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 50, 50, 0.95);
            color: white;
            padding: 25px 30px;
            border-radius: 12px;
            z-index: 10000;
            text-align: center;
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 100, 100, 0.8);
            box-shadow: 0 10px 30px rgba(255, 0, 0, 0.3);
            min-width: 400px;
            max-width: 500px;
            font-size: 16px;
            line-height: 1.4;
        `;
        
        // Стили для кнопки закрытия 
        const closeBtn = message.querySelector('.break-notification-close');
        closeBtn.style.cssText = `
            position: absolute;
            top: 2px;
            right: 2px;
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.3s ease;
            z-index: 10001;
        `;
        
        // Стили для контента
        const content = message.querySelector('.break-notification-content');
        content.style.cssText = `
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
        `;
        
        // Стили для текста
        const textElement = message.querySelector('.break-notification-text');
        textElement.style.cssText = `
            margin: 0;
            font-weight: 500;
            font-size: 17px;
            padding-right: 15px;
            margin-top: 5px;
        `;
        
        // Анимация появления
        message.style.opacity = '0';
        message.style.transform = 'translate(-50%, -50%) scale(0.8)';
        
        document.body.appendChild(message);
        
        // Анимация появления
        setTimeout(() => {
            message.style.opacity = '1';
            message.style.transform = 'translate(-50%, -50%) scale(1)';
            message.style.transition = 'all 0.3s ease';
        }, 10);
        
        // Запускаем таймер
        let timeLeft = 3600; // 1 час в секундах
        const timerEl = message.querySelector('.break-timer');
        
        const updateTimer = () => {
            timeLeft--;
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            
            if (timerEl) {
                timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                if (timerEl) timerEl.textContent = "00:00";
            }
        };
        
        const timer = setInterval(updateTimer, 1000);
        updateTimer(); // Первоначальное обновление
        
        // Сохраняем ссылку на таймер
        message.timer = timer;
        
        // Функция для закрытия сообщения
        const closeMessage = () => {
            if (message.parentNode) {
                if (message.timer) {
                    clearInterval(message.timer);
                }
                message.style.opacity = '0';
                message.style.transform = 'translate(-50%, -50%) scale(0.9)';
                message.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    if (message.parentNode) {
                        message.remove();
                    }
                }, 300);
            }
        };
        
        // Обработчик для кнопки закрытия
        closeBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            closeMessage();
        });
        
        // Обработчик при наведении на кнопку закрытия
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        });
        
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.backgroundColor = 'transparent';
        });
        
        // Автоматически скрываем через 6 секунд
        const autoCloseTimer = setTimeout(() => {
            closeMessage();
        }, 6000);
        
        // Сохраняем таймер авто-закрытия для возможности отмены
        message.autoCloseTimer = autoCloseTimer;
    }
    
    hideBreakMessage(level) {
        // Удаляем центральное сообщение
        const centerMessage = document.querySelector(`.break-notification-center[data-level="${level}"]`);
        if (centerMessage) {
            if (centerMessage.timer) {
                clearInterval(centerMessage.timer);
            }
            centerMessage.remove();
        }
        
        // Удаляем трекер из системы уведомлений
        const notification = document.querySelector(`.break-notification-tracker[data-break-level="${level}"]`);
        if (notification) {
            notification.remove();
        }
        
        // Также удаляем старые сообщения (для обратной совместимости)
        const oldMessage = document.querySelector(`.break-message[data-level="${level}"]`);
        if (oldMessage) {
            if (oldMessage.timer) {
                clearInterval(oldMessage.timer);
            }
            oldMessage.remove();
        }
    }
}

// Менеджер весов
class ScaleManager {
    constructor() {
        this.weights = { left: 0, right: 0 };
        this.state = 'balanced';
    }
    
    countBrokenCrystals() {
        let leftCount = 0; // Карьера (уровни 6,7,8)
        let rightCount = 0; // Семья (уровни 3,4,5)
        
        for (let level = 3; level <= 8; level++) {
            if (window.crystalManager.brokenCrystals[level]) {
                if (level >= 6) {
                    leftCount++;
                } else {
                    rightCount++;
                }
            }
        }
        
        return { left: leftCount, right: rightCount };
    }
    
    calculateBrokenWeight(count) {
        if (count === 0) return 0;
        if (count === 1) return WEIGHT_LEVELS[1];
        if (count === 2) return WEIGHT_LEVELS[2];
        if (count >= 3) return WEIGHT_LEVELS[3];
        return 0;
    }
    
    updateWeightsFromBrokenCrystals() {
        const brokenCounts = this.countBrokenCrystals();
        
        // Рассчитываем новые веса
        const newLeftWeight = this.calculateBrokenWeight(brokenCounts.left);
        const newRightWeight = this.calculateBrokenWeight(brokenCounts.right);
        
        // Устанавливаем новые веса
        this.weights.left = newLeftWeight;
        this.weights.right = newRightWeight;
        
        console.log(`Broken crystals - Left: ${brokenCounts.left} (${newLeftWeight}kg), Right: ${brokenCounts.right} (${newRightWeight}kg)`);
    }
    
    updateScaleBalance() {
        const totalLeftWeight = this.weights.left;
        const totalRightWeight = this.weights.right;
        
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
                this.state = 'left_tilt';
            } else {
                scaleContainer.classList.add(`beam-tilt-right-${tiltIntensity}`);
                leftPan.classList.add(`pan-move-up-${tiltIntensity}`);
                rightPan.classList.add(`pan-move-down-${tiltIntensity}`);
                this.state = 'right_tilt';
            }
        } else {
            this.state = 'balanced';
        }
        
        // Обновляем отображение весов
        this.updateWeightDisplay();
    }
    
    updateWeightDisplay() {
        const statusElement = document.getElementById('scaleStatus');
        if (!statusElement) return;

        const brokenCounts = this.countBrokenCrystals();
        
        // Рассчитываем количество ЦЕЛЫХ алмазов
        const familyIntact = 3 - brokenCounts.right;  // Семья: уровни 3,4,5
        const careerIntact = 3 - brokenCounts.left;   // Карьера: уровни 6,7,8
        
        const totalLeftWeight = this.weights.left;
        const totalRightWeight = this.weights.right;
        const weightDifference = Math.abs(totalLeftWeight - totalRightWeight);

        let statusText = '';
        let statusClass = '';

        // Сначала проверяем баланс весов
        if (weightDifference === 0) {
            statusClass = 'balanced';
            // Сбалансированные случаи
            if (familyIntact === 3 && careerIntact === 3) {
                statusText = 'Весы сбалансированы';
            } else {
                statusText = `Весы сбалансированы ${familyIntact} | ${careerIntact}`;
            }
        } else {
            // Несбалансированные случаи - ВСЕГДА начинаем с Семьи
            statusText = `В чаше Семья ${this.formatCrystalText(familyIntact)} | В Карьере ${careerIntact}`;
            
            // Определяем класс для стилизации
            const isFamilyHeavier = totalRightWeight > totalLeftWeight; // Семья тяжелее
            if (isFamilyHeavier) {
                statusClass = 'family-heavy';
            } else {
                statusClass = 'career-heavy';
            }
        }

        // Обновляем элемент
        statusElement.className = `scale-status ${statusClass}`;
        statusElement.querySelector('.status-text').textContent = statusText;
        
        console.log(`Status: ${statusText}, Family intact: ${familyIntact}, Career intact: ${careerIntact}`);
    }

    // Вспомогательный метод для форматирования текста алмазов
    formatCrystalText(count) {
        if (count === 1) return '1 алмаз';
        if (count === 0) return '0 алмазов';
        return `${count} алмаза`;
    }
}

// Менеджер состояния
class StateManager {
    constructor() {
        this.brokenCrystals = {};
        this.sliderValues = {}; // Добавляем хранение значений слайдеров
    }
    
    saveAllStates() {
        localStorage.setItem('crystalStates', JSON.stringify(window.crystalManager.brokenCrystals));
        localStorage.setItem('scaleState', JSON.stringify({
            weights: window.scaleManager.weights,
            state: window.scaleManager.state
        }));
        
        // Сохраняем значения слайдеров
        this.saveSliderValues();
    }
    
    saveSliderValues() {
        const sliderValues = {};
        const sliders = document.querySelectorAll('.advanced-slider-input');
        sliders.forEach((slider, index) => {
            const level = slider.closest('.nav-level')?.dataset.level;
            if (level) {
                if (!sliderValues[level]) sliderValues[level] = [];
                sliderValues[level].push(parseInt(slider.value) || 0);
            }
        });
        localStorage.setItem('sliderValues', JSON.stringify(sliderValues));
    }
    
    loadAllStates() {
        // Загружаем состояния кристаллов
        const savedStates = localStorage.getItem('crystalStates');
        if (savedStates) {
            window.crystalManager.brokenCrystals = JSON.parse(savedStates);
            this.updateBrokenCrystalsVisuals();
        }
        
        // Загружаем состояние весов
        const savedScaleState = localStorage.getItem('scaleState');
        if (savedScaleState) {
            try {
                const scaleState = JSON.parse(savedScaleState);
                window.scaleManager.weights = scaleState.weights || { left: 0, right: 0 };
                window.scaleManager.state = scaleState.state || 'balanced';
                
                // Применяем сохраненное состояние весов
                setTimeout(() => {
                    window.scaleManager.updateScaleBalance();
                    window.scaleManager.updateWeightDisplay();
                }, 100);
            } catch (e) {
                console.error('Error loading scale state:', e);
            }
        }
        
        // Загружаем значения слайдеров или сбрасываем на 0
        this.loadSliderValues();
    }
    
    loadSliderValues() {
        const savedSliderValues = localStorage.getItem('sliderValues');
        
        if (savedSliderValues) {
            // Если есть сохраненные значения - загружаем их
            try {
                const sliderValues = JSON.parse(savedSliderValues);
                this.applySliderValues(sliderValues);
            } catch (e) {
                console.error('Error loading slider values:', e);
                this.resetAllSlidersToZero();
            }
        } else {
            // Если нет сохраненных значений - сбрасываем все на 0
            this.resetAllSlidersToZero();
        }
    }
    
    applySliderValues(sliderValues) {
        Object.keys(sliderValues).forEach(level => {
            const containers = document.querySelectorAll(`[data-level="${level}"] .advanced-slider-container`);
            const values = sliderValues[level];
            
            containers.forEach((container, index) => {
                if (values && values[index] !== undefined) {
                    const input = container.querySelector('.advanced-slider-input');
                    const value = values[index];
                    input.value = value;
                    updateSliderVisuals(container, value);
                }
            });
        });
    }
    
    resetAllSlidersToZero() {
        const sliders = document.querySelectorAll('.advanced-slider-container');
        sliders.forEach(container => {
            const input = container.querySelector('.advanced-slider-input');
            input.value = 0;
            updateSliderVisuals(container, 0);
        });
        console.log('All sliders reset to zero');
    }
    
    updateBrokenCrystalsVisuals() {
        for (let level = 3; level <= 8; level++) {
            if (window.crystalManager.brokenCrystals[level]) {
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
        
        window.crystalManager.updateBrokenCrystalsOnBowlLevel(1);
        window.crystalManager.updateBrokenCrystalsOnBowlLevel(2);
    }
}

// Система уведомлений
class NotificationSystem {
    constructor() {
        this.container = document.getElementById('notificationSystem');
        if (!this.container) {
            this.createNotificationContainer();
        }
    }
    
    createNotificationContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notificationSystem';
        this.container.className = 'notification-system';
        this.container.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.container);
    }
    
    show(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = message;
        
        // Добавляем анимацию появления
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        
        this.container.appendChild(notification);
        
        // Анимация появления
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
            notification.style.transition = 'all 0.3s ease';
        }, 10);

        // Функция закрытия уведомления
        const closeNotification = () => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
                // Удаляем обработчик клика по документу
                document.removeEventListener('click', outsideClickListener);
            }, 300);
        };

        // Обработчик клика вне уведомления
        const outsideClickListener = (event) => {
            if (!notification.contains(event.target)) {
                closeNotification();
            }
        };

        // Добавляем обработчик клика по всему документу
        setTimeout(() => {
            document.addEventListener('click', outsideClickListener);
        }, 100);

        // Также добавляем обработчик на само уведомление чтобы клик внутри не закрывал его
        notification.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        // Автоматическое скрытие через 3 секунды
        if (duration > 0) {
            setTimeout(() => {
                closeNotification();
            }, duration);
        }
        
        return notification;
    }
    
    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    }
    
    error(message, duration = 3000) {
        return this.show(message, 'error', duration);
    }
    
    warning(message, duration = 3000) {
        return this.show(message, 'warning', duration);
    }
    
    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }
}

// Утилиты
class Utils {
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    static handleCrystalError(level, error) {
        console.error(`Crystal error at level ${level}:`, error);
        
        // Показать пользовательское сообщение
        window.notificationSystem.error(`Ошибка в кристалле: ${error.message}`);
    }
}

// Простой и надежный класс для выпадающего меню
class DropdownMenu {
    constructor() {
        this.isOpen = false;
        this.init();
    }
    
    init() {
        console.log('Инициализация меню...');
        
        const toggle = document.querySelector('.dropdown-toggle');
        const menu = document.querySelector('.dropdown-content');
        const overlay = document.querySelector('.dropdown-overlay');
        
        if (!toggle || !menu) {
            console.error('Элементы меню не найдены!');
            return;
        }
        
        // Обработчик клика по кнопке меню
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });
        
        // Обработчики для пунктов меню
        const menuItems = menu.querySelectorAll('.dropdown-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Клик по пункту меню:', item.textContent.trim());
                // Закрываем меню после клика
                setTimeout(() => {
                    this.closeMenu();
                }, 300);
            });
        });
        
        // Закрытие при клике на оверлей
        if (overlay) {
            overlay.addEventListener('click', () => {
                this.closeMenu();
            });
        }
        
        // Закрытие при клике вне меню
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-menu')) {
                this.closeMenu();
            }
        });
        
        // Закрытие при нажатии Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeMenu();
            }
        });
        
        console.log('Меню инициализировано');
    }
    
    toggleMenu() {
        if (this.isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }
    
    openMenu() {
        const menu = document.querySelector('.dropdown-content');
        const overlay = document.querySelector('.dropdown-overlay');
        const toggle = document.querySelector('.dropdown-toggle');
        
        if (menu) menu.style.display = 'block';
        if (overlay) overlay.style.display = 'block';
        if (toggle) toggle.classList.add('active');
        
        this.isOpen = true;
        
        // Анимация появления
        setTimeout(() => {
            if (menu) {
                menu.style.opacity = '1';
                menu.style.transform = 'translateY(0)';
            }
            if (overlay) {
                overlay.style.opacity = '1';
            }
        }, 10);
    }
    
    closeMenu() {
        const menu = document.querySelector('.dropdown-content');
        const overlay = document.querySelector('.dropdown-overlay');
        const toggle = document.querySelector('.dropdown-toggle');
        
        if (menu) {
            menu.style.opacity = '0';
            menu.style.transform = 'translateY(-10px)';
        }
        if (overlay) {
            overlay.style.opacity = '0';
        }
        
        setTimeout(() => {
            if (menu) menu.style.display = 'none';
            if (overlay) overlay.style.display = 'none';
            if (toggle) toggle.classList.remove('active');
            this.isOpen = false;
        }, 300);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded");
    
    // Инициализация менеджеров
    window.crystalManager = new CrystalManager();
    window.scaleManager = new ScaleManager();
    window.stateManager = new StateManager();
    window.notificationSystem = new NotificationSystem();
    window.dropdownMenu = new DropdownMenu();
    
    initializeApp();
    window.stateManager.loadAllStates();
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
    window.scaleManager.updateWeightDisplay();
    
    // Показываем приветственное сообщение
    setTimeout(() => {
        window.notificationSystem.info('Добро пожаловать в Кристаллы Фемиды!');
    }, 1000);
}

// Добавление динамических стилей
function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Анимация предупреждения */
        @keyframes crystalWarningPulse {
            0% { 
                filter: drop-shadow(0 8px 25px rgba(124,199,224,0.4));
            }
            100% { 
                filter: drop-shadow(0 12px 35px orange);
            }
        }
        
        .crystal-warning {
            animation: crystalWarningPulse 0.5s infinite alternate !important;
        }
        
        /* Для кристаллов карьеры */
        [data-level="6"] .crystal-warning,
        [data-level="7"] .crystal-warning,
        [data-level="8"] .crystal-warning {
            animation: crystalWarningPulsePurple 0.5s infinite alternate !important;
        }
        
        @keyframes crystalWarningPulsePurple {
            0% { 
                filter: drop-shadow(0 8px 25px rgba(192,126,224,0.4));
            }
            100% { 
                filter: drop-shadow(0 12px 35px orange);
            }
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
        
        /* Анимация появления сообщения */
        @keyframes breakNotificationAppear {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.8);
            }
            100% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
        }
        
        .break-notification-center {
            animation: breakNotificationAppear 0.3s ease-out;
        }
        
        /* Стили для выпадающего меню */
        .dropdown-content {
            transition: all 0.3s ease;
            opacity: 0;
            transform: translateY(-10px);
        }
        
        .dropdown-overlay {
            transition: opacity 0.3s ease;
            opacity: 0;
        }
    `;
    document.head.appendChild(style);
}

// Инициализация всех слайдеров
function initializeAllSliders() {
    const sliders = document.querySelectorAll('.advanced-slider-container');
    sliders.forEach(container => {
        const input = container.querySelector('.advanced-slider-input');
        
        // Принудительно устанавливаем значение 0 при инициализации
        const initialValue = 0;
        input.value = initialValue;
        
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
            window.crystalManager.updateBrokenCrystalsOnBowlLevel(level);
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
                window.crystalManager.updateBrokenCrystalsOnBowlLevel(prevLevel);
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
    
    // Если кристалл уже сломан, выходим
    if (window.crystalManager.brokenCrystals[level]) return;
    
    const sliders = crystalContainer.querySelectorAll('.advanced-slider-input');
    const values = Array.from(sliders).map(slider => parseInt(slider.value) || 0);
    
    // Рассчитываем стандартное отклонение
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Считаем количество критических значений
    const criticalCount = values.filter(value => value <= CONFIG.CRITICAL_VALUE).length;
    
    // Рассчитываем суммарный отрицательный баланс
    const negativeSum = values.reduce((sum, value) => sum + Math.min(value, 0), 0);
    
    // Рассчитываем эффективный порог
    const effectiveThreshold = CONFIG.BREAK_THRESHOLD - criticalCount;
    
    console.log(`Level ${level} - SD: ${standardDeviation.toFixed(2)}, Critical: ${criticalCount}, Negative Sum: ${negativeSum}, Effective threshold: ${effectiveThreshold}, Values: ${values}`);
    
    // Убираем предыдущие предупреждения
    removeCrystalWarning(level);
    
    // Проверяем условия поломки
    const shouldBreak = 
        standardDeviation >= effectiveThreshold || // Сильный разброс значений
        negativeSum <= -35; // Слишком большой отрицательный баланс
    
    // Проверяем условия предупреждения
    const shouldWarn = 
        (standardDeviation >= CONFIG.WARNING_THRESHOLD && standardDeviation < effectiveThreshold) || // Приближение к порогу разброса
        (negativeSum <= -25 && negativeSum > -35); // Приближение к порогу отрицательного баланса
    
    if (shouldBreak && !window.crystalManager.brokenCrystals[level]) {
        // ПОЛОМКА
        window.crystalManager.breakCrystal(level);
    } else if (shouldWarn) {
        // ПРЕДУПРЕЖДЕНИЕ
        showCrystalWarning(level, crystalContainer);
    }
}

// Функция показа предупреждения
function showCrystalWarning(level, crystalContainer) {
    const crystal = crystalContainer.querySelector('.extra-large-crystal');
    if (!crystal) return;
    
    // Добавляем класс предупреждения
    crystal.classList.add('crystal-warning');
    
    // Добавляем вибрацию
    crystal.style.animation = 'crystalWarningPulse 0.5s infinite alternate';
    
    // Подсвечиваем слайдеры
    const sliders = crystalContainer.querySelectorAll('.slider-track, .slider-thumb');
    sliders.forEach(slider => {
        slider.style.boxShadow = '0 0 10px orange';
    });
    
    // Сохраняем ссылку на кристалл для удаления предупреждения
    crystal.warningLevel = level;
}

// Функция удаления предупреждения
function removeCrystalWarning(level) {
    const crystalContainer = document.querySelector(`[data-level="${level}"]`);
    if (!crystalContainer) return;
    
    const crystal = crystalContainer.querySelector('.extra-large-crystal');
    if (crystal) {
        crystal.classList.remove('crystal-warning');
        crystal.style.animation = '';
    }
    
    // Убираем подсветку слайдеров
    const sliders = crystalContainer.querySelectorAll('.slider-track, .slider-thumb');
    sliders.forEach(slider => {
        slider.style.boxShadow = '';
    });
}

// Функция восстановления всех кристаллов
window.restoreAllCrystals = function() {
    if (confirm('Восстановить все сломанные кристаллы?')) {
        console.log('Восстановление всех кристаллов...');
        
        // Очищаем все таймеры восстановления
        Object.values(window.crystalManager.cooldownTimers).forEach(timer => {
            if (timer) clearTimeout(timer);
        });
        window.crystalManager.cooldownTimers = {};
        
        // Восстанавливаем ВСЕ кристаллы
        for (let level = 3; level <= 8; level++) {
            if (window.crystalManager.brokenCrystals[level]) {
                window.crystalManager.restoreCrystal(level);
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
        window.scaleManager.weights = { left: 0, right: 0 };
        
        // Сохраняем состояние
        window.stateManager.saveAllStates();
        
        // Обновляем визуальное отображение
        window.stateManager.updateBrokenCrystalsVisuals();
        window.scaleManager.updateScaleBalance();
        
        // Закрываем все сообщения о поломке
        document.querySelectorAll('.break-message').forEach(msg => {
            if (msg.timer) {
                clearInterval(msg.timer);
            }
            msg.remove();
        });
        
        console.log('Все кристаллы восстановлены!');
        window.notificationSystem.success('Все кристаллы восстановлены! Весы сброшены.');
    }
};

// Функция сброса всех значений и восстановления кристаллов
window.resetAllWeights = function() {
    console.log('Reset weights clicked');
    
    // Закрываем меню
    if (window.dropdownMenu) {
        window.dropdownMenu.closeMenu();
    }
    
    if (confirm('Сбросить все значения на 0 и восстановить кристаллы?')) {
        console.log('Сброс всех значений и восстановление кристаллов...');
        
        // 1. ВОССТАНАВЛИВАЕМ ВСЕ КРИСТАЛЛЫ
        if (window.crystalManager) {
            // Очищаем все таймеры восстановления
            Object.values(window.crystalManager.cooldownTimers).forEach(timer => {
                if (timer) clearTimeout(timer);
            });
            window.crystalManager.cooldownTimers = {};
            
            // Восстанавливаем ВСЕ кристаллы
            for (let level = 3; level <= 8; level++) {
                if (window.crystalManager.brokenCrystals[level]) {
                    window.crystalManager.restoreCrystal(level);
                }
            }
            
            // Очищаем состояния поломки
            window.crystalManager.brokenCrystals = {};
        }
        
        // 2. СБРАСЫВАЕМ ВСЕ СЛАЙДЕРЫ НА 0
        const allSliders = document.querySelectorAll('.advanced-slider-input');
        allSliders.forEach(slider => {
            slider.value = 0;
            const container = slider.closest('.advanced-slider-container');
            if (container) {
                updateSliderVisuals(container, 0);
            }
        });
        
        // 3. СБРАСЫВАЕМ ВЕСА ВЕСОВ
        if (window.scaleManager) {
            window.scaleManager.weights = { left: 0, right: 0 };
            window.scaleManager.updateScaleBalance();
            window.scaleManager.updateWeightDisplay();
        }
        
        // 4. УДАЛЯЕМ ВСЕ ТАЙМЕРЫ КРИСТАЛЛОВ
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
        
        // 5. УДАЛЯЕМ ВСЕ СООБЩЕНИЯ О ПОЛОМКЕ
        document.querySelectorAll('.break-notification-center').forEach(msg => {
            if (msg.timer) {
                clearInterval(msg.timer);
            }
            msg.remove();
        });
        
        document.querySelectorAll('.break-message').forEach(msg => {
            if (msg.timer) {
                clearInterval(msg.timer);
            }
            msg.remove();
        });
        
        // 6. ОБНОВЛЯЕМ ВИЗУАЛ КРИСТАЛЛОВ
        if (window.crystalManager) {
            window.crystalManager.updateBrokenCrystalsOnBowlLevel(1);
            window.crystalManager.updateBrokenCrystalsOnBowlLevel(2);
        }
        
        // 7. УБИРАЕМ ПРЕДУПРЕЖДЕНИЯ
        for (let level = 3; level <= 8; level++) {
            removeCrystalWarning(level);
        }
        
        // 8. СОХРАНЯЕМ СОСТОЯНИЕ
        if (window.stateManager) {
            window.stateManager.saveAllStates();
        }
        
        console.log('Все значения сброшены и кристаллы восстановлены!');
        if (window.notificationSystem) {
            window.notificationSystem.success('Все значения сброшены! Кристаллы восстановлены.');
        }
    }
};

// Функции для пунктов меню
window.showNotifications = function() {
    console.log('Notifications clicked');
    if (window.notificationSystem) {
        window.notificationSystem.info('Уведомления будут здесь');
    }
    // Закрываем меню
    if (window.dropdownMenu) {
        window.dropdownMenu.closeMenu();
    }
};

window.showSettings = function() {
    console.log('Settings clicked');
    if (window.notificationSystem) {
        window.notificationSystem.info('Настройки будут здесь');
    }
    // Закрываем меню
    if (window.dropdownMenu) {
        window.dropdownMenu.closeMenu();
    }
};

// Функция для принудительной поломки кристалла (для тестирования)
window.breakCrystalForTest = function(level) {
    window.crystalManager.breakCrystal(level);
};

// Экспорт данных
window.exportUserData = function() {
    const data = {
        crystalStates: window.crystalManager.brokenCrystals,
        scaleState: {
            weights: window.scaleManager.weights,
            state: window.scaleManager.state
        },
        exportDate: new Date().toISOString(),
        version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crystals-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    
    window.notificationSystem.success('Данные успешно экспортированы');
};

// Обработка офлайн состояния
window.addEventListener('online', () => {
    window.notificationSystem.success('Соединение восстановлено');
});

window.addEventListener('offline', () => {
    window.notificationSystem.warning('Работаем в офлайн режиме');
});

// Функция сброса всех слайдеров на 0
window.resetAllSliders = function() {
    if (confirm('Сбросить все значения слайдеров на 0?')) {
        window.stateManager.resetAllSlidersToZero();
        window.notificationSystem.success('Все слайдеры сброшены на 0');
        
        // Проверяем баланс после сброса
        for (let level = 3; level <= 8; level++) {
            setTimeout(() => checkCrystalBalance(level), 100);
        }
    }
};

// Проверка что все функции загружены
console.log('Functions loaded:', {
    resetAllWeights: typeof resetAllWeights,
    dropdownMenu: typeof DropdownMenu,
    updateSliderVisuals: typeof updateSliderVisuals,
    navigateTo: typeof navigateTo,
    closeModal: typeof closeModal
});