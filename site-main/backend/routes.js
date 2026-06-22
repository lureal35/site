const express = require('express');
const router = express.Router();
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ==================== MIDDLEWARE DE AUTENTICAÇÃO ====================
const autenticar = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ erro: 'Token não fornecido' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ erro: 'Token inválido' });
    }
};

// ==================== USUÁRIOS ====================

// Registrar usuário
router.post('/auth/registrar', async (req, res) => {
    try {
        const { nome, senha, email } = req.body;
        
        // Verificar se usuário já existe
        const [existe] = await db.query(
            'SELECT id FROM usuarios WHERE nome = ?',
            [nome]
        );
        
        if (existe.length > 0) {
            return res.status(400).json({ erro: 'Usuário já existe' });
        }
        
        // Hash da senha
        const senhaHash = await bcrypt.hash(senha, 10);
        
        // Inserir usuário
        const [result] = await db.query(
            'INSERT INTO usuarios (nome, senha, email) VALUES (?, ?, ?)',
            [nome, senhaHash, email || null]
        );
        
        res.status(201).json({ 
            sucesso: true, 
            mensagem: 'Usuário criado com sucesso',
            id: result.insertId
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao registrar usuário' });
    }
});

// Login
router.post('/auth/login', async (req, res) => {
    try {
        const { nome, senha } = req.body;
        
        const [usuarios] = await db.query(
            'SELECT * FROM usuarios WHERE nome = ?',
            [nome]
        );
        
        if (usuarios.length === 0) {
            return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
        }
        
        const usuario = usuarios[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
        }
        
        // Gerar token JWT
        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            sucesso: true,
            usuario: { id: usuario.id, nome: usuario.nome },
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao fazer login' });
    }
});

// ==================== LEILÕES ====================

// Listar todos os leilões
router.get('/leiloes', async (req, res) => {
    try {
        const [leiloes] = await db.query(`
            SELECT 
                l.*,
                (SELECT COUNT(*) FROM lances WHERE leilao_id = l.id) as total_lances,
                (SELECT COUNT(*) FROM favoritos WHERE leilao_id = l.id) as total_favoritos
            FROM leiloes l
            ORDER BY l.criado_em DESC
        `);
        
        // Buscar imagens de cada leilão
        for (let leilao of leiloes) {
            const [imagens] = await db.query(
                'SELECT url FROM imagens WHERE leilao_id = ?',
                [leilao.id]
            );
            leilao.imagens = imagens.map(img => img.url);
        }
        
        res.json(leiloes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar leilões' });
    }
});

// Criar leilão
router.post('/leiloes', autenticar, async (req, res) => {
    try {
        const { nome, precoInicial, duracaoMinutos, imagens } = req.body;
        const anunciante = req.usuario.nome;
        const anuncianteId = req.usuario.id;
        
        const preco = parseFloat(precoInicial);
        const duracao = parseInt(duracaoMinutos) || 5;
        const tempoRestante = duracao * 60;
        
        // Inserir leilão
        const [result] = await db.query(`
            INSERT INTO leiloes 
            (nome, preco_inicial, lance_atual, status, anunciante, anunciante_id, duracao_minutos, tempo_restante, imagem_capa)
            VALUES (?, ?, ?, 'aberto', ?, ?, ?, ?, ?)
        `, [nome, preco, preco, anunciante, anuncianteId, duracao, tempoRestante, imagens?.[0] || null]);
        
        const leilaoId = result.insertId;
        
        // Inserir imagens
        if (imagens && imagens.length > 0) {
            for (let url of imagens) {
                await db.query(
                    'INSERT INTO imagens (leilao_id, url) VALUES (?, ?)',
                    [leilaoId, url]
                );
            }
        }
        
        // Buscar leilão criado
        const [leilao] = await db.query('SELECT * FROM leiloes WHERE id = ?', [leilaoId]);
        
        res.status(201).json({
            sucesso: true,
            mensagem: 'Leilão criado com sucesso!',
            leilao: leilao[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao criar leilão' });
    }
});

// Buscar leilão por ID
router.get('/leiloes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [leiloes] = await db.query('SELECT * FROM leiloes WHERE id = ?', [id]);
        
        if (leiloes.length === 0) {
            return res.status(404).json({ erro: 'Leilão não encontrado' });
        }
        
        const leilao = leiloes[0];
        
        // Buscar lances
        const [lances] = await db.query(
            'SELECT * FROM lances WHERE leilao_id = ? ORDER BY data_lance DESC',
            [id]
        );
        leilao.lances = lances;
        
        // Buscar imagens
        const [imagens] = await db.query(
            'SELECT url FROM imagens WHERE leilao_id = ?',
            [id]
        );
        leilao.imagens = imagens.map(img => img.url);
        
        // Buscar favoritos
        const [favoritos] = await db.query(
            'SELECT COUNT(*) as total FROM favoritos WHERE leilao_id = ?',
            [id]
        );
        leilao.totalFavoritos = favoritos[0].total;
        
        res.json(leilao);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar leilão' });
    }
});

// Dar lance
router.post('/leiloes/:id/lance', autenticar, async (req, res) => {
    try {
        const { id } = req.params;
        const { valor } = req.body;
        const cliente = req.usuario.nome;
        const clienteId = req.usuario.id;
        
        // Verificar leilão
        const [leiloes] = await db.query('SELECT * FROM leiloes WHERE id = ?', [id]);
        
        if (leiloes.length === 0) {
            return res.status(404).json({ erro: 'Leilão não encontrado' });
        }
        
        const leilao = leiloes[0];
        
        if (leilao.status === 'fechado') {
            return res.status(400).json({ erro: 'Leilão já encerrado' });
        }
        
        if (leilao.anunciante_id === clienteId) {
            return res.status(400).json({ erro: 'Você não pode dar lance no seu próprio produto' });
        }
        
        if (parseFloat(valor) <= parseFloat(leilao.lance_atual)) {
            return res.status(400).json({ 
                erro: `Lance deve ser maior que R$ ${parseFloat(leilao.lance_atual).toFixed(2)}` 
            });
        }
        
        // Inserir lance
        await db.query(
            'INSERT INTO lances (leilao_id, cliente, cliente_id, valor) VALUES (?, ?, ?, ?)',
            [id, cliente, clienteId, valor]
        );
        
        // Atualizar lance atual e resetar timer
        await db.query(`
            UPDATE leiloes 
            SET lance_atual = ?, tempo_restante = duracao_minutos * 60 
            WHERE id = ?
        `, [valor, id]);
        
        // Buscar leilão atualizado
        const [leilaoAtualizado] = await db.query('SELECT * FROM leiloes WHERE id = ?', [id]);
        
        res.json({
            sucesso: true,
            mensagem: 'Lance registrado com sucesso!',
            leilao: leilaoAtualizado[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao dar lance' });
    }
});

// Encerrar leilão
router.put('/leiloes/:id/fechar', autenticar, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [leiloes] = await db.query('SELECT * FROM leiloes WHERE id = ?', [id]);
        
        if (leiloes.length === 0) {
            return res.status(404).json({ erro: 'Leilão não encontrado' });
        }
        
        const leilao = leiloes[0];
        
        if (leilao.anunciante_id !== req.usuario.id) {
            return res.status(403).json({ erro: 'Apenas o anunciante pode encerrar o leilão' });
        }
        
        // Buscar último lance
        const [ultimoLance] = await db.query(
            'SELECT * FROM lances WHERE leilao_id = ? ORDER BY data_lance DESC LIMIT 1',
            [id]
        );
        
        let vencedor = null;
        let vencedorId = null;
        
        if (ultimoLance.length > 0) {
            vencedor = ultimoLance[0].cliente;
            vencedorId = ultimoLance[0].cliente_id;
        }
        
        // Atualizar leilão
        await db.query(
            'UPDATE leiloes SET status = "fechado", vencedor = ?, vencedor_id = ? WHERE id = ?',
            [vencedor, vencedorId, id]
        );
        
        // Criar notificação para o vencedor
        if (vencedorId) {
            await db.query(
                `INSERT INTO notificacoes (usuario_id, titulo, mensagem, tipo) 
                 VALUES (?, ?, ?, 'success')`,
                [vencedorId, '🏆 Você venceu!', `Você venceu o leilão de "${leilao.nome}" por R$ ${leilao.lance_atual}`]
            );
        }
        
        res.json({
            sucesso: true,
            mensagem: 'Leilão encerrado com sucesso!',
            vencedor
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao encerrar leilão' });
    }
});

// ==================== FAVORITOS ====================

// Adicionar/remover favorito
router.post('/favoritos/:leilaoId', autenticar, async (req, res) => {
    try {
        const { leilaoId } = req.params;
        const usuarioId = req.usuario.id;
        
        // Verificar se já é favorito
        const [existe] = await db.query(
            'SELECT id FROM favoritos WHERE usuario_id = ? AND leilao_id = ?',
            [usuarioId, leilaoId]
        );
        
        if (existe.length > 0) {
            // Remover favorito
            await db.query(
                'DELETE FROM favoritos WHERE usuario_id = ? AND leilao_id = ?',
                [usuarioId, leilaoId]
            );
            res.json({ sucesso: true, favoritado: false });
        } else {
            // Adicionar favorito
            await db.query(
                'INSERT INTO favoritos (usuario_id, leilao_id) VALUES (?, ?)',
                [usuarioId, leilaoId]
            );
            res.json({ sucesso: true, favoritado: true });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao gerenciar favorito' });
    }
});

// Listar favoritos do usuário
router.get('/favoritos', autenticar, async (req, res) => {
    try {
        const [favoritos] = await db.query(`
            SELECT l.* 
            FROM leiloes l
            INNER JOIN favoritos f ON l.id = f.leilao_id
            WHERE f.usuario_id = ?
            ORDER BY f.id DESC
        `, [req.usuario.id]);
        
        res.json(favoritos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar favoritos' });
    }
});

// ==================== NOTIFICAÇÕES ====================

// Buscar notificações do usuário
router.get('/notificacoes', autenticar, async (req, res) => {
    try {
        const [notificacoes] = await db.query(
            'SELECT * FROM notificacoes WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT 50',
            [req.usuario.id]
        );
        res.json(notificacoes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao buscar notificações' });
    }
});

// Marcar notificação como lida
router.put('/notificacoes/:id', autenticar, async (req, res) => {
    try {
        await db.query(
            'UPDATE notificacoes SET lida = TRUE WHERE id = ? AND usuario_id = ?',
            [req.params.id, req.usuario.id]
        );
        res.json({ sucesso: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao atualizar notificação' });
    }
});

// Criar notificação (para testes)
router.post('/notificacoes', autenticar, async (req, res) => {
    try {
        const { titulo, mensagem, tipo } = req.body;
        await db.query(
            'INSERT INTO notificacoes (usuario_id, titulo, mensagem, tipo) VALUES (?, ?, ?, ?)',
            [req.usuario.id, titulo, mensagem, tipo || 'info']
        );
        res.json({ sucesso: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ erro: 'Erro ao criar notificação' });
    }
});

module.exports = router;