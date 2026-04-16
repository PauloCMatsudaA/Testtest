import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Activity, CheckCircle2, Shield } from 'lucide-react';
import CartaoEstatistica from '../components/StatCard';
import TabelaOcorrencias from '../components/OccurrenceTable';
import { PaginaCarregando } from '../components/LoadingSpinner';
import { dashboardApi, ocorrenciasApi } from '../api/api';
import { useNavigate } from 'react-router-dom';

const CORES_LINHA = {
  detection:   '#3b82f6',
  alert:       '#ef4444',
  system:      '#6b7280',
  connection:  '#8b5cf6',
};

const TEMPO_RELATIVO = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return `há ${diff}s`;
  if (diff < 3600)  return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
};

export default function Dashboard() {
  const navegar = useNavigate();

  const [metricas,   setMetricas]   = useState(null);
  const [recentes,   setRecentes]   = useState([]);
  const [logSistema, setLogSistema] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro,       setErro]       = useState(null);

  const buscarDados = useCallback(async () => {
    try {
      const [resMetricas, resOcorrencias] = await Promise.all([
        dashboardApi.metricas().catch(() => null),
        ocorrenciasApi.listar({ limit: 5, offset: 0 }).catch(() => null),
      ]);

      if (resMetricas?.data) {
        const d = resMetricas.data;
        setMetricas({
          totalOcorrencias:     d.total_occurrences   ?? d.total_ocorrencias   ?? 0,
          alertasAtivos:        d.active_alerts       ?? d.alertas_ativos      ?? 0,
          conformidade:         d.compliance_rate     ?? d.conformidade        ?? 0,
          camerasAtivas:        d.active_cameras      ?? d.cameras_ativas      ?? 0,
          tendenciaOcorrencias: d.trend_occurrences   ?? d.tendencia           ?? null,
          tendenciaAlertas:     d.trend_alerts        ?? null,
          tendenciaConformidade:d.trend_compliance    ?? null,
          tendenciaCameras:     d.trend_cameras       ?? null,
        });
      }

      if (resOcorrencias?.data) {
        const lista = Array.isArray(resOcorrencias.data)
          ? resOcorrencias.data
          : resOcorrencias.data.items ?? resOcorrencias.data.results ?? [];
        setRecentes(lista.slice(0, 5));
      }

      setLogSistema(prev => {
        const entrada = {
          id:   Date.now(),
          tipo: 'system',
          texto: 'Dashboard atualizado',
          hora: new Date().toISOString(),
          color: CORES_LINHA.system,
        };
        return [entrada, ...prev].slice(0, 20);
      });

      setErro(null);
    } catch (err) {
      console.error('[Dashboard] Erro:', err);
      setErro('Falha ao carregar dados. Verifique a conexão com o servidor.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscarDados();
    const id = setInterval(buscarDados, 30_000);
    return () => clearInterval(id);
  }, [buscarDados]);

  if (carregando) return <PaginaCarregando />;

  if (erro) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertTriangle size={48} className="text-err" />
        <p className="text-slate-600">{erro}</p>
        <button onClick={buscarDados} className="btn btn-primary">Tentar novamente</button>
      </div>
    );
  }

  const cartoes = [
    { titulo: 'Total Ocorrências', valor: metricas?.totalOcorrencias ?? 0, icone: AlertTriangle, cor: 'laranja', tendencia: metricas?.tendenciaOcorrencias },
    { titulo: 'Alertas Ativos',    valor: metricas?.alertasAtivos ?? 0,    icone: Activity,      cor: 'vermelho', tendencia: metricas?.tendenciaAlertas },
    { titulo: 'Conformidade',      valor: `${metricas?.conformidade ?? 0}%`, icone: CheckCircle2, cor: 'verde',   tendencia: metricas?.tendenciaConformidade },
    { titulo: 'Câmeras Ativas',    valor: metricas?.camerasAtivas ?? 0,    icone: Shield,        cor: 'azul',    tendencia: metricas?.tendenciaCameras },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cartoes.map(c => (
          <CartaoEstatistica key={c.titulo} {...c} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">Ocorrências Recentes</h2>
            <button onClick={() => navegar('/occurrences')} className="btn btn-ghost btn-sm">
              Ver todas →
            </button>
          </div>
          {recentes.length > 0
            ? <TabelaOcorrencias ocorrencias={recentes} compacto />
            : <p className="py-8 text-center text-sm text-slate-400">Nenhuma ocorrência recente.</p>
          }
        </div>

        <div className="card">
          <h2 className="section-title mb-4">Log do Sistema</h2>
          {logSistema.length === 0
            ? <p className="py-8 text-center text-sm text-slate-400">Sem atividade registrada.</p>
            : (
              <ul className="flex flex-col gap-2 text-sm">
                {logSistema.map(entrada => (
                  <li key={entrada.id} className="flex items-start gap-2">
                    <span
                      style={{ "--log-color": entrada.color }}
                      className="log-entry-label mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                    >
                      {entrada.tipo}
                    </span>
                    <div className="flex-1">
                      <p className="text-slate-700">{entrada.texto}</p>
                      <p className="text-xs text-slate-400">{TEMPO_RELATIVO(entrada.hora)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )
          }
        </div>
      </div>
    </div>
  );
}
