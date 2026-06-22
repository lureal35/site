// ========== BANCO DE DADOS ==========
let leiloes = JSON.parse(localStorage.getItem('leiloes')) || [];
let usuarioAtual = JSON.parse(localStorage.getItem('usuarioAtual')) || null;
let produtoSelecionadoId = null;
let timers = {};
let favoritos = JSON.parse(localStorage.getItem('favoritos')) || [];
let notificacoes = JSON.parse(localStorage.getItem('notificacoes')) || [];
let imagensTemp = [];

// ========== SALVAR DADOS ==========
function salvarDados() {
    localStorage.setItem('leiloes', JSON.stringify(leiloes));
    localStorage.setItem('favoritos', JSON.stringify(favoritos));
    localStorage.setItem('notificacoes', JSON.stringify(notificacoes));
}

// ========== INICIALIZAR USUÁRIO ==========
function initUsuario() {
    usuarioAtual = JSON.parse(localStorage.getItem('usuarioAtual'));
    const userNameDisplay = document.getElementById('userNameDisplay');
    if (usuarioAtual && userNameDisplay) {
        userNameDisplay.textContent = usuarioAtual.nome;
    }
}

// ========== UPLOAD DE IMAGEM ==========
document.addEventListener('DOMContentLoaded', function() {
    initUsuario();
    
    // Preview de imagens na página de anúncio
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
    
    renderizarProdutos();
    atualizarBadges();
    
    // Inicia timers
    leiloes.forEach(leilao => {
        if (leilao.status === 'aberto') {
            iniciarTimer(leilao.id);
        }
    });
});

// ========== CRIAR LEILÃO ==========
function criarLeilao() {
    if (!usuarioAtual) {
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
        mostrarFeedback('Digite um preço válido (ex: 99.90)!', 'error');
        return;
    }

    const imagens = [...imagensTemp];

    const novoLeilao = {
        id: Date.now(),
        nome: nome,
        precoInicial: preco,
        lanceAtual: preco,
        status: 'aberto',
        lances: [],
        anunciante: usuarioAtual.nome,
        criadoEm: Date.now(),
        duracaoMinutos: duracao,
        tempoRestante: duracao * 60,
        vencedor: null,
        imagens: imagens,
        imagemCapa: imagens[0] || null
    };

    leiloes.push(novoLeilao);
    salvarDados();
    
    // Limpar campos
    document.getElementById('produtoNome').value = '';
    document.getElementById('produtoPreco').value = '';
    if (document.getElementById('previewImagem')) {
        document.getElementById('previewImagem').innerHTML = '';
    }
    document.getElementById('imagemProduto').value = '';
    imagensTemp = [];
    
    mostrarFeedback('✅ Produto anunciado com sucesso!', 'success');
    
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1500);
}

function mostrarFeedback(texto, tipo = 'info') {
    const el = document.getElementById('mensagemFeedback');
    if (!el) return;
    el.textContent = texto;
    el.className = `message ${tipo}`;
    el.style.display = 'block';
    setTimeout(() => {
        el.style.display = 'none';
        el.textContent = '';
    }, 4000);
}

// ========== TIMER ==========
function iniciarTimer(id) {
    const leilao = leiloes.find(l => l.id === id);
    if (!leilao || leilao.status !== 'aberto') return;

    if (timers[id]) clearInterval(timers[id]);

    if (leilao.tempoRestante <= 0) {
        encerrarLeilaoPorTempo(id);
        return;
    }

    timers[id] = setInterval(() => {
        const leilaoAtual = leiloes.find(l => l.id === id);
        if (!leilaoAtual || leilaoAtual.status === 'fechado') {
            clearInterval(timers[id]);
            delete timers[id];
            return;
        }

        leilaoAtual.tempoRestante--;
        salvarDados();

        if (leilaoAtual.tempoRestante === 30) {
            adicionarNotificacao(
                '⏰ Tempo acabando!',
                `O leilão de "${leilaoAtual.nome}" está acabando! Últimos 30 segundos!`,
                'warning'
            );
        }

        if (produtoSelecionadoId === id) {
            atualizarTimerDisplay(id);
        }

        if (leilaoAtual.tempoRestante <= 0) {
            clearInterval(timers[id]);
            delete timers[id];
            encerrarLeilaoPorTempo(id);
        }
    }, 1000);
}

function atualizarTimerDisplay(id) {
    const leilao = leiloes.find(l => l.id === id);
    if (!leilao) return;

    const minutos = Math.floor(leilao.tempoRestante / 60);
    const segundos = leilao.tempoRestante % 60;
    const display = document.getElementById('timerDisplay');
    const bar = document.getElementById('timerBarProgress');
    
    if (display) {
        display.textContent = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
        
        const total = leilao.duracaoMinutos * 60;
        const percent = (leilao.tempoRestante / total) * 100;
        
        if (leilao.tempoRestante <= 10) {
            display.style.color = '#FF1744';
            if (bar) bar.style.background = 'linear-gradient(90deg, #FF1744, #D50000)';
        } else if (leilao.tempoRestante <= 30) {
            display.style.color = '#FFD600';
            if (bar) bar.style.background = 'linear-gradient(90deg, #FFD600, #FF9100)';
        } else {
            display.style.color = '#00E676';
            if (bar) bar.style.background = 'linear-gradient(90deg, #00E676, #00D4FF)';
        }
        
        if (bar) bar.style.width = `${percent}%`;
    }
}

function encerrarLeilaoPorTempo(id) {
    const leilao = leiloes.find(l => l.id === id);
    if (!leilao || leilao.status === 'fechado') return;

    if (leilao.lances.length > 0) {
        const ultimoLance = leilao.lances[leilao.lances.length - 1];
        leilao.vencedor = ultimoLance.cliente;
        
        adicionarNotificacao(
            '🏆 Leilão encerrado!',
            `O leilão de "${leilao.nome}" foi encerrado! Vencedor: ${ultimoLance.cliente}`,
            'success'
        );
    }

    leilao.status = 'fechado';
    salvarDados();
    renderizarProdutos();
    
    if (produtoSelecionadoId === id) {
        selecionarProduto(id);
    }
}

// ========== FILTROS E BUSCA ==========
function aplicarFiltros() {
    const busca = document.getElementById('buscaInput').value.toLowerCase().trim();
    const status = document.getElementById('filtroStatus').value;
    const preco = document.getElementById('filtroPreco').value;
    const ordenacao = document.getElementById('filtroOrdenacao').value;

    let resultados = [...leiloes];

    if (busca) {
        resultados = resultados.filter(l => 
            l.nome.toLowerCase().includes(busca)
        );
    }

    if (status !== 'todos') {
        resultados = resultados.filter(l => l.status === status);
    }

    if (preco !== 'todos') {
        const [min, max] = preco.split('-').map(Number);
        if (preco === '1000+') {
            resultados = resultados.filter(l => l.lanceAtual >= 1000);
        } else {
            resultados = resultados.filter(l => l.lanceAtual >= min && l.lanceAtual <= max);
        }
    }

    switch(ordenacao) {
        case 'recentes':
            resultados.sort((a, b) => b.criadoEm - a.criadoEm);
            break;
        case 'maior-lance':
            resultados.sort((a, b) => b.lanceAtual - a.lanceAtual);
            break;
        case 'menor-lance':
            resultados.sort((a, b) => a.lanceAtual - b.lanceAtual);
            break;
        case 'mais-lances':
            resultados.sort((a, b) => b.lances.length - a.lances.length);
            break;
    }

    const resultadosEl = document.getElementById('resultadosBusca');
    if (resultadosEl) {
        resultadosEl.textContent = `🔍 ${resultados.length} resultado(s) encontrado(s)`;
    }

    renderizarProdutos(resultados);
}

// ========== RENDERIZAR PRODUTOS ==========
function renderizarProdutos(lista = null) {
    const listaProdutos = lista || leiloes;
    const container = document.getElementById('listaProdutos');
    if (!container) return;
    
    container.innerHTML = '';
    const totalEl = document.getElementById('totalProdutos');
    if (totalEl) totalEl.textContent = leiloes.length;

    if (listaProdutos.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
                <i class="fas fa-box-open" style="font-size:48px;display:block;margin-bottom:16px;opacity:0.3;"></i>
                <p>Nenhum produto encontrado.</p>
                <p style="font-size:14px;">Tente ajustar os filtros ou <a href="anunciar.html" style="color: var(--secondary);">anunciar um novo produto</a>!</p>
            </div>
        `;
        return;
    }

    listaProdutos.forEach((leilao, index) => {
        const div = document.createElement('div');
        div.className = 'produto-item';
        div.style.animationDelay = `${index * 0.05}s`;
        
        const isFavorito = favoritos.includes(leilao.id);
        let statusText = leilao.status === 'aberto' ? '🔓 Aberto' : '🔒 Encerrado';
        let statusClass = leilao.status === 'aberto' ? 'status-aberto' : 'status-fechado';

        let imagemHtml = '';
        if (leilao.imagemCapa) {
            imagemHtml = `<img src="${leilao.imagemCapa}" alt="${leilao.nome}">`;
        } else {
            imagemHtml = `<div class="no-image"><i class="fas fa-image"></i></div>`;
        }

        div.innerHTML = `
            <div class="produto-thumb">
                ${imagemHtml}
            </div>
            <div class="info">
                <strong>${leilao.nome} ${isFavorito ? '❤️' : ''}</strong>
                <div>💰 Lance atual: <span class="preco">R$ ${leilao.lanceAtual.toFixed(2)}</span></div>
                <small>Início: R$ ${leilao.precoInicial.toFixed(2)} | ${leilao.lances.length} lance(s) | ${leilao.anunciante || 'Anônimo'}</small>
                ${leilao.vencedor ? `<div style="color: #FFD700; font-weight: 700; margin-top: 4px;">🏆 Vencedor: ${leilao.vencedor}</div>` : ''}
            </div>
            <div>
                <span class="status ${statusClass}">
                    ${statusText}
                </span>
            </div>
        `;
        
        div.addEventListener('click', () => selecionarProduto(leilao.id));
        container.appendChild(div);
    });
}

// ========== GALERIA DE IMAGENS ==========
function renderizarGaleria(imagens) {
    const container = document.getElementById('galeriaImagens');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!imagens || imagens.length === 0) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-muted); width: 100%;">
                <i class="fas fa-image" style="font-size: 32px; display: block; margin-bottom: 8px;"></i>
                <span>Sem imagens</span>
            </div>
        `;
        return;
    }

    imagens.forEach((img, index) => {
        const div = document.createElement('div');
        div.className = `galeria-item ${index === 0 ? 'destaque' : ''}`;
        div.innerHTML = `<img src="${img}" alt="Imagem ${index + 1}">`;
        div.onclick = () => {
            const leilao = leiloes.find(l => l.id === produtoSelecionadoId);
            if (leilao) {
                leilao.imagemCapa = img;
                salvarDados();
                renderizarGaleria(imagens);
                renderizarProdutos();
            }
        };
        container.appendChild(div);
    });
}

// ========== SELECIONAR PRODUTO ==========
function selecionarProduto(id) {
    const leilao = leiloes.find(l => l.id === id);
    if (!leilao) return;

    produtoSelecionadoId = id;
    const areaLance = document.getElementById('areaLance');
    if (!areaLance) return;
    
    areaLance.classList.add('visible');
    areaLance.style.display = 'block';
    areaLance.scrollIntoView({ behavior: 'smooth', block: 'start' });

    renderizarGaleria(leilao.imagens);

    const isFavorito = favoritos.includes(id);
    const btnFavorito = document.getElementById('btnFavorito');
    if (btnFavorito) {
        btnFavorito.innerHTML = isFavorito ? 
            '<i class="fas fa-heart" style="color: #FF1744;"></i> Remover dos favoritos' : 
            '<i class="fas fa-heart"></i> Adicionar aos favoritos';
    }

    const isAnunciante = usuarioAtual && leilao.anunciante === usuarioAtual.nome;
    const btnDarLance = document.getElementById('btnDarLance');
    if (btnDarLance) {
        if (isAnunciante && leilao.status === 'aberto') {
            btnDarLance.disabled = true;
            btnDarLance.innerHTML = '<i class="fas fa-ban"></i> Você não pode dar lance';
        } else if (!usuarioAtual) {
            btnDarLance.disabled = true;
            btnDarLance.innerHTML = '<i class="fas fa-sign-in-alt"></i> Faça login para dar lance';
        } else if (leilao.status === 'fechado') {
            btnDarLance.disabled = true;
            btnDarLance.innerHTML = '<i class="fas fa-lock"></i> Leilão encerrado';
        } else {
            btnDarLance.disabled = false;
            btnDarLance.innerHTML = '<i class="fas fa-hand-paper"></i> Dar Lance';
        }
    }

    const produtoSelecionado = document.getElementById('produtoSelecionado');
    if (produtoSelecionado) {
        produtoSelecionado.innerHTML = `
            <strong>${leilao.nome}</strong>
            <span style="color: var(--success);">R$ ${leilao.lanceAtual.toFixed(2)}</span>
            ${leilao.status === 'fechado' ? ' <span style="color: var(--danger);">🔒 Encerrado</span>' : ''}
            <small>Anunciado por ${leilao.anunciante || 'Anônimo'} • ${leilao.lances.length} lance(s)</small>
        `;
    }

    const timerContainer = document.querySelector('.timer-container');
    if (timerContainer) {
        if (leilao.status === 'aberto') {
            timerContainer.style.display = 'flex';
            atualizarTimerDisplay(id);
        } else {
            timerContainer.style.display = 'none';
        }
    }

    const historico = document.getElementById('historicoLances');
    if (historico) {
        historico.innerHTML = '<h4 style="color: var(--text-secondary); margin-bottom: 12px;">📋 Histórico de Lances</h4>';
        
        if (leilao.lances.length === 0) {
            historico.innerHTML += '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Nenhum lance ainda. Seja o primeiro!</p>';
        } else {
            leilao.lances.forEach((lance, index) => {
                const isVencedor = leilao.status === 'fechado' && index === leilao.lances.length - 1;
                const div = document.createElement('div');
                div.className = `lance-item ${isVencedor ? 'destaque' : ''}`;
                div.innerHTML = `
                    <span class="cliente">${isVencedor ? '🏆 ' : ''}${lance.cliente}</span>
                    <span class="valor">R$ ${lance.valor.toFixed(2)}</span>
                `;
                historico.appendChild(div);
            });
        }
    }

    const vencedorContainer = document.getElementById('vencedorContainer');
    if (vencedorContainer) {
        if (leilao.status === 'fechado' && leilao.vencedor) {
            vencedorContainer.innerHTML = `
                <div class="vencedor-box">
                    <h3>🏆 VENCEDOR</h3>
                    <div class="nome-vencedor">${leilao.vencedor}</div>
                    <div class="valor-vencedor">R$ ${leilao.lanceAtual.toFixed(2)}</div>
                    <small style="color: var(--text-muted);">${leilao.lances.length} lance(s) realizados</small>
                </div>
            `;
        } else if (leilao.status === 'fechado' && !leilao.vencedor) {
            vencedorContainer.innerHTML = `
                <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; text-align: center; color: var(--text-muted);">
                    ❌ Nenhum lance foi dado neste leilão.
                </div>
            `;
        } else {
            vencedorContainer.innerHTML = '';
        }
    }

    const btnExistente = document.getElementById('btnFecharLeilao');
    if (btnExistente) btnExistente.remove();
    
    if (leilao.status === 'aberto' && usuarioAtual && leilao.anunciante === usuarioAtual.nome && historico) {
        const btnFechar = document.createElement('button');
        btnFechar.id = 'btnFecharLeilao';
        btnFechar.className = 'btn btn-danger';
        btnFechar.style.marginTop = '12px';
        btnFechar.innerHTML = '<i class="fas fa-stop-circle"></i> Encerrar Leilão Agora';
        btnFechar.onclick = () => fecharLeilao(leilao.id);
        historico.appendChild(btnFechar);
    }

    const valorLance = document.getElementById('valorLance');
    if (valorLance) valorLance.value = '';
}

function fecharAreaLance() {
    const areaLance = document.getElementById('areaLance');
    if (areaLance) {
        areaLance.style.display = 'none';
        areaLance.classList.remove('visible');
    }
    produtoSelecionadoId = null;
}

// ========== FAVORITOS ==========
function toggleFavorito() {
    if (!usuarioAtual) {
        alert('Faça login para favoritar produtos!');
        return;
    }

    if (!produtoSelecionadoId) return;

    const index = favoritos.indexOf(produtoSelecionadoId);
    if (index === -1) {
        favoritos.push(produtoSelecionadoId);
        adicionarNotificacao(
            '❤️ Favorito adicionado',
            'Produto adicionado aos seus favoritos!',
            'info'
        );
    } else {
        favoritos.splice(index, 1);
    }

    salvarDados();
    atualizarBadges();
    selecionarProduto(produtoSelecionadoId);
    renderizarProdutos();
}

function toggleFavoritos() {
    const modal = document.getElementById('modalFavoritos');
    if (!modal) return;
    
    modal.classList.toggle('active');
    
    if (modal.classList.contains('active')) {
        const container = document.getElementById('listaFavoritos');
        if (!container) return;
        
        const favoritosLista = leiloes.filter(l => favoritos.includes(l.id));
        
        if (favoritosLista.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <i class="fas fa-heart" style="font-size: 48px; display: block; margin-bottom: 16px; opacity: 0.3;"></i>
                    <p>Você ainda não tem favoritos.</p>
                    <p style="font-size: 14px;">Explore os leilões e adicione seus favoritos!</p>
                </div>
            `;
        } else {
            container.innerHTML = '';
            favoritosLista.forEach(leilao => {
                const div = document.createElement('div');
                div.className = 'produto-item';
                div.innerHTML = `
                    <div class="info">
                        <strong>${leilao.nome} ❤️</strong>
                        <div>💰 Lance atual: <span class="preco">R$ ${leilao.lanceAtual.toFixed(2)}</span></div>
                        <small>${leilao.lances.length} lance(s) | ${leilao.status === 'aberto' ? '🔓 Aberto' : '🔒 Encerrado'}</small>
                    </div>
                `;
                div.addEventListener('click', () => {
                    fecharModalFavoritos();
                    selecionarProduto(leilao.id);
                });
                container.appendChild(div);
            });
        }
    }
}

function fecharModalFavoritos() {
    const modal = document.getElementById('modalFavoritos');
    if (modal) modal.classList.remove('active');
}

// ========== NOTIFICAÇÕES ==========
function adicionarNotificacao(titulo, mensagem, tipo = 'info') {
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
    
    salvarDados();
    mostrarNotificacao(notificacao);
    atualizarBadges();
}

function mostrarNotificacao(notificacao) {
    const container = document.getElementById('notificacoesContainer');
    if (!container) return;
    
    const div = document.createElement('div');
    div.className = `notificacao notificacao-tipo-${notificacao.tipo}`;
    
    const icons = {
        success: '✅',
        danger: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    div.innerHTML = `
        <div class="notificacao-icon">${icons[notificacao.tipo] || 'ℹ️'}</div>
        <div class="notificacao-conteudo">
            <div class="notificacao-titulo">${notificacao.titulo}</div>
            <div class="notificacao-mensagem">${notificacao.mensagem}</div>
            <div class="notificacao-tempo">${notificacao.data}</div>
        </div>
    `;
    
    container.appendChild(div);
    
    setTimeout(() => {
        div.style.opacity = '0';
        div.style.transform = 'translateX(100px)';
        setTimeout(() => div.remove(), 300);
    }, 8000);
}

function toggleNotificacoes() {
    const modal = document.getElementById('modalNotificacoes');
    if (!modal) return;
    
    modal.classList.toggle('active');
    
    if (modal.classList.contains('active')) {
        const container = document.getElementById('listaNotificacoes');
        if (!container) return;
        
        if (notificacoes.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <i class="fas fa-bell-slash" style="font-size: 48px; display: block; margin-bottom: 16px; opacity: 0.3;"></i>
                    <p>Nenhuma notificação ainda.</p>
                    <p style="font-size: 14px;">Você será notificado sobre lances e eventos importantes!</p>
                </div>
            `;
        } else {
            container.innerHTML = '';
            notificacoes.slice().reverse().forEach(notif => {
                const div = document.createElement('div');
                div.className = 'notificacao-item';
                div.innerHTML = `
                    <div class="notif-titulo">${notif.titulo}</div>
                    <div class="notif-mensagem">${notif.mensagem}</div>
                    <div class="notif-tempo">${notif.data}</div>
                `;
                container.appendChild(div);
            });
        }
    }
}

function fecharModalNotificacoes() {
    const modal = document.getElementById('modalNotificacoes');
    if (modal) modal.classList.remove('active');
}

function atualizarBadges() {
    const favCount = document.getElementById('favoritosCount');
    const notifCount = document.getElementById('notificacoesCount');
    if (favCount) favCount.textContent = favoritos.length;
    if (notifCount) notifCount.textContent = notificacoes.length;
}

// ========== DAR LANCE ==========
function darLance() {
    if (!usuarioAtual) {
        alert('Faça login para dar um lance!');
        return;
    }

    if (!produtoSelecionadoId) {
        alert('Selecione um produto primeiro!');
        return;
    }

    const leilao = leiloes.find(l => l.id === produtoSelecionadoId);
    if (!leilao) return;

    if (leilao.status === 'fechado') {
        alert('Este leilão já está encerrado!');
        return;
    }

    if (leilao.anunciante === usuarioAtual.nome) {
        alert('Você não pode dar lance no seu próprio produto!');
        return;
    }

    const valor = parseFloat(document.getElementById('valorLance').value);

    if (!valor || valor <= 0) {
        alert('Digite um valor válido para o lance!');
        return;
    }

    if (valor <= leilao.lanceAtual) {
        alert(`O lance deve ser maior que R$ ${leilao.lanceAtual.toFixed(2)}`);
        return;
    }

    const ultimoLance = leilao.lances.length > 0 ? leilao.lances[leilao.lances.length - 1] : null;
    const foiSuperado = ultimoLance && ultimoLance.cliente === usuarioAtual.nome;

    leilao.lances.push({ cliente: usuarioAtual.nome, valor });
    leilao.lanceAtual = valor;
    leilao.tempoRestante = leilao.duracaoMinutos * 60;
    
    salvarDados();
    renderizarProdutos();
    selecionarProduto(leilao.id);
    iniciarTimer(leilao.id);
    
    if (ultimoLance && ultimoLance.cliente !== usuarioAtual.nome) {
        adicionarNotificacao(
            '📈 Lance superado!',
            `Alguém deu um lance maior no produto "${leilao.nome}"!`,
            'warning'
        );
    }
    
    if (foiSuperado) {
        adicionarNotificacao(
            '🎯 Lance confirmado!',
            `Seu lance de R$ ${valor.toFixed(2)} no produto "${leilao.nome}" foi registrado!`,
            'success'
        );
    }

    const btn = document.getElementById('btnDarLance');
    if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Lance dado!';
        btn.style.background = 'linear-gradient(135deg, #00E676, #00C853)';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 1500);
    }
}

// ========== FECHAR LEILÃO ==========
function fecharLeilao(id) {
    if (!confirm('Tem certeza que deseja encerrar este leilão?')) return;

    const leilao = leiloes.find(l => l.id === id);
    if (!leilao) return;

    if (leilao.lances.length > 0) {
        const ultimoLance = leilao.lances[leilao.lances.length - 1];
        leilao.vencedor = ultimoLance.cliente;
        
        adicionarNotificacao(
            '🏆 Leilão encerrado!',
            `${ultimoLance.cliente} venceu o leilão de "${leilao.nome}" por R$ ${leilao.lanceAtual.toFixed(2)}!`,
            'success'
        );
    }

    leilao.status = 'fechado';
    
    if (timers[id]) {
        clearInterval(timers[id]);
        delete timers[id];
    }
    
    salvarDados();
    renderizarProdutos();
    selecionarProduto(id);
}

// ========== FECHAR MODAIS AO CLICAR FORA ==========
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

console.log('🏆 Lance Livre carregado com sucesso!');