class App {
    constructor() {
        this.modalOpen = false;
        this.currentNotificationTimeout = null;
        this.boundEscapeHandler = this.handleEscape.bind(this);
        this.boundClickHandler = this.handleClick.bind(this);
        
        this.config = {
            notification: {
                duration: 3000,
                messages: {
                    reflection: 'Добро пожаловать!',
                    return: 'Рады снова вас видеть!'
                }
            },
            validation: {
                password: { 
                    minLength: 6
                },
                email: { 
                    regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
                },
                position: { 
                    minLength: 2 
                }
            }
        };
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkPreviousSession();
        console.log('Кристаллы Фемиды инициализированы');
    }

    bindEvents() {
        // Делегирование событий
        document.addEventListener('click', this.boundClickHandler);
        
        // Обработчики форм
        const reflectionForm = document.getElementById('reflectionForm');
        const returnForm = document.getElementById('returnForm');
        
        if (reflectionForm) {
            reflectionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit('reflection');
            });
        }
        
        if (returnForm) {
            returnForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit('return');
            });
        }

        // Валидация в реальном времени
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('form-input')) {
                this.clearFieldError(e.target);
            }
        });
    }

    handleClick(e) {
        if (e.target.closest('.password-toggle')) {
            this.togglePasswordVisibility(e.target.closest('.password-toggle'));
        }
    }

    togglePasswordVisibility(button) {
        const inputId = button.getAttribute('data-password-input');
        const passwordInput = document.getElementById(inputId);
        
        if (!passwordInput) return;

        const eyeIcon = button.querySelector('.eye-icon');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.querySelector('.eye-open').style.display = 'block';
            eyeIcon.querySelector('.eye-closed').style.display = 'none';
            button.setAttribute('aria-label', 'Скрыть пароль');
        } else {
            passwordInput.type = 'password';
            eyeIcon.querySelector('.eye-open').style.display = 'none';
            eyeIcon.querySelector('.eye-closed').style.display = 'block';
            button.setAttribute('aria-label', 'Показать пароль');
        }
        
        passwordInput.focus();
    }

    openModal(type) {
        this.closeAllModals();
        const modal = document.getElementById(`${type}Modal`);
        
        if (modal) {
            // Сначала показываем модалку
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
            this.modalOpen = true;
            
            // Затем запускаем анимацию через небольшой таймаут
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
            
            // Фокус на первом инпуте для доступности
            const firstInput = modal.querySelector('input');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
            
            // Блокировка скролла
            document.body.style.overflow = 'hidden';
            
            // ПОКАЗЫВАЕМ УВЕДОМЛЕНИЕ ПРИ ОТКРЫТИИ МОДАЛЬНОГО ОКНА
            this.showNotification(type);
            document.addEventListener('keydown', this.boundEscapeHandler);
        }
    }

    closeModal(type) {
        const modal = document.getElementById(`${type}Modal`);
        if (modal) {
            // Сначала запускаем анимацию закрытия
            modal.classList.remove('show');
            
            // Затем скрываем модалку после завершения анимации
            setTimeout(() => {
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
                this.modalOpen = false;
                this.clearFormErrors(modal);
                
                // ЗАКРЫВАЕМ УВЕДОМЛЕНИЕ ПРИ ЗАКРЫТИИ МОДАЛЬНОГО ОКНА
                this.hideNotification();
                
                // Восстановление скролла
                if (!document.querySelector('.modal[style*="display: flex"]')) {
                    document.body.style.overflow = '';
                    document.removeEventListener('keydown', this.boundEscapeHandler);
                }
            }, 300); // Должно совпадать с длительностью CSS transition
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            // Запускаем анимацию закрытия
            modal.classList.remove('show');
            
            // Скрываем после анимации
            setTimeout(() => {
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
                this.clearFormErrors(modal);
            }, 300);
        });
        
        this.modalOpen = false;
        document.body.style.overflow = '';
        
        // ЗАКРЫВАЕМ УВЕДОМЛЕНИЕ ПРИ ЗАКРЫТИИ ВСЕХ МОДАЛЬНЫХ ОКОН
        this.hideNotification();
        document.removeEventListener('keydown', this.boundEscapeHandler);
    }

    handleEscape(event) {
        if (event.key === 'Escape') {
            this.closeAllModals();
        }
    }

    showNotification(type) {
        const message = this.config.notification.messages[type];
        if (!message) return;

        const notification = document.getElementById('topNotification');
        const notificationText = notification.querySelector('.notification-text');
        
        notificationText.textContent = message;
        notification.classList.add('show');
        notification.setAttribute('aria-live', 'polite');

        // Сбрасываем предыдущий таймаут
        if (this.currentNotificationTimeout) {
            clearTimeout(this.currentNotificationTimeout);
        }

        // АВТОМАТИЧЕСКОЕ ЗАКРЫТИЕ ЧЕРЕЗ 3 СЕКУНДЫ
        this.currentNotificationTimeout = setTimeout(() => {
            this.hideNotification();
        }, this.config.notification.duration);
    }

    hideNotification() {
        const notification = document.getElementById('topNotification');
        notification.classList.remove('show');
        notification.setAttribute('aria-live', 'off');
        
        if (this.currentNotificationTimeout) {
            clearTimeout(this.currentNotificationTimeout);
            this.currentNotificationTimeout = null;
        }
    }

    showErrorNotification(message) {
        const notification = document.getElementById('topNotification');
        const notificationText = notification.querySelector('.notification-text');
        
        notificationText.textContent = message;
        notification.classList.add('show', 'error');
        notification.setAttribute('aria-live', 'assertive');

        setTimeout(() => {
            notification.classList.remove('show', 'error');
        }, this.config.notification.duration);
    }

    async handleFormSubmit(formType) {
        try {
            const form = document.getElementById(`${formType}Form`);
            if (!form) {
                throw new Error(`Форма ${formType}Form не найдена`);
            }
            
            if (this.validateForm(form)) {
                await this.submitForm(formType, form);
            }
        } catch (error) {
            console.error('Ошибка отправки формы:', error);
            this.showErrorNotification('Произошла ошибка. Попробуйте снова.');
            this.hideLoadingState(formType);
        }
    }

    async submitForm(formType, form) {
        this.showLoadingState(formType);
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Имитация API запроса
        try {
            await new Promise((resolve) => {
                setTimeout(() => {
                    console.log('Данные формы:', data);
                    resolve({ success: true });
                }, 1500);
            });
            this.redirectToApp();
        } catch (error) {
            throw error;
        }
    }

    validateForm(form) {
        const inputs = form.querySelectorAll('input[required]');
        let isValid = true;

        inputs.forEach(input => {
            const value = input.value.trim();
            const fieldType = input.getAttribute('data-field');
            
            if (!value) {
                // ТОЛЬКО КРАСНАЯ РАМКА И ФОН, БЕЗ ТЕКСТА
                this.showFieldError(input);
                isValid = false;
            } else if (fieldType === 'email' && !this.isValidEmail(value)) {
                this.showFieldError(input);
                isValid = false;
            } else if (fieldType === 'password' && !this.isValidPassword(value)) {
                this.showFieldError(input);
                isValid = false;
            } else if (fieldType === 'position' && value.length < 2) {
                this.showFieldError(input);
                isValid = false;
            } else {
                this.clearFieldError(input);
            }
        });

        return isValid;
    }

    isValidEmail(email) {
        return this.config.validation.email.regex.test(email);
    }

    isValidPassword(password) {
        return password.length >= this.config.validation.password.minLength;
    }

    showFieldError(input) {
        this.clearFieldError(input);
        
        // Вибрация при ошибке (если поддерживается)
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
        
        // ТОЛЬКО КРАСНАЯ РАМКА И ФОН, БЕЗ ТЕКСТА
        input.classList.add('error');
    }

    clearFieldError(input) {
        input.classList.remove('error');
        
        // ОЧИЩАЕМ ТЕКСТ ОШИБКИ ЕСЛИ ОН БЫЛ
        const errorDiv = input.parentNode.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.textContent = '';
        }
    }

    clearFormErrors(modal) {
        const inputs = modal.querySelectorAll('.form-input');
        inputs.forEach(input => this.clearFieldError(input));
    }

    showLoadingState(formType) {
        const continueBtn = document.querySelector(`#${formType}Modal .modal-btn-continue`);
        if (!continueBtn) return;
        
        const originalText = continueBtn.innerHTML;
        continueBtn.dataset.originalContent = originalText;
        
        continueBtn.innerHTML = `
            <span class="loading-spinner"></span>
            Перенаправление...
        `;
        continueBtn.disabled = true;
        
        // Показываем индикатор загрузки
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('show');
        }
    }

    hideLoadingState(formType) {
        const continueBtn = document.querySelector(`#${formType}Modal .modal-btn-continue`);
        if (continueBtn && continueBtn.dataset.originalContent) {
            continueBtn.innerHTML = continueBtn.dataset.originalContent;
            continueBtn.disabled = false;
        }
        
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('show');
        }
    }

    redirectToApp() {
    localStorage.setItem('lastSession', Date.now().toString());
    
    // Показать индикатор загрузки
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.classList.add('show');
    }
    
    // Закрыть все модальные окна
    this.closeAllModals();
    
    // Перенаправить на home.html
    setTimeout(() => {
        window.location.href = '/home';  // ← ИСПРАВЬ ЭТУ СТРОКУ
        // ИЛИ если home - главная страница:
        // window.location.href = '/';
    }, 1500);
}

    checkPreviousSession() {
        const lastSession = localStorage.getItem('lastSession');
        if (lastSession) {
            const timeDiff = Date.now() - parseInt(lastSession);
            const twentyFourHours = 24 * 60 * 60 * 1000;
            
            if (timeDiff < twentyFourHours) {
                console.log('Обнаружена предыдущая сессия');
            }
        }
    }

    // Метод для очистки ресурсов
    destroy() {
        document.removeEventListener('click', this.boundClickHandler);
        document.removeEventListener('keydown', this.boundEscapeHandler);
        
        this.closeAllModals();
        
        if (this.currentNotificationTimeout) {
            clearTimeout(this.currentNotificationTimeout);
        }
        
        console.log('Приложение уничтожено');
    }
}

// Инициализация приложения
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new App();
});

// Глобальные функции для HTML атрибутов
function openModal(type) {
    if (app) app.openModal(type);
}

function closeModal(type) {
    if (app) app.closeModal(type);
}

// Закрытие модального окна при клике вне его, но не при выделении текста
window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        // Проверяем, не было ли выделения текста
        const selection = window.getSelection();
        if (selection.toString().length === 0) {
            const activeModal = event.target.id.replace('Modal', '');
            closeModal(activeModal);
        }
    }
});

// Очистка при разгрузке страницы
window.addEventListener('beforeunload', () => {
    if (app) {
        app.destroy();
    }
});

