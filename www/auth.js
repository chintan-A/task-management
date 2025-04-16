class AuthManager {
    constructor() {
        this.setupThemeToggle();
        this.setupPasswordToggle();
        this.setupFormHandlers();
        this.setupPasswordStrengthChecker();
        this.setupProfilePictureHandler();
        this.checkSession();
    }

    checkSession() {
        const session = SecureStore.validateSession();
        if (!session && !window.location.pathname.includes('login.html') && 
            !window.location.pathname.includes('signup.html')) {
            window.location.href = 'login.html';
        }
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        const currentTheme = localStorage.getItem('theme') || 'light';
        
        document.documentElement.setAttribute('data-theme', currentTheme);
        themeToggle.checked = currentTheme === 'dark';

        themeToggle.addEventListener('change', () => {
            const theme = themeToggle.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);

            const session = SecureStore.validateSession();
            if (session) {
                SecureStore.updateUserSettings(session.email, { theme });
            }
        });
    }

    setupPasswordToggle() {
        const toggleButton = document.querySelector('.toggle-password');
        if (!toggleButton) return;

        const passwordInput = document.getElementById('password');
        toggleButton.addEventListener('click', () => {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            toggleButton.classList.toggle('fa-eye');
            toggleButton.classList.toggle('fa-eye-slash');
        });
    }

    setupFormHandlers() {
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
            this.checkRememberMe();
        }

        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleSignup(e));
        }
    }

    setupPasswordStrengthChecker() {
        const passwordInput = document.getElementById('password');
        const strengthMeter = document.querySelector('.strength-meter');
        const strengthText = document.querySelector('.strength-text');

        if (!passwordInput || !strengthMeter || !strengthText) return;

        passwordInput.addEventListener('input', () => {
            const password = passwordInput.value;
            const strength = this.checkPasswordStrength(password);
            strengthMeter.className = 'strength-meter ' + strength.level;
            strengthText.textContent = strength.message;
        });
    }

    checkPasswordStrength(password) {
        if (!password) {
            return { level: '', message: '' };
        }

        if (!SecureStore.isPasswordStrong(password)) {
            return { 
                level: 'weak', 
                message: 'Password must have 8+ characters, uppercase, lowercase, number, and special character' 
            };
        }

        const length = password.length;
        if (length >= 12) {
            return { level: 'strong', message: 'Strong password!' };
        } else {
            return { level: 'medium', message: 'Good, but could be stronger' };
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorElement = document.getElementById('signupError');

        try {
            await SecureStore.createUser(username, email, password);
            await this.handleLogin(e, true);
        } catch (error) {
            errorElement.textContent = error.message;
        }
    }

    async handleLogin(e, isAutoLogin = false) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const rememberMe = isAutoLogin ? false : document.getElementById('rememberMe')?.checked;
        const errorElement = document.getElementById('loginError');

        try {
            await SecureStore.verifyUser(email, password);
            await SecureStore.createSession(email);
            
            if (rememberMe) {
                localStorage.setItem('rememberedUser', email);
            } else {
                localStorage.removeItem('rememberedUser');
            }

            window.location.href = 'index.html';
        } catch (error) {
            if (errorElement) {
                errorElement.textContent = error.message;
            }
        }
    }

    setupProfilePictureHandler() {
        const profileInput = document.getElementById('profilePicture');
        if (!profileInput) return;

        profileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) { // 5MB limit
                    alert('Profile picture must be less than 5MB');
                    profileInput.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    this.profilePictureData = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    checkRememberMe() {
        const rememberedUser = localStorage.getItem('rememberedUser');
        if (rememberedUser) {
            const emailInput = document.getElementById('email');
            const rememberMeCheckbox = document.getElementById('rememberMe');
            if (emailInput && rememberMeCheckbox) {
                emailInput.value = rememberedUser;
                rememberMeCheckbox.checked = true;
            }
        }
    }
}

// Initialize Authentication
const authManager = new AuthManager();
