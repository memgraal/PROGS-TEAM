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

// Функция для показа приветственного сообщения
function showWelcomeMessageSimple() {
    const welcomeShown = sessionStorage.getItem('welcomeShown');
    if (welcomeShown) return;
    
    if (window.notificationSystem) {
        window.notificationSystem.show(`
            <div style="display: flex; align-items: center; gap: 10px;">
                <div>
                    <strong style="color: var(--accent-1);">Добро пожаловать в Кристаллы Фемиды!</strong><br>
                    <span style="color: var(--muted); font-size: 0.9rem;">Отслеживайте баланс между сферами жизни</span>
                </div>
            </div>
        `, 5000);
    }
    
    sessionStorage.setItem('welcomeShown', 'true');
}

// Ленивая загрузка модальных окон
class LazyLoader {
    constructor() {
        this.loadedLevels = new Set([0]); // Главный экран загружен сразу
        this.observer = null;
        this.initIntersectionObserver();
    }

    initIntersectionObserver() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const level = entry.target.dataset.level;
                    this.loadLevelContent(level);
                    this.observer.unobserve(entry.target);
                }
            });
        }, { 
            rootMargin: '50px',
            threshold: 0.1 
        });
    }

    loadLevelContent(level) {
        if (this.loadedLevels.has(level)) return;

        console.log(`Lazy loading level ${level}`);
        this.loadedLevels.add(level);

        // Для уровней 3-8 загружаем тяжелые ресурсы
        if (level >= 3 && level <= 8) {
            this.preloadCrystalImages(level);
        }
    }

    preloadCrystalImages(level) {
        const crystalType = level >= 6 ? 'purple' : 'blue';
        const img = new Image();
        img.src = `/static/Img/diamond ${crystalType}.svg`;
        
        img.onload = () => {
            const crystal = document.querySelector(`[data-level="${level}"] .extra-large-crystal`);
            if (crystal && !crystal.src.includes('diamond')) {
                crystal.src = img.src;
            }
        };
    }

    observeLevel(levelElement) {
        if (this.observer && !this.loadedLevels.has(levelElement.dataset.level)) {
            this.observer.observe(levelElement);
        }
    }
}

// Оптимизатор слайдеров
class SliderOptimizer {
    constructor() {
        this.activeSliders = new Set();
        this.debouncedUpdate = this.debounce(this.updateSliderPriorities.bind(this), 100);
        this.setupVisibilityListener();
    }

    setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.suspendAllAnimations();
            } else {
                this.resumeAllAnimations();
            }
        });
    }

    optimizeSlidersForLevel(level) {
        const sliders = document.querySelectorAll(`[data-level="${level}"] .advanced-slider-container`);
        
        sliders.forEach((slider, index) => {
            if (index > 1) {
                this.lazyInitSlider(slider);
            } else {
                this.immediateInitSlider(slider);
            }
        });
    }

    lazyInitSlider(slider) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.immediateInitSlider(slider);
                    observer.unobserve(slider);
                }
            });
        });

        observer.observe(slider);
    }

    immediateInitSlider(slider) {
        this.activeSliders.add(slider);
        const input = slider.querySelector('.advanced-slider-input');
        const initialValue = parseInt(input.value) || 0;
        updateSliderVisuals(slider, initialValue);
    }

    debounce(func, wait) {
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

    suspendAllAnimations() {
        document.querySelectorAll('.slider-thumb, .extra-large-crystal').forEach(el => {
            el.style.animationPlayState = 'paused';
        });
    }

    resumeAllAnimations() {
        document.querySelectorAll('.slider-thumb, .extra-large-crystal').forEach(el => {
            el.style.animationPlayState = 'running';
        });
    }

    isElementInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
}

// Менеджер памяти
class MemoryManager {
    constructor() {
        this.cleanupCallbacks = new Map();
        this.setupCleanupListeners();
    }

    setupCleanupListeners() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.cleanupInactiveResources();
            }
        });
    }

    scheduleCleanup() {
        requestAnimationFrame(() => {
            this.cleanupInactiveResources();
        });
    }

    cleanupInactiveResources() {
        const activeLevel = navStack[navStack.length - 1];
        
        document.querySelectorAll('.nav-level.active').forEach(level => {
            if (level.dataset.level !== activeLevel.toString()) {
                this.cleanupLevelResources(level.dataset.level);
            }
        });

        this.cleanupOrphanedTimers();
        
        if (window.gc) {
            window.gc();
        }
    }

    cleanupLevelResources(level) {
        if (level >= 3 && level <= 8) {
            this.suspendCrystalAnimations(level);
        }
    }

    suspendCrystalAnimations(level) {
        const crystal = document.querySelector(`[data-level="${level}"] .extra-large-crystal`);
        if (crystal) {
            crystal.style.animationPlayState = 'paused';
        }
    }

    cleanupOrphanedTimers() {
        Object.entries(window.crystalManager.cooldownTimers).forEach(([level, timer]) => {
            if (!document.querySelector(`[data-level="${level}"]`)) {
                clearTimeout(timer);
                delete window.crystalManager.cooldownTimers[level];
            }
        });
    }

    restoreLevel(level) {
        const crystal = document.querySelector(`[data-level="${level}"] .extra-large-crystal`);
        if (crystal) {
            crystal.style.animationPlayState = 'running';
        }
    }
}

// Простой скрипт для проверки текущего размера экрана
document.addEventListener('DOMContentLoaded', function() {
    function updateScreenSizeInfo() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const breakpoint = getBreakpoint(width);
        
        console.log(`Экран: ${width}x${height}, Брейкпоинт: ${breakpoint}`);
    }
    
    function getBreakpoint(width) {
        if (width < 768) return 'mobile';
        if (width < 1200) return 'tablet';
        if (width < 1920) return 'desktop';
        if (width < 2560) return 'hd';
        if (width < 3440) return '2k';
        return '4k+';
    }
    
    // Проверяем при загрузке и изменении размера
    updateScreenSizeInfo();
    window.addEventListener('resize', updateScreenSizeInfo);
});

// Оптимизатор изображений
class ImageOptimizer {
    constructor() {
        this.imageCache = new Map();
        this.initPreloadStrategy();
    }

    initPreloadStrategy() {
        this.preloadCriticalImages();
        this.setupLazyLoading();
    }

    preloadCriticalImages() {
        const criticalImages = [
            '/static/Img/stand.svg',
            '/static/Img/beam.svg',
            '/static/Img/left-pan.svg',
            '/static/Img/right-pan.svg'
        ];

        criticalImages.forEach(src => {
            const img = new Image();
            img.src = src;
            this.imageCache.set(src, img);
        });
    }

    setupLazyLoading() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    this.loadImage(img);
                    observer.unobserve(img);
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            observer.observe(img);
        });
    }

    loadImage(imgElement) {
        const src = imgElement.dataset.src;
        if (this.imageCache.has(src)) {
            imgElement.src = src;
        } else {
            const img = new Image();
            img.onload = () => {
                imgElement.src = src;
                this.imageCache.set(src, img);
            };
            img.src = src;
        }
        imgElement.removeAttribute('data-src');
    }
}

// Простой адаптер для сложных случаев
class ResponsiveAdapter {
    constructor() {
        this.setupViewportMeta();
        this.setupDynamicScaling();
        this.setupOrientationHandler();
    }
    
    // Динамический viewport для мобильных устройств
    setupViewportMeta() {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 
                'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
        }
    }
    
    // Динамическое масштабирование для очень больших/маленьких экранов
    setupDynamicScaling() {
        const updateScale = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const aspectRatio = width / height;
            
            // Определяем тип экрана
            let scale = 1;
            
            if (width < 768) {
                // Мобильные - уменьшаем масштаб
                scale = Math.max(0.8, width / 768);
            } else if (width > 3000) {
                // Очень большие экраны - увеличиваем масштаб
                scale = Math.min(1.3, width / 2560);
            }
            
            // Применяем масштаб только к определенным элементам
            this.applyOptimalScale(scale, aspectRatio);
        };
        
        // Запускаем при загрузке и изменении размера
        updateScale();
        window.addEventListener('resize', this.debounce(updateScale, 250));
        window.addEventListener('orientationchange', updateScale);
    }
    
    applyOptimalScale(scale, aspectRatio) {
        // Масштабируем только сложные элементы
        const elementsToScale = document.querySelectorAll('.crystals-group, .extra-large-crystal, .scale');
        
        elementsToScale.forEach(element => {
            if (scale !== 1) {
                element.style.transform = `scale(${scale})`;
                element.style.transformOrigin = 'center center';
            } else {
                element.style.transform = '';
            }
        });
        
        // Специальная обработка для ультра-широких экранов
        if (aspectRatio > 2) {
            document.documentElement.style.setProperty('--container-width', '90%');
        } else {
            document.documentElement.style.setProperty('--container-width', 'min(95%, 1800px)');
        }
    }
    
    // Обработчик смены ориентации
    setupOrientationHandler() {
        const handleOrientation = () => {
            if (window.screen.orientation) {
                const orientation = window.screen.orientation.type;
                
                if (orientation.includes('portrait')) {
                    document.body.classList.add('portrait');
                    document.body.classList.remove('landscape');
                } else {
                    document.body.classList.add('landscape');
                    document.body.classList.remove('portrait');
                }
            }
        };
        
        if (window.screen.orientation) {
            window.screen.orientation.addEventListener('change', handleOrientation);
        }
        handleOrientation();
    }
    
    debounce(func, wait) {
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
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    window.responsiveAdapter = new ResponsiveAdapter();
});

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
        
        removeCrystalWarning(level);
        
        const isCareerCrystal = crystal.classList.contains('career-crystal');
        
        this.brokenCrystals[level] = true;
        
        crystal.classList.add('crystal-broken');
        
        const sliders = crystalContainer.querySelectorAll('.slider-btn, .slider-track');
        sliders.forEach(slider => {
            slider.style.pointerEvents = 'none';
            slider.style.opacity = '0.5';
        });
        
        window.scaleManager.updateWeightsFromBrokenCrystals();
        
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
    
    restoreCrystal(level) {
        console.log(`Restoring crystal at level ${level}`);
        
        this.hideBreakMessage(level);
        
        const crystalContainer = document.querySelector(`[data-level="${level}"]`);
        if (crystalContainer) {
            const timer = crystalContainer.querySelector('.crystal-timer');
            if (timer) {
                if (timer.timer) clearInterval(timer.timer);
                timer.remove();
            }
            
            const crystal = crystalContainer.querySelector('.extra-large-crystal');
            if (crystal) {
                crystal.classList.remove('crystal-broken');
            }
            
            const sliders = crystalContainer.querySelectorAll('.slider-btn, .slider-track');
            sliders.forEach(slider => {
                slider.style.pointerEvents = 'auto';
                slider.style.opacity = '1';
            });
        }
        
        this.brokenCrystals[level] = false;
        
        window.scaleManager.updateWeightsFromBrokenCrystals();
        
        window.scaleManager.updateScaleBalance();
        window.stateManager.saveAllStates();
        
        const isCareerCrystal = level >= 6;
        this.updateBrokenCrystalsOnBowlLevel(isCareerCrystal ? 2 : 1);
        
        console.log(`Crystal at level ${level} restored.`);
    }
    
    addCrystalTimer(level) {
        const crystalContainer = document.querySelector(`[data-level="${level}"]`);
        if (!crystalContainer) return;
        
        const crystalCenter = crystalContainer.querySelector('.crystal-center');
        if (!crystalCenter) return;
        
        const oldTimer = crystalContainer.querySelector('.crystal-timer');
        if (oldTimer) oldTimer.remove();
        
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
        
        let timeLeft = 3600;
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
                setTimeout(() => {
                    if (timerContainer.parentNode) {
                        timerContainer.remove();
                    }
                }, 2000);
            }
        }, 1000);
        
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
        
        const oldIndicators = bowlContainer.querySelectorAll('.broken-crystal-indicator');
        oldIndicators.forEach(indicator => indicator.remove());
        
        const allCrystals = bowlContainer.querySelectorAll('.crystal-in-bowl');
        allCrystals.forEach(crystal => {
            crystal.classList.remove('crystal-broken');
        });
        
        crystalLevels.forEach(crystalLevel => {
            if (this.brokenCrystals[crystalLevel]) {
                const crystalIndex = crystalLevels.indexOf(crystalLevel) + 1;
                const crystalElement = bowlContainer.querySelector(`.crystal-${crystalIndex}`);
                if (crystalElement) {
                    crystalElement.classList.add('crystal-broken');
                }
            }
        });
    }
    
    showBreakMessage(level, isCareerCrystal) {
    this.hideBreakMessage(level);
    
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
    
    const content = message.querySelector('.break-notification-content');
    content.style.cssText = `
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
    `;
    
    const textElement = message.querySelector('.break-notification-text');
    textElement.style.cssText = `
        margin: 0;
        font-weight: 500;
        font-size: 17px;
        padding-right: 15px;
        margin-top: 5px;
    `;
    
    message.style.opacity = '0';
    message.style.transform = 'translate(-50%, -50%) scale(0.8)';
    
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.style.opacity = '1';
        message.style.transform = 'translate(-50%, -50%) scale(1)';
        message.style.transition = 'all 0.3s ease';
    }, 10);
    
    let timeLeft = 3600;
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
    updateTimer();
    
    message.timer = timer;
    
    // Функция закрытия сообщения
    const closeMessage = () => {
        if (message.parentNode) {
            if (message.timer) {
                clearInterval(message.timer);
            }
            if (message.autoCloseTimer) {
                clearTimeout(message.autoCloseTimer);
            }
            if (message.escapeHandler) {
                document.removeEventListener('keydown', message.escapeHandler);
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
    
    // Обработчик ESC
    message.escapeHandler = (event) => {
        if (event.key === 'Escape') {
            closeMessage();
        }
    };
    
    // Добавляем обработчик ESC
    document.addEventListener('keydown', message.escapeHandler);
    
    closeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        closeMessage();
    });
    
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    });
    
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.backgroundColor = 'transparent';
    });
    
    const autoCloseTimer = setTimeout(() => {
        closeMessage();
    }, 6000);
    
    message.autoCloseTimer = autoCloseTimer;
}

hideBreakMessage(level) {
    const centerMessage = document.querySelector(`.break-notification-center[data-level="${level}"]`);
    if (centerMessage) {
        if (centerMessage.timer) {
            clearInterval(centerMessage.timer);
        }
        if (centerMessage.autoCloseTimer) {
            clearTimeout(centerMessage.autoCloseTimer);
        }
        if (centerMessage.escapeHandler) {
            document.removeEventListener('keydown', centerMessage.escapeHandler);
        }
        centerMessage.remove();
    }
    
    const notification = document.querySelector(`.break-notification-tracker[data-break-level="${level}"]`);
    if (notification) {
        notification.remove();
    }
    
    const oldMessage = document.querySelector(`.break-message[data-level="${level}"]`);
    if (oldMessage) {
        if (oldMessage.timer) {
            clearInterval(oldMessage.timer);
        }
        oldMessage.remove();
    }
}
}

class ScaleManager {
    constructor() {
        this.weights = { left: 0, right: 0 };
        this.state = 'balanced';
    }
    
    countBrokenCrystals() {
        let leftCount = 0;
        let rightCount = 0;
        
        for (let level = 3; level <= 8; level++) {
            if (window.crystalManager.brokenCrystals[level]) {
                if (level >= 6) {
                    leftCount = leftCount + 1;
                } else {
                    rightCount = rightCount + 1;
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
        
        const newLeftWeight = this.calculateBrokenWeight(brokenCounts.left);
        const newRightWeight = this.calculateBrokenWeight(brokenCounts.right);
        
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
        
        this.updateWeightDisplay();
    }
    
    updateWeightDisplay() {
        const statusElement = document.getElementById('scaleStatus');
        if (!statusElement) {
            console.warn('Scale status element not found');
            return;
        }

        if (!this.state) {
            this.state = 'balanced';
        }

        const brokenCounts = this.countBrokenCrystals();
        const familyIntact = 3 - brokenCounts.right;
        const careerIntact = 3 - brokenCounts.left;
        
        const totalLeftWeight = this.weights.left;
        const totalRightWeight = this.weights.right;
        const weightDifference = Math.abs(totalLeftWeight - totalRightWeight);

        let statusText = '';
        let statusClass = 'balanced';

        if (weightDifference === 0) {
            statusClass = 'balanced';
            if (familyIntact === 3 && careerIntact === 3) {
                statusText = 'Весы сбалансированы';
            } else {
                statusText = `Весы сбалансированы ${familyIntact} | ${careerIntact}`;
            }
        } else {
            statusText = `В чаше Семья ${this.formatCrystalText(familyIntact)} | В Карьере ${careerIntact}`;
            
            const isFamilyHeavier = totalRightWeight > totalLeftWeight;
            if (isFamilyHeavier) {
                statusClass = 'family-heavy';
            } else {
                statusClass = 'career-heavy';
            }
        }

        statusElement.className = `scale-status ${statusClass}`;
        const statusTextElement = statusElement.querySelector('.status-text');
        if (statusTextElement) {
            statusTextElement.textContent = statusText;
        }
        
        console.log(`Status: ${statusText}, Family intact: ${familyIntact}, Career intact: ${careerIntact}`);
    }

    formatCrystalText(count) {
        if (count === 1) return '1 алмаз';
        if (count === 0) return '0 алмазов';
        return `${count} алмаза`;
    }
}

class StateManager {
    constructor() {
        this.brokenCrystals = {};
        this.sliderValues = {};
    }
    
    saveAllStates() {
        try {
            localStorage.setItem('crystalStates', JSON.stringify(window.crystalManager.brokenCrystals));
            localStorage.setItem('scaleState', JSON.stringify({
                weights: window.scaleManager.weights,
                state: window.scaleManager.state
            }));
            
            this.saveSliderValues();
            this.saveReflectionData();
        } catch (error) {
            console.error('Failed to save states:', error);
            if (window.notificationSystem) {
                window.notificationSystem.error('Не удалось сохранить данные');
            }
        }
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
    
    saveReflectionData() {
        // Рефлексии сохраняются отдельно в saveReflection()
    }
    
    loadAllStates() {
        try {
            const savedStates = localStorage.getItem('crystalStates');
            if (savedStates) {
                window.crystalManager.brokenCrystals = JSON.parse(savedStates);
                this.updateBrokenCrystalsVisuals();
            }
            
            const savedScaleState = localStorage.getItem('scaleState');
            if (savedScaleState) {
                try {
                    const scaleState = JSON.parse(savedScaleState);
                    window.scaleManager.weights = scaleState.weights || { left: 0, right: 0 };
                    window.scaleManager.state = scaleState.state || 'balanced';
                } catch (e) {
                    console.error('Error loading scale state:', e);
                    window.scaleManager.weights = { left: 0, right: 0 };
                    window.scaleManager.state = 'balanced';
                }
            } else {
                window.scaleManager.weights = { left: 0, right: 0 };
                window.scaleManager.state = 'balanced';
            }
            
            setTimeout(() => {
                window.scaleManager.updateScaleBalance();
                window.scaleManager.updateWeightDisplay();
            }, 50);
            
        } catch (error) {
            console.error('Error loading states:', error);
            window.scaleManager.weights = { left: 0, right: 0 };
            window.scaleManager.state = 'balanced';
            window.scaleManager.updateWeightDisplay();
        }
    }
    
    loadSliderValues() {
        const savedSliderValues = localStorage.getItem('sliderValues');
        
        if (savedSliderValues) {
            try {
                const sliderValues = JSON.parse(savedSliderValues);
                this.applySliderValues(sliderValues);
            } catch (e) {
                console.error('Error loading slider values:', e);
                this.resetAllSlidersToZero();
            }
        } else {
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
        
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        
        this.container.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
            notification.style.transition = 'all 0.3s ease';
        }, 10);

        const closeNotification = () => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
                document.removeEventListener('click', outsideClickListener);
            }, 300);
        };

        const outsideClickListener = (event) => {
            if (!notification.contains(event.target)) {
                closeNotification();
            }
        };

        setTimeout(() => {
            document.addEventListener('click', outsideClickListener);
        }, 100);

        notification.addEventListener('click', (event) => {
            event.stopPropagation();
        });

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
        
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });
        
        const menuItems = menu.querySelectorAll('.dropdown-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Клик по пункту меню:', item.textContent.trim());
                setTimeout(() => {
                    this.closeMenu();
                }, 300);
            });
        });
        
        if (overlay) {
            overlay.addEventListener('click', () => {
                this.closeMenu();
            });
        }
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-menu')) {
                this.closeMenu();
            }
        });
        
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

// Мониторинг производительности
function setupPerformanceMonitoring() {
    let frameCount = 0;
    let lastTime = performance.now();
    
    function checkFPS() {
        frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - lastTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
            
            if (fps < 30) {
                console.warn(`Low FPS: ${fps}. Optimizing...`);
                if (window.sliderOptimizer) {
                    window.sliderOptimizer.suspendAllAnimations();
                }
            }
            
            frameCount = 0;
            lastTime = currentTime;
        }
        
        requestAnimationFrame(checkFPS);
    }
    
    checkFPS();
    
    if (performance.memory) {
        setInterval(() => {
            const usedMB = performance.memory.usedJSHeapSize / 1048576;
            if (usedMB > 50) {
                if (window.memoryManager) {
                    window.memoryManager.cleanupInactiveResources();
                }
            }
        }, 10000);
    }
}

function closeReflectionModal() {
    const modal = document.querySelector('.reflection-modal');
    if (!modal) return;
    
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

function resetReflectionForm() {
    document.querySelectorAll('.assessment-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('reflectionGoal').value = '';
    document.getElementById('reflectionComment').value = '';
}

function loadReflectionData() {
    const savedReflections = JSON.parse(localStorage.getItem('crystalReflections') || '{}');
    const key = `${currentReflectionContext.level}_${currentReflectionContext.facetName}`;
    
    if (savedReflections[key]) {
        const data = savedReflections[key];
        
        // Устанавливаем оценку
        if (data.assessment !== undefined) {
            document.querySelectorAll('.assessment-btn').forEach(btn => {
                if (parseInt(btn.dataset.value) === data.assessment) {
                    btn.classList.add('active');
                }
            });
        }
        
        // Заполняем поля
        document.getElementById('reflectionGoal').value = data.goal || '';
        document.getElementById('reflectionComment').value = data.comment || '';
    }
}

function getCrystalName(levelElement) {
    if (!levelElement) return 'Неизвестный кристалл';
    
    const level = levelElement.dataset.level;
    const crystalTitles = {
        '3': 'Дети',
        '4': 'Партнер', 
        '5': 'Быт',
        '6': 'Основная работа',
        '7': 'Развитие навыков',
        '8': 'Командная работа'
    };
    
    return crystalTitles[level] || 'Кристалл';
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded and parsed");
    
    // СНАЧАЛА устанавливаем начальное состояние статуса
    setInitialBalancedState();
    
    // ПОТОМ инициализируем менеджеры
    window.crystalManager = new CrystalManager();
    window.scaleManager = new ScaleManager();
    window.stateManager = new StateManager();
    window.notificationSystem = new NotificationSystem();
    window.dropdownMenu = new DropdownMenu();
    
    // Новые оптимизации
    window.lazyLoader = new LazyLoader();
    window.sliderOptimizer = new SliderOptimizer();
    window.memoryManager = new MemoryManager();
    window.imageOptimizer = new ImageOptimizer();
    
    // ТЕПЕРЬ инициализируем приложение
    initializeApp();
    window.stateManager.loadAllStates();
    
    // Запускаем мониторинг производительности
    setupPerformanceMonitoring();
    
    // ПОКАЗЫВАЕМ ПРИВЕТСТВЕННОЕ СООБЩЕНИЕ
    showWelcomeMessageSimple();
    
    // Инициализация обработчиков для модального окна рефлексии
    initializeReflectionModal();
});

function initializeReflectionModal() {
    // Обработчики для кнопок оценки
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('assessment-btn')) {
            // Снимаем активный класс со всех кнопок
            document.querySelectorAll('.assessment-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            // Добавляем активный класс к нажатой кнопке
            e.target.classList.add('active');
        }
    });
    
    // Закрытие по ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.querySelector('.reflection-modal');
            if (modal && modal.style.display !== 'none') {
                closeReflectionModal();
            }
        }
    });
    
    // Закрытие по клику на оверлей
    document.addEventListener('click', function(e) {
        const modal = document.querySelector('.reflection-modal');
        if (modal && modal.style.display !== 'none' && e.target === modal) {
            closeReflectionModal();
        }
    });
}

function initializeApp() {
    console.log("Initializing application...");
    
    // СНАЧАЛА устанавливаем сбалансированное состояние
    setInitialBalancedState();
    
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
    
    // ОБНОВЛЯЕМ статус после полной инициализации
    if (window.scaleManager && typeof window.scaleManager.updateWeightDisplay === 'function') {
        window.scaleManager.updateWeightDisplay();
    } else {
        // Если scaleManager еще не готов, используем fallback
        updateWeightDisplayImmediately();
    }
    
    // Наблюдаем за уровнями для ленивой загрузки
    document.querySelectorAll('.nav-level[data-level]:not([data-level="0"])').forEach(level => {
        if (window.lazyLoader) {
            window.lazyLoader.observeLevel(level);
        }
    });
    
    setTimeout(() => {
        // Финальное обновление статуса
        if (window.scaleManager) {
            window.scaleManager.updateWeightDisplay();
        }
    }, 100);
}

// Добавление динамических стилей
function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .nav-level {
            transform: translateZ(0);
            backface-visibility: hidden;
            perspective: 1000;
        }

        .extra-large-crystal,
        .slider-thumb,
        .pan-img {
            will-change: transform, filter;
            transform: translateZ(0);
        }

        @media (max-width: 768px) {
            .crystal-in-bowl,
            .slider-thumb {
                transition-duration: 0.2s !important;
            }
            
            .pan-img {
                box-shadow: 0 2px 10px var(--accent-3) !important;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            *,
            *::before,
            *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
                scroll-behavior: auto !important;
            }
        }

        .slider-track {
            contain: layout style paint;
        }

        .crystals-group {
            contain: layout;
        }

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
                drop-shadow(0 0 15px rgba(255, 50, 50, 0.7))
                drop-shadow(0 0 5px rgba(255, 100, 100, 0.5)) !important;
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
        
        .dropdown-content {
            transition: all 0.3s ease;
            opacity: 0;
            transform: translateY(-10px);
        }
        
        .dropdown-overlay {
            transition: opacity 0.3s ease;
            opacity: 0;
        }
        
        @keyframes reflectionModalAppear {
            from {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.9);
            }
            to {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
        }
        
        .reflection-modal.active .modal-content {
            animation: reflectionModalAppear 0.3s ease-out;
        }
    `;
    document.head.appendChild(style);
}

// Инициализация всех слайдеров
function initializeAllSliders() {
    const sliders = document.querySelectorAll('.advanced-slider-container');
    sliders.forEach(container => {
        const input = container.querySelector('.advanced-slider-input');
        
        const initialValue = 0;
        input.value = initialValue;
        
        updateSliderVisuals(container, initialValue);
        setupSliderDrag(container);
    });
}

// Настройка слайдера (УПРОЩЕННАЯ ВЕРСИЯ БЕЗ ПЕРЕТАСКИВАНИЯ)
function setupSliderDrag(container) {
    const track = container.querySelector('.slider-track');
    const thumb = container.querySelector('.slider-thumb');
    
    if (track && thumb) {
        track.style.pointerEvents = 'none';
        thumb.style.pointerEvents = 'none';
        thumb.style.cursor = 'default';
    }
}



// Функция для обновления всех слайдеров при загрузке
function updateAllSlidersOnLoad() {
    const sliders = document.querySelectorAll('.advanced-slider-container');
    sliders.forEach(container => {
        const input = container.querySelector('.advanced-slider-input');
        const currentValue = parseInt(input.value) || 0;
        updateSliderVisuals(container, currentValue);
    });
}

function updateSliderVisuals(container, value) {
    try {
        const thumb = container.querySelector('.slider-thumb');
        const valueDisplay = container.querySelector('.slider-value');
        const fill = container.querySelector('.slider-fill');
        const headerValue = container.closest('.facet-input-group')?.querySelector('.current-value-display');
        
        const crystalContainer = container.closest('.nav-level');
        const level = parseInt(crystalContainer?.dataset.level);
        const isCareerCrystal = level >= 6 && level <= 8;
        
        if (valueDisplay) valueDisplay.textContent = value;
        if (headerValue) headerValue.textContent = value;
        
        const percentage = ((value + 30) / 60) * 100;
        
        if (thumb) {
            thumb.style.transition = 'left 0.3s ease, background 0.3s ease';
            thumb.style.left = `${percentage}%`;
        }
        
        if (fill) {
            fill.style.transition = 'width 0.3s ease, background 0.3s ease';
            fill.style.width = `${percentage}%`;
        }
        
        // ЛОГИКА ЦВЕТОВ С МИНИМАЛЬНЫМИ ИЗМЕНЕНИЯМИ
        if (value === 0) {
            // 🟠 ОРАНЖЕВЫЙ на нуле
            if (fill) fill.style.background = '#ffa500';
            if (thumb) thumb.style.background = '#ffa500';
            if (headerValue) {
                headerValue.style.transition = 'all 0.3s ease';
                headerValue.style.borderColor = '#ffa500';
                headerValue.style.background = 'rgba(255,165,0,0.2)';
                headerValue.style.color = '#ffa500';
            }
        } else if (value > 0) {
            // Положительные значения - СВЕТЛЕЕТ
            if (isCareerCrystal) {
                // 🟣 ФИОЛЕТОВЫЙ для карьеры (+)
                let currentColor = value >= 15 ? '#C17CE3' : '#9E67B8'; // Светлеет
                
                if (fill) fill.style.background = currentColor;
                if (thumb) thumb.style.background = currentColor;
                if (headerValue) {
                    headerValue.style.transition = 'all 0.3s ease';
                    headerValue.style.borderColor = currentColor;
                    headerValue.style.background = 'rgba(216,180,254,0.2)';
                    headerValue.style.color = currentColor;
                }
            } else {
                // 🔵 СИНИЙ для семьи (+)
                let currentColor = value >= 15 ? '#6cb2beff' : '#6CAABE'; // Светлеет
                
                if (fill) fill.style.background = currentColor;
                if (thumb) thumb.style.background = currentColor;
                if (headerValue) {
                    headerValue.style.transition = 'all 0.3s ease';
                    headerValue.style.borderColor = currentColor;
                    headerValue.style.background = 'rgba(147,197,253,0.2)';
                    headerValue.style.color = currentColor;
                }
            }
        } else {
            // 🔴 КРАСНЫЙ для отрицательных значений - немного темнеет
            let currentColor = value <= -15 ? '#ef4444' : '#f87171';
            
            if (fill) fill.style.background = currentColor;
            if (thumb) thumb.style.background = currentColor;
            if (headerValue) {
                headerValue.style.transition = 'all 0.3s ease';
                headerValue.style.borderColor = currentColor;
                headerValue.style.background = value <= -15 ? 'rgba(239,68,68,0.2)' : 'rgba(248,113,113,0.2)';
                headerValue.style.color = currentColor;
            }
        }

        // Плавные переходы
        if (thumb) {
            thumb.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            thumb.style.transition = 'left 0.3s ease, background 0.3s ease, box-shadow 0.3s ease';
        }

        if (fill) {
            fill.style.borderRadius = '8px';
            fill.style.transition = 'width 0.3s ease, background 0.3s ease';
        }

    } catch (error) {
        console.error('Error updating slider visuals:', error);
    }
}

// Функция для обновления всех слайдеров при загрузке
function updateAllSlidersOnLoad() {
    const sliders = document.querySelectorAll('.advanced-slider-container');
    sliders.forEach(container => {
        const input = container.querySelector('.advanced-slider-input');
        const currentValue = parseInt(input.value) || 0;
        updateSliderVisuals(container, currentValue);
    });
}

// Вызов после загрузки страницы
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        updateAllSlidersOnLoad();
    }, 100);
});

// Обновляем при изменении значений
function updateSliderValue(container, value) {
    try {
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
        
        saveAllStates();
    } catch (error) {
        console.error('Error updating slider value:', error);
    }
}

// Функция для обновления всех слайдеров при загрузке
function updateAllSlidersOnLoad() {
    const sliders = document.querySelectorAll('.advanced-slider-container');
    sliders.forEach(container => {
        const input = container.querySelector('.advanced-slider-input');
        const currentValue = parseInt(input.value) || 0;
        updateSliderVisuals(container, currentValue);
    });
}

// Вызов после загрузки страницы
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        updateAllSlidersOnLoad();
    }, 100);
});

// Обновляем при изменении значений
function updateSliderValue(container, value) {
    try {
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
        
        saveAllStates();
    } catch (error) {
        console.error('Error updating slider value:', error);
    }
}

// Функция для обновления всех слайдеров при загрузке
function updateAllSlidersOnLoad() {
    const sliders = document.querySelectorAll('.advanced-slider-container');
    sliders.forEach(container => {
        const input = container.querySelector('.advanced-slider-input');
        const currentValue = parseInt(input.value) || 0;
        updateSliderVisuals(container, currentValue);
    });
}

// Вызов после загрузки страницы
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        updateAllSlidersOnLoad();
    }, 100);
});

// Обновляем при изменении значений
function updateSliderValue(container, value) {
    try {
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
        
        saveAllStates();
    } catch (error) {
        console.error('Error updating slider value:', error);
    }
}

// Функция для обновления всех слайдеров при загрузке
function updateAllSlidersOnLoad() {
    const sliders = document.querySelectorAll('.advanced-slider-container');
    sliders.forEach(container => {
        const input = container.querySelector('.advanced-slider-input');
        const currentValue = parseInt(input.value) || 0;
        updateSliderVisuals(container, currentValue);
    });
}

// Вызов после загрузки страницы
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(updateAllSlidersOnLoad, 100);
});

// Обновленная функция для кнопок ±1 с вызовом модального окна рефлексии
window.changeAdvancedValue = function(button, change) {
    const container = button.closest('.advanced-slider-container');
    const input = container.querySelector('.advanced-slider-input');
    
    let currentValue = parseInt(input.value) || 0;
    let newValue = currentValue + change;
    
    const min = parseInt(input.min) || -30;
    const max = parseInt(input.max) || 30;
    
    if (newValue >= min && newValue <= max) {
        updateSliderValue(container, newValue);
        
        // Сохраняем контекст для рефлексии
        currentReflectionContext = {
            level: container.closest('.nav-level')?.dataset.level,
            facetName: container.closest('.facet-input-group')?.querySelector('.facet-label')?.textContent || 'Неизвестная грань',
            crystalName: getCrystalName(container.closest('.nav-level')),
            sliderValue: newValue,
            container: container
        };
        
        // Показываем модальное окно рефлексии
        showReflectionModal();
        
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = '';
        }, 150);
        
        const level = container.closest('.nav-level')?.dataset.level;
        if (level) {
            setTimeout(() => checkCrystalBalance(level), 100);
        }
        
        console.log(`Advanced slider value changed to: ${newValue}`);
    } else {
        button.style.background = 'rgba(255,0,0,0.3)';
        setTimeout(() => {
            button.style.background = '';
        }, 300);
    }
};

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

// Функция для проверки баланса и ломки алмаза
function checkCrystalBalance(level) {
    const crystalContainer = document.querySelector(`[data-level="${level}"]`);
    if (!crystalContainer) return;
    
    if (window.crystalManager.brokenCrystals[level]) return;
    
    const sliders = crystalContainer.querySelectorAll('.advanced-slider-input');
    const values = Array.from(sliders).map(slider => parseInt(slider.value) || 0);
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const variance = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    const criticalCount = values.filter(value => value <= CONFIG.CRITICAL_VALUE).length;
    
    const negativeSum = values.reduce((sum, value) => sum + Math.min(value, 0), 0);
    
    const effectiveThreshold = CONFIG.BREAK_THRESHOLD - criticalCount;
    
    console.log(`Level ${level} - SD: ${standardDeviation.toFixed(2)}, Critical: ${criticalCount}, Negative Sum: ${negativeSum}, Effective threshold: ${effectiveThreshold}, Values: ${values}`);
    
    removeCrystalWarning(level);
    
    const shouldBreak = 
        standardDeviation >= effectiveThreshold ||
        negativeSum <= -35;
    
    const shouldWarn = 
        (standardDeviation >= CONFIG.WARNING_THRESHOLD && standardDeviation < effectiveThreshold) ||
        (negativeSum <= -25 && negativeSum > -35);
    
    if (shouldBreak && !window.crystalManager.brokenCrystals[level]) {
        window.crystalManager.breakCrystal(level);
    } else if (shouldWarn) {
        showCrystalWarning(level, crystalContainer);
    }
}

// Функция показа предупреждения
function showCrystalWarning(level, crystalContainer) {
    const crystal = crystalContainer.querySelector('.extra-large-crystal');
    if (!crystal) return;
    
    crystal.classList.add('crystal-warning');
    
    crystal.style.animation = 'crystalWarningPulse 0.5s infinite alternate';
    
    const sliders = crystalContainer.querySelectorAll('.slider-track, .slider-thumb');
    sliders.forEach(slider => {
        slider.style.boxShadow = '0 0 10px orange';
    });
    
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
    
    const sliders = crystalContainer.querySelectorAll('.slider-track, .slider-thumb');
    sliders.forEach(slider => {
        slider.style.boxShadow = '';
    });
}

// Навигационные функции
window.navigateTo = function(level) { 
    console.log("Navigating to level:", level); 
    
    // Очистка ресурсов предыдущего уровня
    if (window.memoryManager) {
        const previousLevel = navStack[navStack.length - 1];
        window.memoryManager.cleanupLevelResources(previousLevel);
    }
    
    const current = document.querySelector(".nav-level.active"); 
    if (current) current.classList.remove("active");

    const target = document.querySelector(`[data-level="${level}"]`);
    if (target) {
        target.classList.add("active");
        navStack.push(level);
        
        // Восстановление ресурсов нового уровня
        if (window.memoryManager) {
            setTimeout(() => {
                window.memoryManager.restoreLevel(level);
            }, 100);
        }
        
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

// Функция восстановления всех кристаллов
window.restoreAllCrystals = function() {
    if (confirm('Восстановить все сломанные кристаллы?')) {
        console.log('Восстановление всех кристаллов...');
        
        Object.values(window.crystalManager.cooldownTimers).forEach(timer => {
            if (timer) clearTimeout(timer);
        });
        window.crystalManager.cooldownTimers = {};
        
        for (let level = 3; level <= 8; level++) {
            if (window.crystalManager.brokenCrystals[level]) {
                window.crystalManager.restoreCrystal(level);
            }
        }
        
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
        
        window.scaleManager.weights = { left: 0, right: 0 };
        
        window.stateManager.saveAllStates();
        
        window.stateManager.updateBrokenCrystalsVisuals();
        window.scaleManager.updateScaleBalance();
        
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
    
    if (window.dropdownMenu) {
        window.dropdownMenu.closeMenu();
    }
    
    if (confirm('Сбросить все значения на 0 и восстановить кристаллы?')) {
        console.log('Сброс всех значений и восстановление кристаллов...');
        
        if (window.crystalManager) {
            Object.values(window.crystalManager.cooldownTimers).forEach(timer => {
                if (timer) clearTimeout(timer);
            });
            window.crystalManager.cooldownTimers = {};
            
            for (let level = 3; level <= 8; level++) {
                if (window.crystalManager.brokenCrystals[level]) {
                    window.crystalManager.restoreCrystal(level);
                }
            }
            
            window.crystalManager.brokenCrystals = {};
        }
        
        const allSliders = document.querySelectorAll('.advanced-slider-input');
        allSliders.forEach(slider => {
            slider.value = 0;
            const container = slider.closest('.advanced-slider-container');
            if (container) {
                updateSliderVisuals(container, 0);
            }
        });
        
        if (window.scaleManager) {
            window.scaleManager.weights = { left: 0, right: 0 };
            window.scaleManager.updateScaleBalance();
            window.scaleManager.updateWeightDisplay();
        }
        
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
        
        if (window.crystalManager) {
            window.crystalManager.updateBrokenCrystalsOnBowlLevel(1);
            window.crystalManager.updateBrokenCrystalsOnBowlLevel(2);
        }
        
        for (let level = 3; level <= 8; level++) {
            removeCrystalWarning(level);
        }
        
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
    if (window.dropdownMenu) {
        window.dropdownMenu.closeMenu();
    }
};

window.showSettings = function() {
    console.log('Settings clicked');
    if (window.notificationSystem) {
        window.notificationSystem.info('Настройки будут здесь');
    }
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
        
        for (let level = 3; level <= 8; level++) {
            setTimeout(() => checkCrystalBalance(level), 100);
        }
    }
};

// Функция для точной установки значения слайдера
window.setExactValue = function(container, value) {
    const input = container.querySelector('.advanced-slider-input');
    const min = parseInt(input.min) || -30;
    const max = parseInt(input.max) || 30;
    
    value = Math.max(min, Math.min(max, value));
    updateSliderValue(container, value);
    
    const level = container.closest('.nav-level')?.dataset.level;
    if (level) {
        setTimeout(() => checkCrystalBalance(level), 100);
    }
};

function updateWeightDisplayImmediately() {
    console.log("Updating weight display immediately...");
    
    const statusElement = document.getElementById('scaleStatus');
    if (!statusElement) {
        console.error('Scale status element not found during immediate update');
        // Попробуем найти элемент через разные селекторы
        const alternativeElement = document.querySelector('.scale-status');
        if (alternativeElement) {
            alternativeElement.className = 'scale-status balanced';
            const textElement = alternativeElement.querySelector('.status-text');
            if (textElement) {
                textElement.textContent = 'Весы сбалансированы';
            }
            console.log("Found alternative element and updated it");
        }
        return;
    }

    // Устанавливаем сбалансированное состояние по умолчанию
    statusElement.className = 'scale-status balanced';
    const statusTextElement = statusElement.querySelector('.status-text');
    if (statusTextElement) {
        statusTextElement.textContent = 'Весы сбалансированы';
        console.log('Immediately set scale status to: Весы сбалансированы');
    } else {
        console.error("Status text element not found in updateWeightDisplayImmediately");
    }
}

function setInitialBalancedState() {
    console.log("Setting initial balanced state...");
    
    const statusElement = document.getElementById('scaleStatus');
    if (statusElement) {
        statusElement.className = 'scale-status balanced';
        const statusTextElement = statusElement.querySelector('.status-text');
        if (statusTextElement) {
            statusTextElement.textContent = 'Весы сбалансированы';
            console.log("Status text set to: Весы сбалансированы");
        } else {
            console.error("Status text element not found");
        }
    } else {
        console.error("Scale status element not found");
    }
    
    // Также обновляем менеджер весов, если он уже существует
    if (window.scaleManager) {
        window.scaleManager.weights = { left: 0, right: 0 };
        window.scaleManager.state = 'balanced';
    }
}

// Показать приветственное сообщение при загрузке сайта
function showWelcomeMessage() {
    const welcomeShown = sessionStorage.getItem('welcomeShown');
    if (welcomeShown) return;
    
    // Создаем уведомление в стиле системы уведомлений
    const notificationSystem = document.getElementById('notificationSystem');
    if (!notificationSystem) return;
    
    const notification = document.createElement('div');
    notification.className = 'notification info';
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div>
                <strong>Добро пожаловать в Кристаллы Фемиды!</strong>
                <strong style="color: var(--accent-1);">Помоги себе что бы помочь другим</strong><br>
            </div>
        </div>
    `;
    
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    
    notificationSystem.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
        notification.style.transition = 'all 0.3s ease';
    }, 100);
    
    // Помечаем, что сообщение было показано
    sessionStorage.setItem('welcomeShown', 'true');
    
    let closeTimer;
    
    // Функция закрытия уведомления
    const closeNotification = () => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
        clearTimeout(closeTimer);
        // Удаляем обработчики событий
        document.removeEventListener('click', closeOnOutsideClick);
        document.removeEventListener('keydown', closeOnEscape);
    };
    
    // Автоматическое закрытие через 5 секунд
    closeTimer = setTimeout(closeNotification, 5000);
    
    // Закрытие при клике на уведомление
    notification.addEventListener('click', (event) => {
        event.stopPropagation();
        closeNotification();
    });
    
    // Закрытие при клике в любом месте вне уведомления
    const closeOnOutsideClick = (event) => {
        if (!notification.contains(event.target)) {
            closeNotification();
        }
    };
    
    // Закрытие при нажатии ESC
    const closeOnEscape = (event) => {
        if (event.key === 'Escape') {
            closeNotification();
        }
    };
    
    // Добавляем обработчики с небольшой задержкой
    setTimeout(() => {
        document.addEventListener('click', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);
    }, 100);
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Показываем приветственное сообщение с небольшой задержкой
    setTimeout(showWelcomeMessage, 1000);
});

// Функция для тестирования (добавьте в консоль браузера)
window.testWelcomeMessage = function() {
    sessionStorage.removeItem('welcomeShown');
    showWelcomeMessage();
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Показываем приветственное сообщение с небольшой задержкой
    setTimeout(showWelcomeMessage, 1000);
});

// Функция для тестирования (добавьте в консоль браузера)
window.testWelcomeMessage = function() {
    sessionStorage.removeItem('welcomeShown');
    showWelcomeMessage();
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Показываем приветственное сообщение с небольшой задержкой
    setTimeout(showWelcomeMessage, 1000);
});


window.testWelcomeMessage = function() {
    sessionStorage.removeItem('welcomeShown');
    showWelcomeMessage();
};

// Обновленная функция для обработки ESC - навигация по стеку
function handleEscapeKey(event) {
    if (event.key === 'Escape') {
        // Если есть приветственное сообщение - закрываем его
        const welcomeMessage = document.getElementById('welcomeMessage');
        if (welcomeMessage) {
            welcomeMessage.click(); // Имитируем клик для закрытия
            return;
        }
        
        // Навигация по стеку
        if (navStack.length > 1) {
            navigateBack();
        } else {
            closeModal();
        }
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Показываем приветственное сообщение
    setTimeout(showWelcomeMessage, 500);
    
    // Устанавливаем обработчик ESC
    document.addEventListener('keydown', handleEscapeKey);
});

// Убедитесь, что ваши функции навигации выглядят так:
window.navigateBack = function() { 
    try {
        if (navStack.length > 1) { 
            navStack.pop(); 
            const current = document.querySelector(".nav-level.active"); 
            if (current) current.classList.remove("active");

            const prevLevel = navStack[navStack.length - 1];
            const prevElement = document.querySelector(`[data-level="${prevLevel}"]`);
            if (prevElement) {
                prevElement.classList.add("active");
                
                if (prevLevel === 1 || prevLevel === 2) {
                    updateBrokenCrystalsOnBowlLevel(prevLevel);
                }
            }
        }
    } catch (error) {
        console.error('Error in navigateBack:', error);
    }
};

window.closeModal = function() { 
    try {
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
    } catch (error) {
        console.error('Error closing modal:', error);
    }
};

// Глобальные переменные для рефлексии
let currentReflectionContext = {
    level: null,
    facetName: null,
    crystalName: null,
    sliderValue: null,
    container: null,
    pendingChange: 0 // -1 или +1
};

// Обновленная функция для кнопок ±1
window.changeAdvancedValue = function(button, change) {
    const container = button.closest('.advanced-slider-container');
    const input = container.querySelector('.advanced-slider-input');
    
    let currentValue = parseInt(input.value) || 0;
    let newValue = currentValue + change;
    
    const min = parseInt(input.min) || -30;
    const max = parseInt(input.max) || 30;
    
    if (newValue >= min && newValue <= max) {
        // Сохраняем контекст для рефлексии
        currentReflectionContext = {
            level: container.closest('.nav-level')?.dataset.level,
            facetName: container.closest('.facet-input-group')?.querySelector('.facet-label')?.textContent || 'Неизвестная грань',
            crystalName: getCrystalName(container.closest('.nav-level')),
            sliderValue: currentValue,
            container: container,
            pendingChange: change,
            newValue: newValue
        };
        
        // Показываем модальное окно рефлексии
        showReflectionModal();
        
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = '';
        }, 150);
        
    } else {
        button.style.background = 'rgba(255,0,0,0.3)';
        setTimeout(() => {
            button.style.background = '';
        }, 300);
    }
};

function showReflectionModal() {

    if (currentReflectionContext.sliderValue === null) {
    currentReflectionContext.sliderValue = 0;
}

    const modal = document.querySelector('.reflection-modal');
    if (!modal) return;
    
    const reflectionContent = modal.querySelector('.reflection-content');
    
    // Определяем тип кристалла и добавляем соответствующий класс
    const isCareerCrystal = currentReflectionContext.level >= 6;
    reflectionContent.className = 'modal-content reflection-content ' + 
        (isCareerCrystal ? 'career-crystal' : 'family-crystal');
    
    // Также добавляем класс к самому модальному окну для скроллбара
    modal.className = 'reflection-modal ' + 
        (isCareerCrystal ? 'career-scroll' : 'family-scroll');
    
    // Заполняем контекстную информацию
    document.getElementById('reflectionCrystalName').textContent = currentReflectionContext.crystalName;
    document.getElementById('reflectionFacetName').textContent = currentReflectionContext.facetName;
    document.getElementById('reflectionValue').textContent = currentReflectionContext.sliderValue;
    
    // Рассчитываем и отображаем баланс
    updateReflectionBalance(currentReflectionContext.sliderValue, isCareerCrystal);
    
    // Сбрасываем форму
    resetReflectionForm();
    
    // Показываем модальное окно
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    
    // Загружаем сохраненные данные если есть
    loadReflectionData();
}

// Новая функция для обновления цветов ползунка в модальном окне
function updateReflectionSliderColors(isCareerCrystal) {
    const balanceElement = document.getElementById('reflectionBalance');
    const valueElement = document.getElementById('reflectionValue');
    const sliderValue = currentReflectionContext.sliderValue;
    
    // Цвета для семьи (синие)
    if (!isCareerCrystal) {
        if (sliderValue === 0) {
            // Оранжевый на нуле
            if (balanceElement) balanceElement.style.color = '#ffa500';
            if (valueElement) valueElement.style.color = '#ffa500';
        } else if (sliderValue > 0) {
            // Синий для положительных
            if (balanceElement) balanceElement.style.color = 'var(--accent-2)';
            if (valueElement) valueElement.style.color = 'var(--accent-2)';
        } else {
            // Красный для отрицательных
            if (balanceElement) balanceElement.style.color = '#ff6b6b';
            if (valueElement) valueElement.style.color = '#ff6b6b';
        }
    } 
    // Цвета для карьеры (фиолетовые)
    else {
        if (sliderValue === 0) {
            // Оранжевый на нуле
            if (balanceElement) balanceElement.style.color = '#ffa500';
            if (valueElement) valueElement.style.color = '#ffa500';
        } else if (sliderValue > 0) {
            // Фиолетовый для положительных
            if (balanceElement) balanceElement.style.color = 'var(--accent-3)';
            if (valueElement) valueElement.style.color = 'var(--accent-3)';
        } else {
            // Красный для отрицательных
            if (balanceElement) balanceElement.style.color = '#ff6b6b';
            if (valueElement) valueElement.style.color = '#ff6b6b';
        }
    }
}

function updateReflectionBalance(sliderValue, isCareerCrystal) {
    const balanceElement = document.getElementById('reflectionBalance');
    const statusElement = document.getElementById('reflectionStatus');
    const valueElement = document.getElementById('reflectionValue');
    
    const percentage = Math.round(((sliderValue + 30) / 60) * 100);
    
    let status = '', statusClass = '';
    if (sliderValue >= 20) { status = 'Отличный'; statusClass = 'excellent'; }
    else if (sliderValue >= 10) { status = 'Хороший'; statusClass = 'good'; }
    else if (sliderValue >= 0) { status = 'Нормальный'; statusClass = 'normal'; }
    else if (sliderValue >= -10) { status = 'Напряженный'; statusClass = 'tense'; }
    else if (sliderValue >= -20) { status = 'Критический'; statusClass = 'critical'; }
    else { status = 'Опасный'; statusClass = 'dangerous'; }
    
    if (balanceElement) balanceElement.textContent = `${percentage}%`;
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.setAttribute('data-status', statusClass);
    }
    if (valueElement) valueElement.textContent = sliderValue;
    
    // ОБНОВЛЕННАЯ ЛОГИКА ЦВЕТОВ ДЛЯ ВСЕХ ЭЛЕМЕНТОВ
    if (sliderValue === 0) {
        // ОРАНЖЕВЫЙ для нуля
        if (balanceElement) balanceElement.style.color = '#ffa500';
        if (valueElement) valueElement.style.color = '#ffa500';
        if (statusElement) {
            statusElement.style.color = '#ffa500';
            statusElement.style.background = 'rgba(255,165,0,0.15)';
        }
    } else if (sliderValue > 0) {
        // Положительные значения - цвет кристалла
        const positiveColor = isCareerCrystal ? 'var(--accent-3)' : 'var(--accent-2)';
        const positiveBg = isCareerCrystal ? 'rgba(192,126,224,0.15)' : 'rgba(124,199,224,0.15)';
        
        if (balanceElement) balanceElement.style.color = positiveColor;
        if (valueElement) valueElement.style.color = positiveColor;
        if (statusElement) {
            statusElement.style.color = positiveColor;
            statusElement.style.background = positiveBg;
        }
    } else {
        // КРАСНЫЙ для отрицательных
        const negativeColor = sliderValue <= -15 ? '#ef4444' : '#f87171';
        const negativeBg = sliderValue <= -15 ? 'rgba(239,68,68,0.15)' : 'rgba(248,113,113,0.15)';
        
        if (balanceElement) balanceElement.style.color = negativeColor;
        if (valueElement) valueElement.style.color = negativeColor;
        if (statusElement) {
            statusElement.style.color = negativeColor;
            statusElement.style.background = negativeBg;
        }
    }
}

// Функция закрытия модального окна
function closeReflectionModal() {
    const modal = document.querySelector('.reflection-modal');
    if (!modal) return;
    
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
    
    // Убираем обработчики
    document.removeEventListener('keydown', handleReflectionEscape);
}

// Обработчик ESC
function handleReflectionEscape(event) {
    if (event.key === 'Escape') {
        cancelReflection();
    }
}

// Отмена рефлексии
function cancelReflection() {
    // Не применяем изменения значения
    console.log('Изменение отменено');
    closeReflectionModal();
    
    // Показываем уведомление
    if (window.notificationSystem) {
        window.notificationSystem.info('Изменение отменено');
    }
}

// Сохранение рефлексии
function saveReflection() {
    const assessmentBtn = document.querySelector('.assessment-btn.active');
    const assessment = assessmentBtn ? parseInt(assessmentBtn.dataset.value) : null;
    const goal = document.getElementById('reflectionGoal').value;
    const comment = document.getElementById('reflectionComment').value;
    
    // Применяем изменение значения
    if (currentReflectionContext.container && currentReflectionContext.pendingChange !== 0) {
        updateSliderValue(currentReflectionContext.container, currentReflectionContext.newValue);
        
        const level = currentReflectionContext.container.closest('.nav-level')?.dataset.level;
        if (level) {
            setTimeout(() => checkCrystalBalance(level), 100);
        }
    }
    
    // Сохраняем данные рефлексии
    const reflectionData = {
        assessment: assessment,
        goal: goal,
        comment: comment,
        timestamp: new Date().toISOString(),
        sliderValue: currentReflectionContext.newValue,
        facet: currentReflectionContext.facetName,
        crystal: currentReflectionContext.crystalName
    };
    
    // Сохраняем в localStorage
    const savedReflections = JSON.parse(localStorage.getItem('crystalReflections') || '{}');
    const key = `${currentReflectionContext.level}_${currentReflectionContext.facetName}`;
    savedReflections[key] = reflectionData;
    localStorage.setItem('crystalReflections', JSON.stringify(savedReflections));
    
    // Сохраняем в общее состояние
    if (window.stateManager) {
        window.stateManager.saveAllStates();
    }
    
    // Показываем уведомление
    if (window.notificationSystem) {
        window.notificationSystem.success('Рефлексия сохранена');
    }
    
    // Закрываем модальное окно
    closeReflectionModal();
}

// Сброс формы рефлексии
function resetReflectionForm() {
    document.querySelectorAll('.assessment-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById('reflectionGoal').value = '';
    document.getElementById('reflectionComment').value = '';
}

// Загрузка сохраненных данных рефлексии
function loadReflectionData() {
    const savedReflections = JSON.parse(localStorage.getItem('crystalReflections') || '{}');
    const key = `${currentReflectionContext.level}_${currentReflectionContext.facetName}`;
    
    if (savedReflections[key]) {
        const data = savedReflections[key];
        
        // Устанавливаем оценку
        if (data.assessment !== undefined) {
            document.querySelectorAll('.assessment-btn').forEach(btn => {
                if (parseInt(btn.dataset.value) === data.assessment) {
                    btn.classList.add('active');
                }
            });
        }
        
        // Заполняем поля
        document.getElementById('reflectionGoal').value = data.goal || '';
        document.getElementById('reflectionComment').value = data.comment || '';
    }
}

// Вспомогательная функция для получения имени кристалла
function getCrystalName(levelElement) {
    if (!levelElement) return 'Неизвестный кристалл';
    
    const level = levelElement.dataset.level;
    const crystalTitles = {
        '3': 'Дети',
        '4': 'Партнер', 
        '5': 'Быт',
        '6': 'Основная работа',
        '7': 'Развитие навыков',
        '8': 'Командная работа'
    };
    
    return crystalTitles[level] || 'Кристалл';
}

// Инициализация обработчиков для модального окна
function initializeReflectionModal() {
    // Обработчики для кнопок оценки
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('assessment-btn')) {
            // Снимаем активный класс со всех кнопок
            document.querySelectorAll('.assessment-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            // Добавляем активный класс к нажатой кнопке
            e.target.classList.add('active');
        }
    });
    
    // Закрытие по клику на оверлей
    document.addEventListener('click', function(e) {
        const modal = document.querySelector('.reflection-modal');
        if (modal && modal.style.display !== 'none' && e.target === modal) {
            cancelReflection();
        }
    });
}

// Добавьте вызов инициализации в DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    initializeReflectionModal();
    // ... остальной код инициализации
});