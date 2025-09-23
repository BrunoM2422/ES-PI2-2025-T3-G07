// Autor: Pedro Henrique Ribeiro Silva Murta
document.addEventListener('DOMContentLoaded', function() {
    // Pega os elementos do formulário
    const loginForm = document.querySelector('form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitButton = document.querySelector('button');
    const recoverPasswordLink = document.getElementById('recoverPassword');
    const createAccountLink = document.getElementById('createAccount');

    // Inicia o sistema de login
    initializeLogin();

    function initializeLogin() {
        // Adiciona os listeners de evento e de validação
        if (loginForm) {
            loginForm.addEventListener('submit', handleLoginSubmit);
        }

        if (emailInput) {
            emailInput.addEventListener('input', validateEmail);
            emailInput.addEventListener('blur', validateEmail);
        }

        if (passwordInput) {
            passwordInput.addEventListener('input', validatePassword);
            passwordInput.addEventListener('blur', validatePassword);
        }

        //Isso serve para que o click seja notado pelo programa
        if (recoverPasswordLink) {
            recoverPasswordLink.addEventListener('click', handleRecoverPasswordClick);
        }

        if (createAccountLink) {
            createAccountLink.addEventListener('click', handleCreateAccountClick);
        }

    }

    function handleLoginSubmit(event) {
        event.preventDefault(); // Não deixa mandar default

        // Limpa mensagens anteriores
        clearMessages();

        // Valida o formulário
        if (!validateForm()) {
            return;
        }

        //Pega os dados do formulário
        const loginData = {
            email: emailInput.value.trim(),
            password: passwordInput.value
        };

        // Faz o login
        performLogin(loginData);
    }

    function validateForm() {
        let isValid = true;

        // valida o email e a senha respectivamente
        if (!validateEmail()) {
            isValid = false;
        }
        if (!validatePassword()) {
            isValid = false;
        }

        return isValid;
    }

    function validateEmail() {
        const email = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (email === '') {
            showFieldError(emailInput, 'Email é obrigatório');
            return false;
        }

        if (!emailRegex.test(email)) {
            showFieldError(emailInput, 'Por favor, insira um email válido');
            return false;
        }

        clearFieldError(emailInput);
        return true;
    }

    function validatePassword() {
        const password = passwordInput.value;

        if (password === '') {
            showFieldError(passwordInput, 'Senha é obrigatória');
            return false;
        }

        if (password.length < 6) {
            showFieldError(passwordInput, 'A senha deve ter pelo menos 6 caracteres');
            return false;
        }

        clearFieldError(passwordInput);
        return true;
    }

    function performLogin(loginData) {
        //WIP
    }

    function handleLoginError(message) {
        setSubmitButtonState('normal', 'Enviar');
        showMessage(message, 'error');
    }

    function handleRecoverPasswordClick(event) {
        event.preventDefault();
        // Navigate to password recovery page
        window.location.href = 'recuperarSenha.html';
    }

    function handleCreateAccountClick(event) {
        event.preventDefault();
        // Navigate to account creation page
        window.location.href = 'criarConta.html';
    }

    function setSubmitButtonState(state, text) {
        if (!submitButton) return;

        switch (state) {
            case 'loading':
                submitButton.disabled = true;
                submitButton.textContent = text;
                submitButton.style.opacity = '0.7';
                break;
            case 'normal':
                submitButton.disabled = false;
                submitButton.textContent = text;
                submitButton.style.opacity = '1';
                break;
        }
    }

    function showFieldError(input, message) {
        clearFieldError(input);

        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.style.color = '#e74c3c';
        errorDiv.style.fontSize = '12px';
        errorDiv.style.marginTop = '5px';

        input.parentNode.appendChild(errorDiv);
        input.style.borderColor = '#e74c3c';
    }

    function clearFieldError(input) {
        const existingError = input.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        input.style.borderColor = '';
    }

    function showMessage(message, type) {
        // remove mensagens existentes
        const existingMessage = document.querySelector('.login-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'login-message';
        messageDiv.innerHTML = message; // Use innerHTML para que links funcionem na mensagem de erro (provavelmente nem precise caso nem seja aplicável)
        // Estilização baseado no tipo de mensagem
        if (type === 'success') {
            messageDiv.style.cssText = `
                background-color: #d4edda;
                color: #155724;
                padding: 10px;
                border-radius: 4px;
                margin: 10px 0;
                border: 1px solid #c3e6cb;
            `;
        } else if (type === 'error') {
            messageDiv.style.cssText = `
                background-color: #f8d7da;
                color: #721c24;
                padding: 10px;
                border-radius: 4px;
                margin: 10px 0;
                border: 1px solid #f5c6cb;
            `;
        }

        // Insere a mensagem depois do formulário
        loginForm.parentNode.insertBefore(messageDiv, loginForm.nextSibling);
    }

    function clearMessages() {
        const messages = document.querySelectorAll('.login-message, .field-error');
        messages.forEach(msg => msg.remove());

        // Reseta a estilização dos campos
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            input.style.borderColor = '';
        });
    }


    // Funções que provavelmente serão criadas no futuro
    function isLoggedIn() {
        const user = localStorage.getItem('currentUser');
        return user !== null;
    }

    function logout() {
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }

    function getCurrentUser() {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }
});
