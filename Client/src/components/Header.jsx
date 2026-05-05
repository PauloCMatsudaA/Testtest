import { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/Header.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Bell, Search, Menu } from 'lucide-react';
import { notificacoesApi } from '../api/api';

const POLLING_MS = 15_000;

export default function Cabecalho({ titulo, aoAbrirMenu }) {
  const { usuario } = useAuth();
  const navegar     = useNavigate();

  const [notifAberta,  setNotifAberta]  = useState(false);
  const [notificacoes, setNotificacoes] = useState([]);
  const [naoLidas,     setNaoLidas]     = useState(0);
  const intervalRef = useRef(null);

  const buscarNotificacoes = useCallback(async () => {
    try {
      const res   = await notificacoesApi.listar();
      const lista = res.data || [];
      setNotificacoes(lista);
      setNaoLidas(lista.filter(n => !n.lida).length);
    } catch (err) {
      const status = err?.response?.status;
      const msg    = err?.code || err?.message || 'sem conexão';
      console.warn('[Notificações] Erro ao buscar:', status ?? msg);
    }
  }, []);

  useEffect(() => {
    if (!usuario) return;
    buscarNotificacoes();
    intervalRef.current = setInterval(buscarNotificacoes, POLLING_MS);
    return () => clearInterval(intervalRef.current);
  }, [usuario, buscarNotificacoes]);

  const abrirPainel = async () => {
    const abrindo = !notifAberta;
    setNotifAberta(abrindo);
    if (abrindo && naoLidas > 0) {
      try {
        await notificacoesApi.marcarTodasLidas();
        setNaoLidas(0);
        setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
      } catch {}
    }
  };

  const tempoRelativo = (criado_em) => {
    const diff = Math.floor((Date.now() - new Date(criado_em).getTime()) / 1000);
    if (diff < 60)    return `há ${diff}s`;
    if (diff < 3600)  return `há ${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
    return `há ${Math.floor(diff / 86400)}d`;
  };

  const inicial      = usuario?.nome?.charAt(0) || usuario?.name?.charAt(0) || 'U';
  const primeiroNome = (usuario?.nome || usuario?.name || '').split(' ')[0];

  return (
    <header className="header">
      <div className="header-left">
        <button onClick={aoAbrirMenu} className="btn-icon" aria-label="Abrir menu">
          <Menu size={20} />
        </button>
        <h1 className="header-title">{titulo}</h1>
      </div>

      <div className="header-right">
        <div className="header-search">
          <Search size={15} className="search-icon" />
          <input type="text" placeholder="Buscar..." />
        </div>

        <div className="notif-wrapper">
          <button onClick={abrirPainel} className="btn-icon" aria-label="Notificações">
            <Bell size={20} />
            {naoLidas > 0 && (
              <span className="notif-badge">{naoLidas > 99 ? '99+' : naoLidas}</span>
            )}
          </button>

          {notifAberta && (
            <>
              <div className="notif-overlay" onClick={() => setNotifAberta(false)} />
              <div className="notif-dropdown card fade-in">
                <p className="notif-heading">Notificações</p>
                {notificacoes.length === 0 ? (
                  <p className="notif-empty">Nenhuma notificação</p>
                ) : (
                  <ul>
                    {notificacoes.slice(0, 10).map(n => (
                      <li key={n.id} className={`notif-item ${n.lida ? 'notif-item--lida' : ''}`}>
                        <span className={`notif-item-dot notif-dot--${n.tipo || 'info'}`} />
                        <div className="notif-item-content">
                          <p className="notif-item-text">{n.texto}</p>
                          <p className="notif-item-time">{tempoRelativo(n.criado_em)}</p>
                        </div>
                        {!n.lida && <span className="notif-unread-dot" />}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="notif-footer">
                  <button
                    className="notif-footer-btn"
                    onClick={() => { setNotifAberta(false); navegar('/notificacoes'); }}
                  >
                    Ver todas
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <button className="header-avatar-btn" onClick={() => navegar('/perfil')}>
          <div className="header-avatar">{inicial}</div>
          <span className="header-username">{primeiroNome}</span>
        </button>
      </div>
    </header>
  );
}
