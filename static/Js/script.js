console.log("script.js loaded successfully!");

let navStack = [0];

window.navigateTo = function(level) { 
    console.log("Navigating to level:", level); 
    const current = document.querySelector(".nav-level.active"); 
    if (current) current.classList.remove("active");

    const target = document.querySelector('[data-level="' + level + '"]');
    if (target) {
        target.classList.add("active");
        navStack.push(level);
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
        if (prevElement) prevElement.classList.add("active");
    }
};

// Функция для продвинутого ползунка
window.changeAdvancedValue = function(button, change) {
    const container = button.closest('.advanced-slider-container');
    const input = container.querySelector('.advanced-slider-input');
    const valueDisplay = container.closest('.facet-input-group').querySelector('.current-value-display');
    
    let currentValue = parseInt(input.value) || 0;
    let newValue = currentValue + change;
    
    // Проверяем границы
    const min = parseInt(input.min) || -30;
    const max = parseInt(input.max) || 30;
    
    if (newValue >= min && newValue <= max) {
        input.value = newValue;
        updateSliderVisuals(container, newValue);
        
        // Обновляем отображение значения в заголовке
        if (valueDisplay) {
            valueDisplay.textContent = newValue;
        }
        
        // Анимация кнопки
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = '';
        }, 150);
        
        console.log(`Advanced slider value changed to: ${newValue}`);
    }
};

// Функция для обновления визуала продвинутого ползунка
function updateSliderVisuals(container, value) {
    const thumb = container.querySelector('.slider-thumb');
    const valueDisplay = container.querySelector('.slider-value');
    const fill = container.querySelector('.slider-fill');
    const headerValue = container.closest('.facet-input-group').querySelector('.current-value-display');
    
    // Обновляем значения
    valueDisplay.textContent = value;
    if (headerValue) {
        headerValue.textContent = value;
    }
    
    // Рассчитываем позицию (от -30 до 30 -> от 0% до 100%)
    const percentage = ((value + 30) / 60) * 100;
    
    // Обновляем позицию бегунка и заливки
    thumb.style.left = `${percentage}%`;
    fill.style.width = `${percentage}%`;
    
    // Меняем цвет в зависимости от значения
    if (value < 0) {
        fill.style.background = 'linear-gradient(90deg, #ff6b6b 0%, #ffa500 100%)';
        thumb.style.background = '#ff6b6b';
        if (headerValue) {
            headerValue.style.borderColor = '#ff6b6b';
            headerValue.style.background = 'rgba(255, 107, 107, 0.2)';
            headerValue.style.color = '#ff6b6b';
        }
    } else if (value > 0) {
        fill.style.background = 'linear-gradient(90deg, #4ecdc4 0%, #45b7af 100%)';
        thumb.style.background = '#4ecdc4';
        if (headerValue) {
            headerValue.style.borderColor = '#4ecdc4';
            headerValue.style.background = 'rgba(78, 205, 196, 0.2)';
            headerValue.style.color = '#4ecdc4';
        }
    } else {
        fill.style.background = 'linear-gradient(90deg, #ffa500 0%, #ffa500 100%)';
        thumb.style.background = '#ffa500';
        if (headerValue) {
            headerValue.style.borderColor = '#ffa500';
            headerValue.style.background = 'rgba(255, 165, 0, 0.2)';
            headerValue.style.color = '#ffa500';
        }
    }
}

// Инициализация продвинутых ползунков
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация продвинутых ползунков
    document.querySelectorAll('.advanced-slider-container').forEach(container => {
        const input = container.querySelector('.advanced-slider-input');
        const initialValue = parseInt(input.value) || 0;
        updateSliderVisuals(container, initialValue);
        
        // Обновляем отображение значения в заголовке
        const headerValue = container.closest('.facet-input-group').querySelector('.current-value-display');
        if (headerValue) {
            headerValue.textContent = initialValue;
        }
    });
    
    // Инициализация навигационных уровней
    document.querySelectorAll(".nav-level").forEach(function(level) { 
        if (level.getAttribute("data-level") !== "0") { 
            level.classList.remove("active"); 
        } 
    });
});