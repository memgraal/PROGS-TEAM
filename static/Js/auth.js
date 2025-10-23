/**
 * Кристаллы Фемиды - улучшенная версия
 * @version 2.1
 */

// Конфигурация приложения
const CONFIG = {
    api: {
        endpoints: {
            login: '/api/auth/login',
            register: '/api/auth/register'
        },
        timeout: 10000,
        retryAttempts: 3
    },
    validation: {
        password: { 
            minLength: 6
        },
        email: { 
            regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            debounceTimeout: 500
        },
        name: {
            minLength: 2,
            maxLength: 50
        },
        position: {
            minLength: 2,
            maxLength: 100
        }
    },
    ui: {
        animationDuration: 300,
        notificationDuration: 5000,
        loadingDelay: 1500
    },
    security: {
        sessionTimeout: 24 * 60 * 60 * 1000,
        maxPasswordAttempts: 5
    }
};

// Утилиты безопасности
class SecurityHelper {
    static sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    static isValidEmail(email) {
        return CONFIG.validation.email.regex.test(email);
    }

    static isValidPassword(password) {
        return password.length >= CONFIG.validation.password.minLength;
    }
}

// Система уведомлений
class NotificationSystem {
    constructor() {
        this.container = document.getElementById('topNotification');
        this.textElement = this.container?.querySelector('.notification-text');
        this.currentTimeout = null;
    }

    show(message, type = 'info', duration = CONFIG.ui.notificationDuration) {
        if (!this.container || !this.textElement) return;

        // Очищаем предыдущее уведомление
        this.hide();

        // Устанавливаем сообщение и тип
        this.textElement.textContent = SecurityHelper.sanitizeHTML(message);
        this.container.className = `notification-system`;

        // Показываем с анимацией
        requestAnimationFrame(() => {
            this.container.classList.add('show');
        });

        // Автоматическое скрытие
        this.currentTimeout = setTimeout(() => {
            this.hide();
        }, duration);
    }

    hide() {
        if (this.container) {
            this.container.classList.remove('show');
        }
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
    }
}

// Валидатор форм
class FormValidator {
    constructor() {
        this.debounceTimers = new Map();
        this.errorMessages = {
            required: 'Это поле обязательно для заполнения',
            email: 'Введите корректный email адрес',
            password: `Пароль должен содержать минимум ${CONFIG.validation.password.minLength} символов`,
            name: `Имя должно содержать от ${CONFIG.validation.name.minLength} до ${CONFIG.validation.name.maxLength} символов`,
            position: `Должность должна содержать от ${CONFIG.validation.position.minLength} до ${CONFIG.validation.position.maxLength} символов`
        };
    }

    validateField(input, showError = true) {
        const value = input.value.trim();
        const fieldType = input.getAttribute('data-field');
        let isValid = true;
        let errorMessage = '';

        if (!value) {
            isValid = false;
            errorMessage = this.errorMessages.required;
        } else {
            switch (fieldType) {
                case 'email':
                    isValid = SecurityHelper.isValidEmail(value);
                    errorMessage = this.errorMessages.email;
                    break;
                case 'password':
                    isValid = SecurityHelper.isValidPassword(value);
                    errorMessage = this.errorMessages.password;
                    break;
                case 'name':
                    isValid = value.length >= CONFIG.validation.name.minLength && 
                              value.length <= CONFIG.validation.name.maxLength;
                    errorMessage = this.errorMessages.name;
                    break;
                case 'position':
                    isValid = value.length >= CONFIG.validation.position.minLength && 
                              value.length <= CONFIG.validation.position.maxLength;
                    errorMessage = this.errorMessages.position;
                    break;
            }
        }

        if (showError) {
            this.displayFieldError(input, isValid, errorMessage);
        }

        return isValid;
    }

    displayFieldError(input, isValid, message) {
        // Создаем или находим контейнер для ошибки внутри input
        let errorContainer = input.parentNode.querySelector('.input-error-message');
        
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.className = 'input-error-message';
            input.parentNode.appendChild(errorContainer);
        }

        if (isValid) {
            input.classList.remove('error');
            errorContainer.textContent = '';
            errorContainer.style.display = 'none';
        } else {
            input.classList.add('error');
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
            
            // Вибрация при ошибке
            if (navigator.vibrate) navigator.vibrate(200);
        }
    }

    validateForm(form) {
        const inputs = form.querySelectorAll('input[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!this.validateField(input, true)) {
                isValid = false;
            }
        });

        return isValid;
    }

    setupRealTimeValidation(form) {
        const inputs = form.querySelectorAll('input[required]');
        
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                // Дебаунс валидации
                if (this.debounceTimers.has(input)) {
                    clearTimeout(this.debounceTimers.get(input));
                }

                this.debounceTimers.set(input, setTimeout(() => {
                    this.validateField(input, true);
                }, CONFIG.validation.email.debounceTimeout));
            });

            // Валидация при потере фокуса
            input.addEventListener('blur', () => {
                this.validateField(input, true);
            });
        });
    }

    clearFormErrors(form) {
        const inputs = form.querySelectorAll('.form-input');
        inputs.forEach(input => {
            input.classList.remove('error');
            const errorContainer = input.parentNode.querySelector('.input-error-message');
            if (errorContainer) {
                errorContainer.textContent = '';
                errorContainer.style.display = 'none';
            }
        });
    }
}

// Менеджер модальных окон
class ModalManager {
    constructor() {
        this.openModals = new Set();
        this.focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        this.boundKeyHandler = this.handleKeyDown.bind(this);
    }

    open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        this.closeAll();

        // Показываем модалку
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        
        // Анимация появления
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });

        // Блокируем скролл body
        document.body.style.overflow = 'hidden';
        document.body.classList.add('modal-open');

        // Управление фокусом
        this.trapFocus(modal);
        this.openModals.add(modalId);

        // Глобальные обработчики
        document.addEventListener('keydown', this.boundKeyHandler);
    }

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        // Анимация закрытия
        modal.classList.remove('show');
        
        setTimeout(() => {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
            this.openModals.delete(modalId);

            // Восстанавливаем скролл если нет других модалок
            if (this.openModals.size === 0) {
                document.body.style.overflow = '';
                document.body.classList.remove('modal-open');
                document.removeEventListener('keydown', this.boundKeyHandler);
            }
        }, CONFIG.ui.animationDuration);
    }

    closeAll() {
        this.openModals.forEach(modalId => {
            this.close(modalId);
        });
        this.openModals.clear();
    }

    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.closeAll();
        }

        if (event.key === 'Tab') {
            this.handleTabKey(event);
        }
    }

    handleTabKey(event) {
        if (this.openModals.size === 0) return;

        const modalId = Array.from(this.openModals)[this.openModals.size - 1];
        const modal = document.getElementById(modalId);
        const focusable = modal.querySelectorAll(this.focusableElements);
        
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    }

    trapFocus(modal) {
        const focusable = modal.querySelectorAll(this.focusableElements);
        if (focusable.length > 0) {
            setTimeout(() => focusable[0].focus(), 100);
        }
    }
}

// Главный класс приложения
class App {
    constructor() {
        this.modalManager = new ModalManager();
        this.validator = new FormValidator();
        this.notifications = new NotificationSystem();
        this.passwordAttempts = 0;
        
        this.boundClickHandler = this.handleClick.bind(this);
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkPreviousSession();
        console.log('🚀 Кристаллы Фемиды инициализированы');
    }

    bindEvents() {
        document.addEventListener('click', this.boundClickHandler);
        this.setupFormHandlers();
        this.setupRealTimeValidation();
    }

    setupFormHandlers() {
        const reflectionForm = document.getElementById('reflectionForm');
        const returnForm = document.getElementById('returnForm');
        
        if (reflectionForm) {
            reflectionForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit('reflection', reflectionForm);
            });
        }
        
        if (returnForm) {
            returnForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit('return', returnForm);
            });
        }
    }

    setupRealTimeValidation() {
        const reflectionForm = document.getElementById('reflectionForm');
        const returnForm = document.getElementById('returnForm');
        
        if (reflectionForm) this.validator.setupRealTimeValidation(reflectionForm);
        if (returnForm) this.validator.setupRealTimeValidation(returnForm);
    }

    handleClick(e) {
        if (e.target.closest('.password-toggle')) {
            this.togglePasswordVisibility(e.target.closest('.password-toggle'));
        }
        
        if (e.target.classList.contains('modal')) {
            const selection = window.getSelection();
            if (selection.toString().length === 0) {
                const modalId = e.target.id;
                const type = modalId.replace('Modal', '');
                this.closeModal(type);
            }
        }
    }

    togglePasswordVisibility(button) {
        const inputId = button.getAttribute('data-password-input');
        const passwordInput = document.getElementById(inputId);
        
        if (!passwordInput) return;

        const eyeIcon = button.querySelector('.eye-icon');
        const isVisible = passwordInput.type === 'text';
        
        passwordInput.type = isVisible ? 'password' : 'text';
        
        if (eyeIcon) {
            const eyeOpen = eyeIcon.querySelector('.eye-open');
            const eyeClosed = eyeIcon.querySelector('.eye-closed');
            
            if (eyeOpen && eyeClosed) {
                eyeOpen.style.display = isVisible ? 'none' : 'block';
                eyeClosed.style.display = isVisible ? 'block' : 'none';
            }
        }
        
        button.setAttribute('aria-label', isVisible ? 'Показать пароль' : 'Скрыть пароль');
        passwordInput.focus();
    }

    openModal(type) {
        const modalId = `${type}Modal`;
        this.modalManager.open(modalId);
        
        // Показываем уведомление с оригинальными сообщениями
        const messages = {
            reflection: 'Добро пожаловать!',
            return: 'Рады снова вас видеть!'
        };
        
        if (messages[type]) {
            this.notifications.show(messages[type], 'info');
        }
    }

    closeModal(type) {
        const modalId = `${type}Modal`;
        this.modalManager.close(modalId);
        
        // Скрываем уведомление при закрытии модального окна
        this.notifications.hide();
        
        // Очищаем ошибки формы
        const form = document.getElementById(`${type}Form`);
        if (form) this.validator.clearFormErrors(form);
    }

    async handleFormSubmit(formType, form) {
        if (this.passwordAttempts >= CONFIG.security.maxPasswordAttempts) {
            this.notifications.show('Слишком много попыток. Попробуйте позже.', 'error');
            return;
        }

        if (!this.validator.validateForm(form)) {
            this.passwordAttempts++;
            return;
        }

        try {
            await this.submitForm(formType, form);
            this.passwordAttempts = 0;
        } catch (error) {
            console.error('Ошибка отправки формы:', error);
            this.passwordAttempts++;
            this.notifications.show('Произошла ошибка. Попробуйте снова.', 'error');
            this.hideLoadingState(formType);
        }
    }

    async submitForm(formType, form) {
        this.showLoadingState(formType);
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        try {
            // Имитация API запроса
            await new Promise(resolve => {
                setTimeout(resolve, CONFIG.ui.loadingDelay);
            });
            
            this.redirectToApp();
        } catch (error) {
            throw error;
        }
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
        localStorage.setItem('userAuthenticated', 'true');
        
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('show');
        }
        
        this.modalManager.closeAll();
        this.notifications.hide();
        
        setTimeout(() => {
            window.location.href = '/home';
        }, CONFIG.ui.loadingDelay);
    }

    checkPreviousSession() {
        const lastSession = localStorage.getItem('lastSession');
        const userAuthenticated = localStorage.getItem('userAuthenticated');
        
        if (lastSession && userAuthenticated === 'true') {
            const timeDiff = Date.now() - parseInt(lastSession);
            
            if (timeDiff < CONFIG.security.sessionTimeout) {
                console.log('Обнаружена активная сессия');
            } else {
                localStorage.removeItem('userAuthenticated');
            }
        }
    }

    destroy() {
        document.removeEventListener('click', this.boundClickHandler);
        this.modalManager.closeAll();
        this.notifications.hide();
    }
}

// Инициализация приложения
let app;

document.addEventListener('DOMContentLoaded', () => {
    try {
        app = new App();
        
        window.openModal = (type) => app.openModal(type);
        window.closeModal = (type) => app.closeModal(type);
        
    } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
    }
});

window.addEventListener('beforeunload', () => {
    if (app) {
        app.destroy();
    }
});