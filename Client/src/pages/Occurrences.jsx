import { useState, useEffect, useCallback } from 'react';
import { Filter, X, ChevronLeft, ChevronRight, Search, RefreshCw } from 'lucide-react';
import TabelaOcorrencias from '../components/OccurrenceTable';
import BadgeStatus from '../components/AlertBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ocorrenciasApi } from '../api/api';

const STATUS_OPTS = [
  { value: '',             label: 'Todos'         },
  { value: 'conforme',     label: 'Conforme'      },
  { value: 'nao_conforme', label: 'Não Conforme'  },
];

function formatarDataModal(valor) {
  if (!valor) return '—';
  try {
    const d = typeof valor === 'string' ? parseISO(valor) : new Date(valor);
    return isValid(d) ? format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—';
  } catch {
    return '—';
  }
}

export default function Occurrences() {
  const [ocorrencias,  setOcorrencias]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [showFilters,  setShowFilters]  = useState(false);
  const [busca,        setBusca]        = useState('');
  const [filtros,      setFiltros]      = useState({ status: '', dataInicio: '', dataFim: '' });
  const [pagina,       setPagina]       = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalItems,   setTotalItems]   = useState(0);
  const [modalOc,      setModalOc]      = useState(null);

  const POR_PAGINA = 20;

  const carregar = useCallback(async (pag = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { skip: (pag - 1) * POR_PAGINA, limit: POR_PAGINA };
      if (filtros.status)     params.status     = filtros.status;
      if (filtros.dataInicio) params.start_date = filtros.dataInicio;
      if (filtros.dataFim)    params.end_date   = filtros.dataFim;

      const data = await ocorrenciasApi.listar(params);
      const lista = Array.isArray(data) ? data : (data.items ?? []);
      const total = data.total ?? lista.length;

      setOcorrencias(lista);
      setTotalItems(total);
      setTotalPaginas(Math.max(1, Math.ceil(total / POR_PAGINA)));
      setPagina(pag);
    } catch (e) {
      setError('Erro ao carregar ocorrências.');
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => { carregar(1); }, [carregar]);

  const ocFiltradas = ocorrencias.filter(oc => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      String(oc.camera_id ?? '').includes(q) ||
      String(oc.sector_id ?? '').includes(q) ||
      (oc.status ?? '').toLowerCase().includes(q) ||
      (oc.epi_detected ?? []).join(' ').toLowerCase().includes(q)
    );
  });

  const aplicarFiltros = (e) => {
    e.preventDefault();
    setShowFilters(false);
    carregar(1);
  };

  const limparFiltros = () => {
    setFiltros({ status: '', dataInicio: '', dataFim: '' });
    setBusca('');
    setShowFilters(false);
  };

  return (
    <div className="occurrences-page">
      <div className="occurrences-header">
        <div>
          <h1 className="occurrences-title">Ocorrências</h1>
          <p className="occurrences-subtitle">
            {totalItems > 0 ? `${totalItems} registros encontrados` : 'Monitoramento de conformidade'}
          </p>
        </div>
        <div className="occurrences-actions">
          <button className="btn-refresh" onClick={() => carregar(pagina)} title="Atualizar">
            <RefreshCw size={16} />
          </button>
          <button
            className={`btn-filter ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter size={16} />
            Filtros
          </button>
        </div>
      </div>

      {showFilters && (
        <form className="filtros-panel" onSubmit={aplicarFiltros}>
          <div className="filtros-grid">
            <div className="filtro-group">
              <label className="filtro-label">Busca local</label>
              <div className="input-icon">
                <Search size={14} className="input-icon-icon" />
                <input
                  className="filtro-input"
                  placeholder="Câmera, setor, EPI…"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>
            </div>

            <div className="filtro-group">
              <label className="filtro-label">Status</label>
              <select
                className="filtro-select"
                value={filtros.status}
                onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}
              >
                {STATUS_OPTS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="filtro-group">
              <label className="filtro-label">De</label>
              <input
                type="date"
                className="filtro-input"
                value={filtros.dataInicio}
                onChange={e => setFiltros(f => ({ ...f, dataInicio: e.target.value }))}
              />
            </div>

            <div className="filtro-group">
              <label className="filtro-label">Até</label>
              <input
                type="date"
                className="filtro-input"
                value={filtros.dataFim}
                onChange={e => setFiltros(f => ({ ...f, dataFim: e.target.value }))}
              />
            </div>
          </div>

          <div className="filtros-footer">
            <button type="button" className="btn-limpar" onClick={limparFiltros}>
              <X size={14} /> Limpar
            </button>
            <button type="submit" className="btn-aplicar">Aplicar filtros</button>
          </div>
        </form>
      )}

      {loading && (
        <div className="loading-container">
          <LoadingSpinner />
        </div>
      )}

      {error && !loading && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => carregar(pagina)}>Tentar novamente</button>
        </div>
      )}

      {!loading && !error && (
        <>
          <TabelaOcorrencias
            ocorrencias={ocFiltradas}
            onVerDetalhes={setModalOc}
          />

          {totalPaginas > 1 && (
            <div className="paginacao">
              <button
                className="btn-pag"
                onClick={() => carregar(pagina - 1)}
                disabled={pagina <= 1}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="paginacao-info">
                Página {pagina} de {totalPaginas}
              </span>
              <button
                className="btn-pag"
                onClick={() => carregar(pagina + 1)}
                disabled={pagina >= totalPaginas}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !error && ocFiltradas.length === 0 && (
        <div className="empty-state">
          <p>Nenhuma ocorrência encontrada.</p>
          {(filtros.status || filtros.dataInicio || filtros.dataFim || busca) && (
            <button className="btn-limpar-empty" onClick={limparFiltros}>
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {modalOc && (
        <div className="modal-overlay" onClick={() => setModalOc(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Ocorrência #{modalOc.id}</h2>
              <button className="modal-close" onClick={() => setModalOc(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-grid">
                <div className="modal-field">
                  <span className="modal-label">Status</span>
                  <BadgeStatus status={modalOc.status} />
                </div>
                <div className="modal-field">
                  <span className="modal-label">Data</span>
                  <span className="modal-value">{formatarDataModal(modalOc.timestamp)}</span>
                </div>
                <div className="modal-field">
                  <span className="modal-label">Câmera</span>
                  <span className="modal-value">{modalOc.camera_id ?? '—'}</span>
                </div>
                <div className="modal-field">
                  <span className="modal-label">Setor</span>
                  <span className="modal-value">{modalOc.sector_id ?? '—'}</span>
                </div>
                <div className="modal-field">
                  <span className="modal-label">Confiança</span>
                  <span className="modal-value">
                    {modalOc.confidence != null
                      ? `${(modalOc.confidence * 100).toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div className="modal-field modal-field--full">
                  <span className="modal-label">EPIs detectados</span>
                  <div className="modal-epis">
                    {modalOc.epi_detected?.length
                      ? modalOc.epi_detected.map(e => (
                          <span key={e} className="badge-epi">{e}</span>
                        ))
                      : <span className="modal-value">Nenhum</span>
                    }
                  </div>
                </div>
                {modalOc.image_path && (
                  <div className="modal-field modal-field--full">
                    <span className="modal-label">Imagem</span>
                    <img
                      src={`/api/occurrences/${modalOc.id}/image`}
                      alt="Frame da ocorrência"
                      className="modal-img"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
