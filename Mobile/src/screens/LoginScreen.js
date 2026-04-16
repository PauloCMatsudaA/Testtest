import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

const CORES = {
  primaria:   '#F97316',
  primariaEscura: '#EA6C0A',
  escura:     '#0F172A',
  slate700:   '#1E293B',
  slate600:   '#334155',
  slate400:   '#94A3B8',
  branco:     '#FFFFFF',
  erro:       '#EF4444',
  erroFundo:  '#FEE2E2',
  bordaCinza: '#E2E8F0',
};

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail]         = useState('');
  const [senha, setSenha]         = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro]           = useState('');

  const handleLogin = async () => {
    setErro('');

    if (!email.trim()) {
      setErro('Informe seu e-mail para continuar.');
      return;
    }
    if (!senha.trim()) {
      setErro('Informe sua senha para continuar.');
      return;
    }

    setCarregando(true);
    try {
      await login(email.trim().toLowerCase(), senha);
    } catch (err) {
      setErro(err.message || 'Credenciais inválidas. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  const preencherDemo = () => {
    setEmail('demo@episee.com');
    setSenha('123456');
    setErro('');
  };

  return (
    <LinearGradient
      colors={['#0F172A', '#1E293B', '#0F172A']}
      locations={[0, 0.5, 1]}
      style={estilos.gradiente}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={estilos.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={estilos.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={estilos.logoContainer}>
            <View style={estilos.logoAnel}>
              <View style={estilos.logoAnelInterno}>
                <Ionicons name="shield-checkmark" size={56} color={CORES.primaria} />
              </View>
            </View>
            <Text style={estilos.logoTexto}>EPIsee</Text>
            <Text style={estilos.tagline}>Sua segurança em primeiro lugar</Text>
          </View>

          <View style={estilos.card}>
            <Text style={estilos.cardTitulo}>Acessar minha conta</Text>

            <View style={estilos.campoContainer}>
              <Text style={estilos.campoLabel}>E-mail</Text>
              <View style={estilos.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color={CORES.slate400} style={estilos.inputIcone} />
                <TextInput
                  style={estilos.input}
                  placeholder="seu@email.com"
                  placeholderTextColor={CORES.slate400}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setErro(''); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!carregando}
                />
              </View>
            </View>

            <View style={estilos.campoContainer}>
              <Text style={estilos.campoLabel}>Senha</Text>
              <View style={estilos.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={CORES.slate400} style={estilos.inputIcone} />
                <TextInput
                  style={[estilos.input, { flex: 1 }]}
                  placeholder="Sua senha"
                  placeholderTextColor={CORES.slate400}
                  value={senha}
                  onChangeText={(t) => { setSenha(t); setErro(''); }}
                  secureTextEntry={!mostrarSenha}
                  autoCapitalize="none"
                  editable={!carregando}
                />
                <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)} style={estilos.olhoBtn}>
                  <Ionicons
                    name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={CORES.slate400}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {erro ? (
              <View style={estilos.erroContainer}>
                <Ionicons name="alert-circle-outline" size={16} color={CORES.erro} />
                <Text style={estilos.erroTexto}>{erro}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[estilos.botaoEntrar, carregando && estilos.botaoDesabilitado]}
              onPress={handleLogin}
              disabled={carregando}
              activeOpacity={0.85}
            >
              {carregando ? (
                <ActivityIndicator size="small" color={CORES.branco} />
              ) : (
                <Text style={estilos.botaoEntrarTexto}>Entrar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={estilos.botaoDemo} onPress={preencherDemo}>
              <Text style={estilos.botaoDemoTexto}>Usar credenciais de demo</Text>
            </TouchableOpacity>
          </View>

          <Text style={estilos.rodape}>EPIsee · Segurança do Trabalho</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const estilos = StyleSheet.create({
  gradiente: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoAnel: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  logoAnelInterno: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(249,115,22,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  logoTexto: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 6 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 10,
  },
  cardTitulo: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 20, textAlign: 'center' },
  campoContainer: { marginBottom: 16 },
  campoLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0',
    borderRadius: 12, paddingHorizontal: 12, height: 50,
    backgroundColor: '#F8FAFC',
  },
  inputIcone: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#0F172A', height: 50 },
  olhoBtn: { padding: 4 },
  erroContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEE2E2', borderRadius: 8,
    padding: 10, marginBottom: 12, gap: 6,
  },
  erroTexto: { fontSize: 13, color: '#EF4444', flex: 1 },
  botaoEntrar: {
    backgroundColor: '#F97316', borderRadius: 12,
    height: 52, justifyContent: 'center', alignItems: 'center',
    marginTop: 4,
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  botaoDesabilitado: { opacity: 0.7 },
  botaoEntrarTexto: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  botaoDemo: { marginTop: 14, alignItems: 'center', padding: 8 },
  botaoDemoTexto: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  rodape: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 24 },
});
