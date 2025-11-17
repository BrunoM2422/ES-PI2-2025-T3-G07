/* Autores: Gabriel Scolfaro de Azeredo
            Pedro Henrique Ribeiro Silva Murta
            Bruno Lenitta Machado

*/

//Implementa a lógica da página de login

//Garantir que o HTML existe
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
        if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
        if (emailInput) {
            emailInput.addEventListener('input', validateEmail);
            emailInput.addEventListener('blur', validateEmail);
        }
        if (passwordInput) {
            passwordInput.addEventListener('input', validatePassword);
            passwordInput.addEventListener('blur', validatePassword);
        }
        //Isso serve para que o click seja notado pelo programa
        if (recoverPasswordLink)
            recoverPasswordLink.addEventListener('click', handleRecoverPasswordClick);
        if (createAccountLink)
            createAccountLink.addEventListener('click', handleCreateAccountClick);
    }

    function handleLoginSubmit(event) {
        event.preventDefault(); // Não deixa mandar default
        // Limpa mensagens anteriores
        clearMessages();

        // Valida o formulário
        if (!validateForm()) return;

        //Pega os dados do formulário
        const loginData = {
            email: emailInput.value.trim(),
            password: passwordInput.value,
        };

        // Faz o login
        performLogin(loginData);
    }

    function validateForm() {
        let isValid = true;
        // valida o email e a senha respectivamente
        if (!validateEmail()) isValid = false;
        if (!validatePassword()) isValid = false;
        return isValid;
    }

    //Garantir que o email é válido
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

    //Validar a senha
    function validatePassword() {
        const password = passwordInput.value;
        if (password === '') {
            showFieldError(passwordInput, 'Senha é obrigatória');
            return false;
        }
        clearFieldError(passwordInput);
        return true;
    }

    //Função assincrona que verifica se houve compatibilidade de email e de senha
    async function performLogin(loginData) {
        try {
            setSubmitButtonState('loading', 'Entrando...');

            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData),
            });

            const result = await response.json();

            if (!response.ok || !result.ok) {
                handleLoginError(result.error || 'Email ou senha inválidos.');
                return;
            }

            // Salva usuário no localStorage
            localStorage.setItem('currentUser', JSON.stringify(result.user));

            // Mensagem de sucesso
            showMessage('Login realizado com sucesso! Redirecionando...', 'success');

            // Redireciona para o hub.html após 1s
            setTimeout(() => {
                window.location.href = 'hub.html';
            }, 1000);
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            handleLoginError('Erro inesperado. Tente novamente.');
        } finally {
            setSubmitButtonState('normal', 'Entrar');
        }
    }

    function handleLoginError(message) {
        setSubmitButtonState('normal', 'Entrar');
        showMessage(message, 'error');
    }

    function handleRecoverPasswordClick(event) {
        event.preventDefault();
        // Navega pra página de recuperação de senha
        window.location.href = 'recuperarSenha.html';
    }

    function handleCreateAccountClick(event) {
        event.preventDefault();
        // Navega pra página de criar conta
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
        if (existingError) existingError.remove();
        input.style.borderColor = '';
    }

    //Mostrar as mensagens
    function showMessage(message, type) {
        // remove mensagens existentes
        const existingMessage = document.querySelector('.login-message');
        if (existingMessage) existingMessage.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = 'login-message';
        messageDiv.innerHTML = message;

        if (type === 'success') {
            messageDiv.style.cssText = `
                background-color: #d4edda;
                color: #155724;
                padding: 10px;
                border-radius: 4px;
                margin: 10px 0;
                border: 1px solid #c3e6cb;
                text-align: center;
            `;
        } else if (type === 'error') {
            messageDiv.style.cssText = `
                background-color: #f8d7da;
                color: #721c24;
                padding: 10px;
                border-radius: 4px;
                margin: 10px 0;
                border: 1px solid #f5c6cb;
                text-align: center;
            `;
        }

        loginForm.parentNode.insertBefore(messageDiv, loginForm.nextSibling);
    }

    function clearMessages() {
        const messages = document.querySelectorAll('.login-message, .field-error');
        // Reseta a estilização dos campos
        messages.forEach((msg) => msg.remove());
        const inputs = document.querySelectorAll('input');
        inputs.forEach((input) => (input.style.borderColor = ''));
    }

    // Controle de sessão
    function isLoggedIn() {
        return localStorage.getItem('currentUser') !== null;
    }

    function logout() {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }

    function getCurrentUser() {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }
});