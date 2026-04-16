import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { FileText, Download, Calendar, RefreshCw, TrendingUp, AlertTriangle, Users, Shield } from 'lucide-react';
import { relatoriosApi } from '../api/api';
import { PaginaCarregando } from '../components/LoadingSpinner';

const CORES_GRAFICOS = ['#f97316', '#22c55e', '#ef4444', '#3b82f6', '#8b5cf6', '#f59e0b'];

const PERIODOS = [
  { rotulo: '7 dias',  valor: '7d'  },
  { rotulo: '30 dias', valor: '30d' },
  { rotulo: '90 dias', valor: '90d' },
  { rotulo: '1 ano',   valor: '1y'  },
];

const ABAS = [
  { id: 'overview',     rotulo: 'Visão Geral',    icone: TrendingUp    },
  { id: 'occurrences',  rotulo: 'Ocorrências',   icone: AlertTriangle },
  { id: 'compliance',   rotulo: 'Conformidade',  icone: Shield        },
  { id: 'personnel',    rotulo: 'Pessoal',        icone: Users         },
];

const CORES_LINHA = {
  detection:   '#3b82f6',
  alert:       '#ef4444',
  system:      '#6b7280',
  connection:  '#8b5cf6',
};

function tooltipPersonalizado({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ "--log-color": p.color }} className="log-entry-label">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

function SecaoVazioGrafico({ mensagem = 'Sem dados disponíveis' }) {
  return (
    <div className="flex h-64 items-center justify-center">
      <p className="text-sm text-slate-400">{mensagem}</p>
    </div>
  );
}

function CartaoPainelControl({ titulo, valor, descricao, icone: Icone, cor = 'brand' }) {
  const mapCor = {
    brand:  { bg: 'bg-orange-50', text: 'text-brand'    },
    green:  { bg: 'bg-green-50',  text: 'text-green-600' },
    red:    { bg: 'bg-red-50',    text: 'text-red-600'   },
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600'  },
  };
  const cores = mapCor[cor] || mapCor.brand;

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{titulo}</p>
        <div className={`rounded-lg p-2 ${cores.bg}`}>
          {Icone && <Icone size={16} className={cores.text} />}
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800">{valor}</p>
      {descricao && <p className="mt-1 text-xs text-slate-400">{descricao}</p>}
    </div>
  );
}

function AbaVisaoGeral({ dados }) {
  if (!dados) return <SecaoVazioGrafico />;

  const totais = dados.totals || dados.totais || {};
  const tendencias  = dados.trends   || dados.tendencias   || [];
  const porSetor    = dados.by_sector || dados.por_setor   || [];
  const porTipo     = dados.by_type   || dados.por_tipo    || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoPainelControl titulo="Total Ocorrências" valor={totais.total_occurrences ?? totais.total_ocorrencias ?? 0} descricao="No período selecionado" icone={AlertTriangle} cor="brand" />
        <CartaoPainelControl titulo="Alertas Críticos"   valor={totais.critical_alerts    ?? totais.alertas_criticos   ?? 0} descricao="Requerem atenção"     icone={AlertTriangle} cor="red"   />
        <CartaoPainelControl titulo="Taxa Conformidade"  valor={`${totais.compliance_rate  ?? totais.conformidade        ?? 0}%`} descricao="Média do período" icone={Shield}        cor="green" />
        <CartaoPainelControl titulo="Usuários Ativos"    valor={totais.active_users        ?? totais.usuarios_ativos     ?? 0} descricao="No período"           icone={Users}         cor="blue"  />
      </div>

      {tendencias.length > 0 && (
        <div className="card">
          <h3 className="section-title mb-4">Tendência de Ocorrências</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={tendencias}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={tooltipPersonalizado} />
              <Line type="monotone" dataKey="occurrences" stroke="#f97316" strokeWidth={2} dot={false} name="Ocorrências" />
              <Line type="monotone" dataKey="alerts"      stroke="#ef4444" strokeWidth={2} dot={false} name="Alertas"      />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {porSetor.length > 0 && (
          <div className="card">
            <h3 className="section-title mb-4">Por Setor</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={porSetor} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip content={tooltipPersonalizado} />
                <Bar dataKey="occurrences" fill="#f97316" radius={[0, 4, 4, 0]} name="Ocorrências" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {porTipo.length > 0 && (
          <div className="card">
            <h3 className="section-title mb-4">Por Tipo de EPI</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={porTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#94a3b8' }}>
                  {porTipo.map((_, i) => <Cell key={i} fill={CORES_GRAFICOS[i % CORES_GRAFICOS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function AbaOcorrencias({ dados }) {
  if (!dados) return <SecaoVazioGrafico />;

  const porDia    = dados.by_day        || dados.por_dia     || [];
  const porCamera = dados.by_camera     || dados.por_camera  || [];
  const porStatus = dados.by_status     || dados.por_status  || [];
  const logUlt    = dados.recent_log    || dados.log_recente || [];

  return (
    <div className="flex flex-col gap-6">
      {porDia.length > 0 && (
        <div className="card">
          <h3 className="section-title mb-4">Ocorrências por Dia</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porDia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={tooltipPersonalizado} />
              <Bar dataKey="total"    fill="#f97316" radius={[4, 4, 0, 0]} name="Total"      />
              <Bar dataKey="critical" fill="#ef4444" radius={[4, 4, 0, 0]} name="Crítico"   />
              <Bar dataKey="resolved" fill="#22c55e" radius={[4, 4, 0, 0]} name="Resolvido" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {porCamera.length > 0 && (
          <div className="card">
            <h3 className="section-title mb-4">Por Câmera</h3>
            <div className="flex flex-col gap-2">
              {porCamera.map((c, i) => {
                const w = Math.round((c.count / porCamera[0].count) * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-32 truncate text-sm text-slate-600">{c.name}</div>
                    <div className="flex-1">
                      <div className="h-3 rounded bg-slate-200" style={{ width: `${w}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs text-slate-500">{c.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {porStatus.length > 0 && (
          <div className="card">
            <h3 className="section-title mb-4">Por Status</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={porStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                  {porStatus.map((_, i) => <Cell key={i} fill={CORES_GRAFICOS[i % CORES_GRAFICOS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {logUlt.length > 0 && (
        <div className="card">
          <h3 className="section-title mb-4">Log de Atividade</h3>
          <ul className="flex flex-col gap-3 text-sm">
            {logUlt.map((entrada, i) => (
              <li key={i} className="flex items-start gap-3 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                <span
                  style={{ "--log-color": CORES_LINHA[entrada.type] || '#6b7280' }}
                  className="log-entry-label mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                >
                  {entrada.type}
                </span>
                <div>
                  <p className="text-slate-700">{entrada.message}</p>
                  <p className="text-xs text-slate-400">{entrada.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AbaConformidade({ dados }) {
  if (!dados) return <SecaoVazioGrafico />;

  const tendencia  = dados.trend        || dados.tendencia  || [];
  const porEpi     = dados.by_epi       || dados.por_epi    || [];
  const porSetor   = dados.by_sector    || dados.por_setor  || [];
  const media      = dados.average_rate ?? dados.media      ?? 0;
  const maisAlta   = dados.highest_rate ?? dados.mais_alta  ?? 0;
  const maisBaixa  = dados.lowest_rate  ?? dados.mais_baixa ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <CartaoPainelControl titulo="Taxa Média"       valor={`${media}%`}      descricao="Período selecionado" icone={Shield} cor="green" />
        <CartaoPainelControl titulo="Máximo Atingido"  valor={`${maisAlta}%`}   descricao="Melhor resultado"    icone={Shield} cor="blue"  />
        <CartaoPainelControl titulo="Mínimo Atingido"  valor={`${maisBaixa}%`}  descricao="Pior resultado"      icone={Shield} cor="red"   />
      </div>

      {tendencia.length > 0 && (
        <div className="card">
          <h3 className="section-title mb-4">Evolução da Conformidade</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={tendencia}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip content={tooltipPersonalizado} />
              <Line type="monotone" dataKey="rate" stroke="#22c55e" strokeWidth={2} dot={false} name="Conformidade" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {porEpi.length > 0 && (
          <div className="card">
            <h3 className="section-title mb-4">Por Tipo de EPI</h3>
            <div className="flex flex-col gap-3">
              {porEpi.map((e, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-28 truncate text-sm text-slate-600">{e.name}</div>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${e.rate}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-10 text-right text-xs font-medium text-slate-600">{e.rate}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {porSetor.length > 0 && (
          <div className="card">
            <h3 className="section-title mb-4">Por Setor</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porSetor} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip content={tooltipPersonalizado} />
                <Bar dataKey="rate" fill="#22c55e" radius={[0, 4, 4, 0]} name="Taxa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function AbaPessoal({ dados }) {
  if (!dados) return <SecaoVazioGrafico />;

  const ativos      = dados.active_users       ?? dados.usuarios_ativos   ?? 0;
  const eventos     = dados.total_events       ?? dados.total_eventos     ?? 0;
  const maisCump    = dados.most_compliant      || dados.mais_cumpridores  || [];
  const episAusentes = dados.missing_epis_users || dados.epi_ausentes     || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <CartaoPainelControl titulo="Usuários Ativos"  valor={ativos}  descricao="No período" icone={Users} cor="blue"  />
        <CartaoPainelControl titulo="Total de Eventos" valor={eventos} descricao="Detectados"  icone={Users} cor="brand" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {maisCump.length > 0 && (
          <div className="card">
            <h3 className="section-title mb-4">Mais Cumpridores</h3>
            <div className="flex flex-col gap-3">
              {maisCump.map((u, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-semibold text-brand">
                    {u.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.sector}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">{u.compliance_rate}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {episAusentes.length > 0 && (
          <div className="card">
            <h3 className="section-title mb-4">EPIs Ausentes (Top 5)</h3>
            <div className="flex flex-col gap-3">
              {episAusentes.slice(0, 5).map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">{e.name}</p>
                    <p className="text-xs text-slate-400">{e.sector}</p>
                  </div>
                  <div className="row gap-2 shrink-0">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(e.ausencias / episAusentes[0].ausencias) * 100}%`, backgroundColor: e.cor }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs font-medium text-slate-600">{e.ausencias}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Relatorios() {
  const [abaSelecionada, setAbaSelecionada] = useState('overview');
  const [periodo,        setPeriodo]        = useState('30d');
  const [dadosRelatorio, setDadosRelatorio] = useState(null);
  const [carregando,     setCarregando]     = useState(true);
  const [erro,           setErro]           = useState(null);
  const [exportando,     setExportando]     = useState(false);
  const abortRef = useRef(null);

  const buscarRelatorio = useCallback(async (aba, per) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setCarregando(true);
    setErro(null);

    try {
      const res = await relatoriosApi.obter(aba, per);
      setDadosRelatorio(res.data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[Relatórios] Erro:', err);
        setErro('Falha ao carregar relatório. Tente novamente.');
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscarRelatorio(abaSelecionada, periodo);
    return () => abortRef.current?.abort();
  }, [abaSelecionada, periodo, buscarRelatorio]);

  const exportarPDF = async () => {
    setExportando(true);
    try {
      const res  = await relatoriosApi.exportarPDF(abaSelecionada, periodo);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: `relatorio-${abaSelecionada}-${periodo}.pdf` });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Relatórios] Erro ao exportar:', err);
    } finally {
      setExportando(false);
    }
  };

  const renderAba = () => {
    if (carregando) return <PaginaCarregando />;
    if (erro)       return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <AlertTriangle size={32} className="text-err" />
        <p className="text-slate-600">{erro}</p>
        <button onClick={() => buscarRelatorio(abaSelecionada, periodo)} className="btn btn-primary btn-sm">Tentar novamente</button>
      </div>
    );
    switch (abaSelecionada) {
      case 'overview':    return <AbaVisaoGeral   dados={dadosRelatorio} />;
      case 'occurrences': return <AbaOcorrencias  dados={dadosRelatorio} />;
      case 'compliance':  return <AbaConformidade dados={dadosRelatorio} />;
      case 'personnel':   return <AbaPessoal       dados={dadosRelatorio} />;
      default:            return null;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="mt-1 text-sm text-slate-500">Analise dados e exporte relatórios detalhados.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Calendar size={15} className="text-slate-400" />
            <select
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
              className="border-none bg-transparent text-sm text-slate-700 focus:outline-none"
            >
              {PERIODOS.map(p => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
            </select>
          </div>
          <button onClick={() => buscarRelatorio(abaSelecionada, periodo)} className="btn btn-secondary btn-sm flex items-center gap-2">
            <RefreshCw size={14} />
            Atualizar
          </button>
          <button onClick={exportarPDF} disabled={exportando || carregando} className="btn btn-primary btn-sm flex items-center gap-2">
            {exportando ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            {exportando ? 'Exportando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      <div className="tabs">
        {ABAS.map(aba => (
          <button
            key={aba.id}
            onClick={() => setAbaSelecionada(aba.id)}
            className={`tab ${abaSelecionada === aba.id ? 'active' : ''}`}
          >
            <aba.icone size={15} />
            <span>{aba.rotulo}</span>
          </button>
        ))}
      </div>

      <div className="tab-content">
        {renderAba()}
      </div>

      <div className="card">
        <h2 className="section-title mb-3">Relatórios Salvos</h2>
        <div className="flex flex-col gap-2">
          {[
            { nome: 'Relatório Mensal - Março 2026',  data: '01/04/2026', tipo: 'PDF' },
            { nome: 'Relatório Semanal - Semana 13',  data: '31/03/2026', tipo: 'PDF' },
            { nome: 'Relatório de Conformidade Q1',   data: '01/04/2026', tipo: 'PDF' },
          ].map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-brand" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{r.nome}</p>
                  <p className="text-xs text-slate-400">Gerado em {r.data}</p>
                </div>
              </div>
              <button className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-d transition-colors">
                <Download size={13} /> {r.tipo}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
