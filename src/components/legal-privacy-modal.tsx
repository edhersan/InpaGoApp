import { useEffect, useState, type ReactElement } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type LegalTab = 'privacidad' | 'terminos' | 'arco';

export interface LegalPrivacyModalProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: LegalTab;
}

export const INSTITUTIONAL_PRIVACY_EMAIL = '[correo-oficial]';

export function buildArcoMailtoUrl(subject: string, body: string): string {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${INSTITUTIONAL_PRIVACY_EMAIL}?subject=${encodedSubject}&body=${encodedBody}`;
}

export function LegalPrivacyModal({
  visible,
  onClose,
  initialTab = 'privacidad',
}: LegalPrivacyModalProps): ReactElement {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
    }
  }, [initialTab, visible]);

  const handleOpenMailto = (subject: string, body: string): void => {
    void Linking.openURL(buildArcoMailtoUrl(subject, body));
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.brandSmall}>
                <Text style={styles.brandWhite}>Inpa_</Text>
                <Text style={styles.brandOrange}>Go</Text>
                <Text style={styles.headerSub}> · Legal y Privacidad</Text>
              </Text>
              <Text style={styles.headerCaption}>
                Ley 1581 de 2012 y Decreto 1377 de 2013 (Colombia)
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </Pressable>
          </View>

          <View style={styles.tabsRow}>
            {(
              [
                { key: 'privacidad', label: 'Privacidad' },
                { key: 'terminos', label: 'Términos' },
                { key: 'arco', label: 'Derechos ARCO' },
              ] as const
            ).map((tab) => (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.bodyContent}>
            {activeTab === 'privacidad' ? (
              <View style={styles.sectionStack}>
                <Text style={styles.heading}>Aviso de Privacidad (Habeas Data)</Text>
                <Text style={styles.paragraph}>
                  En cumplimiento de la Ley Estatutaria 1581 de 2012, el Decreto 1377 de 2013 y las
                  políticas de protección de datos de Google Play y App Store, la Fundación
                  Universitaria UNINPAHU (Bogotá D.C., Colombia) informa cómo trata los datos
                  personales recolectados en la aplicación institucional Inpa_Go.
                </Text>

                <Text style={styles.subheading}>1. Datos Biométricos Sensibles y Carácter Facultativo</Text>
                <Text style={styles.paragraph}>
                  Inpa_Go puede tratar datos sensibles de carácter biométrico consistentes en tu
                  fotografía facial de registro y el patrón espectral de tu voz (clip de 3 a 5
                  segundos) exclusivamente para validar tu identidad durante el control de
                  asistencia académica.
                </Text>
                <View style={styles.calloutBox}>
                  <Text style={styles.calloutTitle}>Carácter facultativo (Art. 6 Ley 1581 de 2012)</Text>
                  <Text style={styles.calloutText}>
                    No estás obligado(a) a autorizar el tratamiento de datos biométricos sensibles.
                    Si decides no otorgar esta autorización o la revocas posteriormente, cuentas con
                    la alternativa de registro manual de asistencia directamente con tu docente
                    (método MANUAL_DOCENTE) sin afectación a tus derechos académicos.
                  </Text>
                </View>

                <Text style={styles.subheading}>2. Geolocalización Puntual en Primer Plano</Text>
                <Text style={styles.paragraph}>
                  La ubicación GPS se solicita únicamente en primer plano y bajo demanda explícita
                  cuando confirmas asistencia en una sesión abierta, con el único fin de verificar
                  tu presencia dentro del radio de la geocerca de la sede UNINPAHU. Inpa_Go nunca
                  realiza rastreo en segundo plano y bloquea expresamente el permiso
                  ACCESS_BACKGROUND_LOCATION.
                </Text>

                <Text style={styles.subheading}>3. Transmisión Internacional y Almacenamiento en Nube</Text>
                <Text style={styles.paragraph}>
                  Para operar el servicio académico con alta disponibilidad, los datos y evidencias
                  se transmiten de forma cifrada hacia servidores en la nube administrados en
                  infraestructura de Vercel (API y almacenamiento privado Vercel Blob) y TiDB Cloud
                  (base de datos MySQL), garantizando estándares adecuados de protección y
                  confidencialidad.
                </Text>

                <Text style={styles.subheading}>4. Medidas de Seguridad Técnica</Text>
                <Text style={styles.paragraph}>
                  • Cifrado en tránsito mediante HTTPS/TLS en todas las comunicaciones.{'\n'}
                  • Integridad criptográfica mediante huella SHA-256 sobre fotografías y perfiles de
                  voz.{'\n'}
                  • Control de acceso basado en roles (RBAC: ADMIN_BIENESTAR, DOCENTE, ESTUDIANTE) y
                  autenticación JWT con tokens revocables y almacenamiento seguro en dispositivo.
                </Text>
              </View>
            ) : activeTab === 'terminos' ? (
              <View style={styles.sectionStack}>
                <Text style={styles.heading}>Términos de Uso de Inpa_Go</Text>
                <Text style={styles.paragraph}>
                  El uso de Inpa_Go está reservado exclusivamente a estudiantes, docentes y personal
                  de Bienestar Institucional de la Fundación Universitaria UNINPAHU para la gestión
                  y verificación de asistencia académica.
                </Text>

                <Text style={styles.subheading}>1. Obligaciones del Usuario</Text>
                <Text style={styles.paragraph}>
                  • Suministrar información veraz (documento, nombre completo y correo
                  institucional).{'\n'}
                  • Mantener la confidencialidad de tus credenciales y evitar compartir tu sesión.{'\n'}
                  • Abstenerte de suplantar identidad, manipular grabaciones de voz o alterar
                  coordenadas GPS.
                </Text>

                <Text style={styles.subheading}>2. Alternativa Manual y Continuidad Académica</Text>
                <Text style={styles.paragraph}>
                  En caso de fallas técnicas, falta de conectividad o negativa/revocatoria del
                  consentimiento para datos biométricos sensibles, el docente cuenta con el registro
                  manual (MANUAL_DOCENTE) para garantizar la toma de asistencia.
                </Text>

                <Text style={styles.subheading}>3. Propiedad Intelectual y Vigencia</Text>
                <Text style={styles.paragraph}>
                  La marca Inpa_Go, su identidad visual institucional y los reportes generados
                  pertenecen a la Fundación Universitaria UNINPAHU. UNINPAHU podrá actualizar estos
                  términos notificando oportunamente a través de la aplicación.
                </Text>
              </View>
            ) : (
              <View style={styles.sectionStack}>
                <Text style={styles.heading}>Contacto Institucional y Derechos ARCO</Text>
                <Text style={styles.paragraph}>
                  Como titular de tus datos personales tienes derecho a Conocer/Acceder, Actualizar,
                  Rectificar, Cancelar/Suprimir tus datos personales y Oponerte o Revocar la
                  autorización otorgada (incluyendo datos biométricos de voz y fotografía) en
                  cualquier momento.
                </Text>

                <View style={styles.contactCard}>
                  <Text style={styles.subheading}>Responsable del Tratamiento</Text>
                  <Text style={styles.paragraph}>
                    Fundación Universitaria UNINPAHU — Bienestar Institucional{'\n'}
                    Ciudad: Bogotá D.C., Colombia{'\n'}
                    Correo oficial de privacidad: {INSTITUTIONAL_PRIVACY_EMAIL}{'\n'}
                    Teléfono institucional: [telefono-oficial]{'\n'}
                    Dirección sede principal: [direccion-sede]
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    handleOpenMailto(
                      'Solicitud Derechos ARCO — Inpa_Go (Ley 1581 de 2012)',
                      'Cordial saludo,\n\nSolicito ejercer mis derechos ARCO (Acceso / Rectificación / Cancelación / Revocatoria de autorización biométrica) sobre mis datos registrados en Inpa_Go.\n\nNombre completo: \nDocumento: \nCorreo institucional: \nDetalle de la solicitud: '
                    )
                  }
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryBtnText}>Enviar Solicitud ARCO por Correo</Text>
                </Pressable>

                <Text style={styles.subheading}>Autoridad de Vigilancia en Colombia</Text>
                <Text style={styles.paragraph}>
                  Si consideras que tus derechos de protección de datos personales no han sido
                  atendidos conforme a la Ley 1581 de 2012, puedes presentar una queja ante la
                  Superintendencia de Industria y Comercio (SIC) de Colombia (www.sic.gov.co), una
                  vez agotado el trámite de consulta o reclamo ante el responsable del tratamiento.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 21, 47, 0.65)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: '88%',
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    backgroundColor: '#07152F',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleGroup: {
    flex: 1,
    gap: 2,
  },
  brandSmall: {
    fontSize: 15,
    fontWeight: '800',
  },
  brandWhite: {
    color: '#FFFFFF',
  },
  brandOrange: {
    color: '#F0440B',
  },
  headerSub: {
    color: '#CBD5E1',
    fontWeight: '600',
  },
  headerCaption: {
    color: '#94A3B8',
    fontSize: 11,
  },
  closeBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#07152F',
  },
  tabText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  bodyContent: {
    padding: 16,
  },
  sectionStack: {
    gap: 10,
  },
  heading: {
    color: '#07152F',
    fontSize: 17,
    fontWeight: '800',
  },
  subheading: {
    color: '#07152F',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  paragraph: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
  },
  calloutBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  calloutTitle: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '800',
  },
  calloutText: {
    color: '#92400E',
    fontSize: 12,
    lineHeight: 18,
  },
  contactCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  primaryBtn: {
    backgroundColor: '#F0440B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
