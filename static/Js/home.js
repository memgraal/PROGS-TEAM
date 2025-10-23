document.addEventListener('DOMContentLoaded', function() {
    // ===== КОД ДЛЯ БОКОВЫХ ПАНЕЛЕЙ =====
    const menuBtn = document.getElementById('menuBtn');
    const tabsBtn = document.querySelector('.icon-btn[aria-label="Вкладки"]');
    const sidebar = document.getElementById('sidebar');
    const tabsSidebar = document.getElementById('tabsSidebar');
    const overlay = document.getElementById('sidebarOverlay');

    // Функции управления панелями
    function openSidebar(panel) {
        closeAllPanels();
        panel.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Подсвечиваем текущую страницу в панели вкладок
        if (panel === tabsSidebar) {
            highlightCurrentPage();
        }
    }

    function closeAllPanels() {
        sidebar.classList.remove('active');
        tabsSidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Подсветка текущей страницы
    function highlightCurrentPage() {
        const currentPage = 'main'; // Для главной страницы
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-page') === currentPage) {
                item.classList.add('active');
            }
        });
    }

    // Обработчики для кнопок
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.contains('active') ? closeAllPanels() : openSidebar(sidebar);
        });
    }

    if (tabsBtn) {
        tabsBtn.addEventListener('click', () => {
            tabsSidebar.classList.contains('active') ? closeAllPanels() : openSidebar(tabsSidebar);
        });
    }

    // Закрытие по оверлею и ESC
    if (overlay) {
        overlay.addEventListener('click', closeAllPanels);
    }
    
    document.addEventListener('keydown', (e) => e.key === 'Escape' && closeAllPanels());

    // Обработчики для пунктов меню вкладок
    document.querySelectorAll('.tabs-sidebar .nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            const page = this.getAttribute('data-page');
            const href = this.getAttribute('href');
            
            // Закрываем панель после клика
            closeAllPanels();
            
            // Переход на выбранную страницу
            if (page !== 'main' && href) {
                e.preventDefault();
                window.location.href = href;
            }
        });
    });

    // Закрытие основной панели при клике на пункты
    document.querySelectorAll('.sidebar:not(.tabs-sidebar) .nav-item').forEach(item => {
        item.addEventListener('click', closeAllPanels);
    });

    // Инициализация - подсвечиваем текущую страницу
    highlightCurrentPage();

    // ===== КОД ДЛЯ ЗАГРУЗКИ СЕГОДНЯШНИХ ЗАДАЧ ИЗ ПЛАНИРОВЩИКА =====
    loadTodayTasks();
    
    // Слушаем события обновления задач из планировщика
    window.addEventListener('tasksUpdated', loadTodayTasks);

    function loadTodayTasks() {
        const plansList = document.querySelector('.plans-list');
        if (!plansList) return;

        // Получаем задачи из планировщика
        const todayTasks = JSON.parse(localStorage.getItem('todayTasks')) || [];
        const plannerTasks = JSON.parse(localStorage.getItem('plannerTasks')) || [];
        
        // Если нет специальных todayTasks, фильтруем из plannerTasks
        const tasks = todayTasks.length > 0 ? todayTasks : 
            plannerTasks.filter(task => {
                const today = new Date().toISOString().split('T')[0];
                return task.deadline === today && !task.completed;
            });

        renderTodayTasks(tasks, plansList);
    }

    function renderTodayTasks(tasks, container) {
    // Очищаем контейнер
    container.innerHTML = '';

    if (tasks.length === 0) {
        // Контейнер будет пустым, CSS покажет псевдо-элемент
        return;
    }

    // Сортируем по важности (убывание) и дате создания
    const sortedTasks = tasks.sort((a, b) => {
        if (b.importance !== a.importance) {
            return b.importance - a.importance;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Добавляем задачи с анимацией
    sortedTasks.forEach((task, index) => {
        const taskElement = document.createElement('div');
        taskElement.className = 'plan-item';
        taskElement.style.animationDelay = `${index * 0.1}s`;
        
        taskElement.innerHTML = `
            <div class="plan-main-line">
                <span class="plan-text">${escapeHtml(task.title)}</span>
                <div class="plan-right">
                    <div class="importance-stars">
                        ${renderImportanceStars(task.importance)}
                    </div>
                </div>
            </div>
            <span class="plan-category">${getTaskCategory(task)}</span>
        `;
        
        container.appendChild(taskElement);
    });
}

    function getTaskCategory(task) {
        // Определяем категорию по важности
        if (task.importance >= 4) return 'Важное';
        if (task.importance >= 2) return 'Обычное';
        return 'Планировщик';
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderImportanceStars(importance) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += `<span class="${i <= importance ? 'star-filled' : 'star-empty'}">★</span>`;
        }
        return stars;
    }

    // ===== КОД ДЛЯ ГРАФИКОВ И ДРУГИХ ЭЛЕМЕНТОВ ГЛАВНОЙ СТРАНИЦЫ =====
    
    // Инициализация паутины баланса
    initSpiderwebChart();
    
    // Инициализация недельной динамики
    initWeeklyChart();
    
    // Обработчики для кнопок весов
    initScaleButtons();

    function initSpiderwebChart() {
        const ctx = document.getElementById('spiderwebChart');
        if (!ctx) return;

        const spiderwebChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Здоровье', 'Карьера', 'Семья', 'Финансы', 'Развитие', 'Духовность'],
                datasets: [{
                    label: 'Текущий баланс',
                    data: [65, 59, 80, 81, 56, 55],
                    borderColor: '#8F70ED',
                    backgroundColor: 'rgba(143, 112, 237, 0.2)',
                    borderWidth: 2,
                    pointBackgroundColor: '#8F70ED'
                }, {
                    label: 'Идеальный баланс',
                    data: [80, 70, 85, 75, 70, 80],
                    borderColor: '#33A2D4',
                    backgroundColor: 'rgba(51, 162, 212, 0.2)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointBackgroundColor: '#33A2D4'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        pointLabels: {
                            color: '#FFFFFF',
                            font: {
                                size: 12
                            }
                        },
                        ticks: {
                            backdropColor: 'transparent',
                            color: '#8491A8',
                            showLabelBackdrop: false
                        },
                        suggestedMin: 0,
                        suggestedMax: 100
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });

        // Обработчики для переключения наборов данных
        document.getElementById('currentBalanceBtn')?.addEventListener('click', function() {
            const isActive = this.classList.contains('active');
            if (isActive) {
                this.classList.remove('active');
                spiderwebChart.data.datasets[0].borderColor = 'transparent';
                spiderwebChart.data.datasets[0].backgroundColor = 'transparent';
            } else {
                this.classList.add('active');
                spiderwebChart.data.datasets[0].borderColor = '#8F70ED';
                spiderwebChart.data.datasets[0].backgroundColor = 'rgba(143, 112, 237, 0.2)';
            }
            spiderwebChart.update();
        });

        document.getElementById('idealBalanceBtn')?.addEventListener('click', function() {
            const isActive = this.classList.contains('active');
            if (isActive) {
                this.classList.remove('active');
                spiderwebChart.data.datasets[1].borderColor = 'transparent';
                spiderwebChart.data.datasets[1].backgroundColor = 'transparent';
            } else {
                this.classList.add('active');
                spiderwebChart.data.datasets[1].borderColor = '#33A2D4';
                spiderwebChart.data.datasets[1].backgroundColor = 'rgba(51, 162, 212, 0.2)';
            }
            spiderwebChart.update();
        });
    }

    function initWeeklyChart() {
        const ctx = document.getElementById('weeklyChart');
        if (!ctx) return;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                datasets: [{
                    label: 'Продуктивность',
                    data: [65, 59, 80, 81, 56, 55, 40],
                    borderColor: '#8F70ED',
                    backgroundColor: 'rgba(143, 112, 237, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#8491A8'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#8491A8'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    function initScaleButtons() {
        // Обработчики для кнопок весов
        document.querySelectorAll('.scale-card').forEach(button => {
            button.addEventListener('click', function() {
                const page = this.getAttribute('data-page');
                alert(`Будет открыта страница весов: ${this.querySelector('.scale-title').textContent}`);
            });
        });
    }

    // Обработчики для кнопок управления периодом
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Здесь можно добавить логику переключения периодов
            console.log('Переключение периода');
        });
    });

    document.querySelector('.other-date-btn')?.addEventListener('click', function() {
        // Логика для выбора другой даты
        console.log('Выбор другой даты');
    });

    // Обработчик для кнопки "Все цели"
    document.querySelector('.all-goals-btn')?.addEventListener('click', function() {
        window.location.href = 'goals.html';
    });

    // Обработчик для кнопки "Мой профиль" в социальной сети
    document.querySelector('.social-profile-btn-container .all-goals-btn')?.addEventListener('click', function() {
        window.location.href = 'profile.html';
    });
});