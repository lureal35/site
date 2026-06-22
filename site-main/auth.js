// ========== AUTH.JS - COM API ==========

const API_URL = 'http://localhost:3000/api';
let usuarioAtual = JSON.parse(localStorage.getItem('usuarioAtual')) || null;

// ========== LOGIN ==========
async function loginUsuario() {
    const nome = document.getElementById('nomeUsuario').value.trim();
    const senha = document.getElementById('senhaUsuario').value.trim();

    if (!nome || !senha) {
        mostrarMensagem('Preencha todos os campos!', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, senha })
        });

        const data = await response.json();

        if (!response.ok) {
            mostrarMensagem('❌ ' + data.erro, 'error');
            return;
        }

        usuarioAtual = data.usuario;
        localStorage.setItem('usuarioAtual', JSON.stringify({
            ...data.usuario,
            token: data.token
        }));
        
        localStorage.setItem('authToken', data.token);
        
        mostrarMensagem('✅ Login realizado com sucesso!', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    } catch (error) {
        mostrarMensagem('❌ Erro ao conectar ao servidor', 'error');
        console.error(error);
    }
}

// ========== CADASTRO ==========
async function cadastrarUsuario() {
    const nome = document.getElementById('nomeUsuario').value.trim();
    const senha = document.getElementById('senhaUsuario').value.trim();
    const email = prompt('Digite seu email (opcional):');

    if (!nome || !senha) {
        mostrarMensagem('Preencha todos os campos!', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/registrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, senha, email })
        });

        const data = await response.json();

        if (!response.ok) {
            mostrarMensagem('❌ ' + data.erro, 'error');
            return;
        }

        mostrarMensagem('✅ Usuário cadastrado! Faça login.', 'success');
        document.getElementById('nomeUsuario').value = '';
        document.getElementById('senhaUsuario').value = '';
    } catch (error) {
        mostrarMensagem('❌ Erro ao conectar ao servidor', 'error');
        console.error(error);
    }
}

// ========== LOGOUT ==========
function logout() {
    if (!confirm('Tem certeza que deseja sair?')) return;
    localStorage.removeItem('usuarioAtual');
    localStorage.removeItem('authToken');
    window.location.href = 'login.html';
}

// ========== VERIFICAR AUTENTICAÇÃO ==========
function verificarAutenticacao() {
    const usuarioAtual = JSON.parse(localStorage.getItem('usuarioAtual'));
    const paginaAtual = window.location.pathname.split('/').pop() || 'index.html';
    const paginasPublicas = ['login.html'];
    
    if (!usuarioAtual && !paginasPublicas.includes(paginaAtual)) {
        window.location.href = 'login.html';
        return false;
    }
    
    if (usuarioAtual && paginaAtual === 'login.html') {
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}

function getUsuarioAtual() {
    return JSON.parse(localStorage.getItem('usuarioAtual'));
}

function getAuthToken() {
    const usuario = getUsuarioAtual();
    return usuario ? usuario.token : null;
}

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

verificarAutenticacao();
atualizarHeader();