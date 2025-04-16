class ProfileManager {
    constructor() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadUserProfile();
        this.setupPasswordStrengthChecker();
        this.setupBiometricSupport();
        this.setupThemeSync();
    }

    checkAuth() {
        const session = SecureStore.validateSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        this.currentUser = session.email;
    }

    setupEventListeners() {
        document.getElementById('profileForm').addEventListener('submit', (e) => this.handleProfileUpdate(e));
        document.getElementById('deleteAccount').addEventListener('click', () => this.handleAccountDeletion());
        document.getElementById('newProfilePicture').addEventListener('change', (e) => this.handleProfilePictureChange(e));
        
        // Privacy controls
        document.getElementById('blurFace').addEventListener('change', () => this.updateProfilePicture());
        document.getElementById('avatarVisibility').addEventListener('change', (e) => this.updateAvatarVisibility(e));
    }

    async setupBiometricSupport() {
        const biometricSupported = await SecureStore.initWebAuthn();
        const biometricSection = document.getElementById('biometricSection');
        
        if (biometricSupported) {
            const isBiometricEnabled = localStorage.getItem(`${SecureStore.BIOMETRIC_ENABLED_KEY}_${this.currentUser}`);
            
            biometricSection.innerHTML = `
                <div class="form-group">
                    <label class="toggle-label">
                        <input type="checkbox" id="enableBiometric" ${isBiometricEnabled ? 'checked' : ''}>
                        Enable Biometric Login (Face ID/Touch ID)
                    </label>
                </div>
            `;

            document.getElementById('enableBiometric').addEventListener('change', (e) => this.handleBiometricToggle(e));
        } else {
            biometricSection.innerHTML = '<p class="note">Biometric authentication is not supported on this device</p>';
        }
    }

    setupThemeSync() {
        // Check if system prefers dark mode
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        const themeToggle = document.getElementById('theme-toggle');
        
        // Set initial state
        if (prefersDark.matches) {
            document.body.classList.add('dark-mode');
            themeToggle.checked = true;
        }

        // Listen for system theme changes
        prefersDark.addEventListener('change', (e) => {
            document.body.classList.toggle('dark-mode', e.matches);
            themeToggle.checked = e.matches;
        });

        // Manual theme toggle
        themeToggle.addEventListener('change', (e) => {
            document.body.classList.toggle('dark-mode', e.target.checked);
        });
    }

    async handleBiometricToggle(e) {
        try {
            if (e.target.checked) {
                await SecureStore.enableBiometric(this.currentUser);
                alert('Biometric login enabled successfully!');
            } else {
                localStorage.removeItem(`${SecureStore.BIOMETRIC_ENABLED_KEY}_${this.currentUser}`);
                alert('Biometric login disabled');
            }
        } catch (error) {
            e.target.checked = false;
            alert(error.message);
        }
    }

    loadUserProfile() {
        const userData = SecureStore.getUserData(this.currentUser);
        if (userData) {
            document.getElementById('username').value = userData.username;
            document.getElementById('email').value = userData.email;
            if (userData.profilePicture) {
                document.getElementById('currentProfilePic').src = userData.profilePicture;
            }
        }
    }

    setupPasswordStrengthChecker() {
        const passwordInput = document.getElementById('newPassword');
        const strengthMeter = document.querySelector('.strength-meter');
        const strengthText = document.querySelector('.strength-text');

        if (!passwordInput || !strengthMeter || !strengthText) return;

        passwordInput.addEventListener('input', () => {
            const password = passwordInput.value;
            if (!password) {
                strengthMeter.className = 'strength-meter';
                strengthText.textContent = '';
                return;
            }

            if (!SecureStore.isPasswordStrong(password)) {
                strengthMeter.className = 'strength-meter weak';
                strengthText.textContent = 'Password must have 8+ characters, uppercase, lowercase, number, and special character';
                return;
            }

            const length = password.length;
            if (length >= 12) {
                strengthMeter.className = 'strength-meter strong';
                strengthText.textContent = 'Strong password!';
            } else {
                strengthMeter.className = 'strength-meter medium';
                strengthText.textContent = 'Good, but could be stronger';
            }
        });
    }

    async handleProfileUpdate(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const newPassword = document.getElementById('newPassword').value;
        const errorElement = document.getElementById('profileError');

        try {
            if (newPassword && !SecureStore.isPasswordStrong(newPassword)) {
                throw new Error('New password does not meet security requirements');
            }

            await SecureStore.updateUserProfile(this.currentUser, {
                username,
                password: newPassword || undefined,
                profilePicture: this.newProfilePicture
            });

            errorElement.style.color = '#28a745';
            errorElement.textContent = 'Profile updated successfully!';
            
            if (newPassword) {
                document.getElementById('newPassword').value = '';
                document.querySelector('.strength-meter').className = 'strength-meter';
                document.querySelector('.strength-text').textContent = '';
            }

            this.newProfilePicture = null;
        } catch (error) {
            errorElement.style.color = '#dc3545';
            errorElement.textContent = error.message;
        }
    }

    async handleProfilePictureChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('Profile picture must be less than 5MB');
            e.target.value = '';
            return;
        }

        try {
            const options = {
                size: 200,
                blurFace: document.getElementById('blurFace').checked
            };

            this.newProfilePicture = await SecureStore.processProfilePicture(file, options);
            document.getElementById('currentProfilePic').src = this.newProfilePicture;
        } catch (error) {
            alert('Error processing profile picture: ' + error.message);
        }
    }

    updateAvatarVisibility(e) {
        const visibility = e.target.value;
        const userData = SecureStore.getUserData(this.currentUser);
        
        if (visibility === 'initials') {
            const initialsAvatar = SecureStore.generateInitialsAvatar(userData.username);
            document.getElementById('currentProfilePic').src = initialsAvatar;
            this.newProfilePicture = initialsAvatar;
        } else if (userData.profilePicture) {
            document.getElementById('currentProfilePic').src = userData.profilePicture;
            this.newProfilePicture = userData.profilePicture;
        }
    }

    async handleAccountDeletion() {
        const confirmed = confirm(
            'Are you sure you want to delete your account? This action cannot be undone and will delete all your tasks.'
        );

        if (confirmed) {
            const doubleConfirmed = confirm(
                'Please confirm again. All your data will be permanently deleted.'
            );

            if (doubleConfirmed) {
                try {
                    await SecureStore.deleteAccount(this.currentUser);
                    window.location.href = 'login.html';
                } catch (error) {
                    alert('Error deleting account: ' + error.message);
                }
            }
        }
    }
}

// Initialize Profile Manager
const profileManager = new ProfileManager();
