import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, User, Mail, Shield, Eye, EyeOff } from 'lucide-react';
import { usuariosApi } from '../api/api';

const ROLES = [
  { value: 'gestor',    label: 'Gestor'    },
  { value: 'operador',  label: 'Operador'  },
  { value: 'viewer',   label: 'Visualizador' },
];

function badgeRole(role) {
  const map = {
    gestor:   'badge-blue',
    operador: 'badge-green',
    viewer:   'badge-gray',
    admin:    'badge-purple',
  };
  return <span className={`badge ${map[role] ?? 'badge-gray'}`}>{role}</span>;
}

export default function Usuarios() {
  const [usuarios,    setUsuarios]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando,    setEditando]    = useState(null);
  const [deletando,   setDeletando]   = useState(null);
  const [showPwd,     setShowPwd]     = useState(false);
  const [salvando,    setSalvando]    = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'operador', password: '', is_active: true });

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    setError(null);
    try {
      const data = await usuariosApi.listar();
      setUsuarios(Array.isArray(data) ? data : (data.items ?? []));
    } catch {
      setError('Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }

  function abrirAdicionar() {
    setEditando(null);
    setForm({ name: '', email: '', role: 'operador', password: '', is_active: true });
    setShowPwd(false);
    setModalAberto(true);
  }

  function abrirEditar(u) {
    setEditando(u);
    setForm({ name: u.name ?? u.username ?? '', email: u.email ?? '', role: u.role ?? 'operador', password: '', is_active: u.is_active ?? true });
    setShowPwd(false);
    setModalAberto(true);
  }

  async function salvar() {
    if (!form.name || !form.email) return;
    setSalvando(true);
    try {
      const payload = { name: form.name, email: form.email, role: form.role, is_active: form.is_active };
      if (form.password) payload.password = form.password;

      if (editando) {
        const updated = await usuariosApi.atualizar(editando.id, payload);
        setUsuarios(prev => prev.map(u => (u.id === editando.id ? updated : u)));
      } else {
        if (!form.password) { alert('Senha obrigatória para novo usuário.'); return; }
        const created = await usuariosApi.criar({ ...payload, password: form.password });
        setUsuarios(prev => [...prev, created]);
      }
      setModalAberto(false);
    } catch (e) {
      alert(`Erro ao salvar: ${e.message ?? 'desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarDelete(id) {
    try {
      await usuariosApi.deletar(id);
      setUsuarios(prev => prev.filter(u => u.id !== id));
    } catch (e) {
      alert(`Erro ao deletar: ${e.message}`);
    } finally {
      setDeletando(null);
    }
  }

  const totalAtivos   = usuarios.filter(u => u.is_active).length;
  const totalGestores = usuarios.filter(u => u.role === 'gestor').length;

  return (
    <div className="pg-wide">
      <div className="row-between flex-wrap gap-3">
        <div>
          <h1 className="pg-title">Usuários</h1>
          <p className="sec-sub">{usuarios.length} cadastrados · {totalAtivos} ativos · {totalGestores} gestores</p>
        </div>
        <button onClick={abrirAdicionar} className="btn-primary">
          <Plus size={16} /> Novo Usuário
        </button>
      </div>

      {loading && <p className="sec-sub text-center py-12">Carregando…</p>}
      {error   && <p className="text-err text-sm text-center py-8">{error}</p>}

      {!loading && !error && (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                {['Usuário', 'E-mail', 'Perfil', 'Status', 'Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {usuarios.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="row gap-2">
                      <div className="icon-box bg-blue-50">
                        <User size={14} className="text-blue-500" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{u.name ?? u.username}</p>
                        <p className="sec-sub text-xs">#{u.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="row gap-1.5 text-slate-600">
                      <Mail size={13} className="text-slate-400" />
                      {u.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">{badgeRole(u.role)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${u.is_active ? 'badge-ok' : 'badge-gray'}`}>
                      {u.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="row gap-2">
                      <button onClick={() => abrirEditar(u)} className="btn-icon" title="Editar">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeletando(u)} className="btn-icon text-err hover:bg-red-50" title="Remover">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {usuarios.length === 0 && (
            <p className="text-center sec-sub py-10">Nenhum usuário cadastrado.</p>
          )}
        </div>
      )}

      {modalAberto && (
        <div className="overlay">
          <div className="modal fade-in">
            <div className="modal-head">
              <h3 className="modal-title">
                <Shield size={18} className="text-brand" />
                {editando ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button onClick={() => setModalAberto(false)} className="btn-icon"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div className="field">
                <label className="label">Nome</label>
                <input className="input" placeholder="Nome completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">E-mail</label>
                <input className="input" type="email" placeholder="email@empresa.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">Perfil</label>
                <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">{editando ? 'Nova Senha (opcional)' : 'Senha'}</label>
                <div className="input-icon">
                  <input
                    className="input pr-10"
                    type={showPwd ? 'text' : 'password'}
                    placeholder={editando ? 'Deixe em branco para manter' : 'Senha'}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                  />
                  <button type="button" className="input-icon-btn" onClick={() => setShowPwd(v => !v)}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <label className="row gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                <span className="text-sm text-slate-700">Usuário ativo</span>
              </label>
            </div>

            <div className="modal-foot">
              <button onClick={() => setModalAberto(false)} className="btn-ghost">Cancelar</button>
              <button onClick={salvar} disabled={salvando || !form.name || !form.email} className="btn-primary disabled:opacity-50">
                {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletando && (
        <div className="overlay">
          <div className="modal-sm fade-in">
            <div className="row gap-3 mb-4">
              <div className="icon-box-lg bg-red-100"><Trash2 size={20} className="text-err" /></div>
              <div>
                <h3 className="font-semibold text-slate-800">Remover Usuário</h3>
                <p className="sec-sub">Tem certeza que deseja remover <strong>{deletando.name ?? deletando.username}</strong>?</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeletando(null)} className="btn-ghost">Cancelar</button>
              <button onClick={() => confirmarDelete(deletando.id)} className="btn bg-err text-white hover:bg-red-600">Remover</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
