import { useState, useEffect } from 'react';
import { Eye, EyeOff, Key, AlertCircle, CheckCircle, User, Database } from 'lucide-react';
import { supabase } from '../../../shared/services/supabase';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';
import Loader from '../../../shared/components/ui/Loader';
import Login from './Login';

type User = {
  id: string;
  full_name: string;
  email: string;
  password?: string;
  dni?: string;
  role: string;
  location_id?: string;
  phone?: string;
  status: 'active' | 'inactive';
  notes?: string;
  created_at: string;
  updated_at: string;
};

export default function PasswordSetup() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingPassword, setSettingPassword] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dni, setDni] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [passwordColumnExists, setPasswordColumnExists] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('full_name');

      if (error) {
        // Si el error es porque la columna password no existe
        if (error.message.includes('column "password" does not exist')) {
          setPasswordColumnExists(false);
          setError('');
        } else {
          console.error('Error fetching users:', error);
          setError('Error cargando usuarios');
        }
      } else {
        setUsers(data || []);
        setPasswordColumnExists(true);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (user: User) => {
    if (!password || !confirmPassword) {
      setError('Por favor completa ambos campos de contraseña');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (!dni.trim()) {
      setError('Por favor ingresa el DNI');
      return;
    }

    setSettingPassword(user.id);
    setError('');
    setSuccess('');

    try {
      // Actualizar contraseña y DNI en la tabla users
      const { error: updateError } = await supabase
        .from('users')
        .update({
          password: password,
          dni: dni.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        setError(`Error configurando contraseña: ${updateError.message}`);
        return;
      }

      setSuccess(`Contraseña y DNI configurados exitosamente para ${user.full_name}`);
      setPassword('');
      setConfirmPassword('');
      setDni('');

      // Actualizar la lista de usuarios
      await fetchUsers();
    } catch (err) {
      console.error('Error:', err);
      setError('Error inesperado configurando contraseña');
    } finally {
      setSettingPassword(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <LoadingSpinner minHeight="100vh" label="Cargando usuarios..." />
      </div>
    );
  }

  if (showLogin) {
    return <Login />;
  }

  if (!passwordColumnExists) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="bg-yellow-100 text-yellow-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Database size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Configuración de Base de Datos</h1>
            <p className="text-gray-600">Se requiere agregar una columna a la tabla users</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-2">Columna faltante</p>
                <p>La tabla <code className="bg-yellow-100 px-1 rounded">users</code> no tiene la columna <code className="bg-yellow-100 px-1 rounded">password</code> necesaria para la autenticación.</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Instrucciones:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Ve a tu <strong>Supabase Dashboard</strong></li>
              <li>Navega a <strong>Table Editor</strong></li>
              <li>Selecciona la tabla <code className="bg-gray-200 px-1 rounded">users</code></li>
              <li>Haz clic en <strong>"Add Column"</strong></li>
              <li>Configura la nueva columna:</li>
            </ol>

            <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-2">Configuración de la columna:</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div><strong>Name:</strong> password</div>
                <div><strong>Type:</strong> text</div>
                <div><strong>Default value:</strong> (dejar vacío)</div>
                <div><strong>Allow nullable:</strong> Sí</div>
              </div>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-800 mb-2">SQL alternativo:</h4>
              <code className="text-sm text-blue-700 bg-blue-100 px-2 py-1 rounded block">
                ALTER TABLE users ADD COLUMN password text;
              </code>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Recargar después de agregar la columna
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="bg-blue-100 text-blue-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Key size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Configuración de Contraseñas</h1>
            <p className="text-gray-600">Configura contraseñas para tus usuarios existentes</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg mb-6">
              <AlertCircle size={20} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg mb-6">
              <CheckCircle size={20} />
              <span className="text-sm">{success}</span>
            </div>
          )}

          <div className="space-y-4">
            {users.map((user) => (
              <div key={user.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                      <User size={20} className="text-slate-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">{user.full_name}</h3>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <span className="text-xs font-medium text-slate-500 mt-1">
                        {user.role === 'super_admin' ? 'Super Administrador' :
                          user.role === 'supervisores' ? 'Supervisor' :
                            user.role === 'sistemas' ? 'Sistemas' :
                              user.role === 'area_legal' ? 'Área Legal' :
                                'Usuario'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={dni}
                          onChange={(e) => setDni(e.target.value)}
                          placeholder="DNI"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-24"
                        />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Nueva contraseña"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirmar contraseña"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSetPassword(user)}
                      disabled={settingPassword === user.id || !password || !confirmPassword || !dni.trim()}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {settingPassword === user.id ? (
                        <>
                          <Loader size={16} />
                          Configurando...
                        </>
                      ) : (
                        <>
                          <Key size={16} />
                          Configurar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => setShowLogin(true)}
              className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-700 transition-colors mr-4"
            >
              Ir al Login
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Recargar Página
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
