// ========== SCRIPT.JS - COM API ==========

const API_URL = 'http://localhost:3000/api';
let leiloes = [];
let produtoSelecionadoId = null;
let timers = {};
let favoritos = [];
let notificacoes = [];

// ========== FUNÇÕES DE API ==========

function getAuthToken() {
    const usuario = JSON.parse(localStorage.getItem('usuarioAtual'));
    return usuario ? usuario.token : null;
}

async function apiRequest(endpoint, method = 'GET', body = null) {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = {
        method,
        headers
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.erro || 'Erro na requisição');
    }
    
    return data;
}

// ========== CARREGAR LEILÕES ==========

async function carregarLeiloes() {
    try {
        const data = await apiRequest('/leiloes');
        leiloes = data;
        renderizarProdutos();
        atualizarBadges();
        
        // Iniciar timers
        leiloes.forEach(leilao => {
            if (leilao.status === 'aberto') {
                iniciarTimer(leilao.id);
            }
        });
    } catch (error) {
        console.error('Erro ao carregar leilões:', error);
        // Fallback para dados locais
        leiloes = JSON.parse(localStorage.getItem('leiloes')) || [];
        renderizarProdutos();
    }
}

// ========== CRIAR LEILÃO ==========

async function criarLeilao() {
    const usuario = getUsuarioAtual();
    if (!usuario) {
        alert('Faça login primeiro!');
        return;
    }

    const nome = document.getElementById('produtoNome').value.trim();
    const precoInput = document.getElementById('produtoPreco');
    const preco = parseFloat(precoInput.value.replace(',', '.'));
    const duracao = parseInt(document.getElementById('tempoLeilao').value) || 5;

    if (!nome) {
        mostrarFeedback('Digite o nome do produto!', 'error');
        return;
    }

    if (isNaN(preco) || preco <= 0) {
        mostrarFeedback('Digite um preço válido!', 'error');
        return;
    }

    try {
        const data = await apiRequest('/leiloes', 'POST', {
            nome,
            precoInicial: preco,
            duracaoMinutos: duracao,
            imagens: imagensTemp
        });

        mostrarFeedback('✅ Produto anunciado com sucesso!', 'success');
        
        // Limpar campos
        document.getElementById('produtoNome').value = '';
        document.getElementById('produtoPreco').value = '';
        document.getElementById('previewImagem').innerHTML = '';
        document.getElementById('imagemProduto').value = '';
        imagensTemp = [];
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    } catch (error) {
        mostrarFeedback('❌ ' + error.message, 'error');
        console.error(error);
    }
}

// ========== DAR LANCE ==========

async function darLance() {
    const usuario = getUsuarioAtual();
    if (!usuario) {
        alert('Faça login para dar um lance!');
        return;
    }

    if (!produtoSelecionadoId) {
        alert('Selecione um produto primeiro!');
        return;
    }

    const valor = parseFloat(document.getElementById('valorLance').value);

    if (!valor || valor <= 0) {
        alert('Digite um valor válido para o lance!');
        return;
    }

    try {
        const data = await apiRequest(`/leiloes/${produtoSelecionadoId}/lance`, 'POST', { valor });
        
        // Atualizar dados
        await carregarLeiloes();
        selecionarProduto(produtoSelecionadoId);
        iniciarTimer(produtoSelecionadoId);
        
        const btn = document.getElementById('btnDarLance');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> Lance dado!';
            btn.style.background = 'linear-gradient(135deg, #00E676, #00C853)';
            setTimeout(() => {
                btn.innerHTML = '<i class="fas fa-hand-paper"></i> Dar Lance';
                btn.style.background = '';
            }, 1500);
        }
    } catch (error) {
        alert('❌ ' + error.message);
        console.error(error);
    }
}

// ========== ENCERRAR LEILÃO ==========

async function fecharLeilao(id) {
    if (!confirm('Tem certeza que deseja encerrar este leilão?')) return;

    try {
        const data = await apiRequest(`/leiloes/${id}/fechar`, 'PUT');
        
        await carregarLeiloes();
        selecionarProduto(id);
        
        if (data.vencedor) {
            adicionarNotificacaoLocal(
                '🏆 Leilão encerrado!',
                `${data.vencedor} venceu o leilão!`,
                'success'
            );
        }
    } catch (error) {
        alert('❌ ' + error.message);
        console.error(error);
    }
}

// ========== FAVORITOS ==========

async function toggleFavorito() {
    const usuario = getUsuarioAtual();
    if (!usuario) {
        alert('Faça login para favoritar produtos!');
        return;
    }

    if (!produtoSelecionadoId) return;

    try {
        const data = await apiRequest(`/favoritos/${produtoSelecionadoId}`, 'POST');
        
        // Atualizar favoritos locais
        if (data.favoritado) {
            if (!favoritos.includes(produtoSelecionadoId)) {
                favoritos.push(produtoSelecionadoId);
            }
        } else {
            favoritos = favoritos.filter(id => id !== produtoSelecionadoId);
        }
        
        localStorage.setItem('favoritos', JSON.stringify(favoritos));
        atualizarBadges();
        selecionarProduto(produtoSelecionadoId);
        renderizarProdutos();
    } catch (error) {
        alert('❌ ' + error.message);
        console.error(error);
    }
}

// ========== CARREGAR FAVORITOS ==========

async function carregarFavoritos() {
    try {
        const data = await apiRequest('/favoritos');
        favoritos = data.map(l => l.id);
        localStorage.setItem('favoritos', JSON.stringify(favoritos));
    } catch (error) {
        console.error('Erro ao carregar favoritos:', error);
        favoritos = JSON.parse(localStorage.getItem('favoritos')) || [];
    }
}

// ========== NOTIFICAÇÕES LOCAIS ==========

function adicionarNotificacaoLocal(titulo, mensagem, tipo = 'info') {
    const notificacao = {
        id: Date.now(),
        titulo,
        mensagem,
        tipo,
        data: new Date().toLocaleString()
    };
    
    notificacoes.push(notificacao);
    if (notificacoes.length > 50) {
        notificacoes = notificacoes.slice(-50);
    }
    
    localStorage.setItem('notificacoes', JSON.stringify(notificacoes));
    mostrarNotificacao(notificacao);
    atualizarBadges();
}

// ========== INICIALIZAR ==========

document.addEventListener('DOMContentLoaded', function() {
    initUsuario();
    
    // Carregar dados da API
    carregarLeiloes();
    carregarFavoritos();
    
    // Carregar notificações locais
    notificacoes = JSON.parse(localStorage.getItem('notificacoes')) || [];
    atualizarBadges();
    
    // Preview de imagens
    const inputImagem = document.getElementById('imagemProduto');
    if (inputImagem) {
        inputImagem.addEventListener('change', function(e) {
            const preview = document.getElementById('previewImagem');
            if (!preview) return;
            
            preview.innerHTML = '';
            const files = Array.from(e.target.files);
            
            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = function(event) {
                        const img = document.createElement('img');
                        img.src = event.target.result;
                        preview.appendChild(img);
                        imagensTemp.push(event.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            });
        });
    }
});