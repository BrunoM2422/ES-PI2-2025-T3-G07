/* Autores: Pedro Henrique Ribeiro Silva Murta
            Gabriel Scolfaro de Azeredo
            Nicolas Mitjans Nunes
            Bruno Lenitta Machado
*/

// Aguarda o carregamento completo do DOM antes de executar
document.addEventListener('DOMContentLoaded', function() {
    // Pega os elementos do formulário
    const createAccountForm = document.querySelector('form');
    const nameInput = document.getElementById('name');
    const surnameInput = document.getElementById('surname');
    const emailInput = document.getElementById('email');
    const telephoneInput = document.getElementById('telephone');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const submitButton = document.querySelector('button');

    // Inicializa a criação de conta
    initializeAccountCreation();

    function initializeAccountCreation() {
        // Configura os event listeners para validação em tempo real
        if (createAccountForm) {
            createAccountForm.addEventListener('submit', handleAccountCreation);
        }
        
        // Validação para nome - durante digitação e ao sair do campo
        if (nameInput) {
            nameInput.addEventListener('input', validateName);
            nameInput.addEventListener('blur', validateName);
        }

        // Validação para sobrenome
        if (surnameInput) {
            surnameInput.addEventListener('input', validateSurname);
            surnameInput.addEventListener('blur', validateSurname);
        }

        // Validação para email
        if (emailInput) {
            emailInput.addEventListener('input', validateEmail);
            emailInput.addEventListener('blur', validateEmail);
        }

        // Validação para telefone
        if (telephoneInput) {
            telephoneInput.addEventListener('input', validateTelephone);
            telephoneInput.addEventListener('blur', validateTelephone);
        }

        // Validação para senha e confirmação
        if (passwordInput) {
            passwordInput.addEventListener('input', validatePassword);
            passwordInput.addEventListener('blur', validatePassword);
        }
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', validatePassword);
            confirmPasswordInput.addEventListener('blur', validatePassword);
        }
    }

    function handleAccountCreation(event) {
        event.preventDefault(); // Impede envio padrão do formulário
        
        clearMessages(); // Limpa mensagens anteriores

        // Verifica se todos os campos são válidos
        if (!validateForm()) {
            return; // Para aqui se houver erro
        }

        // Prepara os dados para envio
        const accountData = {
            name: nameInput.value.trim(),
            surname: surnameInput.value.trim(),
            email: emailInput.value.trim(),
            telephone: telephoneInput.value.trim(),
            password: passwordInput.value
        };

        // Envia os dados para criação da conta
        performAccountCreation(accountData);
    }

    function validateForm() {
        let isValid = true;

        // Valida cada campo individualmente
        if (!validateName()) isValid = false;
        if (!validateSurname()) isValid = false;
        if (!validateEmail()) isValid = false;
        if (!validateTelephone()) isValid = false;
        if (!validatePassword()) isValid = false;
        
        // Verifica se as senhas coincidem
        if (passwordInput.value !== confirmPasswordInput.value) {
            showFieldError(confirmPasswordInput, 'As senhas não coincidem');
            isValid = false;
        } else {
            clearFieldError(confirmPasswordInput);
        }

        return isValid;
    }

    function validateName() {
        const name = nameInput.value.trim();
        
        // Nome deve ter pelo menos 2 caracteres e apenas letras
        if (name === '' || name.length < 2 || !/^[a-zA-ZÀ-ÿ\s]+$/.test(name)) {
            showFieldError(nameInput, 'Nome é obrigatório | Nome deve ter pelo menos 2 caracteres | Nome deve conter apenas letras');
            return false;
        }
        clearFieldError(nameInput);
        return true;
    }

    function validateSurname() {
        const surname = surnameInput.value.trim();
        // Mesmas regras do nome
        if (surname === '' || surname.length < 2 || !/^[a-zA-ZÀ-ÿ\s]+$/.test(surname)) {
            showFieldError(surnameInput, 'Sobrenome é obrigatório | O sobrenome deve conter pelo menos 2 caracteres | Sobrenome deve conter apenas letras');
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
        
        // Remove caracteres não numéricos e valida quantidade de dígitos
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
        // Senha precisa ter: mínimo 6 caracteres, letra maiúscula, minúscula e número
        if (password === '' || password.length < 6 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            showFieldError(passwordInput, 'Senha é obrigatória | A senha deve ter pelo menos 6 caracteres | A senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número');
            return false;
        }
        clearFieldError(passwordInput);
        return true;
    }

    async function performAccountCreation(accountData) {
        try {
            setSubmitButtonState('loading', 'Criando conta...');

            // Envia requisição para a API
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

            // Salva o usuário como currentUser (igual ao login)
            const userData = {
                id_usuario: result.userId,
                email: accountData.email,
                nome: accountData.name,
                sobrenome: accountData.surname
            };
            
            localStorage.setItem('currentUser', JSON.stringify(userData));

            showMessage('Conta criada com sucesso!', 'success');

            // Redireciona para o hub após breve delay
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
        
        // Controla estado visual do botão de submit
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

        // Cria elemento de erro estilizado
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';

        // Formata mensagem com quebras de linha
        const formattedMessage = message.split('|').join('<br>');
        errorDiv.innerHTML = formattedMessage;

        // Estilos para mensagem de erro
        errorDiv.style.color = '#e74c3c';
        errorDiv.style.fontSize = '12px';
        errorDiv.style.marginTop = '5px';
        errorDiv.style.width = '500px';

        input.parentNode.appendChild(errorDiv);
        input.style.borderColor = '#e74c3c'; // Borda vermelha para indicar erro
    }

    function clearFieldError(input) {
        // Remove mensagens de erro anteriores do campo
        const existingError = input.parentNode.querySelector('.field-error');
        if (existingError) existingError.remove();
        input.style.borderColor = ''; // Restaura cor padrão
    }

    function showMessage(message, type) {
        // Remove mensagens existentes
        const existingMessage = document.querySelector('.account-message');
        if (existingMessage) existingMessage.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = 'account-message';
        messageDiv.textContent = message;

        // Aplica estilos baseados no tipo de mensagem
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

        // Insere mensagem após o formulário
        createAccountForm.parentNode.insertBefore(messageDiv, createAccountForm.nextSibling);
    }

    function clearMessages() {
        // Limpa todas as mensagens do formulário
        const messages = document.querySelectorAll('.account-message, .field-error');
        messages.forEach(msg => msg.remove());
        
        // Restaura bordas padrão de todos os inputs
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