// ========== AUTH.JS - SISTEMA DE AUTENTICAÇÃO ==========

// ========== BANCO DE DADOS ==========
let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
let usuarioAtual = JSON.parse(localStorage.getItem('usuarioAtual')) || null;

// ========== SALVAR DADOS ==========
function salvarDadosAuth() {
    localStorage.setItem('usuarios', JSON.stringify(usuarios));
    localStorage.setItem('usuarioAtual', JSON.stringify(usuarioAtual));
}

// ========== VERIFICAR AUTENTICAÇÃO ==========
function verificarAutenticacao() {
    const usuarioAtual = JSON.parse(localStorage.getItem('usuarioAtual'));
    const paginaAtual = window.location.pathname.split('/').pop() || 'index.html';
    
    // Páginas que NÃO exigem login
    const paginasPublicas = ['login.html'];
    
    // Se não estiver logado e não estiver em uma página pública
    if (!usuarioAtual && !paginasPublicas.includes(paginaAtual)) {
        window.location.href = 'login.html';
        return false;
    }
    
    // Se estiver logado e estiver na página de login
    if (usuarioAtual && paginaAtual === 'login.html') {
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}

// ========== OBTER USUÁRIO ATUAL ==========
function getUsuarioAtual() {
    return JSON.parse(localStorage.getItem('usuarioAtual'));
}

// ========== LOGIN ==========
function loginUsuario() {
    const nome = document.getElementById('nomeUsuario').value.trim();
    const senha = document.getElementById('senhaUsuario').value.trim();

    if (!nome || !senha) {
        mostrarMensagem('Preencha todos os campos!', 'error');
        return;
    }

    const usuario = usuarios.find(u => u.nome === nome && u.senha === senha);
    
    if (!usuario) {
        mostrarMensagem('❌ Usuário ou senha inválidos!', 'error');
        return;
    }

    usuarioAtual = usuario;
    localStorage.setItem('usuarioAtual', JSON.stringify(usuarioAtual));
    mostrarMensagem('✅ Login realizado com sucesso!', 'success');
    
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// ========== CADASTRO ==========
function cadastrarUsuario() {
    const nome = document.getElementById('nomeUsuario').value.trim();
    const senha = document.getElementById('senhaUsuario').value.trim();

    if (!nome || !senha) {
        mostrarMensagem('Preencha todos os campos!', 'error');
        return;
    }

    if (usuarios.find(u => u.nome === nome)) {
        mostrarMensagem('Usuário já existe!', 'error');
        return;
    }

    usuarios.push({ nome, senha });
    salvarDadosAuth();
    mostrarMensagem('✅ Usuário cadastrado! Faça login.', 'success');
    document.getElementById('nomeUsuario').value = '';
    document.getElementById('senhaUsuario').value = '';
}

// ========== LOGOUT ==========
function logout() {
    if (!confirm('Tem certeza que deseja sair?')) return;
    localStorage.removeItem('usuarioAtual');
    window.location.href = 'login.html';
}

// ========== MENSAGENS ==========
function mostrarMensagem(texto, tipo = 'info') {
    const el = document.getElementById('mensagemUsuario');
    if (!el) return;
    el.textContent = texto;
    el.className = `message ${tipo}`;
    setTimeout(() => {
        el.className = 'message';
        el.textContent = '';
    }, 4000);
}

// ========== ATUALIZAR HEADER ==========
function atualizarHeader() {
    const usuario = getUsuarioAtual();
    const userNameDisplay = document.getElementById('userNameDisplay');
    const headerUser = document.getElementById('headerUser');
    
    if (usuario) {
        if (userNameDisplay) userNameDisplay.textContent = usuario.nome;
        if (headerUser) {
            headerUser.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; color: var(--text-secondary);">
                    <i class="fas fa-user-circle" style="font-size: 24px;"></i>
                    <span id="userNameDisplay">${usuario.nome}</span>
                    <button onclick="logout()" class="btn btn-outline" style="padding: 4px 12px; font-size: 12px; min-width: auto;">
                        <i class="fas fa-sign-out-alt"></i>
                    </button>
                </div>
            `;
        }
    }
}

// ========== INICIALIZAR ==========
verificarAutenticacao();
atualizarHeader();