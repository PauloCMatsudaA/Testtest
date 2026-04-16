import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import '../styles/NavDrawer.css';
import {
  ShieldCheck, LayoutDashboard, AlertTriangle, FileBarChart,
  ClipboardList, Camera, Building2, Settings, LogOut, X, Users,
} from "lucide-react";

const itensMenu = [
  { rota: "/dashboard",    rotulo: "Dashboard",        Icone: LayoutDashboard },
  { rota: "/occurrences",  rotulo: "Ocorrências",       Icone: AlertTriangle   },
  { rota: "/reports",      rotulo: "Relatórios",        Icone: FileBarChart    },
  { rota: "/epi-requests", rotulo: "Solicitações EPI",  Icone: ClipboardList   },
  { rota: "/cameras",      rotulo: "Câmeras",           Icone: Camera         },
  { rota: "/sectors",      rotulo: "Setores",           Icone: Building2      },
  { rota: "/users",        rotulo: "Usuários",          Icone: Users          },
  { rota: "/settings",     rotulo: "Configurações",     Icone: Settings       },
];

export default function MenuGaveta({ aberto, aoFechar }) {
  const { usuario, sair } = useAuth();

  const inicial = usuario?.nome?.charAt(0) || usuario?.name?.charAt(0) || "U";
  const nome    = usuario?.nome || usuario?.name || "";
  const cargo   = usuario?.cargo || usuario?.role || "";

  return (
    <>
      <div
        aria-hidden="true"
        onClick={aoFechar}
        className={`nav-overlay ${aberto ? "open" : "closed"}`}
      />
      <nav aria-label="Menu de navegação" className={`nav-drawer ${aberto ? "open" : "closed"}`}>
        <div className="nav-header">
          <div className="nav-logo">
            <div className="nav-logo-icon">
              <ShieldCheck size={18} color="#fff" />
            </div>
            <span className="nav-logo-text">EPI<span>see</span></span>
          </div>
          <button onClick={aoFechar} className="nav-close" aria-label="Fechar menu">
            <X size={18} />
          </button>
        </div>

        <nav className="nav-menu">
          {itensMenu.map(({ rota, rotulo, Icone }) => (
            <NavLink
              key={rota}
              to={rota}
              onClick={aoFechar}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <Icone size={18} className="nav-item-icon" />
              <span>{rotulo}</span>
            </NavLink>
          ))}
        </nav>

        <div className="nav-footer">
          <div className="nav-user">
            <div className="nav-user-avatar">{inicial}</div>
            <div className="nav-notif-content">
              <p className="nav-user-name">{nome}</p>
              <p className="nav-user-role">{cargo}</p>
            </div>
          </div>
          <button onClick={sair} className="nav-logout">
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </nav>
    </>
  );
}
