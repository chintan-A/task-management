// Task Management Class
class TaskManager {
    constructor() {
        this.checkAuth();
        this.tasks = this.loadUserTasks();
        this.setupEventListeners();
        this.loadUserProfile(); 
        this.loadTasks();
        this.setupDragAndDrop();
        this.setupThemeToggle();
        this.checkDueDates();
        this.setupAutoStatusUpdate();
    }

    checkAuth() {
        const session = SecureStore.validateSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        this.currentUser = session.email;
    }

    loadUserProfile() {
        const session = SecureStore.validateSession();
        if (!session) return;

        const userData = SecureStore.getUserData(session.email);
        if (userData) {
            const usernameElement = document.getElementById('username');
            const userAvatarElement = document.getElementById('userAvatar');
            
            if (usernameElement) {
                usernameElement.textContent = userData.username || 'User';
            }
            
            if (userAvatarElement && userData.profilePicture) {
                userAvatarElement.src = userData.profilePicture;
            } else if (userAvatarElement) {
                // Generate initials avatar if no profile picture
                userAvatarElement.src = SecureStore.generateInitialsAvatar(userData.username || 'User');
            }
        }

        document.getElementById('logoutBtn').addEventListener('click', () => {
            SecureStore.clearSession();
            window.location.href = 'login.html';
        });
    }

    handleLogout() {
        SecureStore.clearSession();
        window.location.href = 'login.html';
    }

    loadUserTasks() {
        try {
            const userTasks = SecureStore.getUserTasks(this.currentUser);
            return userTasks ? JSON.parse(userTasks) : [];
        } catch (error) {
            console.error('Error loading tasks:', error);
            return [];
        }
    }

    saveTasks() {
        try {
            SecureStore.saveUserTasks(this.currentUser, JSON.stringify(this.tasks));
            // Show save confirmation
            this.showToast('Tasks saved successfully');
        } catch (error) {
            console.error('Error saving tasks:', error);
            this.showToast('Error saving tasks', 'error');
        }
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Trigger reflow to enable animation
        toast.offsetHeight;
        
        // Show toast
        toast.classList.add('show');
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    setupEventListeners() {
        // Form submission
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask({
                name: document.getElementById('taskName').value,
                description: document.getElementById('taskDescription').value,
                dueDate: document.getElementById('taskDueDate').value,
                priority: document.getElementById('taskPriority').value,
                tags: document.getElementById('taskTags').value
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag)
            });
        });

        // Filters
        document.getElementById('filterStatus').addEventListener('change', () => this.filterTasks());
        document.getElementById('filterPriority').addEventListener('change', () => this.filterTasks());
        document.getElementById('sortBy').addEventListener('change', () => this.filterTasks());
    }

    addTask(taskData) {
        const task = {
            id: Date.now(),
            name: taskData.name,
            description: taskData.description,
            dueDate: taskData.dueDate,
            priority: taskData.priority,
            tags: taskData.tags,
            completed: false,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        this.tasks.push(task);
        this.saveTasks();
        this.loadTasks();
        this.showToast('Task added successfully');
        return task;
    }

    updateTask(taskId, updates) {
        const taskIndex = this.tasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
            this.tasks[taskIndex] = { ...this.tasks[taskIndex], ...updates };
            this.saveTasks();
            this.loadTasks();
            this.showToast('Task updated successfully');
        }
    }

    deleteTask(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        this.saveTasks();
        this.loadTasks();
        this.showToast('Task deleted successfully');
    }

    toggleTaskStatus(taskId) {
        const task = this.tasks.find(task => task.id === taskId);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.loadTasks();
        }
    }

    editTask(taskId) {
        const task = this.tasks.find(task => task.id === taskId);
        if (!task) return;

        const newName = prompt('Edit task name:', task.name);
        if (!newName) return;

        const newDescription = prompt('Edit task description:', task.description);
        if (newDescription === null) return;

        const newDueDate = prompt('Edit due date (YYYY-MM-DD):', task.dueDate);
        if (newDueDate === null) return;

        const newPriority = prompt('Edit priority (high/medium/low):', task.priority);
        if (newPriority === null) return;

        const newTags = prompt('Edit tags (comma-separated):', task.tags.join(','));
        if (newTags === null) return;

        task.name = newName;
        task.description = newDescription;
        task.dueDate = newDueDate;
        task.priority = newPriority.toLowerCase();
        task.tags = newTags.split(',').map(tag => tag.trim()).filter(tag => tag);

        this.saveTasks();
        this.loadTasks();
    }

    filterTasks() {
        const statusFilter = document.getElementById('filterStatus').value;
        const priorityFilter = document.getElementById('filterPriority').value;
        const sortBy = document.getElementById('sortBy').value;

        let filteredTasks = [...this.tasks];

        // Apply status filter
        if (statusFilter !== 'all') {
            filteredTasks = filteredTasks.filter(task => 
                statusFilter === 'completed' ? task.completed : !task.completed
            );
        }

        // Apply priority filter
        if (priorityFilter !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.priority === priorityFilter);
        }

        // Apply sorting
        filteredTasks.sort((a, b) => {
            switch (sortBy) {
                case 'dueDate':
                    return new Date(a.dueDate) - new Date(b.dueDate);
                case 'priority':
                    const priorityOrder = { high: 1, medium: 2, low: 3 };
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                case 'name':
                    return a.name.localeCompare(b.name);
                default:
                    return 0;
            }
        });

        this.renderTasks(filteredTasks);
    }

    setupDragAndDrop() {
        const taskList = document.getElementById('taskList');
        
        taskList.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('task-card')) {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
            }
        });

        taskList.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('task-card')) {
                e.target.classList.remove('dragging');
            }
        });

        taskList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingCard = document.querySelector('.dragging');
            const cards = [...taskList.querySelectorAll('.task-card:not(.dragging)')];
            const nextCard = cards.find(card => {
                const box = card.getBoundingClientRect();
                return e.clientY <= box.top + box.height / 2;
            });

            if (nextCard) {
                taskList.insertBefore(draggingCard, nextCard);
            } else {
                taskList.appendChild(draggingCard);
            }
        });

        taskList.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedTaskId = parseInt(e.dataTransfer.getData('text/plain'));
            const cards = [...taskList.querySelectorAll('.task-card')];
            const newOrder = cards.map(card => parseInt(card.dataset.taskId));
            
            this.tasks = newOrder.map(id => this.tasks.find(task => task.id === id));
            this.saveTasks();
        });
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        const userData = SecureStore.getUserData(this.currentUser);
        const currentTheme = userData?.settings?.theme || localStorage.getItem('theme') || 'light';
        
        document.documentElement.setAttribute('data-theme', currentTheme);
        themeToggle.checked = currentTheme === 'dark';

        themeToggle.addEventListener('change', () => {
            const theme = themeToggle.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            SecureStore.updateUserSettings(this.currentUser, { theme });
        });
    }

    checkDueDates() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        this.tasks.forEach(task => {
            if (task.completed) return;

            const dueDate = new Date(task.dueDate);
            if (dueDate <= tomorrow) {
                const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                
                if (daysUntilDue <= 0) {
                    this.showNotification(`Task Overdue: ${task.name}`);
                } else if (daysUntilDue === 1) {
                    this.showNotification(`Task Due Tomorrow: ${task.name}`);
                }
            }
        });

        // Check due dates every hour
        setTimeout(() => this.checkDueDates(), 3600000);
    }

    showNotification(message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(message);
        } else if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(message);
                }
            });
        }
    }

    setupAutoStatusUpdate() {
        // Check task statuses every minute
        setInterval(() => this.updateTaskStatuses(), 60000);
        // Initial check
        this.updateTaskStatuses();
    }

    updateTaskStatuses() {
        const now = new Date();
        let hasChanges = false;

        this.tasks = this.tasks.map(task => {
            if (!task.completed && task.dueDate) {
                const dueDate = new Date(task.dueDate);
                
                // If due date has passed
                if (dueDate < now) {
                    task.status = 'overdue';
                    task.statusUpdateTime = now.toISOString();
                    hasChanges = true;
                }
                // If due date is today
                else if (this.isSameDay(dueDate, now)) {
                    task.status = 'due-today';
                    task.statusUpdateTime = now.toISOString();
                    hasChanges = true;
                }
                // If due date is within next 24 hours
                else if (dueDate - now <= 24 * 60 * 60 * 1000) {
                    task.status = 'due-soon';
                    task.statusUpdateTime = now.toISOString();
                    hasChanges = true;
                }
                // If task has started but not due soon
                else if (task.startDate && new Date(task.startDate) <= now) {
                    task.status = 'in-progress';
                    task.statusUpdateTime = now.toISOString();
                    hasChanges = true;
                }
            }
            return task;
        });

        if (hasChanges) {
            this.saveTasks();
            this.loadTasks(); // Refresh the display
            this.showStatusNotifications();
        }
    }

    showStatusNotifications() {
        const overdueCount = this.tasks.filter(task => task.status === 'overdue').length;
        const dueTodayCount = this.tasks.filter(task => task.status === 'due-today').length;
        
        if (overdueCount > 0) {
            this.showNotification('Overdue Tasks', `You have ${overdueCount} overdue task(s)`);
        }
        if (dueTodayCount > 0) {
            this.showNotification('Due Today', `You have ${dueTodayCount} task(s) due today`);
        }
    }

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    loadTasks() {
        const taskList = document.getElementById('taskList');
        const filterStatus = document.getElementById('filterStatus').value;
        const filterPriority = document.getElementById('filterPriority').value;
        const sortBy = document.getElementById('sortBy').value;

        // Sort tasks
        let filteredTasks = [...this.tasks];
        
        // Apply filters
        if (filterStatus !== 'all') {
            if (filterStatus === 'completed') {
                filteredTasks = filteredTasks.filter(task => task.completed);
            } else if (filterStatus === 'active') {
                filteredTasks = filteredTasks.filter(task => !task.completed);
            } else if (filterStatus === 'overdue') {
                filteredTasks = filteredTasks.filter(task => task.status === 'overdue');
            } else if (filterStatus === 'in-progress') {
                filteredTasks = filteredTasks.filter(task => task.status === 'in-progress');
            }
        }

        if (filterPriority !== 'all') {
            filteredTasks = filteredTasks.filter(task => task.priority === filterPriority);
        }

        // Sort tasks
        filteredTasks.sort((a, b) => {
            switch (sortBy) {
                case 'dueDate':
                    return new Date(a.dueDate) - new Date(b.dueDate);
                case 'priority':
                    const priorityOrder = { high: 1, medium: 2, low: 3 };
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                case 'status':
                    return (a.status || '').localeCompare(b.status || '');
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });

        taskList.innerHTML = '';
        filteredTasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            taskList.appendChild(taskElement);
        });

        this.updateTaskCounters();
    }

    createTaskElement(task) {
        const taskElement = document.createElement('div');
        taskElement.className = `task-item ${task.completed ? 'completed' : ''} ${task.status || ''}`;
        taskElement.draggable = true;
        
        const statusClass = this.getStatusClass(task);
        const dueDateFormatted = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date';
        
        taskElement.innerHTML = `
            <div class="task-header ${statusClass}">
                <input type="checkbox" ${task.completed ? 'checked' : ''}>
                <h3>${task.name}</h3>
                <div class="task-priority ${task.priority}">${task.priority}</div>
            </div>
            <div class="task-details">
                <p>${task.description}</p>
                <div class="task-meta">
                    <span class="due-date">
                        <i class="fas fa-calendar"></i> ${dueDateFormatted}
                    </span>
                    <span class="task-status">
                        <i class="fas fa-clock"></i> ${this.getStatusText(task)}
                    </span>
                </div>
                <div class="task-tags">
                    ${task.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
            <div class="task-actions">
                <button class="edit-btn"><i class="fas fa-edit"></i></button>
                <button class="delete-btn"><i class="fas fa-trash"></i></button>
            </div>
        `;

        return taskElement;
    }

    getStatusClass(task) {
        if (task.completed) return 'status-completed';
        if (task.status === 'overdue') return 'status-overdue';
        if (task.status === 'due-today') return 'status-due-today';
        if (task.status === 'due-soon') return 'status-due-soon';
        if (task.status === 'in-progress') return 'status-in-progress';
        return '';
    }

    getStatusText(task) {
        if (task.completed) return 'Completed';
        if (task.status === 'overdue') return 'Overdue';
        if (task.status === 'due-today') return 'Due Today';
        if (task.status === 'due-soon') return 'Due Soon';
        if (task.status === 'in-progress') return 'In Progress';
        return 'Pending';
    }

    updateTaskCounters() {
        const now = new Date();
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(task => task.completed).length;
        const overdueTasks = this.tasks.filter(task => 
            !task.completed && 
            task.status === 'overdue'
        ).length;
        const inProgressTasks = this.tasks.filter(task => 
            !task.completed && 
            task.status === 'in-progress'
        ).length;

        document.getElementById('totalTasks').textContent = totalTasks;
        document.getElementById('completedTasks').textContent = completedTasks;
        document.getElementById('overdueTasks').textContent = overdueTasks;
        document.getElementById('inProgressTasks').textContent = inProgressTasks;
    }

    renderTasks(tasksToRender = this.tasks) {
        const taskList = document.getElementById('taskList');
        taskList.innerHTML = '';

        tasksToRender.forEach(task => {
            const taskCard = document.createElement('div');
            taskCard.className = `task-card ${task.completed ? 'completed' : ''}`;
            taskCard.draggable = true;
            taskCard.dataset.taskId = task.id;

            taskCard.innerHTML = `
                <div class="task-header">
                    <span class="task-title">${task.name}</span>
                    <div class="task-actions">
                        <button onclick="taskManager.toggleTaskStatus(${task.id})">
                            <i class="fas ${task.completed ? 'fa-undo' : 'fa-check'}"></i>
                        </button>
                        <button onclick="taskManager.editTask(${task.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="taskManager.deleteTask(${task.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="task-description">${task.description}</div>
                <div class="task-meta">
                    <span class="priority priority-${task.priority}">
                        ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </span>
                    <span class="due-date">Due: ${new Date(task.dueDate).toLocaleDateString()}</span>
                </div>
                <div class="task-tags">
                    ${task.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            `;

            taskList.appendChild(taskCard);
        });
    }
}

// Initialize Task Manager
const taskManager = new TaskManager();
