// Autor: Pedro Henrique Ribeiro Silva Murta
document.addEventListener('DOMContentLoaded', function() {
    // Pega os elementos do formulário
    const recoveryForm = document.querySelector('.RecoverPass');
    const emailInput = document.querySelector('input[type="email"]');
    const submitButton = document.querySelector('button');
    const recoveryText = document.querySelector('.passwordRecoverText');

    // Inicia o sistema de recuperação de senha
    initializePasswordRecovery();

    function initializePasswordRecovery() {
        // Adiciona os listeners de evento e de validação
        if (recoveryForm) {
            recoveryForm.addEventListener('submit', handlePasswordRecovery);
        }

        if (emailInput) {
            emailInput.addEventListener('input', validateEmail);
            emailInput.addEventListener('blur', validateEmail);
        }
    }

    function handlePasswordRecovery(event) {
        event.preventDefault(); // Não deixa default ser enviado

        // Limpa mensagens anteriormente criadas
        clearMessages();

        // Valida o formulário
        if (!validateEmail()) {
            return;
        }

        // Pega o email
        const email = emailInput.value.trim();

        // Executa a recuperação de senha
        performPasswordRecovery(email);
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

    function performPasswordRecovery(email) {
    //wip
    }
//WIP DA RECUPERAÇÃO DE SENHA
    function handleRecoverySuccess(email) {
        // Generate a mock recovery token
        const recoveryToken = generateRecoveryToken();

        // Store recovery token (in production, this would be sent via email)
        const recoveryData = {
            email: email,
            token: recoveryToken,
            requestedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        };

        // Save to localStorage (mock email sending)
        localStorage.setItem('passwordRecovery', JSON.stringify(recoveryData));

        // Show success message
        showMessage(
            `Instruções de recuperação de senha foram enviadas para ${email}. Verifique sua caixa de entrada.`,
            'success'
        );

        // Reset form
        if (emailInput) {
            emailInput.value = '';
        }

        // Reset button state
        setSubmitButtonState('normal', 'Recuperar Senha');
    }

    function generateRecoveryToken() {
        // Generate a simple token (in production, use a proper token generation method)
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
        // Remove mensagens que já existem no momento
        const existingMessage = document.querySelector('.recovery-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'recovery-message';
        messageDiv.textContent = message;

        // Estilização baseado no tipo
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

        // Insere a mensagem abaixo do formulário
        recoveryForm.parentNode.insertBefore(messageDiv, recoveryForm.nextSibling);
    }

    function clearMessages() {
        const messages = document.querySelectorAll('.recovery-message, .field-error');
        messages.forEach(msg => msg.remove());
        if (emailInput) {
            emailInput.style.borderColor = '';
        }
    }
    // Funções utilitárias futuras
    function isValidRecoveryToken(email, token) {
        const recoveryData = JSON.parse(localStorage.getItem('passwordRecovery') || '{}');

        if (recoveryData.email !== email || recoveryData.token !== token) {
            return false;
        }

        // observa se o token expirou
        const now = new Date();
        const expiresAt = new Date(recoveryData.expiresAt);

        return now < expiresAt;
    }

    function resetPassword(email, token, newPassword) {
        if (!isValidRecoveryToken(email, token)) {
            return { success: false, message: 'Token de recuperação inválido ou expirado' };
        }

        // Atualiza a senha de usuários existentes
        const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const userIndex = users.findIndex(user => user.email === email);

        if (userIndex === -1) {
            return { success: false, message: 'Usuário não encontrado' };
        }

        users[userIndex].password = newPassword;
        localStorage.setItem('registeredUsers', JSON.stringify(users));

        // remove o token de recuperação
        localStorage.removeItem('passwordRecovery');

        return { success: true, message: 'Senha alterada com sucesso' };
    }

});
