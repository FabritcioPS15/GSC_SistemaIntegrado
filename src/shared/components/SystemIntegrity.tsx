import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, RefreshCw, Database, Users, Package, Camera, Wrench, Send, MapPin } from 'lucide-react';
import { generateIntegrityReport, syncAllAssetsIntegrity, cleanupOrphanedData } from '../services/sync';
import LoadingSpinner from './ui/LoadingSpinner';

interface IntegrityReport {
  summary: {
    totalAssets: number;
    totalLocations: number;
    totalUsers: number;
    totalCameras: number;
    totalMaintenanceRecords: number;
    totalShipments: number;
  };
  issues: {
    assetsWithoutLocation: number;
    assetsWithInconsistentStatus: number;
    maintenanceRecordsWithoutAssets: number;
    shipmentsWithoutAssets: number;
  };
  recommendations: string[];
}

export default function SystemIntegrity() {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadReport = async () => {
    setLoading(true);
    try {
      const integrityReport = await generateIntegrityReport();
      setReport(integrityReport);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading integrity report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await syncAllAssetsIntegrity();
      // Recargar el reporte después de la sincronización
      await loadReport();
    } catch (error) {
      console.error('Error syncing assets:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      await cleanupOrphanedData();
      // Recargar el reporte después de la limpieza
      await loadReport();
    } catch (error) {
      console.error('Error cleaning up data:', error);
    } finally {
      setCleaning(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const getTotalIssues = () => {
    if (!report) return 0;
    return Object.values(report.issues).reduce((sum, count) => sum + count, 0);
  };

  const getSystemHealth = () => {
    const totalIssues = getTotalIssues();
    if (totalIssues === 0) return 'excellent';
    if (totalIssues <= 5) return 'good';
    if (totalIssues <= 15) return 'warning';
    return 'critical';
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'excellent': return <CheckCircle className="text-green-600" />;
      case 'good': return <CheckCircle className="text-blue-600" />;
      case 'warning': return <AlertTriangle className="text-yellow-600" />;
      case 'critical': return <AlertTriangle className="text-red-600" />;
      default: return <AlertTriangle className="text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <LoadingSpinner minHeight="0" size={48} className="py-12" label="Cargando integridad del sistema..." />
      </div>
    );
  }

  const systemHealth = getSystemHealth();
  const totalIssues = getTotalIssues();

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <Database size={24} className="text-blue-700" />
            </div>
            <div>
              <h1 className="text-2xl font-normal text-gray-900">Integridad del Sistema</h1>
              <p className="text-gray-600">Monitoreo y sincronización de datos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadReport}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RefreshCw size={18} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Estado general del sistema */}
        <div className={`p-4 rounded-lg border ${getHealthColor(systemHealth)}`}>
          <div className="flex items-center gap-3">
            {getHealthIcon(systemHealth)}
            <div>
              <h3 className="font-normal">
                Estado del Sistema: {systemHealth === 'excellent' ? 'Excelente' :
                  systemHealth === 'good' ? 'Bueno' :
                    systemHealth === 'warning' ? 'Advertencia' : 'Crítico'}
              </h3>
              <p className="text-sm">
                {totalIssues === 0 ? 'No se encontraron problemas' :
                  `${totalIssues} problema${totalIssues > 1 ? 's' : ''} detectado${totalIssues > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {report && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Resumen del sistema */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-normal text-gray-900 mb-4">Resumen del Sistema</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Package size={20} className="text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Activos</p>
                  <p className="font-normal">{report.summary.totalAssets}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin size={20} className="text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Ubicaciones</p>
                  <p className="font-normal">{report.summary.totalLocations}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users size={20} className="text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Usuarios</p>
                  <p className="font-normal">{report.summary.totalUsers}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Camera size={20} className="text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">Cámaras</p>
                  <p className="font-normal">{report.summary.totalCameras}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Wrench size={20} className="text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">Mantenimientos</p>
                  <p className="font-normal">{report.summary.totalMaintenanceRecords}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Send size={20} className="text-red-600" />
                <div>
                  <p className="text-sm text-gray-600">Envíos</p>
                  <p className="font-normal">{report.summary.totalShipments}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Problemas detectados */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-normal text-gray-900 mb-4">Problemas Detectados</h2>
            <div className="space-y-3">
              {report.issues.assetsWithoutLocation > 0 && (
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-yellow-600" />
                    <span className="text-sm">Activos sin ubicación</span>
                  </div>
                  <span className="font-normal text-yellow-800">{report.issues.assetsWithoutLocation}</span>
                </div>
              )}
              {report.issues.assetsWithInconsistentStatus > 0 && (
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-orange-600" />
                    <span className="text-sm">Estados inconsistentes</span>
                  </div>
                  <span className="font-normal text-orange-800">{report.issues.assetsWithInconsistentStatus}</span>
                </div>
              )}
              {report.issues.maintenanceRecordsWithoutAssets > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-600" />
                    <span className="text-sm">Mantenimientos huérfanos</span>
                  </div>
                  <span className="font-normal text-red-800">{report.issues.maintenanceRecordsWithoutAssets}</span>
                </div>
              )}
              {report.issues.shipmentsWithoutAssets > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-600" />
                    <span className="text-sm">Envíos huérfanos</span>
                  </div>
                  <span className="font-normal text-red-800">{report.issues.shipmentsWithoutAssets}</span>
                </div>
              )}
              {totalIssues === 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle size={18} className="text-green-600" />
                  <span className="text-sm text-green-800">No se encontraron problemas</span>
                </div>
              )}
            </div>
          </div>

          {/* Recomendaciones */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
            <h2 className="text-lg font-normal text-gray-900 mb-4">Recomendaciones</h2>
            <div className="space-y-2">
              {report.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm text-blue-800">{recommendation}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
            <h2 className="text-lg font-normal text-gray-900 mb-4">Acciones del Sistema</h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSyncAll}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Sincronizando...' : 'Sincronizar Todo'}
              </button>
              <button
                onClick={handleCleanup}
                disabled={cleaning}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Database size={18} className={cleaning ? 'animate-spin' : ''} />
                {cleaning ? 'Limpiando...' : 'Limpiar Datos Huérfanos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lastUpdated && (
        <div className="mt-6 text-center text-sm text-gray-500">
          Última actualización: {lastUpdated.toLocaleString()}
        </div>
      )}

      <div className="mt-8 text-center">
        <p className="text-gray-300 text-xs opacity-50">Sistema realizado por: Fabritcio</p>
      </div>
    </div>
  );
}
