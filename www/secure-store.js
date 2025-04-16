class SecureStore {
    static SESSION_KEY = 'secure_session';
    static USER_KEY = 'secure_users';
    static TASKS_KEY = 'secure_tasks';
    static TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
    static BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

    static async generateToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    static async hashPassword(password, salt = null) {
        if (!salt) {
            const saltArray = new Uint8Array(16);
            crypto.getRandomValues(saltArray);
            salt = Array.from(saltArray, byte => byte.toString(16).padStart(2, '0')).join('');
        }

        const encoder = new TextEncoder();
        const passwordData = encoder.encode(password + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', passwordData);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return { hash: hashHex, salt };
    }

    static async createSession(email) {
        const token = await this.generateToken();
        const session = {
            token,
            email,
            expiresAt: Date.now() + this.TOKEN_EXPIRY
        };
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        return token;
    }

    static validateSession() {
        const sessionData = sessionStorage.getItem(this.SESSION_KEY);
        if (!sessionData) return null;

        const session = JSON.parse(sessionData);
        if (Date.now() > session.expiresAt) {
            this.clearSession();
            return null;
        }

        return session;
    }

    static clearSession() {
        sessionStorage.removeItem(this.SESSION_KEY);
    }

    static async createUser(username, email, password) {
        const users = this.getUsers();
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        // Check if email already exists
        if (users[email]) {
            throw new Error('Email already registered');
        }

        // Validate username
        if (username.length < 3) {
            throw new Error('Username must be at least 3 characters long');
        }

        // Validate password strength
        if (!this.isPasswordStrong(password)) {
            throw new Error('Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character');
        }

        // Hash password with salt
        const { hash, salt } = await this.hashPassword(password);

        const user = {
            username,
            email,
            passwordHash: hash,
            salt,
            createdAt: new Date().toISOString(),
            settings: {
                theme: 'light'
            }
        };

        users[email] = user;
        this.saveUsers(users);
        return user;
    }

    static async verifyUser(email, password) {
        const users = this.getUsers();
        const user = users[email];

        if (!user) {
            throw new Error('User not found');
        }

        const { hash } = await this.hashPassword(password, user.salt);
        if (hash !== user.passwordHash) {
            throw new Error('Invalid password');
        }

        return user;
    }

    static isPasswordStrong(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

        return password.length >= minLength &&
            hasUpperCase &&
            hasLowerCase &&
            hasNumbers &&
            hasSpecialChar;
    }

    static getUsers() {
        return JSON.parse(localStorage.getItem(this.USER_KEY) || '{}');
    }

    static saveUsers(users) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(users));
    }

    static getUserData(email) {
        const users = this.getUsers();
        const user = users[email];
        if (!user) return null;

        // Return user data without sensitive information
        const { passwordHash, salt, ...safeUserData } = user;
        return safeUserData;
    }

    static updateUserSettings(email, settings) {
        const users = this.getUsers();
        const user = users[email];
        if (!user) return false;

        user.settings = { ...user.settings, ...settings };
        this.saveUsers(users);
        return true;
    }

    static async updateUserProfile(email, updates) {
        const users = this.getUsers();
        const user = users[email];
        if (!user) {
            throw new Error('User not found');
        }

        // Update username if provided
        if (updates.username) {
            user.username = updates.username;
        }

        // Update password if provided
        if (updates.password) {
            const { hash, salt } = await this.hashPassword(updates.password);
            user.passwordHash = hash;
            user.salt = salt;
        }

        // Update profile picture if provided
        if (updates.profilePicture) {
            user.profilePicture = updates.profilePicture;
        }

        users[email] = user;
        this.saveUsers(users);
        return true;
    }

    static async deleteAccount(email) {
        // Delete user data
        const users = this.getUsers();
        if (!users[email]) {
            throw new Error('User not found');
        }

        delete users[email];
        this.saveUsers(users);

        // Delete user tasks
        this.deleteUserTasks(email);

        // Clear session
        this.clearSession();

        return true;
    }

    static getUserTasks(email) {
        const tasksData = localStorage.getItem(`${this.TASKS_KEY}_${email}`);
        return tasksData || '[]';
    }

    static saveUserTasks(email, tasks) {
        localStorage.setItem(`${this.TASKS_KEY}_${email}`, tasks);
    }

    static deleteUserTasks(email) {
        localStorage.removeItem(`${this.TASKS_KEY}_${email}`);
    }

    static async initWebAuthn() {
        if (!window.PublicKeyCredential) {
            console.log('WebAuthn not supported');
            return false;
        }
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }

    static async enableBiometric(email) {
        try {
            const supported = await this.initWebAuthn();
            if (!supported) {
                throw new Error('Biometric authentication not supported on this device');
            }

            const user = this.getUserData(email);
            if (!user) {
                throw new Error('User not found');
            }

            // Create biometric credential
            const publicKeyCredential = await navigator.credentials.create({
                publicKey: {
                    challenge: new Uint8Array(32),
                    rp: {
                        name: 'Task Management App',
                        id: window.location.hostname
                    },
                    user: {
                        id: new TextEncoder().encode(email),
                        name: email,
                        displayName: user.username
                    },
                    pubKeyCredParams: [{
                        type: 'public-key',
                        alg: -7
                    }],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required'
                    },
                    timeout: 60000
                }
            });

            // Store biometric credential
            localStorage.setItem(`${this.BIOMETRIC_ENABLED_KEY}_${email}`, 'true');
            return true;
        } catch (error) {
            console.error('Error enabling biometric:', error);
            throw new Error('Failed to enable biometric authentication');
        }
    }

    static async verifyBiometric(email) {
        try {
            const supported = await this.initWebAuthn();
            if (!supported) {
                throw new Error('Biometric authentication not supported');
            }

            const credential = await navigator.credentials.get({
                publicKey: {
                    challenge: new Uint8Array(32),
                    rpId: window.location.hostname,
                    userVerification: 'required',
                    timeout: 60000
                }
            });

            if (credential) {
                // Create session after successful biometric auth
                this.createSession(email);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Biometric verification failed:', error);
            return false;
        }
    }

    static generateInitialsAvatar(username) {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        // Generate a consistent color based on username
        const hue = Array.from(username).reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
        ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
        ctx.fillRect(0, 0, 200, 200);

        // Add initials
        const initials = username
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, 100, 100);

        return canvas.toDataURL('image/png');
    }

    static async processProfilePicture(file, options = {}) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const size = Math.min(img.width, img.height);
                    canvas.width = options.size || 200;
                    canvas.height = options.size || 200;
                    const ctx = canvas.getContext('2d');

                    // Create circular clip
                    ctx.beginPath();
                    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
                    ctx.clip();

                    // Draw image
                    const scale = canvas.width / size;
                    const x = (img.width - size) / 2;
                    const y = (img.height - size) / 2;
                    ctx.drawImage(img, x, y, size, size, 0, 0, canvas.width, canvas.height);

                    // Apply face blur if requested
                    if (options.blurFace) {
                        // Simple placeholder for face detection and blurring
                        // In a real app, you'd use a face detection library
                        ctx.filter = 'blur(5px)';
                        ctx.drawImage(canvas, 0, 0);
                    }

                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}
