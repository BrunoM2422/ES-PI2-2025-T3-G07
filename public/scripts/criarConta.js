/* Autores: Pedro Henrique Ribeiro Silva Murta
            Gabriel Scolfaro de Azeredo
*/
document.addEventListener('DOMContentLoaded', function() {
    // Pega os elementos do formulário
    const createAccountForm = document.querySelector('form');
    const nameInput = document.getElementById('name');
    const surnameInput = document.getElementById('surname');
    const emailInput = document.getElementById('email');
    const telephoneInput = document.getElementById('telephone');
    const passwordInput = document.getElementById('password');
    const submitButton = document.querySelector('button');

    // Inicializa a criação de conta
    initializeAccountCreation();

    function initializeAccountCreation() {
        // listeners de evento e de validação
        if (createAccountForm) {
            createAccountForm.addEventListener('submit', handleAccountCreation);
        }
        if (nameInput) {
            nameInput.addEventListener('input', validateName);
            nameInput.addEventListener('blur', validateName);
        }

        if (surnameInput) {
            surnameInput.addEventListener('input', validateSurname);
            surnameInput.addEventListener('blur', validateSurname);
        }

        if (emailInput) {
            emailInput.addEventListener('input', validateEmail);
            emailInput.addEventListener('blur', validateEmail);
        }

        if (telephoneInput) {
            telephoneInput.addEventListener('input', validateTelephone);
            telephoneInput.addEventListener('blur', validateTelephone);
        }

        if (passwordInput) {
            passwordInput.addEventListener('input', validatePassword);
            passwordInput.addEventListener('blur', validatePassword);
        }
    }

    function handleAccountCreation(event) {
        event.preventDefault(); // Não deixa default passar
        
        clearMessages(); // limpa as mensagens antigas

        // valida o formulário
        if (!validateForm()) {
            return;
        }

        // pega a data dele
        const accountData = {
            name: nameInput.value.trim(),
            surname: surnameInput.value.trim(),
            email: emailInput.value.trim(),
            telephone: telephoneInput.value.trim(),
            password: passwordInput.value
        };

        // Faz a criação da conta
        // Envia pro servidor
        performAccountCreation(accountData);
    }

    function validateForm() {
        let isValid = true;

        // valida cada um dos campos
        if (!validateName()) isValid = false;
        if (!validateSurname()) isValid = false;
        if (!validateEmail()) isValid = false;
        if (!validateTelephone()) isValid = false;
        if (!validatePassword()) isValid = false;

        return isValid;
    }

    function validateName() {
        const name = nameInput.value.trim();
        
        if (name === '') {
            showFieldError(nameInput, 'Nome é obrigatório');
            return false;
        }
        if (name.length < 2) {
            showFieldError(nameInput, 'Nome deve ter pelo menos 2 caracteres');
            return false;
        }
        if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(name)) {
            showFieldError(nameInput, 'Nome deve conter apenas letras');
            return false;
        }
        clearFieldError(nameInput);
        return true;
    }

    function validateSurname() {
        const surname = surnameInput.value.trim();
        if (surname === '') {
            showFieldError(surnameInput, 'Sobrenome é obrigatório');
            return false;
        }
        if (surname.length < 2) {
            showFieldError(surnameInput, 'Sobrenome deve ter pelo menos 2 caracteres');
            return false;
        }
        if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(surname)) {
            showFieldError(surnameInput, 'Sobrenome deve conter apenas letras');
            return false;
        }
        clearFieldError(surnameInput);
        return true;
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

    function validateTelephone() {
        const telephone = telephoneInput.value.trim();
        if (telephone === '') {
            showFieldError(telephoneInput, 'Telefone é obrigatório');
            return false;
        }
        // Remove todos os caracteres não numéricos para validação
        const cleanPhone = telephone.replace(/\D/g, '');
        if (cleanPhone.length < 10 || cleanPhone.length > 11) {
            showFieldError(telephoneInput, 'Telefone deve ter 10 ou 11 dígitos');
            return false;
        }
        clearFieldError(telephoneInput);
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
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            showFieldError(passwordInput, 'A senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número');
            return false;
        }
        clearFieldError(passwordInput);
        return true;
    }

    async function performAccountCreation(accountData) {
        try {
            setSubmitButtonState('loading', 'Criando conta...');

            const response = await fetch('/api/create-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(accountData)
            });

            const result = await response.json();

            if (!response.ok || !result.ok) {
                handleAccountCreationError(result.error || 'Erro ao criar conta.');
                return;
            }

            // Salva o usuário recém-criado no localStorage
            localStorage.setItem('lastRegisteredUser', JSON.stringify(result));

            showMessage('Conta criada com sucesso!', 'success');

            // Redireciona após um curto tempo
            setTimeout(() => {
                window.location.href = 'hub.html';
            }, 1200);
        } catch (error) {
            console.error('Erro ao criar conta:', error);
            handleAccountCreationError('Ocorreu um erro inesperado. Tente novamente.');
        } finally {
            setSubmitButtonState('normal', 'Criar Conta');
        }
    }

    function handleAccountCreationError(message) {
        setSubmitButtonState('normal', 'Criar Conta');
        showMessage(message, 'error');
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

    function showMessage(message, type) {
        // Remove mensagens existentes
        const existingMessage = document.querySelector('.account-message');
        if (existingMessage) existingMessage.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = 'account-message';
        messageDiv.textContent = message;

        // Estilo baseado no texto
        if (type === 'success') {
            messageDiv.style.cssText = `
                background-color: #d4edda;
                color: #155724;
                padding: 15px;
                border-radius: 4px;
                margin: 15px 0;
                border: 1px solid #c3e6cb;
                text-align: center;
                line-height: 1.4;
            `;
        } else if (type === 'error') {
            messageDiv.style.cssText = `
                background-color: #f8d7da;
                color: #721c24;
                padding: 15px;
                border-radius: 4px;
                margin: 15px 0;
                border: 1px solid #f5c6cb;
                text-align: center;
                line-height: 1.4;
            `;
        }

        // insira a mensagem depois do formulário
        createAccountForm.parentNode.insertBefore(messageDiv, createAccountForm.nextSibling);
    }

    function clearMessages() {
        const messages = document.querySelectorAll('.account-message, .field-error');
        messages.forEach(msg => msg.remove());
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            input.style.borderColor = '';
        });
    }

    // Funções extras (possível uso futuro)
    function getRegisteredUsers() {
        return JSON.parse(localStorage.getItem('registeredUsers') || '[]');
    }

    function isEmailRegistered(email) {
        const users = getRegisteredUsers();
        return users.some(user => user.email === email);
    }

});