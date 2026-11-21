import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';

export interface ValidatedLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

const LOCATION_CONSENT_TITLE = 'Consentimiento de Ubicación (UNINPAHU)';
const LOCATION_CONSENT_MESSAGE =
  'Inpa_Go utilizará tu ubicación GPS únicamente en este momento para verificar que te encuentras dentro de la geocerca autorizada de la sede UNINPAHU durante la sesión activa. Nunca se realiza rastreo en segundo plano.';

function requestExplicitLocationConsent(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return Promise.resolve(window.confirm(`${LOCATION_CONSENT_TITLE}\n\n${LOCATION_CONSENT_MESSAGE}`));
    }
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(LOCATION_CONSENT_TITLE, LOCATION_CONSENT_MESSAGE, [
      {
        text: 'Cancelar',
        style: 'cancel',
        onPress: () => resolve(false),
      },
      {
        text: 'Aceptar y continuar',
        onPress: () => resolve(true),
      },
    ]);
  });
}

export async function captureValidatedLocation(): Promise<ValidatedLocation> {
  const accepted = await requestExplicitLocationConsent();
  if (!accepted) {
    throw new Error('Se requiere tu consentimiento de ubicación para validar tu asistencia en la sede UNINPAHU.');
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error('Los servicios de ubicación (GPS) están desactivados en tu dispositivo.');
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Permiso de ubicación denegado. Actívalo en los ajustes del dispositivo para confirmar asistencia.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? 0,
    timestamp: position.timestamp,
  };
}
